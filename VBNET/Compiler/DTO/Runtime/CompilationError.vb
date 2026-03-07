Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Compilation error with task/node/row context
''' Every error must have a taskId for traceability
''' </summary>
Public Class CompilationError
    ''' <summary>
    ''' Task ID (obligatory) - use row.Id as fallback if row.TaskId is missing
    ''' </summary>
    <JsonProperty("taskId")>
    Public Property TaskId As String

    ''' <summary>
    ''' Node ID (optional) - for node-level errors
    ''' </summary>
    <JsonProperty("nodeId")>
    Public Property NodeId As String

    ''' <summary>
    ''' Row ID (optional) - for row-level errors
    ''' </summary>
    <JsonProperty("rowId")>
    Public Property RowId As String

    ''' <summary>
    ''' Error message (user-friendly)
    ''' </summary>
    <JsonProperty("message")>
    Public Property Message As String

    ''' <summary>
    ''' Error severity (Error, Warning, Critical)
    ''' </summary>
    <JsonProperty("severity")>
    Public Property Severity As ErrorSeverity

    ''' <summary>
    ''' Error category (e.g., "TaskNotFound", "MissingTaskId", "NoEntryNodes")
    ''' </summary>
    <JsonProperty("category")>
    Public Property Category As String

    Public Sub New()
        TaskId = String.Empty
        NodeId = String.Empty
        RowId = String.Empty
        Message = String.Empty
        Severity = ErrorSeverity.Error
        Category = String.Empty
    End Sub
End Class
