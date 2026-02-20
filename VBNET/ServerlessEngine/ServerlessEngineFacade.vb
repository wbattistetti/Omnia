' ServerlessEngineFacade.vb
' Facade that exposes a simplified API compatible with the previous Motore interface.
' Wraps ServerlessEngine and provides ExecuteTask / GetNextTask / SetState / Reset.

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Linq

''' <summary>
''' Facade over ServerlessEngine providing a high-level API compatible with the
''' previous Motore.ExecuteTask pattern.
'''
''' Use this class when you need to run a full task loop without managing
''' individual steps manually.
''' </summary>
Public Class ServerlessEngineFacade
    Private ReadOnly _engine As ServerlessEngine
    Private _messageToShowHandlers As EventHandler(Of MessageEventArgs)

    Public Sub New()
        _engine = New ServerlessEngine()
        AddHandler _engine.MessageToShow, Sub(sender, e)
                                              RaiseEvent MessageToShow(sender, e)
                                          End Sub
    End Sub

    ''' <summary>Parser for user utterances.</summary>
    Public ReadOnly Property Parser As Parser
        Get
            Return _engine.Parser
        End Get
    End Property

    ''' <summary>Raised whenever a message should be shown to the user.</summary>
    Public Custom Event MessageToShow As EventHandler(Of MessageEventArgs)
        AddHandler(value As EventHandler(Of MessageEventArgs))
            _messageToShowHandlers = CType([Delegate].Combine(_messageToShowHandlers, value), EventHandler(Of MessageEventArgs))
        End AddHandler
        RemoveHandler(value As EventHandler(Of MessageEventArgs))
            _messageToShowHandlers = CType([Delegate].Remove(_messageToShowHandlers, value), EventHandler(Of MessageEventArgs))
        End RemoveHandler
        RaiseEvent(sender As Object, e As MessageEventArgs)
            If _messageToShowHandlers IsNot Nothing Then _messageToShowHandlers.Invoke(sender, e)
        End RaiseEvent
    End Event

    ' -------------------------------------------------------------------------
    ' High-level API (loop-based)
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Runs the full execution loop until the engine waits for input or completes.
    ''' Equivalent to the old Motore.ExecuteTask.
    ''' </summary>
    Public Sub ExecuteTask(taskUtterance As TaskUtterance)
        If taskUtterance Is Nothing Then Throw New ArgumentNullException(NameOf(taskUtterance))

        Console.WriteLine($"[ServerlessEngineFacade] ExecuteTask START: SubTasks={taskUtterance.SubTasks?.Count}")

        Dim state As New ExecutionState()
        Dim maxIterations As Integer = 1000 ' Safety guard against infinite loops.
        Dim iterations As Integer = 0

        Do While iterations < maxIterations
            iterations += 1
            Dim stepResult = _engine.ExecuteTaskStep(state, taskUtterance)

            If stepResult.Messages IsNot Nothing Then state.Messages.AddRange(stepResult.Messages)

            If Not stepResult.ContinueExecution Then
                Console.WriteLine($"[ServerlessEngineFacade] ExecuteTask STOP: StepType={stepResult.StepType}, Completed={stepResult.IsCompleted}")
                Exit Do
            End If

            If Not String.IsNullOrEmpty(stepResult.ErrorMessage) Then
                Console.WriteLine($"[ServerlessEngineFacade] ERROR: {stepResult.ErrorMessage}")
                Exit Do
            End If
        Loop

        Console.WriteLine($"[ServerlessEngineFacade] ExecuteTask COMPLETE: Messages={state.Messages.Count}, Completed={state.IsCompleted}")
    End Sub

    ''' <summary>
    ''' Returns the first incomplete TaskUtterance in the tree.
    ''' </summary>
    Public Function GetNextTask(taskUtterance As TaskUtterance) As TaskUtterance
        If taskUtterance Is Nothing Then Return Nothing
        Return GetNextTaskRecursive(taskUtterance.SubTasks)
    End Function

    ''' <summary>
    ''' Applies the parse result to the active TaskUtterance's state machine.
    ''' </summary>
    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currTask As TaskUtterance)
        _engine.SetState(parseResult, currentState, currTask)
    End Sub

    ''' <summary>
    ''' Marks a task as failed (placeholder — actual logic is in TaskUtterance).
    ''' </summary>
    Public Sub MarkAsAcquisitionFailed(currTask As TaskUtterance)
        ' No-op: failure marking is handled internally by the state machine.
    End Sub

    ''' <summary>
    ''' Resets the task tree to its initial state.
    ''' </summary>
    Public Sub Reset(Optional taskUtterance As TaskUtterance = Nothing)
        taskUtterance?.Reset()
    End Sub

    ' -------------------------------------------------------------------------
    ' Private helpers
    ' -------------------------------------------------------------------------

    Private Function GetNextTaskRecursive(tasks As List(Of TaskUtterance)) As TaskUtterance
        If tasks Is Nothing Then Return Nothing
        For Each t In tasks
            If Not t.IsComplete() Then Return t
            Dim found = GetNextTaskRecursive(t.SubTasks)
            If found IsNot Nothing Then Return found
        Next
        Return Nothing
    End Function
End Class

''' <summary>
''' Helper functions for TaskUtterance (public for cross-assembly use).
''' </summary>
Module ServerlessEngineFacadeHelpers
    Public Function IsTaskNodeEmpty(task As TaskUtterance) As Boolean
        If task.SubTasks IsNot Nothing AndAlso task.SubTasks.Any() Then
            Return Not task.SubTasks.Any(Function(st) st.Value IsNot Nothing)
        End If
        Return task.Value Is Nothing
    End Function
End Module
