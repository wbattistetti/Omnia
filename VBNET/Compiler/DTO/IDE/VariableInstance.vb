Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' VariableInstance: Variabile associata a un'istanza di task
''' Ogni variabile ha un varId univoco per evitare collisioni quando lo stesso template è usato in istanze diverse
''' </summary>
Public Class VariableInstance
    <JsonProperty("varId")>
    Public Property VarId As String

    <JsonProperty("varName")>
    Public Property VarName As String

    <JsonProperty("taskInstanceId")>
    Public Property TaskInstanceId As String

    <JsonProperty("nodeId")>
    Public Property NodeId As String

    <JsonProperty("ddtPath")>
    Public Property DdtPath As String
End Class
