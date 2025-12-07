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

        <JsonPropertyName("actions")>
        Public Property Actions As List(Of Object) ' Per compatibilità, deserializza come Object
    End Class



