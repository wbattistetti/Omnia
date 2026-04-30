Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Net.Http
Imports System.Text
Imports Compiler
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

''' <summary>
''' Risultato di uno step AI Agent: nuovo stato JSON, messaggio assistente, completamento.
''' </summary>
Public Class AIAgentStepResult
    Public Property NewStateJson As String
    Public Property AssistantMessage As String
    Public Property IsCompleted As Boolean
End Class

''' <summary>
''' Executor stateless per task AI Agent: OpenAI = una POST LLM per turno; ElevenLabs = bridge HTTP sull&apos;ApiServer (<c>/elevenlabs/*</c>).
''' </summary>
Public Class AIAgentTaskExecutor
    Inherits TaskExecutorBase

    Private Shared ReadOnly Http As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}
    ''' <summary>Long poll verso <c>readPrompt</c> (supera il timeout HTTP standard del client breve).</summary>
    Private Shared ReadOnly HttpLong As New HttpClient With {.Timeout = TimeSpan.FromMinutes(3)}

    Private Const ElevenLabsContextKind As String = "__omnia_ai_agent_kind"
    Private Const ElevenLabsContextKindValue As String = "elevenlabs"
    Private Const ElevenLabsConversationIdKey As String = "conversationId"

    ''' <summary>
    ''' Chiave in <c>state</c> dove il runtime inserisce le rules compilate (non è un campo top-level del POST).
    ''' </summary>
    Public Const RuntimeRulesStateKey As String = "__omnia_runtime_rules"

    ''' <summary>Utterance sintetica quando «Avvio immediato» e nessun input utente (allineato al compile TS).</summary>
    Public Const ImmediateStartSyntheticUserMessage As String = "start"

    Public Sub New()
        MyBase.New()
    End Sub

    ''' <summary>
    ''' URL dell'endpoint LLM per il ramo OpenAI (<see cref="CompiledAIAgentTask.LlmEndpoint"/>).
    ''' </summary>
    Public Shared Function ResolveLlmEndpoint(taskEndpoint As String) As String
        Return If(taskEndpoint, "").Trim()
    End Function

    ''' <summary>
    ''' Base URL ApiServer per i path <c>/elevenlabs/*</c> (override da task o env <c>OMNIA_API_PUBLIC_BASE_URL</c>).
    ''' </summary>
    Public Shared Function ResolveBackendBaseUrl(taskBase As String) As String
        Dim t = If(taskBase, "").Trim()
        If Not String.IsNullOrWhiteSpace(t) Then Return t.TrimEnd("/"c)
        Dim env = Environment.GetEnvironmentVariable("OMNIA_API_PUBLIC_BASE_URL")
        If Not String.IsNullOrWhiteSpace(env) Then Return env.Trim().TrimEnd("/"c)
        Return "http://localhost:5000"
    End Function

    Private Shared Function CombineUrl(baseUrl As String, relativePath As String) As String
        Dim b = baseUrl.TrimEnd("/"c)
        Dim p = relativePath.Trim()
        If Not p.StartsWith("/"c) Then p = "/" & p
        Return b & p
    End Function

    ''' <summary>
    ''' Un passo LLM OpenAI-compatible: costruisce il payload, chiama il backend, valida la risposta JSON.
    ''' </summary>
    Public Shared Async Function ExecuteStepAsync(
        stateJson As String,
        userInput As String,
        rules As String,
        llmEndpoint As String
    ) As System.Threading.Tasks.Task(Of AIAgentStepResult)

        If String.IsNullOrWhiteSpace(llmEndpoint) Then
            Throw New InvalidOperationException(
                "AI Agent LLM endpoint is not configured. CompiledAIAgentTask.llmEndpoint must be a non-empty absolute URL.")
        End If

        If Not Uri.TryCreate(llmEndpoint, UriKind.Absolute, Nothing) Then
            Throw New InvalidOperationException($"AI Agent LLM endpoint is not a valid absolute URL: '{llmEndpoint}'")
        End If

        Dim stateObj As JToken
        If String.IsNullOrWhiteSpace(stateJson) Then
            stateObj = New JObject()
        Else
            stateObj = JToken.Parse(stateJson)
        End If

        If stateObj.Type <> JTokenType.Object Then
            stateObj = New JObject()
        End If
        Dim stateJo = CType(stateObj, JObject)
        stateJo(RuntimeRulesStateKey) = If(rules, "")

        Dim payload As New JObject From {
            {"state", stateObj},
            {"user_message", If(userInput, "")}
        }

        Dim body = payload.ToString(Formatting.None)
        Dim content As New StringContent(body, Encoding.UTF8, "application/json")

        Dim response = Await Http.PostAsync(llmEndpoint, content).ConfigureAwait(False)
        Dim responseBody = Await response.Content.ReadAsStringAsync().ConfigureAwait(False)

        If Not response.IsSuccessStatusCode Then
            Throw New InvalidOperationException(
                $"AI Agent LLM call failed: HTTP {CInt(response.StatusCode)} — {responseBody}")
        End If

        Dim jo = JObject.Parse(responseBody)
        Dim newState = jo("new_state")
        If newState Is Nothing OrElse newState.Type = JTokenType.Null Then
            Throw New InvalidOperationException("AI Agent LLM response missing required field 'new_state'.")
        End If

        Dim newStateJson = newState.ToString(Formatting.None)
        Dim assistantMessage = If(jo("assistant_message")?.ToString(), "")
        Dim statusStr = If(jo("status")?.ToString(), "in_progress")
        Dim isCompleted = String.Equals(statusStr, "completed", StringComparison.OrdinalIgnoreCase)

        Return New AIAgentStepResult With {
            .NewStateJson = newStateJson,
            .AssistantMessage = assistantMessage,
            .IsCompleted = isCompleted
        }
    End Function

    Private Shared Function TryGetElevenLabsConversationId(rawContext As String) As String
        If String.IsNullOrWhiteSpace(rawContext) Then Return Nothing
        Try
            Dim jo = JObject.Parse(rawContext)
            If Not String.Equals(jo(ElevenLabsContextKind)?.ToString(), ElevenLabsContextKindValue, StringComparison.Ordinal) Then
                Return Nothing
            End If
            Dim cid = jo(ElevenLabsConversationIdKey)?.ToString()
            If String.IsNullOrWhiteSpace(cid) Then Return Nothing
            Return cid.Trim()
        Catch
            Return Nothing
        End Try
    End Function

    Private Shared Function BuildElevenLabsContextJson(conversationId As String) As String
        Dim jo As New JObject From {
            {ElevenLabsContextKind, ElevenLabsContextKindValue},
            {ElevenLabsConversationIdKey, conversationId}
        }
        Return jo.ToString(Formatting.None)
    End Function

    Private Shared Async Function ElevenLabsStartAgentAsync(baseUrl As String, agentId As String, dynamicVars As Dictionary(Of String, Object), ct As System.Threading.CancellationToken) As System.Threading.Tasks.Task(Of String)
        Dim url = CombineUrl(baseUrl, "/elevenlabs/startAgent")
        Dim jo As New JObject From {
            {"agentId", agentId},
            {"dynamicVariables", JObject.FromObject(If(dynamicVars, New Dictionary(Of String, Object)()))}
        }
        Dim content As New StringContent(jo.ToString(Formatting.None), Encoding.UTF8, "application/json")
        Dim resp = Await Http.PostAsync(url, content, ct).ConfigureAwait(False)
        Dim body = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
        Dim httpSt = CInt(resp.StatusCode)
        If Not resp.IsSuccessStatusCode Then
            Dim summary As String = body
            Dim elRaw As String = Nothing
            Try
                Dim ej = JObject.Parse(body)
                Dim det = ej("detail")?.ToString()
                Dim er = ej("error")?.ToString()
                If Not String.IsNullOrWhiteSpace(det) Then
                    summary = det
                ElseIf Not String.IsNullOrWhiteSpace(er) Then
                    summary = er
                End If
                Dim rawTok = ej("elevenlabsRawBody")
                If rawTok IsNot Nothing Then elRaw = rawTok.ToString()
            Catch
            End Try
            Throw New RuntimeConvaiException(summary, httpSt, "startAgent", agentId, baseUrl, body, elRaw)
        End If
        Dim out = JObject.Parse(body)
        Dim cid = out("conversationId")?.ToString()
        If String.IsNullOrWhiteSpace(cid) Then
            Throw New RuntimeConvaiException(
                "ElevenLabs startAgent response missing conversationId.",
                httpSt,
                "startAgent",
                agentId,
                baseUrl,
                body,
                Nothing)
        End If
        Return cid.Trim()
    End Function

    Private Shared Async Function ElevenLabsSendUserTurnAsync(baseUrl As String, conversationId As String, text As String, ct As System.Threading.CancellationToken) As System.Threading.Tasks.Task
        Dim url = CombineUrl(baseUrl, "/elevenlabs/sendUserTurn")
        Dim jo As New JObject From {
            {"conversationId", conversationId},
            {"text", If(text, "")}
        }
        Dim content As New StringContent(jo.ToString(Formatting.None), Encoding.UTF8, "application/json")
        Dim resp = Await Http.PostAsync(url, content, ct).ConfigureAwait(False)
        Dim body = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
        If Not resp.IsSuccessStatusCode Then
            Throw New InvalidOperationException($"ElevenLabs sendUserTurn failed: HTTP {CInt(resp.StatusCode)} — {body}")
        End If
    End Function

    Private Shared Async Function ElevenLabsReadPromptAsync(baseUrl As String, conversationId As String, ct As System.Threading.CancellationToken) As System.Threading.Tasks.Task(Of (Text As String, Status As String))
        Dim url = CombineUrl(baseUrl, $"/elevenlabs/readPrompt/{Uri.EscapeDataString(conversationId)}")
        Dim resp = Await HttpLong.GetAsync(url, ct).ConfigureAwait(False)
        Dim body = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
        If resp.StatusCode = System.Net.HttpStatusCode.NotFound Then
            Throw New InvalidOperationException($"ElevenLabs readPrompt: conversation not found ({conversationId}).")
        End If
        If Not resp.IsSuccessStatusCode Then
            Throw New InvalidOperationException($"ElevenLabs readPrompt failed: HTTP {CInt(resp.StatusCode)} — {body}")
        End If
        Dim jo = JObject.Parse(body)
        Dim agentTurn = If(jo("agentTurn")?.ToString(), "")
        Dim status = If(jo("status")?.ToString(), "running")
        Return (agentTurn, status)
    End Function

    Private Async Function ExecuteOpenAiBranch(
        ai As CompiledAIAgentTask,
        task As CompiledTask,
        state As ExecutionState,
        userInput As String
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)

        Dim stateJson = ""
        If state.DialogueContexts IsNot Nothing AndAlso state.DialogueContexts.ContainsKey(task.Id) Then
            stateJson = state.DialogueContexts(task.Id)
        End If

        Dim endpoint = ResolveLlmEndpoint(ai.LlmEndpoint)
        Dim result As AIAgentStepResult
        Try
            result = Await ExecuteStepAsync(stateJson, userInput, ai.Rules, endpoint).ConfigureAwait(False)
        Catch ex As RuntimeConvaiException
            Throw
        Catch ex As Exception
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = ex.Message,
                .IsCompleted = False
            }
        End Try

        If state.DialogueContexts Is Nothing Then
            state.DialogueContexts = New Dictionary(Of String, String)()
        End If
        If result.IsCompleted Then
            If state.DialogueContexts.ContainsKey(task.Id) Then
                state.DialogueContexts.Remove(task.Id)
            End If
        Else
            state.DialogueContexts(task.Id) = result.NewStateJson
        End If

        If _messageCallback IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(result.AssistantMessage) Then
            _messageCallback(result.AssistantMessage, "AIAgent", 0)
        End If

        Dim requiresInput = Not result.IsCompleted
        Return New TaskExecutionResult With {
            .Success = True,
            .RequiresInput = requiresInput,
            .WaitingTaskId = If(requiresInput, task.Id, Nothing),
            .IsCompleted = result.IsCompleted
        }
    End Function

    ''' <summary>Logs first segment of agent id only (dashboard ids are opaque, not secrets — keeps logs readable).</summary>
    Private Shared Function MaskAgentIdForLog(agentId As String) As String
        Dim s = If(agentId, "").Trim()
        If String.IsNullOrWhiteSpace(s) Then Return "(empty)"
        If s.Length <= 10 Then Return s.Substring(0, Math.Min(4, s.Length)) & "…"
        Return s.Substring(0, 10) & "…"
    End Function

    Private Async Function ExecuteElevenLabsBranch(
        ai As CompiledAIAgentTask,
        task As CompiledTask,
        state As ExecutionState,
        userInput As String
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)

        If String.IsNullOrWhiteSpace(ai.AgentId) Then
            Console.WriteLine($"[IA·ConvAI] ElevenLabs branch: task={task.Id} agentId MISSING — compile/UI must set convaiAgentId")
            Return New TaskExecutionResult With {.Success = False, .Err = "ElevenLabs AI Agent requires compiled agentId.", .IsCompleted = False}
        End If

        Dim baseUrl = ResolveBackendBaseUrl(ai.BackendBaseUrl)
        Console.WriteLine($"[IA·ConvAI] ElevenLabs runtime: task={task.Id} agent={MaskAgentIdForLog(ai.AgentId)} apiBase={baseUrl} userChars={If(userInput, """").Length}")

        If state.DialogueContexts Is Nothing Then
            state.DialogueContexts = New Dictionary(Of String, String)()
        End If

        Dim rawCtx = ""
        If state.DialogueContexts.ContainsKey(task.Id) Then
            rawCtx = state.DialogueContexts(task.Id)
        End If

        Dim conversationId = TryGetElevenLabsConversationId(rawCtx)

        Try
            If conversationId Is Nothing Then
                Console.WriteLine($"[IA·ConvAI] POST /elevenlabs/startAgent → new conversation")
                conversationId = Await ElevenLabsStartAgentAsync(baseUrl, ai.AgentId.Trim(), ai.DynamicVariables, System.Threading.CancellationToken.None).ConfigureAwait(False)
                state.DialogueContexts(task.Id) = BuildElevenLabsContextJson(conversationId)
                Dim cidDisp = If(conversationId.Length <= 16, conversationId, conversationId.Substring(0, 12) & "…")
                Console.WriteLine($"[IA·ConvAI] ConvAI conversationId={cidDisp} (stored in DialogueContexts)")
            Else
                Dim cidReuse = If(conversationId.Length <= 16, conversationId, conversationId.Substring(0, 12) & "…")
                Console.WriteLine($"[IA·ConvAI] reuse conversationId={cidReuse}")
            End If

            If Not String.IsNullOrWhiteSpace(userInput) Then
                Console.WriteLine($"[IA·ConvAI] POST /elevenlabs/sendUserTurn chars={userInput.Length}")
                Await ElevenLabsSendUserTurnAsync(baseUrl, conversationId, userInput, System.Threading.CancellationToken.None).ConfigureAwait(False)
            End If

            Console.WriteLine($"[IA·ConvAI] GET /elevenlabs/readPrompt (long-poll)")
            Dim turn = Await ElevenLabsReadPromptAsync(baseUrl, conversationId, System.Threading.CancellationToken.None).ConfigureAwait(False)
            Dim completed = turn.Status.Equals("completed", StringComparison.OrdinalIgnoreCase)
            Console.WriteLine($"[IA·ConvAI] agent turn status={turn.Status} replyChars={If(turn.Text, """").Length} completed={completed}")

            If completed Then
                If state.DialogueContexts.ContainsKey(task.Id) Then
                    state.DialogueContexts.Remove(task.Id)
                End If
            End If

            If _messageCallback IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(turn.Text) Then
                _messageCallback(turn.Text, "AIAgent", 0)
            End If

            Dim requiresInput = Not completed
            Return New TaskExecutionResult With {
                .Success = True,
                .RequiresInput = requiresInput,
                .WaitingTaskId = If(requiresInput, task.Id, Nothing),
                .IsCompleted = completed
            }
        Catch ex As RuntimeConvaiException
            Throw
        Catch ex As Exception
            Console.WriteLine($"[IA·ConvAI] ElevenLabs error: {ex.Message}")
            Return New TaskExecutionResult With {.Success = False, .Err = ex.Message, .IsCompleted = False}
        End Try
    End Function

    ''' <summary>
    ''' Entrypoint TaskExecutor: ramo OpenAI (LLM) o ElevenLabs (bridge ApiServer).
    ''' </summary>
    Public Overrides Async Function Execute(
        task As CompiledTask,
        state As ExecutionState,
        Optional userInput As String = ""
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)

        Dim ai = TryCast(task, CompiledAIAgentTask)
        If ai Is Nothing Then
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = "Task is not a CompiledAIAgentTask",
                .IsCompleted = False
            }
        End If

        Select Case ai.Platform
            Case IAPlatform.ElevenLabs
                Return Await ExecuteElevenLabsBranch(ai, task, state, userInput).ConfigureAwait(False)
            Case IAPlatform.Google
                Return New TaskExecutionResult With {
                    .Success = False,
                    .Err = "IAPlatform.Google is not implemented yet.",
                    .IsCompleted = False
                }
            Case Else
                Return Await ExecuteOpenAiBranch(ai, task, state, userInput).ConfigureAwait(False)
        End Select
    End Function
End Class
