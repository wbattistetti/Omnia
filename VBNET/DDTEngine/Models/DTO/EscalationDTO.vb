' EscalationDTO.vb
' DTO per deserializzazione JSON di Escalation

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

    ''' <summary>
    ''' DTO per deserializzare Escalation dal JSON
    ''' </summary>
    Public Class EscalationDTO
        <JsonPropertyName("escalationId")>
        Public Property EscalationId As String

        <JsonPropertyName("tasks")>
        Public Property Tasks As List(Of Object) ' Tasks dal frontend
    End Class



