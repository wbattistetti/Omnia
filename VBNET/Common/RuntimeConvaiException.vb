Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json.Linq

''' <summary>
''' Errore strutturato quando ConvAI fallisce dopo POST ApiServer (/elevenlabs/startAgent).
''' Usato da SessionManager per payload SSE ricco senza perdere il body JSON upstream.
''' </summary>
Public Class RuntimeConvaiException
    Inherits InvalidOperationException

    Public ReadOnly Property HttpStatus As Integer
    Public ReadOnly Property Phase As String
    Public ReadOnly Property AgentId As String
    Public ReadOnly Property BaseUrl As String
    Public ReadOnly Property ApiServerBodyRaw As String
    Public ReadOnly Property ElevenLabsRawBody As String

    Public Sub New(
        message As String,
        httpStatus As Integer,
        phase As String,
        agentId As String,
        baseUrl As String,
        apiServerBodyRaw As String,
        Optional elevenLabsRawBody As String = Nothing
    )
        MyBase.New(If(message, ""))
        HttpStatus = httpStatus
        Phase = If(phase, "")
        AgentId = If(agentId, "")
        BaseUrl = If(baseUrl, "")
        ApiServerBodyRaw = If(apiServerBodyRaw, "")
        ElevenLabsRawBody = If(elevenLabsRawBody, "")
    End Sub

    ''' <summary>Payload per TaskExecutionResult.ErrDetailJson e SSE.</summary>
    Public Function ToPayloadDictionary() As Dictionary(Of String, Object)
        Dim d As New Dictionary(Of String, Object) From {
            {"error", Message},
            {"httpStatus", HttpStatus},
            {"phase", Phase},
            {"agentId", AgentId},
            {"baseUrl", BaseUrl},
            {"apiServerBody", ApiServerBodyRaw}
        }
        If Not String.IsNullOrWhiteSpace(ElevenLabsRawBody) Then
            d("elevenlabsRawBody") = ElevenLabsRawBody
        End If
        Return d
    End Function

    Public Shared Function FromJsonDetail(errMsg As String, detailJson As String) As RuntimeConvaiException
        If String.IsNullOrWhiteSpace(detailJson) Then
            Return New RuntimeConvaiException(errMsg, 0, "", "", "", "")
        End If
        Try
            Dim jo = JObject.Parse(detailJson)
            Return New RuntimeConvaiException(
                If(jo("error")?.ToString(), errMsg),
                If(jo("httpStatus")?.ToObject(Of Integer?)(), 0),
                If(jo("phase")?.ToString(), ""),
                If(jo("agentId")?.ToString(), ""),
                If(jo("baseUrl")?.ToString(), ""),
                If(jo("apiServerBody")?.ToString(), ""),
                jo("elevenlabsRawBody")?.ToString()
            )
        Catch
            Return New RuntimeConvaiException(errMsg, 0, "", "", "", detailJson)
        End Try
    End Function
End Class
