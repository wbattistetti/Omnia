Option Strict On
Option Explicit On

Imports System.Collections.Generic
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

    Public Sub New()
        TaskGroups = New List(Of TaskGroup)()
        Tasks = New List(Of CompiledTask)()
    End Sub
End Class


