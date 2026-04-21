Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Runtime AI provider for compiled AI Agent tasks (aligned with frontend <c>AgentPlatform</c> where applicable).
''' </summary>
Public Enum IAPlatform
    OpenAI
    ElevenLabs
    Google
End Enum

''' <summary>
''' Deserializes platform from JSON strings such as <c>openai</c>, <c>elevenlabs</c> (frontend <c>AgentPlatform</c>).
''' </summary>
Public NotInheritable Class IAPlatformJsonConverter
    Inherits JsonConverter(Of IAPlatform)

    Public Overrides ReadOnly Property CanWrite As Boolean
        Get
            Return True
        End Get
    End Property

    Public Overrides Sub WriteJson(writer As JsonWriter, value As IAPlatform, serializer As JsonSerializer)
        Dim s = PlatformToWireString(value)
        writer.WriteValue(s)
    End Sub

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As IAPlatform, hasExistingValue As Boolean, serializer As JsonSerializer) As IAPlatform
        If reader.TokenType = JsonToken.Null Then Return IAPlatform.OpenAI
        If reader.TokenType = JsonToken.Integer Then
            Dim i = Convert.ToInt32(reader.Value)
            If [Enum].IsDefined(GetType(IAPlatform), i) Then Return CType(i, IAPlatform)
            Return IAPlatform.OpenAI
        End If
        Dim raw = If(reader.Value?.ToString(), "").Trim()
        Return ParsePlatformString(raw)
    End Function

    Public Shared Function ParsePlatformString(raw As String) As IAPlatform
        If String.IsNullOrEmpty(raw) Then Return IAPlatform.OpenAI
        Select Case raw.ToLowerInvariant()
            Case "elevenlabs", "eleven_labs"
                Return IAPlatform.ElevenLabs
            Case "google", "gemini"
                Return IAPlatform.Google
            Case "openai", "omnia", "anthropic", "amazon", "meta"
                Return IAPlatform.OpenAI
            Case Else
                Return IAPlatform.OpenAI
        End Select
    End Function

    Private Shared Function PlatformToWireString(p As IAPlatform) As String
        Select Case p
            Case IAPlatform.ElevenLabs
                Return "elevenlabs"
            Case IAPlatform.Google
                Return "google"
            Case Else
                Return "openai"
        End Select
    End Function
End Class
