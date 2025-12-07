Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Row data in a node
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class RowData
    ''' <summary>
    ''' Row ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Task ID (optional, falls back to Id if not present)
    ''' </summary>
    <JsonProperty("taskId")>
    Public Property TaskId As String
End Class


