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

    ''' <summary>
    ''' Same rules as <see cref="AppendEmptyEscalationErrors"/> but walks IDE <see cref="TaskNode"/> trees
    ''' (used when compile failed or no compiled utterance tree — e.g. leaf contract blocked full build).
    ''' Filters align with <see cref="TaskAssembler"/>: skip <c>_disabled</c> steps and steps with zero escalations.
    ''' </summary>
    Public Shared Function AppendEmptyEscalationErrorsFromIdeTaskNodes(
        roots As IList(Of TaskNode),
        taskId As String,
        node As FlowNode,
        row As TaskRow,
        errors As List(Of CompilationError),
        flowTaskType As TaskTypes) As Integer

        If roots Is Nothing OrElse errors Is Nothing Then
            Return 0
        End If

        Dim initial = errors.Count
        Dim typeInt = CInt(flowTaskType)
        For Each r In roots
            If r IsNot Nothing Then
                WalkIdeAdd(r, taskId, node, row, errors, typeInt)
            End If
        Next
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
                            .Message = String.Empty,
                            .Code = CompilationErrorCanonicalMapping.CanonicalCode(CompilationErrorCode.EscalationActionsMissing),
                            .Severity = ErrorSeverity.Error,
                            .Category = String.Empty,
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

    Private Shared Sub WalkIdeAdd(
        tn As TaskNode,
        taskId As String,
        node As FlowNode,
        row As TaskRow,
        errors As List(Of CompilationError),
        flowTaskType As Integer)

        If tn Is Nothing Then
            Return
        End If

        If tn.Steps IsNot Nothing Then
            For Each ideStep As DialogueStep In tn.Steps
                If ideStep Is Nothing Then
                    Continue For
                End If
                If ideStep.IsDisabled Then
                    Continue For
                End If
                If ideStep.Escalations Is Nothing OrElse ideStep.Escalations.Count = 0 Then
                    Continue For
                End If
                Dim stepKey = IdeStepTypeToStepKey(ideStep.Type)
                For ei = 0 To ideStep.Escalations.Count - 1
                    Dim esc = ideStep.Escalations(ei)
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
                            .Message = String.Empty,
                            .Code = CompilationErrorCanonicalMapping.CanonicalCode(CompilationErrorCode.EscalationActionsMissing),
                            .Severity = ErrorSeverity.Error,
                            .Category = String.Empty,
                            .StepKey = stepKey,
                            .EscalationIndex = ei,
                            .TaskType = flowTaskType
                        })
                    End If
                Next
            Next
        End If

        If tn.SubTasks Is Nothing Then
            Return
        End If

        For Each child As TaskNode In tn.SubTasks
            WalkIdeAdd(child, taskId, node, row, errors, flowTaskType)
        Next
    End Sub

    ''' <summary>
    ''' Maps IDE string step type to <c>StepKey</c> used in <see cref="DialogueStepTypeToStepKey"/> (aligned with TaskAssembler normalization).
    ''' </summary>
    Private Shared Function IdeStepTypeToStepKey(typeStr As String) As String
        If String.IsNullOrEmpty(typeStr) Then
            Return "unknown"
        End If
        Dim normalized = typeStr.Trim().ToLowerInvariant()
        Select Case normalized
            Case "start", "introduction"
                Return "start"
            Case "nomatch"
                Return "noMatch"
            Case "noinput"
                Return "noInput"
            Case "confirmation"
                Return "confirmation"
            Case "notconfirmed"
                Return "notConfirmed"
            Case "invalid", "violation"
                Return "invalid"
            Case "success"
                Return "success"
            Case Else
                Return normalized
        End Select
    End Function

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
