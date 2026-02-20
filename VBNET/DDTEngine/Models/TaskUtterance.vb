' TaskUtterance.vb
' Unified recursive model for utterance-based dialogue tasks.
' Replaces the former TaskInstance + TaskNode pair.

Option Strict On
Option Explicit On
Imports System.Collections.Generic

''' <summary>
''' Represents a semantic dialogue unit that acquires data from the user.
''' Recursive: SubTasks contains the individual fields (e.g. Day, Month, Year).
''' Carries its own state machine and escalation counters (supports Kubernetes stateless).
''' </summary>
Partial Public Class TaskUtterance

    ' --- Identity ---
    Public Property Id As String
    Public Property Label As String
    Public Property FullLabel As String
    Public Property Required As Boolean

    ' --- Recursive structure ---
    Public Property SubTasks As List(Of TaskUtterance)
    Public Property ParentData As TaskUtterance

    ' --- Runtime state ---
    Public Property State As DialogueState = DialogueState.Start
    Public Property Value As Object
    Public Property InvalidConditionId As String

    ' --- Dialogue configuration ---
    Public Property Steps As List(Of DialogueStep)
    Public Property RequiresConfirmation As Boolean
    Public Property RequiresValidation As Boolean
    Public Property ValidationConditions As List(Of ValidationCondition)
    Public Property NlpContract As CompiledNlpContract

    ' --- Escalation tracking (local, enables stateless deployment) ---
    Public Property EscalationCounters As Dictionary(Of DialogueState, Integer)

    ' --- Root-level config (used on the top-level task only) ---
    Public Property IsAggregate As Boolean
    Public Property Introduction As IEnumerable(Of ITask)
    Public Property SuccessResponse As IEnumerable(Of ITask)
    Public Property ProjectId As String
    Public Property Locale As String
    Public Property TranslationResolver As TaskEngine.Interfaces.ITranslationResolver

    Public Sub New()
        SubTasks = New List(Of TaskUtterance)()
        Steps = New List(Of DialogueStep)()
        ValidationConditions = New List(Of ValidationCondition)()
        EscalationCounters = New Dictionary(Of DialogueState, Integer)()
        State = DialogueState.Start
    End Sub

    ' --- State helpers ---

    Public Function IsComplete() As Boolean
        Return State = DialogueState.Success
    End Function

    Public Function IsEmpty() As Boolean
        If SubTasks.Any() Then Return Not SubTasks.Any(Function(st) st.Value IsNot Nothing)
        Return Value Is Nothing
    End Function

    Public Function IsFilled() As Boolean
        If SubTasks.Any() Then Return Not SubTasks.Any(Function(st) st.Value Is Nothing)
        Return Value IsNot Nothing
    End Function

    Public Function IsSubData() As Boolean
        Return ParentData IsNot Nothing
    End Function

    Public Function HasSubTasks() As Boolean
        Return SubTasks IsNot Nothing AndAlso SubTasks.Count > 0
    End Function

    ' --- Escalation helpers ---

    Public Function GetEscalationLevel(s As DialogueState) As Integer
        If Not EscalationCounters.ContainsKey(s) Then Return 0
        Return EscalationCounters(s)
    End Function

    Public Sub IncrementEscalationLevel(s As DialogueState, max As Integer)
        If Not EscalationCounters.ContainsKey(s) Then EscalationCounters(s) = 0
        EscalationCounters(s) = Math.Min(EscalationCounters(s) + 1, max - 1)
    End Sub

    ' --- Step helpers ---

    Public Function GetCurrentStep() As DialogueStep
        Dim matching = Steps.Where(Function(st) st.Type = State).ToList()
        If matching.Count = 0 Then Throw New InvalidOperationException($"No step for state {State} in task '{Id}'.")
        If matching.Count > 1 Then Throw New InvalidOperationException($"Duplicate steps for state {State} in task '{Id}'.")
        Return matching.Single()
    End Function

    Public Function GetCurrentEscalation() As Escalation
        Dim currentStep = GetCurrentStep()
        If currentStep.Escalations Is Nothing OrElse currentStep.Escalations.Count = 0 Then
            Throw New InvalidOperationException($"No escalations in step {State} for task '{Id}'.")
        End If
        Dim level = GetEscalationLevel(State)
        If level >= currentStep.Escalations.Count Then level = currentStep.Escalations.Count - 1
        Return currentStep.Escalations(level)
    End Function

    ' --- Reset ---

    Public Sub Reset()
        State = DialogueState.Start
        Value = Nothing
        InvalidConditionId = Nothing
        EscalationCounters.Clear()
        For Each child As TaskUtterance In SubTasks
            child.Reset()
        Next
    End Sub

    ' --- State persistence (used for Redis serialization between HTTP requests) ---

    ''' <summary>
    ''' Extracts only the mutable runtime state (State, Value, Counters) into a
    ''' serializable snapshot. Configuration (Steps, NlpContract, etc.) is excluded
    ''' because it is always reconstructed from the compiled dialog in Redis.
    ''' </summary>
    Public Function ExtractState() As TaskUtteranceStateSnapshot
        Dim snap As New TaskUtteranceStateSnapshot() With {
            .Id = Id,
            .State = State,
            .Value = If(Value, Nothing),
            .InvalidConditionId = InvalidConditionId,
            .EscalationCounters = New Dictionary(Of DialogueState, Integer)(EscalationCounters),
            .SubStates = SubTasks.Select(Function(s) s.ExtractState()).ToList()
        }
        Return snap
    End Function

    ''' <summary>
    ''' Re-applies a previously saved state snapshot onto this task and its subtasks.
    ''' Only applies if the snapshot Id matches — safe to call even on a mismatched tree.
    ''' </summary>
    Public Sub ApplyState(snapshot As TaskUtteranceStateSnapshot)
        If snapshot Is Nothing OrElse snapshot.Id <> Id Then Return
        State = snapshot.State
        Value = snapshot.Value
        InvalidConditionId = snapshot.InvalidConditionId
        If snapshot.EscalationCounters IsNot Nothing Then
            EscalationCounters = New Dictionary(Of DialogueState, Integer)(snapshot.EscalationCounters)
        End If
        If snapshot.SubStates IsNot Nothing Then
            For Each child As TaskUtterance In SubTasks
                Dim childSnap = snapshot.SubStates.FirstOrDefault(Function(s) s.Id = child.Id)
                If childSnap IsNot Nothing Then child.ApplyState(childSnap)
            Next
        End If
    End Sub

End Class

' ---------------------------------------------------------------------------
' Serializable state snapshot — contains ONLY mutable runtime state.
' Configuration fields (Steps, NlpContract, ValidationConditions) are
' intentionally absent; they are always rebuilt from the compiled dialog.
' ---------------------------------------------------------------------------

''' <summary>
''' Lightweight snapshot of a TaskUtterance's runtime state, safe to serialize
''' to JSON and store in Redis between HTTP requests.
''' </summary>
Public Class TaskUtteranceStateSnapshot
    Public Property Id As String
    Public Property State As DialogueState
    Public Property Value As Object
    Public Property InvalidConditionId As String
    Public Property EscalationCounters As Dictionary(Of DialogueState, Integer)
    Public Property SubStates As List(Of TaskUtteranceStateSnapshot)

    Public Sub New()
        EscalationCounters = New Dictionary(Of DialogueState, Integer)()
        SubStates = New List(Of TaskUtteranceStateSnapshot)()
    End Sub
End Class
