Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

''' <summary>
''' ActionParameter: corrisponde ESATTAMENTE a ActionParameter TypeScript del frontend
''' </summary>
Public Class ActionParameter
    <JsonPropertyName("parameterId")>
    Public Property ParameterId As String

    <JsonPropertyName("value")>
    Public Property Value As String
End Class

