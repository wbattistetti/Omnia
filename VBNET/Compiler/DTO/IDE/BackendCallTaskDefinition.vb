Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Task definition specifica per BackendCall
''' Eredita da TaskDefinition e aggiunge campi specifici per BackendCall
''' </summary>
Public Class BackendCallTaskDefinition
    Inherits TaskDefinition

    ''' <summary>
    ''' Endpoint configuration: { url, method, headers }
    ''' </summary>
    <JsonProperty("endpoint")>
    Public Property Endpoint As Dictionary(Of String, Object)

    ''' <summary>
    ''' Input mappings: array di { internalName, variable, apiParam }
    ''' </summary>
    <JsonProperty("inputs")>
    Public Property Inputs As List(Of Dictionary(Of String, Object))

    ''' <summary>
    ''' Output mappings: array di { internalName, variable, apiField }
    ''' </summary>
    <JsonProperty("outputs")>
    Public Property Outputs As List(Of Dictionary(Of String, Object))

    ''' <summary>
    ''' Mock table: array di righe con { id, inputs: {...}, outputs: {...} }
    ''' </summary>
    <JsonProperty("mockTable")>
    Public Property MockTable As List(Of Dictionary(Of String, Object))

    Public Sub New()
        MyBase.New()
        Inputs = New List(Of Dictionary(Of String, Object))()
        Outputs = New List(Of Dictionary(Of String, Object))()
        MockTable = New List(Of Dictionary(Of String, Object))()
    End Sub
End Class
