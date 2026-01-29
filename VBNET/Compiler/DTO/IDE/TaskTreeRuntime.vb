Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' TaskTreeRuntime: formato runtime per DDTEngine (ex AssembledDDT)
''' ✅ RINOMINATO: AssembledDDT → TaskTreeRuntime
''' Il frontend usa TaskTree, il compilatore converte TaskTree → TaskTreeRuntime per il runtime.
''' NOTA: DDTEngine/DDTInstance/DDTNode sono interni al runtime e non vengono rinominati per non toccare la logica funzionale.
''' data è sempre un array: data: MainDataNode[]
''' </summary>
Public Class TaskTreeRuntime
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("label")>
    Public Property Label As String

    <JsonProperty("data")>
    <JsonConverter(GetType(MainDataNodeListConverter))>
    Public Property Data As List(Of Compiler.MainDataNode)

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
        Data = New List(Of Compiler.MainDataNode)()
        Constraints = New List(Of Object)()
    End Sub
End Class

