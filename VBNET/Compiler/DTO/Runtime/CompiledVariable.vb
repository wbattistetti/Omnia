Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' CompiledVariable: Variabile trasformata per runtime
''' Mantiene solo ID necessari (varId, taskInstanceId, nodeId)
''' Aggiunge values per storico runtime
''' </summary>
Public Class CompiledVariable
    <JsonProperty("varId")>
    Public Property VarId As String

    <JsonProperty("taskInstanceId")>
    Public Property TaskInstanceId As String

    <JsonProperty("nodeId")>
    Public Property NodeId As String

    <JsonProperty("values")>
    Public Property Values As List(Of Object)

    Public Sub New()
        Values = New List(Of Object)()
    End Sub
End Class
