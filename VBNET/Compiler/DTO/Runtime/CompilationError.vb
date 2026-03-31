Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Compilation error with task/node/row/edge context and optional structured fields for UI and tooling.
''' category = stable code (e.g. MissingOrInvalidTask, AmbiguousLink); message = short diagnostic (English).
''' Human-facing copy is resolved on the frontend from category + these fields.
''' </summary>
Public Class CompilationError
    <JsonProperty("taskId")>
    Public Property TaskId As String

    <JsonProperty("nodeId")>
    Public Property NodeId As String

    <JsonProperty("rowId")>
    Public Property RowId As String

    <JsonProperty("edgeId")>
    Public Property EdgeId As String

    <JsonProperty("message")>
    Public Property Message As String

    <JsonProperty("severity")>
    Public Property Severity As ErrorSeverity

    ''' <summary>
    ''' Stable error kind: NoEntryNodes, MissingOrInvalidTask, AmbiguousLink, TaskCompilationFailed, etc.
    ''' </summary>
    <JsonProperty("category")>
    Public Property Category As String

    ''' <summary>Display label for the row (user text), when row-scoped.</summary>
    <JsonProperty("rowLabel")>
    Public Property RowLabel As String

    ''' <summary>Task reference stored on the row (may be empty).</summary>
    <JsonProperty("rowTaskRef")>
    Public Property RowTaskRef As String

    ''' <summary>Resolved task id from flow.Tasks when found.</summary>
    <JsonProperty("resolvedTaskId")>
    Public Property ResolvedTaskId As String

    ''' <summary>True when row had no TaskId (reference missing).</summary>
    <JsonProperty("missingTaskRef")>
    Public Property MissingTaskRef As Boolean?

    ''' <summary>Invalid task type enum value when applicable.</summary>
    <JsonProperty("invalidType")>
    Public Property InvalidType As Integer?

    ''' <summary>Condition id for link/condition errors.</summary>
    <JsonProperty("conditionId")>
    Public Property ConditionId As String

    ''' <summary>Fine-grained code for TaskCompilationFailed (TemplateNotFound, InvalidContract, …).</summary>
    <JsonProperty("detailCode")>
    Public Property DetailCode As String

    ''' <summary>Technical detail for support/debug (not for end-user copy).</summary>
    <JsonProperty("technicalDetail")>
    Public Property TechnicalDetail As String

    ''' <summary>AmbiguousLink: sameLabel, sameCondition, overlappingConditions, missingConditionInMultiExit.</summary>
    <JsonProperty("reason")>
    Public Property Reason As String

    ''' <summary>Other edge ids involved in an ambiguity.</summary>
    <JsonProperty("conflictsWith")>
    Public Property ConflictsWith As List(Of String)

    ''' <summary>MultipleEntryNodes: ids of candidate entry nodes.</summary>
    <JsonProperty("entryNodeIds")>
    Public Property EntryNodeIds As List(Of String)

    ''' <summary>LinkMissingCondition: other outgoing edges from the same node.</summary>
    <JsonProperty("siblingEdgeIds")>
    Public Property SiblingEdgeIds As List(Of String)

    ''' <summary>Utterance step key matching frontend steps object (e.g. noMatch, start).</summary>
    <JsonProperty("stepKey")>
    Public Property StepKey As String

    ''' <summary>Zero-based index of escalation within the step (EmptyEscalation).</summary>
    <JsonProperty("escalationIndex")>
    Public Property EscalationIndex As Integer?

    Public Sub New()
        TaskId = String.Empty
        NodeId = String.Empty
        RowId = String.Empty
        EdgeId = String.Empty
        Message = String.Empty
        Severity = ErrorSeverity.Error
        Category = String.Empty
        RowLabel = String.Empty
        RowTaskRef = String.Empty
        ResolvedTaskId = String.Empty
        ConditionId = String.Empty
        DetailCode = String.Empty
        TechnicalDetail = String.Empty
        Reason = String.Empty
        StepKey = String.Empty
    End Sub
End Class
