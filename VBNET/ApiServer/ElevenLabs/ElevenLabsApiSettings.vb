Option Strict On
Option Explicit On

Namespace ApiServer.ElevenLabs

''' <summary>
''' ElevenLabs REST API origin (EU data residency cluster). All outbound ConvAI HTTP calls must use this base.
''' </summary>
Friend NotInheritable Class ElevenLabsApiSettings

    Private Const ApiBaseUrl As String = "https://api.eu.residency.elevenlabs.io"

    Friend Shared Function GetApiBaseUrl() As String
        Return ApiBaseUrl
    End Function

End Class

End Namespace
