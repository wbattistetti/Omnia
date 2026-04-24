Option Strict On
Option Explicit On

Imports System.IO
Imports System.Net.Http
Imports System.Net.WebSockets
Imports System.Text
Imports System.Threading
Imports System.Threading.Tasks
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Namespace ApiServer.ElevenLabs

''' <summary>
''' Maintains one ConvAI WebSocket connection for a hosted Omnia conversation; forwards agent text into <see cref="ElevenLabsTurnQueue"/>.
''' </summary>
Public NotInheritable Class ElevenLabsWebSocketRunner
    Implements IDisposable

    Private Shared ReadOnly Http As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}
    Private ReadOnly _agentId As String
    Private ReadOnly _apiKey As String
    Private ReadOnly _dynamicVars As Dictionary(Of String, Object)
    Private ReadOnly _queue As ElevenLabsTurnQueue
    Private ReadOnly _logPrefix As String

    Private _ws As ClientWebSocket
    Private _cts As CancellationTokenSource
    Private _receiveTask As Task
    Private _externalConversationId As String
    Private _disposed As Boolean

    Public Sub New(agentId As String, apiKey As String, dynamicVars As Dictionary(Of String, Object), queue As ElevenLabsTurnQueue, optionalLogPrefix As String)
        If String.IsNullOrWhiteSpace(agentId) Then Throw New ArgumentException("agentId is required.", NameOf(agentId))
        If String.IsNullOrWhiteSpace(apiKey) Then Throw New ArgumentException("apiKey is required.", NameOf(apiKey))
        _agentId = agentId.Trim()
        _apiKey = apiKey.Trim()
        _dynamicVars = If(dynamicVars, New Dictionary(Of String, Object)())
        _queue = If(queue, New ElevenLabsTurnQueue())
        _logPrefix = If(optionalLogPrefix, "[ElevenLabs]")
    End Sub

    Public ReadOnly Property ExternalConversationId As String
        Get
            Return _externalConversationId
        End Get
    End Property

    Public Async Function ConnectAndRunReceiveLoopAsync(ct As CancellationToken) As Task
        Dim signedUrl = Await FetchSignedWebSocketUrlAsync(_agentId, _apiKey, ct).ConfigureAwait(False)
        If String.IsNullOrWhiteSpace(signedUrl) Then
            Throw New InvalidOperationException("ElevenLabs returned an empty signed_url.")
        End If

        _cts = CancellationTokenSource.CreateLinkedTokenSource(ct)
        Dim token = _cts.Token

        _ws = New ClientWebSocket()
        Dim uri = New Uri(signedUrl)
        Await _ws.ConnectAsync(uri, token).ConfigureAwait(False)

        Dim initiation = BuildConversationInitiationJson(_dynamicVars)
        Await SendRawTextAsync(initiation, token).ConfigureAwait(False)

        _receiveTask = Task.Run(Function() ReceiveLoopAsync(token), token)
    End Function

    Public Async Function SendUserMessageAsync(userText As String, ct As CancellationToken) As Task
        If _ws Is Nothing OrElse _ws.State <> WebSocketState.Open Then
            Throw New InvalidOperationException("ElevenLabs WebSocket is not connected.")
        End If
        Dim jo As New JObject From {
            {"type", "user_message"},
            {"text", If(userText, "")}
        }
        Await SendRawTextAsync(jo.ToString(Formatting.None), ct).ConfigureAwait(False)
    End Function

    Private Async Function ReceiveLoopAsync(ct As CancellationToken) As Task
        Dim buffer As Byte() = New Byte(16383) {}
        Dim ms As New MemoryStream()
        Try
            While _ws IsNot Nothing AndAlso _ws.State = WebSocketState.Open AndAlso Not ct.IsCancellationRequested
                Dim seg As New ArraySegment(Of Byte)(buffer)
                Dim result = Await _ws.ReceiveAsync(seg, ct).ConfigureAwait(False)
                If result.MessageType = WebSocketMessageType.Close Then
                    Exit While
                End If
                ms.Write(buffer, 0, result.Count)
                If result.EndOfMessage Then
                    Dim jsonText = Encoding.UTF8.GetString(ms.ToArray())
                    ms.SetLength(0)
                    Await HandleIncomingJsonAsync(jsonText, ct).ConfigureAwait(False)
                End If
            End While
        Catch ex As OperationCanceledException
            ' Expected on shutdown.
        Catch ex As Exception
            Console.WriteLine($"{_logPrefix} ReceiveLoop error: {ex.Message}")
            _queue.Enqueue(New ElevenLabsAgentTurnPayload With {
                .Text = "",
                .Status = "completed"
            })
        End Try
    End Function

    Private Async Function HandleIncomingJsonAsync(jsonText As String, ct As CancellationToken) As Task
        If String.IsNullOrWhiteSpace(jsonText) Then Return

        Dim jo As JObject
        Try
            jo = JObject.Parse(jsonText)
        Catch
            Return
        End Try

        Dim typ = jo("type")?.ToString()
        If String.IsNullOrEmpty(typ) Then Return

        If typ.IndexOf("user_transcript", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            (typ.StartsWith("user_", StringComparison.OrdinalIgnoreCase) AndAlso typ.IndexOf("agent", StringComparison.OrdinalIgnoreCase) < 0) Then
            Return
        End If

        If typ.Equals("ping", StringComparison.OrdinalIgnoreCase) Then
            Await ReplyPongAsync(jo, ct).ConfigureAwait(False)
            Return
        End If

        If typ.IndexOf("conversation_initiation_metadata", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            typ.Equals("conversation_initiation_metadata", StringComparison.OrdinalIgnoreCase) Then
            Dim meta = jo("conversation_initiation_metadata_event")
            If meta Is Nothing Then meta = jo("conversation_initiation_metadata")
            Dim cid = meta?("conversation_id")?.ToString()
            If Not String.IsNullOrEmpty(cid) Then
                _externalConversationId = cid
            End If
            Return
        End If

        Dim agentText As String = Nothing
        Dim isFinal As Boolean = False
        If TryExtractAgentText(jo, agentText, isFinal) Then
            If Not String.IsNullOrWhiteSpace(agentText) Then
                _queue.Enqueue(New ElevenLabsAgentTurnPayload With {
                    .Text = agentText.Trim(),
                    .Status = If(isFinal, "completed", "running")
                })
            ElseIf isFinal Then
                _queue.Enqueue(New ElevenLabsAgentTurnPayload With {.Text = "", .Status = "completed"})
            End If
        End If
    End Function

    Private Shared Function TryExtractAgentText(jo As JObject, ByRef textOut As String, ByRef isFinalOut As Boolean) As Boolean
        textOut = Nothing
        isFinalOut = False
        Dim typ = jo("type")?.ToString()
        If String.IsNullOrEmpty(typ) Then Return False

        If typ.IndexOf("agent", StringComparison.OrdinalIgnoreCase) >= 0 Then
            Dim t1 = jo("agent_response")?.ToString()
            If Not String.IsNullOrEmpty(t1) Then textOut = t1 : Return True
            Dim are = jo("agent_response_event")
            If are IsNot Nothing Then
                Dim s = are("agent_response")?.ToString()
                If String.IsNullOrEmpty(s) Then s = are("text")?.ToString()
                If Not String.IsNullOrEmpty(s) Then textOut = s : Return True
            End If
            Dim t2 = jo("text")?.ToString()
            If Not String.IsNullOrEmpty(t2) Then textOut = t2 : Return True
            Dim t3 = jo("message")?.ToString()
            If Not String.IsNullOrEmpty(t3) Then textOut = t3 : Return True
            Dim are2 = jo("agent_response_event")
            If are2 IsNot Nothing Then
                Dim partTok = are2("text")
                Dim part = If(partTok Is Nothing, Nothing, partTok.ToString())
                If Not String.IsNullOrEmpty(part) Then textOut = part : Return True
            End If
        End If

        If typ.IndexOf("end", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            typ.IndexOf("completed", StringComparison.OrdinalIgnoreCase) >= 0 Then
            isFinalOut = True
            Return True
        End If

        Return False
    End Function

    Private Async Function ReplyPongAsync(pingJo As JObject, ct As CancellationToken) As Task
        Dim pingEvent = pingJo("ping_event")
        Dim ev As JToken = Nothing
        If pingEvent IsNot Nothing Then
            ev = pingEvent("event_id")
        End If
        Dim pong As New JObject From {
            {"type", "pong"}
        }
        If ev IsNot Nothing Then
            pong("event_id") = ev
        End If
        Await SendRawTextAsync(pong.ToString(Formatting.None), ct).ConfigureAwait(False)
    End Function

    Private Async Function SendRawTextAsync(text As String, ct As CancellationToken) As Task
        If _ws Is Nothing OrElse _ws.State <> WebSocketState.Open Then Return
        Dim bytes = Encoding.UTF8.GetBytes(text)
        Await _ws.SendAsync(New ArraySegment(Of Byte)(bytes), WebSocketMessageType.Text, True, ct).ConfigureAwait(False)
    End Function

    Private Shared Async Function FetchSignedWebSocketUrlAsync(agentId As String, apiKey As String, ct As CancellationToken) As Task(Of String)
        Dim apiBase = ElevenLabsApiSettings.GetApiBaseUrl()
        Dim url = $"{apiBase}/v1/convai/conversation/get-signed-url?agent_id={Uri.EscapeDataString(agentId)}"
        Using req As New HttpRequestMessage(HttpMethod.Get, url)
            req.Headers.TryAddWithoutValidation("xi-api-key", apiKey)
            Using resp = Await Http.SendAsync(req, ct).ConfigureAwait(False)
                Dim body = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                If Not resp.IsSuccessStatusCode Then
                    Dim sc = CInt(resp.StatusCode)
                    Console.WriteLine($"[ElevenLabs] GET get-signed-url HTTP {sc} bodyLen={If(body?.Length, 0)} preview={body?.Substring(0, Math.Min(600, body.Length))}")
                    Throw New ElevenLabsUpstreamHttpException(sc, body)
                End If
                Console.WriteLine($"[ElevenLabs] GET get-signed-url OK bodyLen={If(body?.Length, 0)} preview={body?.Substring(0, Math.Min(400, body.Length))}")
                Dim jo = JObject.Parse(body)
                Return jo("signed_url")?.ToString()
            End Using
        End Using
    End Function

    Private Shared Function BuildConversationInitiationJson(dynamicVars As Dictionary(Of String, Object)) As String
        Dim dyn As New JObject()
        If dynamicVars IsNot Nothing Then
            For Each kvp In dynamicVars
                dyn(kvp.Key) = If(kvp.Value Is Nothing, JValue.CreateNull(), JToken.FromObject(kvp.Value))
            Next
        End If
        Dim jo As New JObject From {
            {"type", "conversation_initiation_client_data"},
            {"conversation_initiation_client_data", New JObject From {
                {"dynamic_variables", dyn}
            }}
        }
        Return jo.ToString(Formatting.None)
    End Function

    Public Sub Dispose() Implements IDisposable.Dispose
        If _disposed Then Return
        _disposed = True
        Try
            _cts?.Cancel()
        Catch
        End Try
        Try
            If _ws IsNot Nothing AndAlso _ws.State = WebSocketState.Open Then
                _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "dispose", CancellationToken.None).GetAwaiter().GetResult()
            End If
        Catch
        End Try
        Try
            _ws?.Dispose()
        Catch
        End Try
        _ws = Nothing
    End Sub
End Class

End Namespace
