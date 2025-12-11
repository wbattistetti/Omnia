Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.Json.Serialization

''' <summary>
''' AssembledDDT: corrisponde ESATTAMENTE a AssembledDDT TypeScript del frontend
''' </summary>
Public Class AssembledDDT
    <JsonPropertyName("id")>
    Public Property Id As String

    <JsonPropertyName("label")>
    Public Property Label As String

    <JsonPropertyName("mainData")>
    Public Property MainData As Compiler.MainDataNode

    <JsonPropertyName("translations")>
    Public Property Translations As Dictionary(Of String, String)

    <JsonPropertyName("introduction")>
    Public Property Introduction As Compiler.StepGroup

    Public Sub New()
        Translations = New Dictionary(Of String, String)()
    End Sub
End Class

