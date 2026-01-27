Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' AssembledDDT: corrisponde ESATTAMENTE a AssembledDDT TypeScript del frontend
''' mainData può essere:
''' - Oggetto singolo (DDT semplice): mainData: MainDataNode
''' - Array (DDT aggregato): mainData: MainDataNode[]
''' </summary>
Public Class AssembledDDT
    <JsonProperty("id")>
    Public Property Id As String

    <JsonProperty("label")>
    Public Property Label As String

    <JsonProperty("mainData")>
    <JsonConverter(GetType(MainDataNodeListConverter))>
    Public Property MainData As List(Of Compiler.MainDataNode)

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)

    <JsonProperty("introduction")>
    Public Property Introduction As Compiler.DialogueStep

    ''' <summary>
    ''' Constraints a livello root (opzionale, risolto lazy dal template se mancante)
    ''' </summary>
    <JsonProperty("constraints")>
    Public Property Constraints As List(Of Object)

    ''' <summary>
    ''' Examples a livello root (opzionale, risolto lazy dal template se mancante)
    ''' </summary>
    <JsonProperty("examples")>
    Public Property Examples As List(Of Object)

    Public Sub New()
        Translations = New Dictionary(Of String, String)()
        MainData = New List(Of Compiler.MainDataNode)()
        Constraints = New List(Of Object)()
        Examples = New List(Of Object)()
    End Sub
End Class

