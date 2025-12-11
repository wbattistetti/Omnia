Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Edge data
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class EdgeData
    ''' <summary>
    ''' Condition ID (GUID)
    ''' </summary>
    <JsonProperty("condition")>
    Public Property Condition As String

    ''' <summary>
    ''' Is this an Else edge?
    ''' </summary>
    <JsonProperty("isElse")>
    Public Property IsElse As Boolean?
End Class


