Option Strict On
Option Explicit On
Imports ApiServer.Interfaces
Imports ApiServer.Infrastructure
Imports TaskEngine.Orchestrator
Imports StackExchange.Redis
Imports Newtonsoft.Json

Namespace ApiServer.SessionStorage
    ''' <summary>
    ''' ✅ STATELESS: Implementazione RedisExecutionStateStorage (OBBLIGATORIO)
    '''
    ''' NOTA: Redis è OBBLIGATORIO - nessun fallback.
    ''' Se Redis non è disponibile, solleva eccezione.
    '''
    ''' Pattern:
    ''' - Key format: "{keyPrefix}execution-state:{sessionId}"
    ''' - TTL: Stesso TTL delle sessioni (default 3600 secondi = 1 ora)
    ''' - Serializzazione: JSON
    ''' - Nessun fallback: Redis è obbligatorio
    ''' </summary>
    Public Class RedisExecutionStateStorage
        Implements ApiServer.Interfaces.IExecutionStateStorage

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
            Catch ex As Exception
                Console.WriteLine($"[RedisExecutionStateStorage] ❌ CRITICAL ERROR: Failed to initialize Redis")
                Console.WriteLine($"   Error: {ex.Message}")
                Throw
            End Try
        End Sub

        ''' <summary>
        ''' Genera la chiave Redis per ExecutionState
        ''' </summary>
        Private Function GetExecutionStateKey(sessionId As String) As String
            Return $"{_keyPrefix}execution-state:{sessionId}"
        End Function

        ''' <summary>
        ''' Recupera ExecutionState da Redis per una sessione
        ''' </summary>
        Public Function GetExecutionState(sessionId As String) As ExecutionState Implements ApiServer.Interfaces.IExecutionStateStorage.GetExecutionState
            Try
                Dim key = GetExecutionStateKey(sessionId)
                Dim json = _database.StringGet(key)

                If json.HasValue AndAlso Not String.IsNullOrEmpty(json) Then
                    ' ✅ STATELESS: Deserializza ExecutionState da JSON
                    Dim settings As New JsonSerializerSettings With {
                        .TypeNameHandling = TypeNameHandling.Auto,
                        .NullValueHandling = NullValueHandling.Ignore
                    }
                    Return JsonConvert.DeserializeObject(Of ExecutionState)(json, settings)
                End If

                ' Nessuno stato salvato, ritorna nuovo ExecutionState vuoto
                Return New ExecutionState()
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisExecutionStateStorage] ❌ Error getting execution state: {ex.Message}")
                Throw New Exception($"Failed to get execution state from Redis: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Salva ExecutionState su Redis per una sessione
        ''' </summary>
        Public Sub SaveExecutionState(sessionId As String, state As ExecutionState) Implements ApiServer.Interfaces.IExecutionStateStorage.SaveExecutionState
            Try
                Dim key = GetExecutionStateKey(sessionId)

                ' ✅ STATELESS: Serializza ExecutionState in JSON
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore
                }
                Dim json = JsonConvert.SerializeObject(state, settings)

                _database.StringSet(key, json, _sessionTTL)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisExecutionStateStorage] ❌ Error saving execution state: {ex.Message}")
                Throw New Exception($"Failed to save execution state to Redis: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Elimina ExecutionState da Redis per una sessione
        ''' </summary>
        Public Sub DeleteExecutionState(sessionId As String) Implements ApiServer.Interfaces.IExecutionStateStorage.DeleteExecutionState
            Try
                Dim key = GetExecutionStateKey(sessionId)
                _database.KeyDelete(key)
            Catch ex As Exception
                ' ✅ STATELESS: Nessun fallback - solleva eccezione
                Console.WriteLine($"[RedisExecutionStateStorage] ❌ Error deleting execution state: {ex.Message}")
                Throw New Exception($"Failed to delete execution state from Redis: {ex.Message}", ex)
            End Try
        End Sub
    End Class
End Namespace
