Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Flow node (simplified structure - no data wrapper)
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' Structure: { id, label, rows: [...] } - NO data wrapper
''' </summary>
Public Class FlowNode
    ''' <summary>
    ''' Node ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Node label (optional title)
    ''' </summary>
    <JsonProperty("label")>
    Public Property Label As String

    ''' <summary>
    ''' Task rows in the node (directly, no wrapper)
    ''' </summary>
    <JsonProperty("rows")>
    Public Property Rows As List(Of TaskRow)

    Public Sub New()
        Rows = New List(Of TaskRow)()
    End Sub
End Class


