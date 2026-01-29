Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' Node data
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class NodeData
    ''' <summary>
    ''' Rows in the node
    ''' </summary>
    <JsonProperty("rows")>
    Public Property Rows As List(Of TaskRow)

    Public Sub New()
        Rows = New List(Of TaskRow)()
    End Sub
End Class


