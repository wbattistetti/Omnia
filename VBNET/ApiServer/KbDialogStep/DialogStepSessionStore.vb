Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System.Collections.Generic
Imports System.Security.Cryptography
Imports System.Text
Imports System.Threading.Tasks
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports StackExchange.Redis

Namespace OmniaDialogStepInfra
    ''' <summary>Sessione binding dialogo KB keyed by project + agent + conversation + documento (parità Node dialogStepSessionStore.js).</summary>
    Public NotInheritable Class DialogStepSessionStore
        Private Const KeyPrefix As String = "omnia:dialog:v1:"

        Private Shared ReadOnly MemoryStore As New ConcurrentDictionary(Of String, (Binding As Dictionary(Of String, String), ExpiresAt As Long))()

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
            Using sha = SHA256.Create()
                Dim hash = sha.ComputeHash(Encoding.UTF8.GetBytes(raw))
                Dim hex = BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant()
                Return KeyPrefix & hex
            End Using
        End Function

        Private Shared Function GetRedisDb() As IDatabase
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

        Public Shared Async Function LoadDialogBindingAsync(scope As OmniaDialogStepSessionScope) As Task(Of Dictionary(Of String, String))
            Dim key = SessionKey(scope)
            Try
                Dim db = GetRedisDb()
                Dim hit = Await db.StringGetAsync(key).ConfigureAwait(False)
                If hit.HasValue Then
                    Dim parsed = JObject.Parse(hit.ToString())
                    Dim bindingTok = parsed("binding")
                    If bindingTok IsNot Nothing AndAlso bindingTok.Type = JTokenType.Object Then
                        Dim binding = bindingTok.ToObject(Of Dictionary(Of String, String))
                        If binding IsNot Nothing Then Return binding
                    End If
                End If
            Catch
                ' fallback memory
            End Try

            PruneMemory()
            Dim mem As (Binding As Dictionary(Of String, String), ExpiresAt As Long) = Nothing
            If MemoryStore.TryGetValue(key, mem) AndAlso mem.ExpiresAt > DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() Then
                Return New Dictionary(Of String, String)(mem.Binding, StringComparer.OrdinalIgnoreCase)
            End If
            Return New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
        End Function

        Public Shared Async Function SaveDialogBindingAsync(scope As OmniaDialogStepSessionScope, binding As Dictionary(Of String, String)) As Task
            Dim key = SessionKey(scope)
            Dim payload = JsonConvert.SerializeObject(New With {.binding = binding})
            Dim ttl = DefaultTtlSec()
            Try
                Dim db = GetRedisDb()
                Await db.StringSetAsync(key, payload, TimeSpan.FromSeconds(ttl)).ConfigureAwait(False)
                Return
            Catch
                ' fallback memory
            End Try

            MemoryStore(key) = (
                New Dictionary(Of String, String)(binding, StringComparer.OrdinalIgnoreCase),
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + ttl * 1000L
            )
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
    End Class
End Namespace
