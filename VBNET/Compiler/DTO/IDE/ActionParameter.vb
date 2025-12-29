Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' ActionParameter: corrisponde ESATTAMENTE a ActionParameter TypeScript del frontend
''' </summary>
Public Class ActionParameter
    <JsonProperty("parameterId")>
    Public Property ParameterId As String

    <JsonProperty("value")>
    Public Property Value As String
End Class

