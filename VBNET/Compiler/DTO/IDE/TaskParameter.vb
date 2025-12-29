Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

''' <summary>
''' TaskParameter: corrisponde ESATTAMENTE a TaskParameter TypeScript del frontend
''' </summary>
Public Class TaskParameter
    <JsonPropertyName("parameterId")>
    Public Property ParameterId As String

    <JsonPropertyName("value")>
    Public Property Value As String
End Class

