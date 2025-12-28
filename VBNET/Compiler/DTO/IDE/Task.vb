Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' Task definition
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' Simplified: Uses templateId (string) directly, no conversion needed
''' </summary>
Public Class Task
    ''' <summary>
    ''' Task ID
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Task template ID (string, e.g., "SayMessage", "GetData")
    ''' Direct mapping from IDE to Runtime - no conversion needed
    ''' </summary>
    <JsonProperty("templateId")>
    Public Property TemplateId As String

    ''' <summary>
    ''' Task text (for SayMessage tasks) - direct property from frontend
    ''' </summary>
    <JsonProperty("text")>
    Public Property Text As String

    ''' <summary>
    ''' Task value (parameters, DDT reference, etc.)
    ''' </summary>
    <JsonProperty("value")>
    Public Property Value As Dictionary(Of String, Object)

    Public Sub New()
        Value = New Dictionary(Of String, Object)()
    End Sub
End Class

