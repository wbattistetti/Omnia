Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports ApiServer.Interfaces
Imports ApiServer.Infrastructure
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports StackExchange.Redis
Imports ApiServer.SessionStorage

Namespace ApiServer.SessionStorage
    ''' <summary>
    ''' ✅ STATELESS: Implementazione RedisSessionStorage (OBBLIGATORIO)
    '''
    ''' NOTA: Redis è OBBLIGATORIO - nessun fallback.
    ''' Se Redis non è disponibile, il servizio non si avvia.
    '''
    ''' Pattern:
    ''' - Key format: "{keyPrefix}session:task:{sessionId}" e "{keyPrefix}session:orchestrator:{sessionId}"
    ''' - TTL: Configurabile (default 3600 secondi = 1 ora)
    ''' - Serializzazione: JSON con SessionSerializer
    ''' - Nessun fallback: Redis è obbligatorio
    ''' </summary>
    Public Class RedisSessionStorage
        Implements ApiServer.Interfaces.ISessionStorage

        Private ReadOnly _connection As IConnectionMultiplexer
        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _sessionTTL As TimeSpan

        ''' <summary>
        ''' Costruttore: inizializza Redis (OBBLIGATORIO - nessun fallback)
        ''' </summary>
        ''' <exception cref="Exception">Solleva eccezione se Redis non è disponibile</exception>
        Public Sub New(connectionString As String, keyPrefix As String, sessionTTL As Integer)
            Try
                _connection = ApiServer.Infrastructure.RedisConnectionManager.GetConnection(connectionString)
                _database = _connection.GetDatabase()
                _keyPrefix = keyPrefix
                _sessionTTL = TimeSpan.FromSeconds(sessionTTL)

                ' ✅ STATELESS: Verifica che Redis sia connesso, altrimenti solleva eccezione
                If Not ApiServer.Infrastructure.RedisConnectionManager.IsConnected() Then
                    Throw New Exception("Redis connection is not available. Service cannot start without Redis.")
                End If

                ' Test connessione con PING
                If Not _database.StringSet("__health_check__", "ok", TimeSpan.FromSeconds(1)) Then
                    Throw New Exception("Redis health check failed: cannot write to Redis.")
                End If
                _database.KeyDelete("__health_check__")

                Console.WriteLine($"[RedisSessionStorage] ✅ Connected to Redis: {connectionString}, KeyPrefix: {keyPrefix}, TTL: {sessionTTL}s")
            Catch ex As Exception
                Console.WriteLine($"[RedisSessionStorage] ❌ CRITICAL: Failed to connect to Redis: {ex.Message}")
                Console.WriteLine($"[RedisSessionStorage] ❌ Service cannot start without Redis. Terminating.")
                Throw New Exception($"Redis is required but not available: {ex.Message}", ex)
            End Try
        End Sub

        Private Function GetTaskSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}session:task:{sessionId}"
        End Function

        Private Function GetOrchestratorSessionKey(sessionId As String) As String
            Return $"{_keyPrefix}session:orchestrator:{sessionId}"
        End Function

        ''' <summary>
        ''' Recupera una TaskSession da Redis
        ''' </summary>
        Public Function GetTaskSession(sessionId As String) As TaskSession Implements ApiServer.Interfaces.ISessionStorage.GetTaskSession
            Try
                Dim key = GetTaskSessionKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue Then
                    Try
                        Return SessionSerializer.DeserializeTaskSession(json)
                    Catch deserializeEx As Exception
                        ' ✅ STATELESS: Se deserializzazione fallisce, potrebbe essere una sessione vecchia senza TypeNameHandling
                        ' Prova a eliminare la sessione corrotta e restituisci Nothing (verrà ricreata)
                        Console.WriteLine($"[RedisSessionStorage] ⚠️ Warning: Failed to deserialize session {sessionId}: {deserializeEx.Message}")
                        Console.WriteLine($"[RedisSessionStorage] ⚠️ This might be an old session format. Deleting corrupted session.")
                        Try
                            _database.KeyDelete(key)
                        Catch
                            ' Ignore delete errors
                        End Try
                        Return Nothing
                    End Try
                End If

                Return Nothing
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error getting task session: {ex.Message}")
                Throw New Exception($"Failed to get task session from Redis: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Salva una TaskSession su Redis
        ''' </summary>
        Public Sub SaveTaskSession(session As TaskSession) Implements ApiServer.Interfaces.ISessionStorage.SaveTaskSession
            Try
                Dim key = GetTaskSessionKey(session.SessionId)
                Dim json = SessionSerializer.SerializeTaskSession(session)
                _database.StringSet(key, json, _sessionTTL)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error saving task session: {ex.Message}")
                Throw New Exception($"Failed to save task session to Redis: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Elimina una TaskSession da Redis
        ''' </summary>
        Public Sub DeleteTaskSession(sessionId As String) Implements ApiServer.Interfaces.ISessionStorage.DeleteTaskSession
            Try
                Dim key = GetTaskSessionKey(sessionId)
                _database.KeyDelete(key)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error deleting task session: {ex.Message}")
                Throw New Exception($"Failed to delete task session from Redis: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Recupera una OrchestratorSession da Redis
        ''' </summary>
        Public Function GetOrchestratorSession(sessionId As String) As OrchestratorSession Implements ApiServer.Interfaces.ISessionStorage.GetOrchestratorSession
            Try
                Dim key = GetOrchestratorSessionKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue Then
                    Return SessionSerializer.DeserializeOrchestratorSession(json, sessionId)
                End If

                Return Nothing
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error getting orchestrator session: {ex.Message}")
                Throw New Exception($"Failed to get orchestrator session from Redis: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Salva una OrchestratorSession su Redis
        ''' </summary>
        Public Sub SaveOrchestratorSession(session As OrchestratorSession) Implements ApiServer.Interfaces.ISessionStorage.SaveOrchestratorSession
            Try
                Dim key = GetOrchestratorSessionKey(session.SessionId)
                Dim json = SessionSerializer.SerializeOrchestratorSession(session)
                _database.StringSet(key, json, _sessionTTL)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error saving orchestrator session: {ex.Message}")
                Throw New Exception($"Failed to save orchestrator session to Redis: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Elimina una OrchestratorSession da Redis
        ''' </summary>
        Public Sub DeleteOrchestratorSession(sessionId As String) Implements ApiServer.Interfaces.ISessionStorage.DeleteOrchestratorSession
            Try
                Dim key = GetOrchestratorSessionKey(sessionId)
                _database.KeyDelete(key)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisSessionStorage] ❌ Error deleting orchestrator session: {ex.Message}")
                Throw New Exception($"Failed to delete orchestrator session from Redis: {ex.Message}", ex)
            End Try
        End Sub
    End Class
End Namespace
