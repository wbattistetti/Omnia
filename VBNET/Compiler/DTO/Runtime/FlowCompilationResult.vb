Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports DTO.Runtime

''' <summary>
''' Flow Compilation Result: Output of FlowCompiler
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class FlowCompilationResult
    ''' <summary>
    ''' List of TaskGroups (uno per nodo)
    ''' </summary>
    <JsonProperty("taskGroups")>
    Public Property TaskGroups As List(Of TaskGroup)

    ''' <summary>
    ''' First TaskGroup to execute (entry node)
    ''' </summary>
    <JsonProperty("entryTaskGroupId")>
    Public Property EntryTaskGroupId As String

    ''' <summary>
    ''' List of all compiled tasks (flat list for compatibility)
    ''' ✅ Usa CompiledTaskListConverter per deserializzare le classi polimorfiche
    ''' </summary>
    <JsonProperty("tasks")>
    <JsonConverter(GetType(CompiledTaskListConverter))>
    Public Property Tasks As List(Of CompiledTask)

    ''' <summary>
    ''' Topologia del flow (link tra nodi)
    ''' ✅ FASE 2.4: HFSM - Topologia separata (non dentro TaskGroup)
    ''' </summary>
    <JsonProperty("edges")>
    Public Property Edges As List(Of FlowEdge)

    ''' <summary>
    ''' List of compilation errors (Critical, Error, Warning)
    ''' </summary>
    <JsonProperty("errors")>
    Public Property Errors As List(Of CompilationError)

    ''' <summary>
    ''' True if compilation has Error or Critical errors (blocks orchestrator)
    ''' </summary>
    <JsonProperty("hasErrors")>
    Public ReadOnly Property HasErrors As Boolean
        Get
            If Errors Is Nothing Then Return False
            Return Errors.Any(Function(e) e.Severity = ErrorSeverity.Error OrElse e.Severity = ErrorSeverity.Critical)
        End Get
    End Property

    ''' <summary>
    ''' True if compilation has Critical errors (orchestrator must reject)
    ''' </summary>
    <JsonProperty("hasCriticalErrors")>
    Public ReadOnly Property HasCriticalErrors As Boolean
        Get
            If Errors Is Nothing Then Return False
            Return Errors.Any(Function(e) e.Severity = ErrorSeverity.Critical)
        End Get
    End Property

    Public Sub New()
        TaskGroups = New List(Of TaskGroup)()
        Tasks = New List(Of CompiledTask)()
        Edges = New List(Of FlowEdge)()
        Errors = New List(Of CompilationError)()
    End Sub
End Class


