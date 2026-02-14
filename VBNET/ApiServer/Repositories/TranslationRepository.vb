Option Strict On
Option Explicit On
Imports StackExchange.Redis
Imports System.Collections.Concurrent

Namespace ApiServer.Repositories
    ''' <summary>
    ''' ✅ STATELESS: Repository Redis per traduzioni con cache in memoria
    '''
    ''' Architettura:
    ''' - Redis key: omnia:translations:{projectId}:{locale}:{textKey}
    ''' - Cache in memoria (condivisa tra tutte le sessioni del pod)
    ''' - Immutabile: una volta salvata, non cambia per quella combinazione projectId+locale+textKey
    ''' </summary>
    Public Class RedisTranslationRepository
        Implements ITranslationRepository

        Private ReadOnly _connection As IConnectionMultiplexer
        Private ReadOnly _database As IDatabase
        Private ReadOnly _keyPrefix As String
        Private ReadOnly _cache As New ConcurrentDictionary(Of String, String)
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
        ''' Genera la chiave Redis per una traduzione
        ''' </summary>
        Private Function GetTranslationKey(projectId As String, locale As String, textKey As String) As String
            Return $"{_keyPrefix}translations:{projectId}:{locale}:{textKey}"
        End Function

        ''' <summary>
        ''' Genera la chiave cache in memoria
        ''' </summary>
        Private Function GetCacheKey(projectId As String, locale As String, textKey As String) As String
            Return $"{projectId}:{locale}:{textKey}"
        End Function

        ''' <summary>
        ''' Carica una traduzione dal repository (con cache in memoria)
        ''' </summary>
        Public Function GetTranslation(projectId As String, locale As String, textKey As String) As String Implements ITranslationRepository.GetTranslation
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(locale) Then
                Throw New ArgumentException("Locale cannot be null or empty", NameOf(locale))
            End If
            If String.IsNullOrWhiteSpace(textKey) Then
                Throw New ArgumentException("TextKey cannot be null or empty", NameOf(textKey))
            End If

            ' ✅ STEP 1: Verifica cache in memoria (veloce)
            Dim cacheKey = GetCacheKey(projectId, locale, textKey)
            If _cache.TryGetValue(cacheKey, Nothing) Then
                Dim cachedText = _cache(cacheKey)
                If Not String.IsNullOrEmpty(cachedText) Then
                    Return cachedText
                End If
            End If

            ' ✅ STEP 2: Carica da Redis
            Try
                Dim redisKey = GetTranslationKey(projectId, locale, textKey)
                Dim text = _database.StringGet(redisKey)

                If Not text.HasValue Then
                    Console.WriteLine($"[TranslationRepository] ❌ Translation not found: {projectId}:{locale}:{textKey}")
                    Return Nothing
                End If

                Dim translatedText = text.ToString()

                ' ✅ STEP 3: Salva in cache in memoria
                SyncLock _cacheLock
                    _cache(cacheKey) = translatedText
                End SyncLock

                Return translatedText

            Catch ex As Exception
                Console.WriteLine($"[TranslationRepository] ❌ Error loading translation: {ex.Message}")
                Throw New Exception($"Failed to load translation {projectId}:{locale}:{textKey}: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Carica multiple traduzioni in batch (più efficiente)
        ''' </summary>
        Public Function GetTranslationsBatch(projectId As String, locale As String, textKeys As List(Of String)) As Dictionary(Of String, String) Implements ITranslationRepository.GetTranslationsBatch
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(locale) Then
                Throw New ArgumentException("Locale cannot be null or empty", NameOf(locale))
            End If
            If textKeys Is Nothing OrElse textKeys.Count = 0 Then
                Return New Dictionary(Of String, String)()
            End If

            Dim result As New Dictionary(Of String, String)()

            ' ✅ STEP 1: Carica da cache in memoria (quelli disponibili)
            Dim missingKeys As New List(Of String)()
            For Each textKey In textKeys
                Dim cacheKey = GetCacheKey(projectId, locale, textKey)
                If _cache.TryGetValue(cacheKey, Nothing) Then
                    Dim cachedText = _cache(cacheKey)
                    If Not String.IsNullOrEmpty(cachedText) Then
                        result(textKey) = cachedText
                    Else
                        missingKeys.Add(textKey)
                    End If
                Else
                    missingKeys.Add(textKey)
                End If
            Next

            ' ✅ STEP 2: Carica da Redis quelli mancanti
            If missingKeys.Count > 0 Then
                Try
                    Dim redisKeys = missingKeys.Select(Function(key) CType(GetTranslationKey(projectId, locale, key), RedisKey)).ToArray()
                    Dim values = _database.StringGet(redisKeys)

                    For i = 0 To missingKeys.Count - 1
                        Dim textKey = missingKeys(i)
                        Dim value = values(i)

                        If value.HasValue Then
                            Dim translatedText = value.ToString()
                            result(textKey) = translatedText

                            ' ✅ Salva in cache
                            Dim cacheKey = GetCacheKey(projectId, locale, textKey)
                            SyncLock _cacheLock
                                _cache(cacheKey) = translatedText
                            End SyncLock
                        End If
                    Next
                Catch ex As Exception
                    Console.WriteLine($"[TranslationRepository] ❌ Error loading translations batch: {ex.Message}")
                    ' Continua con quelle caricate
                End Try
            End If

            Return result
        End Function

        ''' <summary>
        ''' Salva una traduzione nel repository
        ''' </summary>
        Public Sub SetTranslation(projectId As String, locale As String, textKey As String, text As String) Implements ITranslationRepository.SetTranslation
            If String.IsNullOrWhiteSpace(projectId) Then
                Throw New ArgumentException("ProjectId cannot be null or empty", NameOf(projectId))
            End If
            If String.IsNullOrWhiteSpace(locale) Then
                Throw New ArgumentException("Locale cannot be null or empty", NameOf(locale))
            End If
            If String.IsNullOrWhiteSpace(textKey) Then
                Throw New ArgumentException("TextKey cannot be null or empty", NameOf(textKey))
            End If
            If text Is Nothing Then
                Throw New ArgumentNullException(NameOf(text), "Text cannot be Nothing")
            End If

            Try
                ' ✅ STEP 1: Salva in Redis (senza TTL - immutabile)
                Dim redisKey = GetTranslationKey(projectId, locale, textKey)
                _database.StringSet(redisKey, text)

                ' ✅ STEP 2: Salva in cache in memoria
                Dim cacheKey = GetCacheKey(projectId, locale, textKey)
                SyncLock _cacheLock
                    _cache(cacheKey) = text
                End SyncLock

                Console.WriteLine($"[TranslationRepository] ✅ Translation saved: {projectId}:{locale}:{textKey}")
            Catch ex As Exception
                Console.WriteLine($"[TranslationRepository] ❌ Error saving translation: {ex.Message}")
                Throw New Exception($"Failed to save translation {projectId}:{locale}:{textKey}: {ex.Message}", ex)
            End Try
        End Sub

        ''' <summary>
        ''' Verifica se una traduzione esiste
        ''' </summary>
        Public Function TranslationExists(projectId As String, locale As String, textKey As String) As Boolean Implements ITranslationRepository.TranslationExists
            If String.IsNullOrWhiteSpace(projectId) OrElse String.IsNullOrWhiteSpace(locale) OrElse String.IsNullOrWhiteSpace(textKey) Then
                Return False
            End If

            ' ✅ Verifica cache in memoria
            Dim cacheKey = GetCacheKey(projectId, locale, textKey)
            If _cache.ContainsKey(cacheKey) Then
                Return True
            End If

            ' ✅ Verifica Redis
            Try
                Dim redisKey = GetTranslationKey(projectId, locale, textKey)
                Return _database.KeyExists(redisKey)
            Catch ex As Exception
                Console.WriteLine($"[TranslationRepository] ❌ Error checking translation existence: {ex.Message}")
                Return False
            End Try
        End Function
    End Class
End Namespace
