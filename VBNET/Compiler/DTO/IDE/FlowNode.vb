Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Flow node (equivalent to reactflow Node)
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class FlowNode
    ''' <summary>
    ''' Node ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Node data (rows, label, etc.)
    ''' </summary>
    <JsonProperty("data")>
    Public Property Data As NodeData
End Class


