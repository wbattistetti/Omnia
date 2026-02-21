' Motore.vb
' Main dialogue engine: stateless, recursive, clean.

Option Strict On
Option Explicit On

''' <summary>
''' Executes dialogue turns against a TaskUtterance tree.
''' Fully stateless: all runtime state lives inside TaskUtterance.
''' Usage pattern:
'''   1. Call ExecuteTurn(root) → shows prompt, returns WaitingForInput.
'''   2. Receive user utterance via HTTP.
'''   3. Call ProcessInput(root, utterance) → updates state.
'''   4. Call ExecuteTurn(root) again for the next prompt.
''' </summary>
Public Class Motore
    Public ReadOnly Property Parser As Parser
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    Public Sub New()
        Parser = New Parser()
    End Sub

    ' -------------------------------------------------------------------------
    ' Public API
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Runs the current dialogue step: executes the escalation micro-tasks and
    ''' returns whether the engine is waiting for user input.
    ''' </summary>
    Public Function ExecuteTurn(root As TaskUtterance) As TurnResult
        If root Is Nothing Then Throw New ArgumentNullException(NameOf(root))

        If root.IsAggregate AndAlso root.Introduction IsNot Nothing Then
            ExecuteTasks(root.Introduction, root)
            root.IsAggregate = False   ' Run introduction only once.
        End If

        Dim [next] = GetNextTask(root.SubTasks)
        If [next] Is Nothing Then Return CompleteSession(root)

        Return ExecuteStep([next])
    End Function

    ''' <summary>
    ''' Parses the user utterance and updates the state machine of the active task.
    ''' </summary>
    Public Function ProcessInput(root As TaskUtterance, utterance As String) As TurnResult
        If root Is Nothing Then Throw New ArgumentNullException(NameOf(root))

        Dim [next] = GetNextTask(root.SubTasks)
        If [next] Is Nothing Then Return TurnResult.Completed

        Dim parseResult = Parser.Parse(If(utterance, ""), [next])
        [next].ApplyParseResult(parseResult)

        Return TurnResult.Continue
    End Function

    ''' <summary>
    ''' Single entry point for a user turn: parses the utterance, updates the state
    ''' machine, then immediately runs the next dialogue step.
    ''' Replaces the two-call pattern ProcessInput(...) + ExecuteTurn(...).
    ''' </summary>
    Public Function HandleUserTurn(root As TaskUtterance, utterance As String) As TurnResult
        If root Is Nothing Then Throw New ArgumentNullException(NameOf(root))
        If String.IsNullOrEmpty(utterance) Then Throw New ArgumentException("Utterance cannot be empty.", NameOf(utterance))

        Dim inputResult = ProcessInput(root, utterance)
        If inputResult.Status = TurnStatus.Completed Then Return TurnResult.Completed

        Return ExecuteTurn(root)
    End Function

    ''' <summary>
    ''' Resets all state in the task tree.
    ''' </summary>
    Public Sub Reset(root As TaskUtterance)
        root?.Reset()
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
    Private Function GetNextTask(tasks As List(Of TaskUtterance),
                                 Optional isSubTaskContext As Boolean = False) As TaskUtterance
        If tasks Is Nothing Then Return Nothing
        For Each t In tasks
            Dim isDone As Boolean = If(isSubTaskContext, t.Value IsNot Nothing, t.IsComplete())
            If isDone Then Continue For

            ' Composite in Start state with partial data → recurse into sub-tasks.
            If t.HasSubTasks() AndAlso Not t.IsEmpty() AndAlso t.State = DialogueState.Start Then
                Dim found = GetNextTask(t.SubTasks, isSubTaskContext:=True)
                If found IsNot Nothing Then Return found
                Continue For
            End If

            Return t
        Next
        Return Nothing
    End Function

    ''' <summary>
    ''' Executes the escalation for the current step and returns the turn status.
    ''' </summary>
    Private Function ExecuteStep(task As TaskUtterance) As TurnResult
        Dim currentStep = task.GetCurrentStep()
        Dim escalation = task.GetCurrentEscalation()
        ExecuteTasks(escalation.Tasks, task)
        ' Pass the number of escalation levels in the step — NOT the number of tasks
        ' inside a single escalation — so the counter advances through each level.
        task.IncrementEscalationLevel(task.State, currentStep.Escalations.Count)

        If Utils.HasExitCondition(escalation.Tasks) Then
            Return TurnResult.SessionClosed
        End If

        Return If(StepRequiresUtterance(task.State), TurnResult.WaitingForInput(), TurnResult.Continue)
    End Function

    Private Function CompleteSession(root As TaskUtterance) As TurnResult
        If root.SuccessResponse IsNot Nothing Then ExecuteTasks(root.SuccessResponse, root)
        Return TurnResult.Completed
    End Function

    Private Sub ExecuteTasks(tasks As IEnumerable(Of ITask), context As TaskUtterance)
        For Each t In tasks
            t.Execute(context, Sub(msg) RaiseEvent MessageToShow(Me, New MessageEventArgs(msg)))
        Next
    End Sub

    Private Shared Function StepRequiresUtterance(state As DialogueState) As Boolean
        Select Case state
            Case DialogueState.Start, DialogueState.NoMatch, DialogueState.NoInput,
                 DialogueState.Confirmation, DialogueState.NotConfirmed, DialogueState.Invalid
                Return True
            Case Else
                Return False
        End Select
    End Function
End Class
