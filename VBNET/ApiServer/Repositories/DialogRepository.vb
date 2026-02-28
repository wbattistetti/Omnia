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
        Private ReadOnly _cache As New ConcurrentDictionary(Of String, CompiledUtteranceTask)
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
        Public Function GetDialog(projectId As String, version As String) As CompiledUtteranceTask Implements IDialogRepository.GetDialog
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
                    ' ✅ LOG: Verifica SubDataMapping quando caricato dalla cache
                    Console.WriteLine($"[DialogRepository.GetDialog] 🔍 Loaded task from CACHE")
                    Console.WriteLine($"[DialogRepository.GetDialog]   - Task.Id: {cachedDialog.Id}")
                    If cachedDialog.NlpContract IsNot Nothing Then
                        Console.WriteLine($"[DialogRepository.GetDialog]   - NlpContract.SubDataMapping IsNothing: {cachedDialog.NlpContract.SubDataMapping Is Nothing}")
                        If cachedDialog.NlpContract.SubDataMapping IsNot Nothing Then
                            Console.WriteLine($"[DialogRepository.GetDialog]   - NlpContract.SubDataMapping.Count: {cachedDialog.NlpContract.SubDataMapping.Count}")
                            For Each kvp In cachedDialog.NlpContract.SubDataMapping
                                Console.WriteLine($"[DialogRepository.GetDialog]     - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                            Next
                        Else
                            Console.WriteLine($"[DialogRepository.GetDialog] ⚠️ SubDataMapping is Nothing in cached task!")
                        End If
                    Else
                        Console.WriteLine($"[DialogRepository.GetDialog] ⚠️ NlpContract is Nothing in cached task!")
                    End If
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

                ' ✅ LOG: Verifica se SubDataMapping è presente nel JSON prima della deserializzazione
                Dim jsonContainsSubDataMapping = jsonString.Contains("SubDataMapping")
                Console.WriteLine($"[DialogRepository.GetDialog] 🔍 JSON from Redis")
                Console.WriteLine($"[DialogRepository.GetDialog]   - JSON length: {jsonString.Length}")
                Console.WriteLine($"[DialogRepository.GetDialog]   - JSON contains 'SubDataMapping': {jsonContainsSubDataMapping}")
                If jsonContainsSubDataMapping Then
                    Dim subDataMappingIndex = jsonString.IndexOf("SubDataMapping")
                    Dim preview = jsonString.Substring(subDataMappingIndex, Math.Min(500, jsonString.Length - subDataMappingIndex))
                    Console.WriteLine($"[DialogRepository.GetDialog]   - JSON SubDataMapping preview: {preview}")
                Else
                    Console.WriteLine($"[DialogRepository.GetDialog] ⚠️ JSON does NOT contain 'SubDataMapping'!")
                End If

                ' ✅ STEP 4: Deserializza CompiledUtteranceTask
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .Converters = New List(Of JsonConverter) From {New ITaskConverter()}
                }
                Dim compiledTask = JsonConvert.DeserializeObject(Of CompiledUtteranceTask)(jsonString, settings)

                ' ✅ LOG: Verifica SubDataMapping dopo la deserializzazione
                Console.WriteLine($"[DialogRepository.GetDialog] 🔍 Loaded task from Redis")
                If compiledTask IsNot Nothing Then
                    Console.WriteLine($"[DialogRepository.GetDialog]   - Task.Id: {compiledTask.Id}")
                    If compiledTask.NlpContract IsNot Nothing Then
                        Console.WriteLine($"[DialogRepository.GetDialog]   - NlpContract.SubDataMapping IsNothing: {compiledTask.NlpContract.SubDataMapping Is Nothing}")
                        If compiledTask.NlpContract.SubDataMapping IsNot Nothing Then
                            Console.WriteLine($"[DialogRepository.GetDialog]   - NlpContract.SubDataMapping.Count: {compiledTask.NlpContract.SubDataMapping.Count}")
                            For Each kvp In compiledTask.NlpContract.SubDataMapping
                                Console.WriteLine($"[DialogRepository.GetDialog]     - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                            Next
                        Else
                            Console.WriteLine($"[DialogRepository.GetDialog] ⚠️ SubDataMapping is Nothing after deserialization!")
                        End If
                    Else
                        Console.WriteLine($"[DialogRepository.GetDialog] ⚠️ NlpContract is Nothing!")
                    End If

                    ' ✅ LOG: Verifica SubDataMapping nei SubTasks (ricorsivo)
                    If compiledTask.SubTasks IsNot Nothing Then
                        Console.WriteLine($"[DialogRepository.GetDialog]   - SubTasks.Count: {compiledTask.SubTasks.Count}")
                        For Each subTask In compiledTask.SubTasks
                            Console.WriteLine($"[DialogRepository.GetDialog]     - SubTask.Id: {subTask.Id}")
                            If subTask.NlpContract IsNot Nothing Then
                                Console.WriteLine($"[DialogRepository.GetDialog]       - SubTask.NlpContract.SubDataMapping IsNothing: {subTask.NlpContract.SubDataMapping Is Nothing}")
                                If subTask.NlpContract.SubDataMapping IsNot Nothing Then
                                    Console.WriteLine($"[DialogRepository.GetDialog]       - SubTask.NlpContract.SubDataMapping.Count: {subTask.NlpContract.SubDataMapping.Count}")
                                    For Each kvp In subTask.NlpContract.SubDataMapping
                                        Console.WriteLine($"[DialogRepository.GetDialog]         - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                                    Next
                                End If
                            End If
                        Next
                    End If
                End If

                If compiledTask Is Nothing Then
                    Return Nothing
                End If

                ' ✅ STEP 5: Salva in cache in memoria
                SyncLock _cacheLock
                    _cache(cacheKey) = compiledTask
                End SyncLock

                Return compiledTask

            Catch ex As Exception
                Throw New Exception($"Failed to load dialog {projectId}:{version}: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Salva un dialogo compilato nel repository
        ''' </summary>
        Public Sub SaveDialog(projectId As String, version As String, compiledTask As CompiledUtteranceTask) Implements IDialogRepository.SaveDialog
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(version) Then
                Throw New ArgumentException("Version cannot be null or empty", NameOf(version))
            End If
            If compiledTask Is Nothing Then
                Throw New ArgumentNullException(NameOf(compiledTask), "CompiledUtteranceTask cannot be Nothing")
            End If

            Try
                ' ✅ STEP 1: Serializza CompiledUtteranceTask
                Dim settings As New JsonSerializerSettings With {
                    .TypeNameHandling = TypeNameHandling.Auto,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                }
                Dim json = JsonConvert.SerializeObject(compiledTask, settings)

                ' ✅ LOG: Verifica SubDataMapping prima del salvataggio
                Console.WriteLine($"[DialogRepository.SaveDialog] 🔍 Saving task {compiledTask.Id}")
                If compiledTask.NlpContract IsNot Nothing Then
                    Console.WriteLine($"[DialogRepository.SaveDialog]   - NlpContract.SubDataMapping IsNothing: {compiledTask.NlpContract.SubDataMapping Is Nothing}")
                    If compiledTask.NlpContract.SubDataMapping IsNot Nothing Then
                        Console.WriteLine($"[DialogRepository.SaveDialog]   - NlpContract.SubDataMapping.Count: {compiledTask.NlpContract.SubDataMapping.Count}")
                        For Each kvp In compiledTask.NlpContract.SubDataMapping
                            Console.WriteLine($"[DialogRepository.SaveDialog]     - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                        Next
                    Else
                        Console.WriteLine($"[DialogRepository.SaveDialog] ⚠️ SubDataMapping is Nothing before serialization!")
                    End If
                Else
                    Console.WriteLine($"[DialogRepository.SaveDialog] ⚠️ NlpContract is Nothing!")
                End If

                ' ✅ LOG: Verifica se SubDataMapping è presente nel JSON
                Dim jsonContainsSubDataMapping = json.Contains("SubDataMapping")
                Console.WriteLine($"[DialogRepository.SaveDialog]   - JSON contains 'SubDataMapping': {jsonContainsSubDataMapping}")
                If jsonContainsSubDataMapping Then
                    Dim subDataMappingIndex = json.IndexOf("SubDataMapping")
                    Dim preview = json.Substring(subDataMappingIndex, Math.Min(500, json.Length - subDataMappingIndex))
                    Console.WriteLine($"[DialogRepository.SaveDialog]   - JSON SubDataMapping preview: {preview}")
                Else
                    Console.WriteLine($"[DialogRepository.SaveDialog] ⚠️ JSON does NOT contain 'SubDataMapping'!")
                End If

                ' ✅ LOG: Verifica SubDataMapping nei SubTasks (ricorsivo)
                If compiledTask.SubTasks IsNot Nothing Then
                    Console.WriteLine($"[DialogRepository.SaveDialog]   - SubTasks.Count: {compiledTask.SubTasks.Count}")
                    For Each subTask In compiledTask.SubTasks
                        Console.WriteLine($"[DialogRepository.SaveDialog]     - SubTask.Id: {subTask.Id}")
                        If subTask.NlpContract IsNot Nothing Then
                            Console.WriteLine($"[DialogRepository.SaveDialog]       - SubTask.NlpContract.SubDataMapping IsNothing: {subTask.NlpContract.SubDataMapping Is Nothing}")
                            If subTask.NlpContract.SubDataMapping IsNot Nothing Then
                                Console.WriteLine($"[DialogRepository.SaveDialog]       - SubTask.NlpContract.SubDataMapping.Count: {subTask.NlpContract.SubDataMapping.Count}")
                                For Each kvp In subTask.NlpContract.SubDataMapping
                                    Console.WriteLine($"[DialogRepository.SaveDialog]         - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                                Next
                            End If
                        End If
                    Next
                End If

                ' ✅ STEP 2: Salva in Redis (senza TTL - immutabile)
                Dim redisKey = GetDialogKey(projectId, version)
                _database.StringSet(redisKey, json)

                ' ✅ STEP 3: Salva in cache in memoria
                Dim cacheKey = GetCacheKey(projectId, version)
                SyncLock _cacheLock
                    _cache(cacheKey) = compiledTask
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
