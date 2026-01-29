Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' Task definition
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' Simplified: Uses templateId (string) directly, no conversion needed
''' ✅ UNIFIED: Uses Newtonsoft.Json attributes for consistency
''' </summary>
Public Class Task
    ''' <summary>
    ''' Task ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Task type (enum numerico, e.g., 0=SayMessage, 3=DataRequest)
    ''' Determina il comportamento del task
    ''' PRIORITÀ 1: Usa questo campo se presente
    ''' </summary>
    <JsonProperty("type")>
    Public Property Type As Integer?

    ''' <summary>
    ''' Task template ID (string, e.g., "SayMessage", "GetData")
    ''' null = Task standalone, GUID = referenzia un altro Task
    ''' PRIORITÀ 2: Usa questo campo come fallback se Type non è presente
    ''' </summary>
    <JsonProperty("templateId")>
    Public Property TemplateId As String

    ''' <summary>
    ''' Task text (for SayMessage tasks) - direct property from frontend
    ''' </summary>
    <JsonProperty("text")>
    Public Property Text As String

    ''' <summary>
    ''' Task parameters array (for tasks in escalations)
    ''' Array of { parameterId: string, value: string }
    ''' </summary>
    <JsonProperty("parameters")>
    Public Property Parameters As List(Of TaskParameter)

    ''' <summary>
    ''' Task value (parameters, DDT reference, etc.) - legacy format
    ''' </summary>
    <JsonProperty("value")>
    Public Property Value As Dictionary(Of String, Object)

    ''' <summary>
    ''' Task label override (if different from template)
    ''' </summary>
    <JsonProperty("label")>
    Public Property Label As String

    ''' <summary>
    ''' ✅ NUOVO: SubTasksIds - Array di templateId che referenziano altri template
    ''' Solo per template: definisce la struttura come grafo di riferimenti
    ''' Per istanze: sempre null (la struttura viene dal template)
    ''' </summary>
    <JsonProperty("subTasksIds")>
    Public Property SubTasksIds As List(Of String)

    ''' <summary>
    ''' ✅ NUOVO: Steps override a root level: { "templateId": { start: {...}, noMatch: {...} } }
    ''' Steps sono keyed per templateId del nodo
    ''' Solo per istanze: override degli steps del template
    ''' </summary>
    <JsonProperty("steps")>
    Public Property Steps As Dictionary(Of String, Object)

    ''' <summary>
    ''' ✅ Constraints del template (priorità 1: dataContracts)
    ''' Solo per template: constraints per validazione dati
    ''' Per istanze: sempre null (constraints vengono dal template)
    ''' </summary>
    <JsonProperty("dataContracts")>
    Public Property DataContracts As List(Of Object)

    ''' <summary>
    ''' ✅ Constraints del template (priorità 2: constraints, fallback)
    ''' Solo per template: constraints per validazione dati
    ''' Per istanze: sempre null (constraints vengono dal template)
    ''' </summary>
    <JsonProperty("constraints")>
    Public Property Constraints As List(Of Object)

    ''' <summary>
    ''' ✅ Condition del template (condizione di esecuzione del nodo)
    ''' Solo per template: quando il nodo è attivo/saltato
    ''' </summary>
    <JsonProperty("condition")>
    Public Property Condition As String

    Public Sub New()
        Parameters = New List(Of TaskParameter)()
        Value = New Dictionary(Of String, Object)()
        SubTasksIds = New List(Of String)()
        Steps = New Dictionary(Of String, Object)()
        DataContracts = New List(Of Object)()
        Constraints = New List(Of Object)()
    End Sub
End Class

