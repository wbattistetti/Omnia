' DDTInstanceDTO.vb
' DTO per deserializzazione JSON

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

    ''' <summary>
    ''' DTO per deserializzare DDTInstance dal JSON
    ''' </summary>
    Public Class DDTInstanceDTO
        <JsonPropertyName("isAggregate")>
        Public Property IsAggregate As Boolean

        <JsonPropertyName("introduction")>
        Public Property Introduction As ResponseDTO

        <JsonPropertyName("successResponse")>
        Public Property SuccessResponse As ResponseDTO

        <JsonPropertyName("mainData")>
        Public Property MainData As List(Of DDTNodeDTO)
    End Class




