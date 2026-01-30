Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' TaskTreeRuntime: formato runtime per TaskEngine (ex AssembledDDT)
''' ✅ RINOMINATO: AssembledDDT → TaskTreeRuntime
''' Il frontend usa TaskTree, il compilatore converte TaskTree → TaskTreeRuntime per il runtime.
''' NOTA: TaskEngine/TaskInstance/TaskNode sono interni al runtime.
''' nodes è sempre un array: nodes: TaskNode[]
''' </summary>
Public Class TaskTreeRuntime
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("label")>
    Public Property Label As String

    <JsonProperty("nodes")>
    <JsonConverter(GetType(TaskNodeListConverter))>
    Public Property Nodes As List(Of Compiler.TaskNode)

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)

    <JsonProperty("introduction")>
    Public Property Introduction As Compiler.DialogueStep

    ''' <summary>
    ''' Constraints a livello root (opzionale, risolto lazy dal template se mancante)
    ''' </summary>
    <JsonProperty("constraints")>
    Public Property Constraints As List(Of Object)

    Public Sub New()
        Translations = New Dictionary(Of String, String)()
        Nodes = New List(Of Compiler.TaskNode)()
        Constraints = New List(Of Object)()
    End Sub
End Class

