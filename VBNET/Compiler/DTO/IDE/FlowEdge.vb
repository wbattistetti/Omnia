Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Flow edge (equivalent to reactflow Edge)
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class FlowEdge
    ''' <summary>
    ''' Edge ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Source node ID
    ''' </summary>
    <JsonProperty("source")>
    Public Property Source As String

    ''' <summary>
    ''' Target node ID
    ''' </summary>
    <JsonProperty("target")>
    Public Property Target As String

    ''' <summary>
    ''' Edge data (condition, isElse, etc.)
    ''' </summary>
    <JsonProperty("data")>
    Public Property Data As EdgeData
End Class


