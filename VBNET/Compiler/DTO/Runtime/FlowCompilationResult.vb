Option Strict On
Option Explicit On
Imports Newtonsoft.Json

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

    Public Sub New()
        TaskGroups = New List(Of TaskGroup)()
        Tasks = New List(Of CompiledTask)()
        Edges = New List(Of FlowEdge)()
    End Sub
End Class


