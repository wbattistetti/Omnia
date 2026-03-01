Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports TaskEngine
Imports Compiler.DTO.IDE

''' <summary>
''' TaskNode: corrisponde ESATTAMENTE a TaskTreeNode TypeScript del frontend
''' steps può essere:
''' - Array: [{ type: "start", escalations: [...] }, ...]
''' - Oggetto (Record): { "start": { escalations: [...] }, "noMatch": {...} }
''' </summary>
Public Class TaskNode
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("name")>
    Public Property Name As String

    <JsonProperty("label")>
    Public Property Label As String

    <JsonProperty("type")>
    Public Property Type As String

    <JsonProperty("required")>
    Public Property Required As Boolean

    <JsonProperty("condition")>
    Public Property Condition As String

    <JsonProperty("steps")>
    <JsonConverter(GetType(DialogueStepListConverter))>
    Public Property Steps As List(Of DialogueStep)

    <JsonProperty("subTasks")>
    Public Property SubTasks As List(Of TaskNode)

    <JsonProperty("synonyms")>
    Public Property Synonyms As List(Of String)

    <JsonProperty("constraints")>
    Public Property Constraints As List(Of Object)

    <JsonProperty("templateId")>
    Public Property TemplateId As String

    <JsonProperty("dataContract")>
    Public Property DataContract As NLPContract

    Public Sub New()
        Steps = New List(Of DialogueStep)()
        SubTasks = New List(Of TaskNode)()
        Synonyms = New List(Of String)()
        Constraints = New List(Of Object)()
    End Sub
End Class
