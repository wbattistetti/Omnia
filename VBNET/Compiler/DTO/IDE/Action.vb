Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.Json.Serialization

''' <summary>
''' Action: corrisponde ESATTAMENTE a Action TypeScript del frontend
''' </summary>
Public Class Action
        <JsonPropertyName("actionId")>
        Public Property ActionId As String

        <JsonPropertyName("actionInstanceId")>
        Public Property ActionInstanceId As String

    <JsonPropertyName("parameters")>
    Public Property Parameters As List(Of Compiler.ActionParameter)

        Public Sub New()
            Parameters = New List(Of ActionParameter)()
        End Sub
    End Class

