Option Strict On
Option Explicit On

''' <summary>
''' Task source information
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class TaskSource
    ''' <summary>
    ''' Source type: flowchart, ddt-step, ddt-recovery-action
    ''' </summary>
    Public Property Type As String

    ''' <summary>
    ''' Flowchart node ID (if from flowchart)
    ''' </summary>
    Public Property NodeId As String

    ''' <summary>
    ''' Flowchart row ID (if from flowchart)
    ''' </summary>
    Public Property RowId As String
End Class


