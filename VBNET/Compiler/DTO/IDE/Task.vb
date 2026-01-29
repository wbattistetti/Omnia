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
    ''' ❌ DEPRECATED: Non più usato. La struttura viene costruita dal template usando templateId.
    ''' Mantenuto solo per backward compatibility durante migrazione.
    ''' </summary>
    <JsonProperty("data")>
    <Obsolete("Use templateId to build structure from template instead")>
    <JsonConverter(GetType(MainDataNodeListConverter))>
    Public Property Data As List(Of MainDataNode)

    ''' <summary>
    ''' ✅ NUOVO: Steps override a root level: { "templateId": { start: {...}, noMatch: {...} } }
    ''' Steps sono keyed per templateId del nodo
    ''' </summary>
    <JsonProperty("steps")>
    Public Property Steps As Dictionary(Of String, Object)

    ''' <summary>
    ''' ❌ DEPRECATED: Use Steps instead
    ''' </summary>
    <JsonProperty("stepPrompts")>
    <Obsolete("Use Steps instead")>
    Public Property StepPrompts As Dictionary(Of String, Object)

    ''' <summary>
    ''' ❌ DEPRECATED: Constraints vengono sempre dal template, non dall'istanza
    ''' </summary>
    <JsonProperty("constraints")>
    <Obsolete("Constraints come sempre dal template, non dall'istanza")>
    Public Property Constraints As List(Of Object)

    Public Sub New()
        Parameters = New List(Of TaskParameter)()
        Value = New Dictionary(Of String, Object)()
        Data = New List(Of MainDataNode)()
        Steps = New Dictionary(Of String, Object)()
        StepPrompts = New Dictionary(Of String, Object)()
        Constraints = New List(Of Object)()
    End Sub
End Class

