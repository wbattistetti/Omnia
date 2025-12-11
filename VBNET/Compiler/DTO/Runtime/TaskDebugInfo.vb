Option Strict On
Option Explicit On

''' <summary>
''' Debug information per un CompiledTask
''' Solo per sviluppo/debugging - non necessario per l'esecuzione
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class TaskDebugInfo
    ''' <summary>
    ''' Tipo di origine del task
    ''' </summary>
    Public Property SourceType As TaskSourceType

    ''' <summary>
    ''' Flowchart node ID (se da flowchart)
    ''' </summary>
    Public Property NodeId As String

    ''' <summary>
    ''' Flowchart row ID (se da flowchart)
    ''' </summary>
    Public Property RowId As String

    ''' <summary>
    ''' Original task instance ID
    ''' </summary>
    Public Property OriginalTaskId As String
End Class


