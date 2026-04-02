Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports TaskEngine

''' <summary>
''' Ensures every compiled dialogue escalation contains at least one micro-task (SayMessage, etc.).
''' Empty escalations match the designer state where an escalation slot exists but no task was added.
''' </summary>
Public NotInheritable Class UtteranceEscalationValidation

    Private Sub New()
    End Sub

    ''' <summary>
    ''' Appends one <see cref="CompilationError"/> per empty escalation. Returns number of errors added.
    ''' </summary>
    Public Shared Function AppendEmptyEscalationErrors(
        root As CompiledUtteranceTask,
        taskId As String,
        node As FlowNode,
        row As TaskRow,
        errors As List(Of CompilationError),
        flowTaskType As TaskTypes) As Integer

        If root Is Nothing OrElse errors Is Nothing Then
            Return 0
        End If

        Dim initial = errors.Count
        Dim typeInt = CInt(flowTaskType)
        WalkAdd(root, taskId, node, row, errors, typeInt)
        Return errors.Count - initial
    End Function

    Private Shared Sub WalkAdd(
        ut As CompiledUtteranceTask,
        taskId As String,
        node As FlowNode,
        row As TaskRow,
        errors As List(Of CompilationError),
        flowTaskType As Integer)

        If ut Is Nothing Then
            Return
        End If

        If ut.Steps IsNot Nothing Then
            For Each dstep As CompiledDialogueStep In ut.Steps
                If dstep Is Nothing OrElse dstep.Escalations Is Nothing Then
                    Continue For
                End If
                Dim stepKey = DialogueStepTypeToStepKey(dstep.Type)
                For ei = 0 To dstep.Escalations.Count - 1
                    Dim esc = dstep.Escalations(ei)
                    If esc Is Nothing Then
                        Continue For
                    End If
                    Dim taskCount = If(esc.Tasks IsNot Nothing, esc.Tasks.Count, 0)
                    If taskCount = 0 Then
                        errors.Add(New CompilationError() With {
                            .TaskId = taskId,
                            .NodeId = If(node IsNot Nothing, node.Id, ""),
                            .RowId = If(row IsNot Nothing, row.Id, ""),
                            .RowLabel = FormatRowUserLabel(row),
                            .Message = "Dialogue escalation has no actions. Add at least one prompt or task to this escalation.",
                            .Severity = ErrorSeverity.Error,
                            .Category = "EmptyEscalation",
                            .StepKey = stepKey,
                            .EscalationIndex = ei,
                            .TaskType = flowTaskType
                        })
                    End If
                Next
            Next
        End If

        If ut.SubTasks Is Nothing Then
            Return
        End If

        For Each child As CompiledUtteranceTask In ut.SubTasks
            WalkAdd(child, taskId, node, row, errors, flowTaskType)
        Next
    End Sub

    Private Shared Function DialogueStepTypeToStepKey(t As DialogueStepType) As String
        Select Case t
            Case DialogueStepType.Start
                Return "start"
            Case DialogueStepType.NoMatch
                Return "noMatch"
            Case DialogueStepType.NoInput
                Return "noInput"
            Case DialogueStepType.Confirmation
                Return "confirmation"
            Case DialogueStepType.NotConfirmed
                Return "notConfirmed"
            Case DialogueStepType.Invalid
                Return "invalid"
            Case DialogueStepType.Success
                Return "success"
            Case Else
                Return t.ToString().ToLowerInvariant()
        End Select
    End Function

    Private Shared Function FormatRowUserLabel(row As TaskRow) As String
        If row Is Nothing Then
            Return "Unnamed row"
        End If
        If Not String.IsNullOrWhiteSpace(row.Text) Then
            Return row.Text.Trim()
        End If
        Return "Unnamed row"
    End Function

End Class
