' ResponseDTO.vb
' DTO per deserializzazione JSON (usa "text" invece di "actions")

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

''' <summary>
''' DTO per deserializzare Response dal JSON
''' Il JSON usa "text" invece di "actions"
''' </summary>
Public Class ResponseDTO
    ''' <summary>
    ''' Testo del response (dal JSON)
    ''' </summary>
    <JsonPropertyName("text")>
    Public Property Text As String

    ''' <summary>
    ''' Tasks (per compatibilità futura se il JSON le include)
    ''' </summary>
    <JsonPropertyName("tasks")>
    Public Property Tasks As List(Of Object)
End Class




