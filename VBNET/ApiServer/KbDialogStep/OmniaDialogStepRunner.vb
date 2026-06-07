Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Threading
Imports System.Threading.Tasks
Imports Newtonsoft.Json.Linq
Imports TaskEngine.KbDialogStep

Namespace OmniaDialogStepInfra
    ''' <summary>Risultato esecuzione passo dialogo KB (HTTP o bootstrap interno).</summary>
    Public Class OmniaDialogStepRunResult
        Public Property HttpStatus As Integer = 500
        Public Property Status As String = "error"
        Public Property Say As String = ""
        Public Property ErrorCode As String = ""
        Public Property Response As JObject
    End Class

    ''' <summary>Motore omnia_dialog_step riusabile da handler HTTP e bootstrap Test agente.</summary>
    Public NotInheritable Class OmniaDialogStepRunner
        Public Shared Async Function ExecuteAsync(
            projectId As String,
            agentTaskId As String,
            conversationId As String,
            updates As Dictionary(Of String, String),
            Optional kbDocumentId As String = Nothing,
            Optional reset As Boolean = False,
            Optional cancellationToken As CancellationToken = Nothing
        ) As Task(Of OmniaDialogStepRunResult)
            Dim pid = If(projectId, "").Trim()
            Dim aid = If(agentTaskId, "").Trim()
            Dim cid = If(conversationId, "").Trim()
            Dim docId = If(kbDocumentId, "").Trim()

            If pid.Length = 0 OrElse aid.Length = 0 Then
                Return Fail(400, "missing_project_or_agent_task", "Parametri progetto o task agente mancanti.")
            End If
            If cid.Length = 0 Then
                Return Fail(400, "missing_conversation_id", "conversationId mancante.")
            End If

            Dim agentTask As JObject = Nothing
            Try
                agentTask = Await ProjectTaskHttpLoader.LoadProjectTaskAsync(pid, aid, cancellationToken).ConfigureAwait(False)
            Catch ex As Exception
                Console.WriteLine("[omnia-dialog-step VB] load task: " & ex.Message)
                Return Fail(500, "task_load_failed", "Impossibile caricare il task agente.")
            End Try

            If agentTask Is Nothing Then
                Return Fail(404, "agent_task_not_found", "Task agente non trovato.")
            End If

            Dim runtime = KbDialogRuntimeLoader.LoadKbDialogRuntime(agentTask, If(docId.Length > 0, docId, Nothing))
            If runtime.HasError Then
                Return Fail(422, runtime.ErrorCode, "Configurazione knowledge base non pronta per il dialogo strutturato.")
            End If

            Dim scope As New OmniaDialogStepSessionScope With {
                .ProjectId = pid,
                .AgentTaskId = aid,
                .ConversationId = cid,
                .KbDocumentId = runtime.DocumentId
            }

            If reset Then
                Await DialogStepSessionStore.ClearDialogBindingAsync(scope).ConfigureAwait(False)
            End If

            Dim binding = Await DialogStepSessionStore.LoadDialogBindingAsync(scope).ConfigureAwait(False)
            Dim dialogIndex = KbDialogIndexLoader.ParseIndex(agentTask.Value(Of String)("agentKbDialogIndexJson"))
            Dim slotUpdates = If(updates, New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase))

            Dim result As DialogStepResult = Nothing
            Try
                result = DialogStepEngine.ExecuteDialogStep(runtime.Grid, runtime.SelectorSpec, binding, slotUpdates, dialogIndex)
            Catch ex As Exception
                Console.WriteLine("[omnia-dialog-step VB] engine error: " & ex.Message)
                Return Fail(500, "dialog_engine_failed", "Il motore dialogo non è disponibile.")
            End Try

            Dim canonicalBinding = DialogStepEngine.BindingKeysCanonical(If(result.Binding, binding), runtime.Grid.Headers)
            Await DialogStepSessionStore.SaveDialogBindingAsync(scope, canonicalBinding).ConfigureAwait(False)

            Dim response As New JObject From {
                {"status", result.Status},
                {"say", result.Say},
                {"binding", JObject.FromObject(canonicalBinding)},
                {"kbDocumentId", runtime.DocumentId},
                {"kbDocumentName", runtime.DocumentName},
                {"remainingRowCount", result.RemainingRowCount}
            }
            If Not String.IsNullOrEmpty(result.UseCaseId) Then response("useCaseId") = result.UseCaseId
            If Not String.IsNullOrEmpty(result.UseCaseKind) Then response("useCaseKind") = result.UseCaseKind
            If Not String.IsNullOrEmpty(result.SayCore) Then response("sayCore") = result.SayCore
            If Not String.IsNullOrEmpty(result.NextColumnId) Then response("nextColumnId") = result.NextColumnId
            If Not String.IsNullOrEmpty(result.NextHeaderLabel) Then response("nextHeaderLabel") = result.NextHeaderLabel
            If result.AllowedValues IsNot Nothing AndAlso result.AllowedValues.Count > 0 Then
                response("allowedValues") = New JArray(result.AllowedValues)
            End If
            If result.MatchedRow IsNot Nothing Then response("matchedRow") = JObject.FromObject(result.MatchedRow)
            If result.MatchedRows IsNot Nothing AndAlso result.MatchedRows.Count > 0 Then
                response("matchedRows") = New JArray(result.MatchedRows.Select(Function(r) JObject.FromObject(r)))
            End If
            If result.Rejected IsNot Nothing Then
                response("rejected") = New JObject From {
                    {"columnId", result.Rejected.ColumnId},
                    {"value", result.Rejected.Value},
                    {"alternative", result.Rejected.Alternative}
                }
            End If

            Return New OmniaDialogStepRunResult With {
                .HttpStatus = 200,
                .Status = If(result.Status, "ask"),
                .Say = If(result.Say, ""),
                .ErrorCode = If(String.Equals(result.Status, "error", StringComparison.OrdinalIgnoreCase), "dialog_step_error", ""),
                .Response = response
            }
        End Function

        Private Shared Function Fail(httpStatus As Integer, errorCode As String, say As String) As OmniaDialogStepRunResult
            Return New OmniaDialogStepRunResult With {
                .HttpStatus = httpStatus,
                .Status = "error",
                .Say = say,
                .ErrorCode = errorCode,
                .Response = New JObject From {
                    {"status", "error"},
                    {"error", errorCode},
                    {"say", say}
                }
            }
        End Function
    End Class
End Namespace
