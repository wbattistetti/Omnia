Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.Json.Serialization

''' <summary>
''' Action: Unified Task in escalation (complete Task object, not a reference)
''' Corresponds to Task TypeScript type in frontend
''' </summary>
Public Class Action
        <JsonPropertyName("id")>
        Public Property Id As String

        <JsonPropertyName("templateId")>
        Public Property TemplateId As String

        <JsonPropertyName("parameters")>
        Public Property Parameters As List(Of Compiler.ActionParameter)

        Public Sub New()
            Parameters = New List(Of ActionParameter)()
        End Sub
    End Class

