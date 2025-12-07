Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports DDTEngine

''' <summary>
''' CompiledTask: Task with condition and state for execution
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class CompiledTask
    ''' <summary>
    ''' Task ID (GUID) - same as row.id for flowchart tasks
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Task action type (enum invece di stringa per type safety)
    ''' </summary>
    Public Property Action As ActionType

    ''' <summary>
    ''' Task value (parameters, DDT reference, etc.)
    ''' </summary>
    Public Property Value As Dictionary(Of String, Object)

    ''' <summary>
    ''' Execution condition (opzionale - può essere Nothing)
    ''' Se presente, viene valutata insieme alla condizione del TaskGroup (AND logico)
    ''' </summary>
    Public Property Condition As Condition

    ''' <summary>
    ''' Current execution state
    ''' </summary>
    Public Property State As TaskState

    ''' <summary>
    ''' Debug information (opzionale - solo per sviluppo/debugging)
    ''' </summary>
    Public Property Debug As TaskDebugInfo

    Public Sub New()
        Value = New Dictionary(Of String, Object)()
        State = TaskState.UnExecuted
    End Sub
End Class

