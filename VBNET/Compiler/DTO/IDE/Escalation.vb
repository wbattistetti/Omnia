Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.Json.Serialization

''' <summary>
''' Escalation: corrisponde ESATTAMENTE a Escalation TypeScript del frontend
''' </summary>
Public Class Escalation
        <JsonPropertyName("escalationId")>
        Public Property EscalationId As String

    <JsonPropertyName("actions")>
    Public Property Actions As List(Of Compiler.Action)

        Public Sub New()
            Actions = New List(Of Action)()
        End Sub
    End Class

