Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports Compiler
Imports TaskEngine

''' <summary>
    ''' Esegue un singolo turno su un <see cref="CompiledTask"/> via <see cref="TaskExecutor.ExecuteTask"/>.
    ''' Usato dal runner atomico (senza FlowOrchestrator) e condiviso con <see cref="FlowOrchestrator"/>.
    ''' </summary>
    Public Class CompiledTaskTurnService

        Public Class TurnOutcome
            Public Property RowResult As RowTurnResult
            Public Property DiagnosticJsons As List(Of String)
        End Class

        ''' <summary>
        ''' Esegue un turno atomico: raccoglie messaggi assistente e diagnostica backend.
        ''' </summary>
        Public Shared Async Function ExecuteTurn(
            task As CompiledTask,
            execState As ExecutionState,
            userInput As String,
            messageCallback As Action(Of String, String, Integer),
            diagnosticCallback As Action(Of String)
        ) As Task(Of TurnOutcome)
            If task Is Nothing Then
                Throw New ArgumentNullException(NameOf(task))
            End If
            If execState Is Nothing Then
                Throw New ArgumentNullException(NameOf(execState))
            End If

            Dim effectiveInput = If(userInput, "").Trim()
            Dim aiAgent = TryCast(task, CompiledAIAgentTask)
            If aiAgent IsNot Nothing AndAlso aiAgent.ImmediateStart AndAlso String.IsNullOrWhiteSpace(effectiveInput) Then
                Dim hasExistingDialogue = execState.DialogueContexts IsNot Nothing AndAlso execState.DialogueContexts.ContainsKey(aiAgent.Id)
                If Not hasExistingDialogue Then
                    effectiveInput = AIAgentTaskExecutor.ImmediateStartSyntheticUserMessage
                End If
            End If

            Dim emittedMessages As New List(Of String)()
            Dim diagnosticJsons As New List(Of String)()

            Dim result = Await TaskExecutor.ExecuteTask(
                task,
                execState,
                Sub(text As String, stepType As String, escalationNumber As Integer)
                    If messageCallback IsNot Nothing Then
                        messageCallback(text, stepType, escalationNumber)
                    End If
                    If String.Equals(stepType, "AIAgent", StringComparison.OrdinalIgnoreCase) AndAlso Not String.IsNullOrWhiteSpace(text) Then
                        emittedMessages.Add(text)
                    ElseIf String.Equals(stepType, "BackendCallDiagnostic", StringComparison.OrdinalIgnoreCase) AndAlso Not String.IsNullOrWhiteSpace(text) Then
                        diagnosticJsons.Add(text)
                    End If
                End Sub,
                effectiveInput
            ).ConfigureAwait(False)

            If Not String.IsNullOrWhiteSpace(result.BackendCallDiagnosticJson) Then
                diagnosticJsons.Add(result.BackendCallDiagnosticJson)
            End If
            If diagnosticCallback IsNot Nothing Then
                For Each d In diagnosticJsons
                    diagnosticCallback(d)
                Next
            End If

            Dim rowResult As RowTurnResult
            If Not result.Success Then
                Dim errMsg = If(String.IsNullOrEmpty(result.Err), "Unknown error", result.Err)
                If Not String.IsNullOrWhiteSpace(result.ErrDetailJson) Then
                    Throw RuntimeConvaiException.FromJsonDetail(errMsg, result.ErrDetailJson)
                End If
                rowResult = RowTurnResult.Completed(New List(Of String) From {errMsg})
            ElseIf result.IsCompleted Then
                rowResult = RowTurnResult.Completed(emittedMessages)
            Else
                rowResult = RowTurnResult.WaitingForInput(task.Id, emittedMessages)
            End If

            Return New TurnOutcome() With {
                .RowResult = rowResult,
                .DiagnosticJsons = diagnosticJsons
            }
        End Function

    End Class
