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

    Public Sub New()
        Translations = New Dictionary(Of String, String)()
        MainData = New List(Of Compiler.MainDataNode)()
    End Sub
End Class

