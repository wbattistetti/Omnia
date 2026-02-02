Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' TaskGroup: rappresenta un nodo con tutte le sue righe (task)
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class TaskGroup
    ''' <summary>
    ''' ID del nodo associato
    ''' </summary>
    <JsonProperty("nodeId")>
    Public Property NodeId As String

    ''' <summary>
    ''' Condizione di esecuzione del nodo (calcolata UNA volta)
    ''' </summary>
    <JsonProperty("execCondition")>
    Public Property ExecCondition As Condition

    ''' <summary>
    ''' Lista di task (righe) da eseguire in sequenza
    ''' ✅ Usa CompiledTaskListConverter per deserializzare le classi polimorfiche
    ''' </summary>
    <JsonProperty("tasks")>
    <JsonConverter(GetType(CompiledTaskListConverter))>
    Public Property Tasks As List(Of CompiledTask)

    ''' <summary>
    ''' Indica se il TaskGroup è stato eseguito (valorizzato a runtime)
    ''' </summary>
    <JsonProperty("executed")>
    Public Property Executed As Boolean

    Public Sub New()
        Tasks = New List(Of CompiledTask)()
        Executed = False
    End Sub
End Class


