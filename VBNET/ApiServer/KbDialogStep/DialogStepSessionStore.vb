Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json.Linq
Imports TaskEngine.KbDialogStep

Namespace OmniaDialogStepInfra
    ''' <summary>Sessione binding + inform state (parità Node dialogStepSessionStore.js).</summary>
    Public NotInheritable Class DialogStepSessionStore
        Private Const KeyPrefix As String = "omnia:dialog:v1:"

        Private Shared ReadOnly MemoryStore As New ConcurrentDictionary(Of String, (Binding As Dictionary(Of String, String), InformState As DialogInformState, ExpiresAt As Long))()

        Private Shared Function DefaultTtlSec() As Integer
            Dim raw = Environment.GetEnvironmentVariable("OMNIA_DIALOG_STEP_TTL_SEC")
            Dim ttl As Integer
            If Integer.TryParse(raw, ttl) AndAlso ttl > 0 Then Return ttl
            Return 86400
        End Function

        Public Shared Function SessionKey(scope As OmniaDialogStepSessionScope) As String
            Dim raw = String.Join("|", {
                If(scope?.ProjectId, ""),
                If(scope?.AgentTaskId, ""),
                If(scope?.ConversationId, ""),
                If(scope?.KbDocumentId, "")
            })
            Using sha = Security.Cryptography.SHA256.Create()
                Dim hash = sha.ComputeHash(Text.Encoding.UTF8.GetBytes(raw))
                Dim hex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant()
                Return KeyPrefix & hex
            End Using
        End Function

        Private Shared Function GetRedisDb() As StackExchange.Redis.IDatabase
            Dim connStr = Program.GetRedisConnectionString()
            Dim mux = RedisConnectionManager.GetConnection(connStr)
            Return mux.GetDatabase()
        End Function

        Private Shared Sub PruneMemory()
            Dim now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            For Each kvp In MemoryStore.ToArray()
                If kvp.Value.ExpiresAt <= now Then
                    MemoryStore.TryRemove(kvp.Key, Nothing)
                End If
            Next
        End Sub

        Public Class DialogSessionPayload
            Public Property Binding As Dictionary(Of String, String)
            Public Property InformState As DialogInformState
        End Class

        Public Shared Async Function LoadDialogSessionAsync(scope As OmniaDialogStepSessionScope) As Task(Of DialogSessionPayload)
            Dim key = SessionKey(scope)
            Try
                Dim db = GetRedisDb()
                Dim hit = Await db.StringGetAsync(key).ConfigureAwait(False)
                If hit.HasValue Then
                    Dim parsed = JObject.Parse(hit.ToString())
                    Return DeserializeSession(parsed)
                End If
            Catch
            End Try

            PruneMemory()
            Dim mem As (Binding As Dictionary(Of String, String), InformState As DialogInformState, ExpiresAt As Long) = Nothing
            If MemoryStore.TryGetValue(key, mem) AndAlso mem.ExpiresAt > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() Then
                Return New DialogSessionPayload With {
                    .Binding = New Dictionary(Of String, String)(mem.Binding, StringComparer.OrdinalIgnoreCase),
                    .InformState = KbDialogSelectorSemantics.CloneInformState(mem.InformState)
                }
            End If
            Return New DialogSessionPayload With {
                .Binding = New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase),
                .InformState = KbDialogSelectorSemantics.EmptyInformState()
            }
        End Function

        Public Shared Async Function LoadDialogBindingAsync(scope As OmniaDialogStepSessionScope) As Task(Of Dictionary(Of String, String))
            Dim session = Await LoadDialogSessionAsync(scope).ConfigureAwait(False)
            Return session.Binding
        End Function

        Public Shared Async Function SaveDialogSessionAsync(scope As OmniaDialogStepSessionScope, binding As Dictionary(Of String, String), informState As DialogInformState) As Task
            Dim key = SessionKey(scope)
            Dim payload = SerializeSession(binding, informState)
            Dim ttl = DefaultTtlSec()
            Try
                Dim db = GetRedisDb()
                Await db.StringSetAsync(key, payload, TimeSpan.FromSeconds(ttl)).ConfigureAwait(False)
                Return
            Catch
            End Try
            MemoryStore(key) = (
                New Dictionary(Of String, String)(binding, StringComparer.OrdinalIgnoreCase),
                KbDialogSelectorSemantics.CloneInformState(informState),
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + ttl * 1000L
            )
        End Function

        Public Shared Async Function SaveDialogBindingAsync(scope As OmniaDialogStepSessionScope, binding As Dictionary(Of String, String)) As Task
            Dim session = Await LoadDialogSessionAsync(scope).ConfigureAwait(False)
            Await SaveDialogSessionAsync(scope, binding, session.InformState).ConfigureAwait(False)
        End Function

        Public Shared Async Function ClearDialogBindingAsync(scope As OmniaDialogStepSessionScope) As Task
            Dim key = SessionKey(scope)
            Try
                Dim db = GetRedisDb()
                Await db.KeyDeleteAsync(key).ConfigureAwait(False)
            Catch
            End Try
            MemoryStore.TryRemove(key, Nothing)
        End Function

        Private Shared Function SerializeSession(binding As Dictionary(Of String, String), informState As DialogInformState) As String
            Dim jo As New JObject From {
                {"binding", JObject.FromObject(binding)}
            }
            If informState IsNot Nothing Then
                jo("informState") = JObject.FromObject(informState)
            End If
            Return jo.ToString()
        End Function

        Private Shared Function DeserializeSession(parsed As JObject) As DialogSessionPayload
            Dim binding As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            Dim bindingTok = parsed("binding")
            If bindingTok IsNot Nothing AndAlso bindingTok.Type = JTokenType.Object Then
                Dim b = bindingTok.ToObject(Of Dictionary(Of String, String))
                If b IsNot Nothing Then binding = b
            End If
            Dim informState = KbDialogSelectorSemantics.EmptyInformState()
            Dim informTok = parsed("informState")
            If informTok IsNot Nothing AndAlso informTok.Type = JTokenType.Object Then
                Dim deserialized = informTok.ToObject(Of DialogInformState)
                If deserialized IsNot Nothing Then informState = deserialized
            End If
            Return New DialogSessionPayload With {.Binding = binding, .InformState = informState}
        End Function
    End Class
End Namespace
