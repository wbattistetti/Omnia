Option Strict On
Option Explicit On

''' <summary>
''' Row data in a node
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class RowData
    ''' <summary>
    ''' Row ID
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Task ID (optional, falls back to Id if not present)
    ''' </summary>
    Public Property TaskId As String

    ''' <summary>
    ''' Row text
    ''' </summary>
    Public Property Text As String
End Class


