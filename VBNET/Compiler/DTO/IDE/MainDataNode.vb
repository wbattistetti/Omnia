Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.Json.Serialization

''' <summary>
''' MainDataNode: corrisponde ESATTAMENTE a MainDataNode TypeScript del frontend
''' 'NOTA DA TOGLIERE: che un data sia maindata dipende da come è strutturato il DDT de una dato ha filgi allora è un maindata altrimenti e un data. Non ha molto senso la lcasse MAINDATA perchè il significato MAIN o sub dipende dla contesto id annidmaento. QUindio probaiblmente è sbaglaito. 
''' 
''' </summary>
Public Class MainDataNode
        <JsonPropertyName("id")>
        Public Property Id As String

        <JsonPropertyName("name")>
        Public Property Name As String

        <JsonPropertyName("label")>
        Public Property Label As String

        <JsonPropertyName("type")>
        Public Property Type As String

        <JsonPropertyName("required")>
        Public Property Required As Boolean

        <JsonPropertyName("condition")>
        Public Property Condition As String

    <JsonPropertyName("steps")>
    Public Property Steps As List(Of Compiler.StepGroup)

    <JsonPropertyName("subData")>
    Public Property SubData As List(Of Compiler.MainDataNode)

        <JsonPropertyName("synonyms")>
        Public Property Synonyms As List(Of String)

        <JsonPropertyName("constraints")>
        Public Property Constraints As List(Of Object)

        Public Sub New()
            Steps = New List(Of StepGroup)()
            SubData = New List(Of MainDataNode)()
            Synonyms = New List(Of String)()
            Constraints = New List(Of Object)()
        End Sub
    End Class

