Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Flow Compilation Result: Output of FlowCompiler
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class FlowCompilationResult
    ''' <summary>
    ''' List of TaskGroups (uno per nodo)
    ''' </summary>
    Public Property TaskGroups As List(Of TaskGroup)

    ''' <summary>
    ''' Fast lookup by node ID
    ''' </summary>
    Public Property TaskGroupMap As Dictionary(Of String, TaskGroup)

    ''' <summary>
    ''' First TaskGroup to execute (entry node)
    ''' </summary>
    Public Property EntryTaskGroupId As String

    ''' <summary>
    ''' List of all compiled tasks (flat list for compatibility)
    ''' </summary>
    Public Property Tasks As List(Of CompiledTask)

    ''' <summary>
    ''' Fast lookup by task ID
    ''' </summary>
    Public Property TaskMap As Dictionary(Of String, CompiledTask)

    Public Sub New()
        TaskGroups = New List(Of TaskGroup)()
        TaskGroupMap = New Dictionary(Of String, TaskGroup)()
        Tasks = New List(Of CompiledTask)()
        TaskMap = New Dictionary(Of String, CompiledTask)()
    End Sub
End Class


