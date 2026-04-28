Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports System.Net
Imports System.Net.Http
Imports System.Text
Imports System.Threading
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Http
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Logging
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Namespace ApiServer.ElevenLabs

''' <summary>
''' Minimal API wiring for ElevenLabs ConvAI bridge (mounted on the existing ApiServer).
''' </summary>
Public NotInheritable Class ElevenLabsEndpoints

    Private Shared ReadOnly JsonReaderSettings As New JsonSerializerSettings With {
        .NullValueHandling = NullValueHandling.Ignore
    }

    Private Shared ReadOnly ElevenLabsApiHttp As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}

    Public Shared Sub MapElevenLabsRoutes(app As WebApplication)
        app.MapGet(
            "/elevenlabs/tts-models",
            Async Function(context As HttpContext) As Task
                Await HandleListTtsModels(context).ConfigureAwait(False)
            End Function)
        app.MapGet(
            "/elevenlabs/agents",
            Async Function(context As HttpContext) As Task
                Await HandleListAgents(context).ConfigureAwait(False)
            End Function)
        app.MapDelete(
            "/elevenlabs/agents/{agentId}",
            Async Function(context As HttpContext, agentId As String) As Task
                Await HandleDeleteAgent(context, agentId).ConfigureAwait(False)
            End Function)
        app.MapPost("/elevenlabs/createAgent", AddressOf HandleCreateAgent)
        app.MapPost("/elevenlabs/startAgent", AddressOf HandleStartAgent)
        app.MapPost("/elevenlabs/sendUserTurn", AddressOf HandleSendUserTurn)
        app.MapPost("/elevenlabs/agentTurn", AddressOf HandleAgentTurnWebhook)
        app.MapPost("/elevenlabs/endConversation", AddressOf HandleEndConversation)
        app.MapGet(
            "/elevenlabs/readPrompt/{conversationId}",
            Async Function(context As HttpContext, conversationId As String) As Task
                Await HandleReadPrompt(context, conversationId).ConfigureAwait(False)
            End Function)
    End Sub

    ''' <summary>
    ''' GET <c>/v1/models</c> verso ElevenLabs, solo modelli <c>model_id</c> che iniziano con <c>eleven_</c> (TTS ConvAI).
    ''' </summary>
    Private Shared Async Function HandleListTtsModels(context As HttpContext) As Task
        Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
        If String.IsNullOrWhiteSpace(apiKey) Then
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
            Await context.Response.WriteAsJsonAsync(New With {.error = "ELEVENLABS_API_KEY is not configured."}).ConfigureAwait(False)
            Return
        End If

        Dim apiBase = ElevenLabsApiSettings.GetApiBaseUrl()
        Dim url = $"{apiBase}/v1/models"
        Using req As New HttpRequestMessage(HttpMethod.Get, url)
            req.Headers.TryAddWithoutValidation("xi-api-key", apiKey.Trim())
            Using resp = Await ElevenLabsApiHttp.SendAsync(req, context.RequestAborted).ConfigureAwait(False)
                Dim body = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                If Not resp.IsSuccessStatusCode Then
                    context.Response.StatusCode = CInt(resp.StatusCode)
                    context.Response.ContentType = "application/json; charset=utf-8"
                    Await context.Response.WriteAsync(body).ConfigureAwait(False)
                    Return
                End If

                Dim tok = JToken.Parse(body)
                Dim arr As JArray = Nothing
                If tok.Type = JTokenType.Array Then
                    arr = DirectCast(tok, JArray)
                ElseIf tok.Type = JTokenType.Object Then
                    Dim inner = DirectCast(tok, JObject)("models")
                    If inner IsNot Nothing AndAlso inner.Type = JTokenType.Array Then
                        arr = DirectCast(inner, JArray)
                    End If
                End If

                Dim filtered As New List(Of Object)()
                If arr IsNot Nothing Then
                    For Each item In arr
                        Dim jo = TryCast(item, JObject)
                        If jo Is Nothing Then Continue For
                        Dim mid = jo("model_id")?.ToString()
                        If String.IsNullOrWhiteSpace(mid) Then Continue For
                        If Not mid.StartsWith("eleven_", StringComparison.OrdinalIgnoreCase) Then Continue For
                        Dim nm = jo("name")?.ToString()
                        filtered.Add(New With {
                            .model_id = mid.Trim(),
                            .name = If(nm, mid.Trim())
                        })
                    Next
                End If

                context.Response.StatusCode = StatusCodes.Status200OK
                Await context.Response.WriteAsJsonAsync(New With {.models = filtered}).ConfigureAwait(False)
            End Using
        End Using
    End Function

    ''' <summary>
    ''' Proxies POST <c>https://api.eu.residency.elevenlabs.io/v1/convai/agents/create</c> using <c>ELEVENLABS_API_KEY</c>.
    ''' Optional body: <c>{"name":"Display name"}</c>. Response: <c>{"agentId":"..."}</c>.
    ''' </summary>
    Private Shared Async Function HandleCreateAgent(context As HttpContext) As Task
        Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
        If String.IsNullOrWhiteSpace(apiKey) Then
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
            Await context.Response.WriteAsJsonAsync(New With {.error = "ELEVENLABS_API_KEY is not configured."}).ConfigureAwait(False)
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim displayName = "Omnia ConvAI agent"
        Dim requestObj As JObject = Nothing
        If Not String.IsNullOrWhiteSpace(body) Then
            Try
                requestObj = JObject.Parse(body)
                Dim n = requestObj("name")?.ToString()
                If Not String.IsNullOrWhiteSpace(n) Then displayName = n.Trim()
            Catch
            End Try
        End If

        Dim payload = BuildConvaiAgentCreatePayload(displayName)
        If requestObj IsNot Nothing Then
            MergeConvaiConversationConfigFromRequest(payload, requestObj)
        End If
        Dim apiBase = ElevenLabsApiSettings.GetApiBaseUrl()
        Dim url = $"{apiBase}/v1/convai/agents/create"

        Dim Logger = context.RequestServices.GetService(Of ILogger(Of ElevenLabsEndpoints))()
        If Logger IsNot Nothing Then
            Logger.LogInformation("ELEVENLABS CREATE PAYLOAD DEBUG: " & Newtonsoft.Json.JsonConvert.SerializeObject(payload, Newtonsoft.Json.Formatting.Indented))
        Else
            Global.System.Console.WriteLine("ELEVENLABS CREATE PAYLOAD DEBUG: " & Newtonsoft.Json.JsonConvert.SerializeObject(payload, Newtonsoft.Json.Formatting.Indented))
        End If

        Using req As New HttpRequestMessage(HttpMethod.Post, url)
            req.Headers.TryAddWithoutValidation("xi-api-key", apiKey.Trim())
            req.Content = New StringContent(payload.ToString(Formatting.None), Encoding.UTF8, "application/json")
            Using resp = Await ElevenLabsApiHttp.SendAsync(req, context.RequestAborted).ConfigureAwait(False)
                Dim respBody = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                If Not resp.IsSuccessStatusCode Then
                    Dim upstream = CInt(resp.StatusCode)
                    ' Surface 4xx from ElevenLabs (validation, auth, wrong region) instead of always 502.
                    Dim clientStatus = upstream
                    If upstream < CInt(HttpStatusCode.BadRequest) OrElse upstream >= 600 Then
                        clientStatus = StatusCodes.Status502BadGateway
                    ElseIf upstream >= CInt(HttpStatusCode.InternalServerError) Then
                        clientStatus = StatusCodes.Status502BadGateway
                    End If
                    context.Response.StatusCode = clientStatus
                    Await context.Response.WriteAsJsonAsync(New With {
                        .error = "ElevenLabs agents/create failed.",
                        .statusCode = upstream,
                        .elevenLabsApiBase = apiBase,
                        .details = respBody
                    }).ConfigureAwait(False)
                    Return
                End If

                Dim out = JObject.Parse(respBody)
                Dim agentId = out("agent_id")?.ToString()
                If String.IsNullOrWhiteSpace(agentId) Then agentId = out("agentId")?.ToString()
                If String.IsNullOrWhiteSpace(agentId) Then
                    context.Response.StatusCode = StatusCodes.Status502BadGateway
                    Await context.Response.WriteAsJsonAsync(New With {
                        .error = "ElevenLabs response missing agent_id.",
                        .elevenLabsApiBase = apiBase,
                        .details = respBody
                    }).ConfigureAwait(False)
                    Return
                End If

                context.Response.StatusCode = StatusCodes.Status200OK
                Await context.Response.WriteAsJsonAsync(New With {.agentId = agentId}).ConfigureAwait(False)
            End Using
        End Using
    End Function

    ''' <summary>Minimal JSON for ConvAI agent create (align with ElevenLabs API if schema changes).</summary>
    Private Shared Function BuildConvaiAgentCreatePayload(displayName As String) As JObject
        Return New JObject From {
            {"name", displayName},
            {"conversation_config", New JObject From {
                {"agent", New JObject From {
                    {"first_message", "Hello! How can I help you today?"},
                    {"language", "en"},
                    {"prompt", New JObject From {
                        {"prompt", ""},
                        {"llm", "gpt-4o"}
                    }}
                }}
            }}
        }
    End Function

    ''' <summary>
    ''' Deep-merge optional <c>conversation_config</c> from the HTTP body into the default Omnia payload
    ''' (voices, LLM model, prompts from the Studio / task IA Runtime UI).
    ''' </summary>
    Private Shared Sub MergeConvaiConversationConfigFromRequest(payload As JObject, requestObj As JObject)
        Dim overlay = requestObj("conversation_config")
        If overlay Is Nothing OrElse overlay.Type <> JTokenType.Object Then Return
        Dim overlayObj = DirectCast(overlay, JObject)
        Dim ccToken = payload("conversation_config")
        If ccToken Is Nothing OrElse ccToken.Type <> JTokenType.Object Then
            payload("conversation_config") = overlayObj.DeepClone()
            Return
        End If
        Dim baseCc = DirectCast(ccToken, JObject)
        baseCc.Merge(overlayObj, New JsonMergeSettings With {.MergeArrayHandling = MergeArrayHandling.Union})
    End Sub

    ''' <summary>
    ''' GET /elevenlabs/agents — proxy <c>GET /v1/convai/agents</c> (paginazione, query opzionale <c>search</c>).
    ''' In caso di eccezione (timeout, rete, ecc.) risponde sempre JSON strutturato invece di 500 generico senza dettaglio.
    ''' </summary>
    Private Shared Async Function HandleListAgents(context As HttpContext) As Task
        Dim fatalEx As Exception = Nothing
        Dim apiBaseLogged As String = ""
        Try
            Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
            If String.IsNullOrWhiteSpace(apiKey) Then
                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
                Await context.Response.WriteAsJsonAsync(New With {.error = "ELEVENLABS_API_KEY is not configured."}).ConfigureAwait(False)
                Return
            End If

            Dim apiBase = ElevenLabsApiSettings.GetApiBaseUrl()
            apiBaseLogged = apiBase
            Dim q = context.Request.Query
            Dim pageSize = q("page_size").ToString()
            If String.IsNullOrWhiteSpace(pageSize) Then pageSize = "30"
            Dim cursor = q("cursor").ToString()
            Dim search = q("search").ToString()

            Dim qParts As New List(Of String) From {
                "page_size=" & Uri.EscapeDataString(pageSize)
            }
            If Not String.IsNullOrWhiteSpace(cursor) Then qParts.Add("cursor=" & Uri.EscapeDataString(cursor))
            If Not String.IsNullOrWhiteSpace(search) Then qParts.Add("search=" & Uri.EscapeDataString(search))
            Dim url = apiBase.TrimEnd("/"c) & "/v1/convai/agents?" & String.Join("&", qParts)

            Using req As New HttpRequestMessage(HttpMethod.Get, url)
                req.Headers.TryAddWithoutValidation("xi-api-key", apiKey.Trim())
                Using resp = Await ElevenLabsApiHttp.SendAsync(req, context.RequestAborted).ConfigureAwait(False)
                    Dim respBody = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                    context.Response.StatusCode = CInt(resp.StatusCode)
                    context.Response.ContentType = "application/json; charset=utf-8"
                    Await context.Response.WriteAsync(respBody).ConfigureAwait(False)
                End Using
            End Using
        Catch ex As Exception
            fatalEx = ex
        End Try

        If fatalEx Is Nothing Then Return
        If context.Response.HasStarted Then Return

        Global.System.Console.WriteLine($"[ElevenLabs] HandleListAgents FATAL: {fatalEx}")
        context.Response.StatusCode = StatusCodes.Status500InternalServerError
        context.Response.ContentType = "application/json; charset=utf-8"
        Await context.Response.WriteAsJsonAsync(New With {
            .error = "ElevenLabs list agents failed (ApiServer / upstream).",
            .phase = "listAgents",
            .detail = fatalEx.Message,
            .elevenLabsApiBase = apiBaseLogged,
            .details = fatalEx.ToString()
        }).ConfigureAwait(False)
    End Function

    ''' <summary>
    ''' DELETE /elevenlabs/agents/{agentId} — proxy <c>DELETE /v1/convai/agents/{agent_id}</c>.
    ''' </summary>
    Private Shared Async Function HandleDeleteAgent(context As HttpContext, agentId As String) As Task
        Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
        If String.IsNullOrWhiteSpace(apiKey) Then
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
            Await context.Response.WriteAsJsonAsync(New With {.error = "ELEVENLABS_API_KEY is not configured."}).ConfigureAwait(False)
            Return
        End If

        Dim id = If(agentId, "").Trim()
        If String.IsNullOrWhiteSpace(id) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "agentId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim apiBase = ElevenLabsApiSettings.GetApiBaseUrl()
        Dim enc = Uri.EscapeDataString(id)
        Dim url = $"{apiBase}/v1/convai/agents/{enc}"

        Using req As New HttpRequestMessage(HttpMethod.Delete, url)
            req.Headers.TryAddWithoutValidation("xi-api-key", apiKey.Trim())
            Using resp = Await ElevenLabsApiHttp.SendAsync(req, context.RequestAborted).ConfigureAwait(False)
                Dim respBody = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                If Not resp.IsSuccessStatusCode Then
                    Dim upstream = CInt(resp.StatusCode)
                    Dim clientStatus = upstream
                    If upstream < CInt(HttpStatusCode.BadRequest) OrElse upstream >= 600 Then
                        clientStatus = StatusCodes.Status502BadGateway
                    ElseIf upstream >= CInt(HttpStatusCode.InternalServerError) Then
                        clientStatus = StatusCodes.Status502BadGateway
                    End If
                    context.Response.StatusCode = clientStatus
                    Await context.Response.WriteAsJsonAsync(New With {
                        .error = "ElevenLabs agents/delete failed.",
                        .statusCode = upstream,
                        .elevenLabsApiBase = apiBase,
                        .details = respBody
                    }).ConfigureAwait(False)
                    Return
                End If

                context.Response.StatusCode = StatusCodes.Status200OK
                If Not String.IsNullOrWhiteSpace(respBody) Then
                    context.Response.ContentType = "application/json; charset=utf-8"
                    Await context.Response.WriteAsync(respBody).ConfigureAwait(False)
                Else
                    Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
                End If
            End Using
        End Using
    End Function

    ''' <summary>
    ''' POST /elevenlabs/startAgent — wrapper con catch globale: sempre JSON strutturato in errore (mai 500 vuoto senza body).
    ''' </summary>
    Private Shared Async Function HandleStartAgent(context As HttpContext) As Task
        Dim fatalEx As Exception = Nothing
        Try
            Await HandleStartAgentCore(context).ConfigureAwait(False)
        Catch ex As Exception
            Global.System.Console.WriteLine($"[ElevenLabs] HandleStartAgent FATAL: {ex}")
            fatalEx = ex
        End Try
        If fatalEx Is Nothing Then Return
        If context.Response.HasStarted Then Return
        Dim fatal As New Dictionary(Of String, Object) From {
            {"error", fatalEx.Message},
            {"phase", "startAgent"},
            {"httpStatus", StatusCodes.Status500InternalServerError},
            {"detail", fatalEx.ToString()}
        }
        Dim upFatal = TryCast(fatalEx, ElevenLabsUpstreamHttpException)
        If upFatal Is Nothing AndAlso fatalEx.InnerException IsNot Nothing Then
            upFatal = TryCast(fatalEx.InnerException, ElevenLabsUpstreamHttpException)
        End If
        If upFatal IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(upFatal.ResponseBody) Then
            fatal("elevenlabsRawBody") = upFatal.ResponseBody
        End If
        context.Response.StatusCode = StatusCodes.Status500InternalServerError
        Await context.Response.WriteAsJsonAsync(fatal).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleStartAgentCore(context As HttpContext) As Task
        Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
        If String.IsNullOrWhiteSpace(apiKey) Then
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
            Await context.Response.WriteAsJsonAsync(New With {
                .error = "ELEVENLABS_API_KEY is not configured.",
                .phase = "startAgent",
                .httpStatus = StatusCodes.Status503ServiceUnavailable
            }).ConfigureAwait(False)
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req As ElevenLabsStartAgentRequest = Nothing
        Dim deserializeEx As Exception = Nothing
        Try
            req = JsonConvert.DeserializeObject(Of ElevenLabsStartAgentRequest)(body, JsonReaderSettings)
        Catch ex As Exception
            deserializeEx = ex
        End Try
        If deserializeEx IsNot Nothing Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {
                .error = "Invalid JSON body for startAgent.",
                .phase = "startAgent",
                .httpStatus = StatusCodes.Status400BadRequest,
                .detail = deserializeEx.Message
            }).ConfigureAwait(False)
            Return
        End If

        Global.System.Console.WriteLine($"[ElevenLabs] startAgent inbound bodyChars={body.Length} agentIdChars={If(req?.AgentId?.Length, 0)}")

        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.AgentId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {
                .error = "agentId is required.",
                .phase = "startAgent",
                .httpStatus = StatusCodes.Status400BadRequest
            }).ConfigureAwait(False)
            Return
        End If

        Dim omniaId = Guid.NewGuid().ToString("N")
        Dim session As New ElevenLabsHostedSession(omniaId)
        ElevenLabsSessionRegistry.TryRegister(session)

        Dim dyn = If(req.DynamicVariables, New Dictionary(Of String, Object)())
        Dim runner As New ElevenLabsWebSocketRunner(req.AgentId.Trim(), apiKey.Trim(), dyn, session.Queue, $"[ElevenLabs:{omniaId}]")

        Dim connectFailed As Boolean = False
        Dim failMessage As String = Nothing
        Dim elevenlabsRawBody As String = Nothing
        Try
            Await runner.ConnectAndRunReceiveLoopAsync(context.RequestAborted).ConfigureAwait(False)
            session.Runner = runner
        Catch ex As Exception
            ElevenLabsSessionRegistry.Remove(omniaId)
            connectFailed = True
            failMessage = ex.Message
            Dim up = TryCast(ex, ElevenLabsUpstreamHttpException)
            If up IsNot Nothing Then
                elevenlabsRawBody = up.ResponseBody
            End If
            runner.Dispose()
        End Try

        If connectFailed Then
            context.Response.StatusCode = StatusCodes.Status502BadGateway
            Await context.Response.WriteAsJsonAsync(New With {
                .error = failMessage,
                .phase = "startAgent",
                .httpStatus = StatusCodes.Status502BadGateway,
                .elevenlabsRawBody = elevenlabsRawBody,
                .details = failMessage
            }).ConfigureAwait(False)
            Return
        End If

        Global.System.Console.WriteLine($"[ElevenLabs] startAgent OK conversationId={omniaId} agentIdChars={req.AgentId.Trim().Length}")

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.conversationId = omniaId}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleSendUserTurn(context As HttpContext) As Task
        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsSendUserTurnRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        If session.Runner Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status409Conflict
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation has no active runner."}).ConfigureAwait(False)
            Return
        End If

        Dim sendFailed As Boolean = False
        Dim sendErr As String = Nothing
        Try
            Await session.Runner.SendUserMessageAsync(If(req.Text, ""), context.RequestAborted).ConfigureAwait(False)
            session.Status = "running"
        Catch ex As Exception
            sendFailed = True
            sendErr = ex.Message
        End Try

        If sendFailed Then
            context.Response.StatusCode = StatusCodes.Status502BadGateway
            Await context.Response.WriteAsJsonAsync(New With {.error = sendErr}).ConfigureAwait(False)
            Return
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleAgentTurnWebhook(context As HttpContext) As Task
        If Not ValidateWebhookSecret(context) Then
            context.Response.StatusCode = StatusCodes.Status401Unauthorized
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsAgentTurnWebhookRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        Dim isFinal = False
        If req.IsFinal.HasValue Then
            isFinal = req.IsFinal.Value
        ElseIf Not String.IsNullOrEmpty(req.Status) Then
            isFinal = req.Status.Equals("completed", StringComparison.OrdinalIgnoreCase)
        End If

        session.Queue.Enqueue(New ElevenLabsAgentTurnPayload With {
            .Text = If(req.Text, ""),
            .Status = If(isFinal, "completed", "running")
        })
        If isFinal Then
            session.Status = "completed"
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleEndConversation(context As HttpContext) As Task
        If Not ValidateWebhookSecret(context) Then
            context.Response.StatusCode = StatusCodes.Status401Unauthorized
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsEndConversationRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        session.Status = "completed"
        session.Queue.Enqueue(New ElevenLabsAgentTurnPayload With {.Text = "", .Status = "completed"})
        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleReadPrompt(context As HttpContext, conversationId As String) As Task
        If String.IsNullOrWhiteSpace(conversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(conversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        Dim timeoutSeconds = 120
        Dim rawTimeout = Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_READ_PROMPT_TIMEOUT_SECONDS")
        If Not String.IsNullOrWhiteSpace(rawTimeout) Then
            Integer.TryParse(rawTimeout, timeoutSeconds)
        End If

        Dim timedOut As Boolean = False
        Dim turn As ElevenLabsAgentTurnPayload = Nothing

        Using cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted)
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(5, timeoutSeconds)))
            Try
                turn = Await session.Queue.DequeueAsync(cts.Token).ConfigureAwait(False)
            Catch ex As OperationCanceledException
                timedOut = True
            End Try
        End Using

        If timedOut Then
            context.Response.StatusCode = StatusCodes.Status408RequestTimeout
            Await context.Response.WriteAsJsonAsync(New With {.error = "timeout waiting for agent turn."}).ConfigureAwait(False)
            Return
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {
            .agentTurn = turn.Text,
            .status = turn.Status
        }).ConfigureAwait(False)
    End Function

    Private Shared Function ValidateWebhookSecret(context As HttpContext) As Boolean
        Dim expected = Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_WEBHOOK_SECRET")
        If String.IsNullOrWhiteSpace(expected) Then Return True
        Dim headerName = If(Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_WEBHOOK_HEADER"), "X-Omnia-Webhook-Secret")
        Dim provided = context.Request.Headers(headerName).ToString()
        Return String.Equals(provided, expected, StringComparison.Ordinal)
    End Function
End Class

End Namespace
