Option Strict On
Option Explicit On

Imports System.Collections.Concurrent

Namespace ApiServer.ElevenLabs

''' <summary>Holds runtime objects for one Omnia-hosted ElevenLabs-backed conversation.</summary>
Public NotInheritable Class ElevenLabsHostedSession
    Public Property OmniaConversationId As String
    Public Property Queue As ElevenLabsTurnQueue
    Public Property Runner As ElevenLabsWebSocketRunner
    Public Property Status As String

    Public Sub New(omniaConversationId As String)
        OmniaConversationId = omniaConversationId
        Queue = New ElevenLabsTurnQueue()
        Status = "running"
    End Sub
End Class

''' <summary>In-memory registry (single-process). ElevenLabs sessions do not persist across ApiServer restart.</summary>
Public NotInheritable Class ElevenLabsSessionRegistry
    Private Shared ReadOnly Sessions As New ConcurrentDictionary(Of String, ElevenLabsHostedSession)(StringComparer.OrdinalIgnoreCase)

    Public Shared Function TryRegister(session As ElevenLabsHostedSession) As Boolean
        Return Sessions.TryAdd(session.OmniaConversationId, session)
    End Function

    Public Shared Function TryGet(conversationId As String) As ElevenLabsHostedSession
        Dim s As ElevenLabsHostedSession = Nothing
        If Sessions.TryGetValue(conversationId, s) Then Return s
        Return Nothing
    End Function

    Public Shared Function Remove(conversationId As String) As Boolean
        Dim s As ElevenLabsHostedSession = Nothing
        Return Sessions.TryRemove(conversationId, s)
    End Function
End Class

End Namespace
