' ServerlessEngine.vb
' Stateless dialogue engine adapter — delegates to TaskEngine.Motore.
' Maintained as a separate project for golden-test and comparison purposes.

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Linq

''' <summary>
''' Stateless dialogue engine for serverless/Kubernetes deployments.
'''
''' This class wraps TaskEngine.Motore and exposes an explicit step-based API:
'''   ExecuteTaskStep  — run one prompt step and return status
'''   SetState         — apply parse result to the active TaskUtterance
'''
''' All runtime state is held inside the TaskUtterance tree, not here.
''' </summary>
Public Class ServerlessEngine
    ''' <summary>Parser used to interpret user utterances.</summary>
    Public ReadOnly Property Parser As Parser

    ''' <summary>Raised whenever a message should be shown to the user.</summary>
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    Private ReadOnly _motore As Motore

    Public Sub New()
        _motore = New Motore()
        Parser = _motore.Parser

        AddHandler _motore.MessageToShow,
            Sub(sender, e) RaiseEvent MessageToShow(sender, e)
    End Sub

    ' -------------------------------------------------------------------------
    ' Step-based public API
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Executes a single dialogue step for the given task tree.
    ''' Returns a StepResult indicating whether to wait for input or continue.
    ''' </summary>
    Public Function ExecuteTaskStep(state As ExecutionState,
                                    taskUtterance As TaskUtterance,
                                    Optional input As String = Nothing) As StepResult

        If state Is Nothing Then Throw New ArgumentNullException(NameOf(state))
        If taskUtterance Is Nothing Then Throw New ArgumentNullException(NameOf(taskUtterance))

        Dim result As New StepResult()
        state.IterationCount += 1

        ' If input is provided, process it first (updates state machine).
        If Not String.IsNullOrEmpty(input) Then
            Dim inputResult = _motore.ProcessInput(taskUtterance, input)
            If inputResult.Status = TurnStatus.Completed Then
                result.StepType = "Complete"
                result.IsCompleted = True
                result.ContinueExecution = False
                state.IsCompleted = True
                Return result
            End If
        End If

        ' Execute the next dialogue turn.
        Dim turnResult = _motore.ExecuteTurn(taskUtterance)
        state.CurrentTaskNode = GetNextTaskInternal(taskUtterance.SubTasks)

        Select Case turnResult.Status
            Case TurnStatus.WaitingForInput
                result.StepType = "WaitingForInput"
                result.ContinueExecution = False

            Case TurnStatus.Completed
                result.StepType = "Complete"
                result.IsCompleted = True
                result.ContinueExecution = False
                state.IsCompleted = True

            Case TurnStatus.SessionClosed
                result.StepType = "SessionClosed"
                result.HasTerminationResponse = True
                result.ContinueExecution = False

            Case Else ' Continue
                result.StepType = "Continue"
                result.ContinueExecution = True
        End Select

        Return result
    End Function

    ''' <summary>
    ''' Applies a parse result to the active TaskUtterance (delegates to ApplyParseResult).
    ''' </summary>
    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currTask As TaskUtterance)
        If currTask Is Nothing Then Throw New ArgumentNullException(NameOf(currTask))
        currTask.ApplyParseResult(parseResult)
    End Sub

    ' -------------------------------------------------------------------------
    ' Private helpers
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Recursively finds the first incomplete TaskUtterance in the tree.
    ''' Completeness rule is context-driven, not structural:
    '''   isSubTaskContext = False (default) → task is a main task → done when State = Success
    '''   isSubTaskContext = True            → task acts as sub-task → done when Value is present
    ''' Recursion into sub-tasks occurs only when the composite is in Start state
    ''' with partial data. Invalid / Confirmation / NoMatch states cause the
    ''' composite itself to be returned so its own step/escalation executes.
    ''' </summary>
    Private Function GetNextTaskInternal(tasks As List(Of TaskUtterance),
                                         Optional isSubTaskContext As Boolean = False) As TaskUtterance
        If tasks Is Nothing Then Return Nothing
        For Each t In tasks
            Dim isDone As Boolean = If(isSubTaskContext, t.Value IsNot Nothing, t.IsComplete())
            If isDone Then Continue For

            ' Composite in Start state with partial data → recurse into sub-tasks.
            If t.HasSubTasks() AndAlso Not t.IsEmpty() AndAlso t.State = DialogueState.Start Then
                Dim found = GetNextTaskInternal(t.SubTasks, isSubTaskContext:=True)
                If found IsNot Nothing Then Return found
                Continue For
            End If

            Return t
        Next
        Return Nothing
    End Function
End Class

''' <summary>
''' Helper functions for TaskUtterance (public for cross-assembly use).
''' </summary>
Module ServerlessEngineHelpers
    Public Function IsTaskNodeEmpty(task As TaskUtterance) As Boolean
        If task.SubTasks IsNot Nothing AndAlso task.SubTasks.Any() Then
            Return Not task.SubTasks.Any(Function(st) st.Value IsNot Nothing)
        End If
        Return task.Value Is Nothing
    End Function

    Public Function IsTaskNodeFilled(task As TaskUtterance) As Boolean
        If task.SubTasks IsNot Nothing AndAlso task.SubTasks.Any() Then
            Return Not task.SubTasks.Any(Function(st) st.Value Is Nothing)
        End If
        Return task.Value IsNot Nothing
    End Function

    Public Function IsTaskNodeSubData(task As TaskUtterance) As Boolean
        Return task.ParentData IsNot Nothing
    End Function

    Public Function HasExitConditionForTasks(tasks As IEnumerable(Of ITask)) As Boolean
        Return tasks.Any(Function(a) TypeOf a Is CloseSessionTask OrElse TypeOf a Is TransferTask)
    End Function
End Module
