Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' TaskParameter: corrisponde ESATTAMENTE a TaskParameter TypeScript del frontend
''' </summary>
Public Class TaskParameter
    <JsonProperty("parameterId")>
    Public Property ParameterId As String

    <JsonProperty("value")>
    Public Property Value As String
End Class

