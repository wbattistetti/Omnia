Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Net.Http
Imports System.Text
Imports Compiler
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Risultato di uno step AI Agent: nuovo stato JSON, messaggio assistente, completamento.
''' </summary>
Public Class AIAgentStepResult
    Public Property NewStateJson As String
    Public Property AssistantMessage As String
    Public Property IsCompleted As Boolean
End Class

''' <summary>
''' Executor stateless per task AI Agent: una chiamata HTTP POST per turno, stato in ExecutionState.DialogueContexts.
''' </summary>
Public Class AIAgentTaskExecutor
    Inherits TaskExecutorBase

    ''' <summary>
    ''' Variabile d'ambiente per l'URL POST se il task non definisce llmEndpoint.
    ''' Esempio backend Node Omnia: http://localhost:3100/api/runtime/ai-agent/step
    ''' </summary>
    Public Const EnvLlmUrl As String = "OMNIA_AI_AGENT_LLM_URL"

    Private Shared ReadOnly Http As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}

    Public Sub New()
        MyBase.New()
    End Sub

    ''' <summary>
    ''' Risolve l'URL dell'endpoint: task prima, poi variabile d'ambiente.
    ''' </summary>
    Public Shared Function ResolveLlmEndpoint(taskEndpoint As String) As String
        If Not String.IsNullOrWhiteSpace(taskEndpoint) Then
            Return taskEndpoint.Trim()
        End If
        Dim env = Environment.GetEnvironmentVariable(EnvLlmUrl)
        Return If(env, "").Trim()
    End Function

    ''' <summary>
    ''' Un passo: costruisce il payload, chiama il LLM, valida la risposta JSON.
    ''' Nessuno stato conservato tra le chiamate oltre a HttpClient condiviso.
    ''' </summary>
    Public Shared Async Function ExecuteStepAsync(
        stateJson As String,
        userInput As String,
        rules As String,
        llmEndpoint As String
    ) As System.Threading.Tasks.Task(Of AIAgentStepResult)

        If String.IsNullOrWhiteSpace(llmEndpoint) Then
            Throw New InvalidOperationException(
                "AI Agent LLM endpoint is not configured. Set CompiledAIAgentTask.llmEndpoint or environment variable " &
                EnvLlmUrl & ".")
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

        Dim payload As New JObject From {
            {"state", stateObj},
            {"user_message", If(userInput, "")},
            {"rules", If(rules, "")}
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

    ''' <summary>
    ''' Entrypoint TaskExecutor: aggiorna DialogueContexts e imposta TaskExecutionResult.
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

        Dim stateJson = ""
        If state.DialogueContexts IsNot Nothing AndAlso state.DialogueContexts.ContainsKey(task.Id) Then
            stateJson = state.DialogueContexts(task.Id)
        End If

        Dim endpoint = ResolveLlmEndpoint(ai.LlmEndpoint)
        Dim result As AIAgentStepResult
        Try
            result = Await ExecuteStepAsync(stateJson, userInput, ai.Rules, endpoint).ConfigureAwait(False)
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
End Class
