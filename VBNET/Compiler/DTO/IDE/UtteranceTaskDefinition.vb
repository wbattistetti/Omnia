Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Task definition specifica per UtteranceInterpretation (richiesta dati ricorsiva)
''' Eredita da TaskDefinition e aggiunge campi specifici per DDT/NLP
''' </summary>
Public Class UtteranceTaskDefinition
    Inherits TaskDefinition

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
    ''' ✅ OBBLIGATORIO: dataContract (singolare) - Contratto NLP per estrazione dati
    ''' Solo per template: contiene la struttura NLP completa (regex, rules, ner, llm)
    ''' Formato: { templateName, templateId, parsers: [{ type: "regex", patterns: [...] }] }
    ''' Il compilatore richiede questo campo per materializzare il grafo runtime.
    ''' Se manca → errore esplicito (nessun fallback).
    ''' </summary>
    <JsonProperty("dataContract")>
    Public Property DataContract As NLPContract

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
        MyBase.New()
        SubTasksIds = New List(Of String)()
        Steps = New Dictionary(Of String, Object)()
        Constraints = New List(Of Object)()
    End Sub
End Class

