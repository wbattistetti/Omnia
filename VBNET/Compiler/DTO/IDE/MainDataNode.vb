Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' MainDataNode: corrisponde ESATTAMENTE a MainDataNode TypeScript del frontend
''' steps può essere:
''' - Array: [{ type: "start", escalations: [...] }, ...]
''' - Oggetto (Record): { "start": { escalations: [...] }, "noMatch": {...} }
''' </summary>
Public Class MainDataNode
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
        Public Property Steps As List(Of Compiler.DialogueStep)

        <JsonProperty("subData")>
        Public Property SubData As List(Of Compiler.MainDataNode)

        <JsonProperty("synonyms")>
        Public Property Synonyms As List(Of String)

        <JsonProperty("constraints")>
        Public Property Constraints As List(Of Object)

        Public Sub New()
            Steps = New List(Of Compiler.DialogueStep)()
            SubData = New List(Of Compiler.MainDataNode)()
            Synonyms = New List(Of String)()
            Constraints = New List(Of Object)()
        End Sub
    End Class
