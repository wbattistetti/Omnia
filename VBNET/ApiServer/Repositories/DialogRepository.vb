Option Strict On
Option Explicit On
Imports Compiler
Imports StackExchange.Redis
Imports Newtonsoft.Json
Imports System.Collections.Concurrent
Imports TaskEngine

Namespace ApiServer.Repositories
    ''' <summary>
    ''' ✅ STATELESS: Repository Redis per dialoghi compilati con cache in memoria
    '''
    ''' Architettura:
    ''' - Redis key: omnia:dialog:{projectId}:{version}
    ''' - Cache in memoria (condivisa tra tutte le sessioni del pod)
    ''' - Immutabile: una volta salvato, non cambia per quella versione
    ''' </summary>
    Public Class RedisDialogRepository
        Implements IDialogRepository

        Private ReadOnly _connection As IConnectionMultiplexer
        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _cache As New ConcurrentDictionary(Of String, RuntimeTask)
        Private ReadOnly _cacheLock As New Object()

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        ''' <param name="connectionString">Connection string Redis</param>
        ''' <param name="keyPrefix">Prefisso per le chiavi Redis (default: "omnia:")</param>
        Public Sub New(connectionString As String, Optional keyPrefix As String = "omnia:")
                    _connection = ApiServer.Infrastructure.RedisConnectionManager.GetConnection(connectionString)
            _database = _connection.GetDatabase()
            _keyPrefix = keyPrefix
        End Sub

        ''' <summary>
        ''' Genera la chiave Redis per un dialogo
        ''' </summary>
        Private Function GetDialogKey(projectId As String, version As String) As String
            Return $"{_keyPrefix}dialog:{projectId}:{version}"
        End Function

        ''' <summary>
        ''' Genera la chiave cache in memoria
        ''' </summary>
        Private Function GetCacheKey(projectId As String, version As String) As String
            Return $"{projectId}:{version}"
        End Function

        ''' <summary>
        ''' Carica un dialogo compilato dal repository (con cache in memoria)
        ''' </summary>
        Public Function GetDialog(projectId As String, version As String) As RuntimeTask Implements IDialogRepository.GetDialog
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(version) Then
                Throw New ArgumentException("Version cannot be null or empty", NameOf(version))
            End If

            ' ✅ STEP 1: Verifica cache in memoria (veloce)
            Dim cacheKey = GetCacheKey(projectId, version)
            If _cache.TryGetValue(cacheKey, Nothing) Then
                Dim cachedDialog = _cache(cacheKey)
                If cachedDialog IsNot Nothing Then
                    Return cachedDialog
                End If
            End If

            ' ✅ STEP 2: Carica da Redis
            Try
                Dim redisKey = GetDialogKey(projectId, version)
                Dim json = _database.StringGet(redisKey)

                If Not json.HasValue Then
                    Return Nothing
                End If

                ' ✅ STEP 3: Normalizza JSON (violation → invalid) prima della deserializzazione
                Dim jsonString = json.ToString()
                If Not String.IsNullOrWhiteSpace(jsonString) Then
                    jsonString = System.Text.RegularExpressions.Regex.Replace(
                        jsonString,
                        """type""\s*:\s*""violation""",
                        """type"": ""invalid""",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                    )
                End If

                ' ✅ STEP 4: Deserializza RuntimeTask
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .Converters = New List(Of JsonConverter) From {New ITaskConverter()}
                }
                Dim runtimeTask = JsonConvert.DeserializeObject(Of RuntimeTask)(jsonString, settings)

                If runtimeTask Is Nothing Then
                    Return Nothing
                End If

                ' ✅ STEP 4: Salva in cache in memoria
                SyncLock _cacheLock
                    _cache(cacheKey) = runtimeTask
                End SyncLock

                Return runtimeTask

            Catch ex As Exception
                Throw New Exception($"Failed to load dialog {projectId}:{version}: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Salva un dialogo compilato nel repository
        ''' </summary>
        Public Sub SaveDialog(projectId As String, version As String, runtimeTask As RuntimeTask) Implements IDialogRepository.SaveDialog
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(version) Then
                Throw New ArgumentException("Version cannot be null or empty", NameOf(version))
            End If
            If runtimeTask Is Nothing Then
                Throw New ArgumentNullException(NameOf(runtimeTask), "RuntimeTask cannot be Nothing")
            End If

            Try
                ' ✅ STEP 1: Serializza RuntimeTask
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                }
                Dim json = JsonConvert.SerializeObject(runtimeTask, settings)

                ' ✅ STEP 2: Salva in Redis (senza TTL - immutabile)
                Dim redisKey = GetDialogKey(projectId, version)
                _database.StringSet(redisKey, json)

                ' ✅ STEP 3: Salva in cache in memoria
                Dim cacheKey = GetCacheKey(projectId, version)
                SyncLock _cacheLock
                    _cache(cacheKey) = runtimeTask
                End SyncLock
            Catch ex As Exception
                Throw New Exception($"Failed to save dialog {projectId}:{version}: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Verifica se un dialogo esiste nel repository
        ''' </summary>
        Public Function DialogExists(projectId As String, version As String) As Boolean Implements IDialogRepository.DialogExists
            If String.IsNullOrWhiteSpace(projectId) OrElse String.IsNullOrWhiteSpace(version) Then
                Return False
            End If

            ' ✅ Verifica cache in memoria
            Dim cacheKey = GetCacheKey(projectId, version)
            If _cache.ContainsKey(cacheKey) Then
                Return True
            End If

            ' ✅ Verifica Redis
            Try
                Dim redisKey = GetDialogKey(projectId, version)
                Return _database.KeyExists(redisKey)
            Catch ex As Exception
                Return False
            End Try
        End Function
    End Class
End Namespace
