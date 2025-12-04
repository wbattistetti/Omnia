' DialogueStepDTO.vb
' DTO per deserializzazione JSON di DialogueStep

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

    ''' <summary>
    ''' DTO per deserializzare DialogueStep dal JSON
    ''' Corrisponde a StepGroup nel frontend
    ''' </summary>
    Public Class DialogueStepDTO
        <JsonPropertyName("type")>
        Public Property Type As String ' "start", "noMatch", "noInput", ecc.

        <JsonPropertyName("escalations")>
        Public Property Escalations As List(Of EscalationDTO)
    End Class



