' DDTNodeDTO.vb
' DTO per deserializzazione JSON

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

    ''' <summary>
    ''' DTO per deserializzare DDTNode dal JSON
    ''' </summary>
    Public Class DDTNodeDTO
        <JsonPropertyName("id")>
        Public Property Id As String

        <JsonPropertyName("name")>
        Public Property Name As String

        <JsonPropertyName("required")>
        Public Property Required As Boolean

        <JsonPropertyName("requiresConfirmation")>
        Public Property RequiresConfirmation As Boolean

        <JsonPropertyName("requiresValidation")>
        Public Property RequiresValidation As Boolean

        <JsonPropertyName("subData")>
        Public Property SubData As List(Of DDTNodeDTO)

        <JsonPropertyName("steps")>
        Public Property Steps As List(Of DialogueStepDTO)

        ' Supporto per vecchia struttura "responses" (compatibilità retroattiva)
        <JsonPropertyName("responses")>
        Public Property Responses As Dictionary(Of String, List(Of ResponseDTO))

        <JsonPropertyName("validationConditions")>
        Public Property ValidationConditions As List(Of ValidationCondition)

        <JsonPropertyName("nlpContract")>
        Public Property NlpContract As Object  ' Deserializzato come Object, poi convertito in NLPContract
    End Class


