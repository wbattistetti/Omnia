Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System
Imports Newtonsoft.Json.Linq

Namespace ElevenLabs

''' <summary>Risolve la sessione host ElevenLabs da <paramref name="conversationId"/> anche se arriva come GUID con/senza trattini o con prefisso <c>omnia_conv_</c>.</summary>
Friend Module ElevenLabsSessionLookup

    Public Function TryResolveHostedSession(conversationId As String) As ElevenLabsHostedSession
        If String.IsNullOrWhiteSpace(conversationId) Then Return Nothing
        Dim raw = conversationId.Trim()
        Dim s = ElevenLabsSessionRegistry.TryGet(raw)
        If s IsNot Nothing Then Return s

        Dim canon = ElevenLabsSessionRegistry.TryResolveAliasToCanonical(raw)
        If Not String.IsNullOrWhiteSpace(canon) Then
            s = ElevenLabsSessionRegistry.TryGet(canon)
            If s IsNot Nothing Then Return s
        End If

        Dim alt = NormalizeHostedSessionLookupKey(raw)
        If String.IsNullOrWhiteSpace(alt) Then Return Nothing
        If Not String.Equals(alt, raw, StringComparison.OrdinalIgnoreCase) Then
            s = ElevenLabsSessionRegistry.TryGet(alt)
        End If
        Return s
    End Function

    ''' <summary>Chiave registry startAgent = <see cref="Guid.ToString"/> formato N (32 hex).</summary>
    Public Function NormalizeHostedSessionLookupKey(raw As String) As String
        If String.IsNullOrWhiteSpace(raw) Then Return Nothing
        Dim t = raw.Trim()
        Dim g As Guid
        If Guid.TryParse(t, g) Then Return g.ToString("N")
        Const Prefix = "omnia_conv_"
        If t.StartsWith(Prefix, StringComparison.OrdinalIgnoreCase) Then
            Dim rest = t.Substring(Prefix.Length).Trim()
            If Guid.TryParse(rest, g) Then Return g.ToString("N")
        End If
        Return Nothing
    End Function

End Module

''' <summary>Holds runtime objects for one Omnia-hosted ElevenLabs-backed conversation.</summary>
Public NotInheritable Class ElevenLabsHostedSession
    Public Property OmniaConversationId As String
    Public Property Queue As ElevenLabsTurnQueue
    Public Property Runner As ElevenLabsWebSocketRunner
    Public Property Status As String

    ''' <summary>
    ''' Fallimenti tool/webhook ConvAI osservati sul WebSocket (es. POST BookFromAgenda 400), drainati con la risposta readPrompt.
    ''' </summary>
    Public ReadOnly ToolDiagnostics As ConcurrentQueue(Of JObject)

    ''' <summary>Parametro deve avere nome distinto da <see cref="OmniaConversationId"/> (VB è case-insensitive).</summary>
    Public Sub New(conversationId As String)
        OmniaConversationId = conversationId
        Queue = New ElevenLabsTurnQueue()
        ToolDiagnostics = New ConcurrentQueue(Of JObject)()
        Status = "running"
    End Sub

    ''' <summary>Svuota la coda in ordine FIFO per allegare alla risposta HTTP readPrompt.</summary>
    Public Function DrainToolDiagnosticsArray() As JArray
        Dim arr As New JArray()
        Dim x As JObject = Nothing
        While ToolDiagnostics.TryDequeue(x)
            arr.Add(x)
        End While
        If arr.Count = 0 Then Return Nothing
        Return arr
    End Function
End Class

''' <summary>In-memory registry (single-process). ElevenLabs sessions do not persist across ApiServer restart.</summary>
Public NotInheritable Class ElevenLabsSessionRegistry
    Private Shared ReadOnly Sessions As New ConcurrentDictionary(Of String, ElevenLabsHostedSession)(StringComparer.OrdinalIgnoreCase)
    ''' <summary>
    ''' Chiavi esterne (es. <c>omnia_conv_{uuid}</c> dal tool schema ConvAI) → conversationId canonico da POST <c>/elevenlabs/startAgent</c> (GUID formato N).
    ''' </summary>
    Private Shared ReadOnly SessionAliases As New ConcurrentDictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)

    ''' <summary>Risolve un alias registrato con <see cref="RegisterSessionAlias"/> verso l&apos;id sessione host.</summary>
    Public Shared Function TryResolveAliasToCanonical(sessionAlias As String) As String
        If String.IsNullOrWhiteSpace(sessionAlias) Then Return Nothing
        Dim c As String = Nothing
        If SessionAliases.TryGetValue(sessionAlias.Trim(), c) Then Return c
        Return Nothing
    End Function

    ''' <summary>Associa l&apos;id usato nel webhook tool (ConvAI) alla sessione host creata da startAgent.</summary>
    Public Shared Sub RegisterSessionAlias(sessionAlias As String, canonicalConversationId As String)
        If String.IsNullOrWhiteSpace(sessionAlias) Then Return
        If String.IsNullOrWhiteSpace(canonicalConversationId) Then Return
        Dim a = sessionAlias.Trim()
        Dim c = canonicalConversationId.Trim()
        If a.Length > 512 OrElse c.Length > 512 Then Return
        If String.Equals(a, c, StringComparison.OrdinalIgnoreCase) Then Return
        SessionAliases(a) = c
    End Sub

    Private Shared Sub RemoveAliasesForCanonical(canonicalConversationId As String)
        If String.IsNullOrWhiteSpace(canonicalConversationId) Then Return
        Dim canon = canonicalConversationId.Trim()
        For Each kv In SessionAliases.ToArray()
            If String.Equals(kv.Value, canon, StringComparison.OrdinalIgnoreCase) Then
                Dim removed As String = Nothing
                SessionAliases.TryRemove(kv.Key, removed)
            End If
        Next
    End Sub

    Public Shared Function TryRegister(session As ElevenLabsHostedSession) As Boolean
        If session Is Nothing Then Throw New ArgumentNullException(NameOf(session))
        Dim key = session.OmniaConversationId
        If String.IsNullOrWhiteSpace(key) Then
            Throw New InvalidOperationException("ElevenLabsHostedSession.OmniaConversationId must be set before TryRegister.")
        End If
        Return Sessions.TryAdd(key, session)
    End Function

    Public Shared Function TryGet(conversationId As String) As ElevenLabsHostedSession
        Dim s As ElevenLabsHostedSession = Nothing
        If Sessions.TryGetValue(conversationId, s) Then Return s
        Return Nothing
    End Function

    Public Shared Function Remove(conversationId As String) As Boolean
        Dim s As ElevenLabsHostedSession = Nothing
        Dim ok = Sessions.TryRemove(conversationId, s)
        If ok Then RemoveAliasesForCanonical(conversationId)
        Return ok
    End Function
End Class

End Namespace
