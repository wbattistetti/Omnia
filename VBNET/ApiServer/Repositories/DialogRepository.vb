Option Strict On
Option Explicit On
Imports Compiler
Imports StackExchange.Redis
Imports Newtonsoft.Json
Imports System.Collections.Concurrent

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
                    Console.WriteLine($"[DialogRepository] ✅ Cache hit: {projectId}:{version}")
                    Return cachedDialog
                End If
            End If

            ' ✅ STEP 2: Carica da Redis
            Try
                Dim redisKey = GetDialogKey(projectId, version)
                Console.WriteLine($"[DialogRepository] 🔍 Checking Redis for dialog: {redisKey}")
                Dim json = _database.StringGet(redisKey)

                If Not json.HasValue Then
                    Console.WriteLine($"[DialogRepository] ❌ Dialog not found in Redis: {redisKey}")
                    Console.WriteLine($"[DialogRepository]    ProjectId: {projectId}")
                    Console.WriteLine($"[DialogRepository]    Version: {version}")
                    Console.WriteLine($"[DialogRepository]    Redis Key: {redisKey}")
                    Return Nothing
                End If

                Console.WriteLine($"[DialogRepository] ✅ Dialog found in Redis: {redisKey} (JSON length: {json.ToString().Length} chars)")

                ' ✅ STEP 3: Deserializza RuntimeTask
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                }
                Dim runtimeTask = JsonConvert.DeserializeObject(Of RuntimeTask)(json, settings)

                If runtimeTask Is Nothing Then
                    Console.WriteLine($"[DialogRepository] ❌ Failed to deserialize dialog: {projectId}:{version}")
                    Return Nothing
                End If

                ' ✅ STEP 4: Salva in cache in memoria
                SyncLock _cacheLock
                    _cache(cacheKey) = runtimeTask
                End SyncLock

                Console.WriteLine($"[DialogRepository] ✅ Dialog loaded from Redis and cached: {projectId}:{version}")
                Return runtimeTask

            Catch ex As Exception
                Console.WriteLine($"[DialogRepository] ❌ Error loading dialog: {ex.Message}")
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
                Console.WriteLine($"[DialogRepository] 💾 Saving dialog to Redis: {redisKey}")
                Console.WriteLine($"[DialogRepository]    JSON length: {json.Length} characters")
                _database.StringSet(redisKey, json)
                Console.WriteLine($"[DialogRepository] ✅ Dialog saved to Redis: {redisKey}")

                ' ✅ STEP 3: Salva in cache in memoria
                Dim cacheKey = GetCacheKey(projectId, version)
                SyncLock _cacheLock
                    _cache(cacheKey) = runtimeTask
                End SyncLock
                Console.WriteLine($"[DialogRepository] ✅ Dialog cached in memory: {cacheKey}")

                Console.WriteLine($"[DialogRepository] ✅✅ Dialog saved successfully: {projectId}:{version}")
                Console.WriteLine($"[DialogRepository]    Redis Key: {redisKey}")
                Console.WriteLine($"[DialogRepository]    Cache Key: {cacheKey}")
            Catch ex As Exception
                Console.WriteLine($"[DialogRepository] ❌ Error saving dialog: {ex.Message}")
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
                Console.WriteLine($"[DialogRepository] ❌ Error checking dialog existence: {ex.Message}")
                Return False
            End Try
        End Function
    End Class
End Namespace
