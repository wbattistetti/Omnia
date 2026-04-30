Option Strict On
Option Explicit On

Namespace ElevenLabs

''' <summary>
''' Risposta HTTP non-success da ElevenLabs REST (es. get-signed-url) — conserva il body grezzo per logging e JSON errore ApiServer.
''' </summary>
Public Class ElevenLabsUpstreamHttpException
    Inherits InvalidOperationException

    Public ReadOnly Property StatusCode As Integer
    Public ReadOnly Property ResponseBody As String

    Public Sub New(statusCode As Integer, responseBody As String)
        MyBase.New($"ElevenLabs get-signed-url failed: HTTP {statusCode} — {If(responseBody, "")}")
        StatusCode = statusCode
        ResponseBody = If(responseBody, "")
    End Sub
End Class

End Namespace
