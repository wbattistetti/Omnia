Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports TaskEngine.Orchestrator
Imports ApiServer.Interfaces
Imports ApiServer.SessionStorage
Imports System.Linq
Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Converters

''' <summary>
''' Orchestrator Session: contiene tutto lo stato di una sessione di esecuzione
''' </summary>
Public Class OrchestratorSession
    Public Property SessionId As String
    Public Property CompilationResult As FlowCompilationResult
    Public Property Tasks As List(Of Object)
    ' ❌ RIMOSSO: DDTs property - non più usato, struttura costruita da template
    Public Property Translations As Dictionary(Of String, String)
    Public Property Orchestrator As TaskEngine.Orchestrator.FlowOrchestrator
    ' ✅ REMOVED: TaskEngine (Motore) - no longer needed, use StatelessDialogueEngine when required
    Public Property Messages As New List(Of Object)
    Public Property EventEmitter As EventEmitter
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
End Class

''' <summary>
''' EventEmitter: gestisce eventi per SSE con replay buffer.
''' Events emitted before any listener is registered are buffered and
''' replayed immediately when the first listener registers via .On().
''' This resolves the race condition between ProcessTurn (fires at session/start)
''' and the SSE handler (registers listeners at session/stream connection).
''' </summary>
Public Class EventEmitter
    Private ReadOnly _listeners As New Dictionary(Of String, List(Of Action(Of Object)))
    Private ReadOnly _replayBuffer As New Dictionary(Of String, Queue(Of Object))
    Private ReadOnly _lock As New Object()
    Private Shared ReadOnly _logger As ApiServer.Logging.StdoutLogger = New ApiServer.Logging.StdoutLogger()

    ''' <summary>
    ''' Register a listener. Buffered events of this type are replayed immediately.
    ''' </summary>
    Public Sub [On](eventName As String, handler As Action(Of Object))
        SyncLock _lock
            If Not _listeners.ContainsKey(eventName) Then
                _listeners(eventName) = New List(Of Action(Of Object))()
            End If
            _listeners(eventName).Add(handler)

            ' Replay buffered events emitted before this listener was registered
            Dim bufferedCount = 0
            If _replayBuffer.ContainsKey(eventName) Then
                Dim q = _replayBuffer(eventName)
                bufferedCount = q.Count
                _logger.LogInfo($"[EventEmitter] 🔄 Starting replay of {bufferedCount} buffered events", New With {
                    .eventName = eventName,
                    .bufferedCount = bufferedCount
                })
                Dim replayIndex = 0
                While q.Count > 0
                    Dim bufferedData = q.Dequeue()
                    replayIndex += 1
                    Try
                        Dim dataPreview As String = "null"
                        If bufferedData IsNot Nothing Then
                            Try
                                dataPreview = JsonConvert.SerializeObject(bufferedData)
                                If dataPreview.Length > 200 Then
                                    dataPreview = dataPreview.Substring(0, 200) + "..."
                                End If
                            Catch
                                dataPreview = bufferedData.ToString()
                            End Try
                        End If
                        _logger.LogInfo($"[EventEmitter] 🔄 Replaying buffered event {replayIndex}/{bufferedCount}", New With {
                            .eventName = eventName,
                            .eventIndex = replayIndex,
                            .totalBuffered = bufferedCount,
                            .dataType = If(bufferedData IsNot Nothing, bufferedData.GetType().Name, "null"),
                            .dataPreview = dataPreview
                        })
                        handler(bufferedData)
                        _logger.LogInfo($"[EventEmitter] ✅ Buffered event {replayIndex}/{bufferedCount} replayed successfully", New With {
                            .eventName = eventName,
                            .eventIndex = replayIndex
                        })
                    Catch ex As Exception
                        _logger.LogError($"[EventEmitter] ❌ Error replaying buffered event {replayIndex}/{bufferedCount}", ex, New With {
                            .eventName = eventName,
                            .eventIndex = replayIndex,
                            .errorMessage = ex.Message
                        })
                    End Try
                End While
                _replayBuffer.Remove(eventName)
            End If

            If bufferedCount > 0 Then
                _logger.LogInfo($"[EventEmitter] ✅ Completed replay of {bufferedCount} buffered events", New With {
                    .eventName = eventName,
                    .totalListeners = _listeners(eventName).Count
                })
            End If
        End SyncLock
    End Sub

    ''' <summary>
    ''' Emit an event. If no listener is registered yet, buffer it for later replay.
    ''' </summary>
    Public Sub Emit(eventName As String, data As Object)
        SyncLock _lock
            Dim hasListeners = _listeners.ContainsKey(eventName) AndAlso _listeners(eventName).Count > 0
            If hasListeners Then
                Dim listenerCount = _listeners(eventName).Count
                _logger.LogInfo($"[EventEmitter] 📤 Emitting event (has listeners)", New With {
                    .eventName = eventName,
                    .listenerCount = listenerCount,
                    .dataType = If(data IsNot Nothing, data.GetType().Name, "null")
                })
                For Each handler In _listeners(eventName)
                    Try
                        handler(data)
                    Catch ex As Exception
                        _logger.LogError($"[EventEmitter] ❌ Error in handler", ex, New With {
                            .eventName = eventName
                        })
                    End Try
                Next
            Else
                ' No listener yet: queue for replay when .On() is called
                If Not _replayBuffer.ContainsKey(eventName) Then
                    _replayBuffer(eventName) = New Queue(Of Object)()
                End If
                _replayBuffer(eventName).Enqueue(data)
                Dim bufferSize = _replayBuffer(eventName).Count
                _logger.LogInfo($"[EventEmitter] 💾 Buffering event (no listeners)", New With {
                    .eventName = eventName,
                    .bufferSize = bufferSize,
                    .dataType = If(data IsNot Nothing, data.GetType().Name, "null")
                })
            End If
        End SyncLock
    End Sub

    Public Sub RemoveListener(eventName As String, handler As Action(Of Object))
        SyncLock _lock
            If _listeners.ContainsKey(eventName) Then
                _listeners(eventName).Remove(handler)
            End If
        End SyncLock
    End Sub

    Public Function ListenerCount(eventName As String) As Integer
        SyncLock _lock
            If _listeners.ContainsKey(eventName) Then
                Return _listeners(eventName).Count
            End If
            Return 0
        End SyncLock
    End Function
End Class

''' <summary>
''' ✅ STATELESS: Task Session contiene solo stato runtime, non configurazione immutabile
'''
''' Configurazione immutabile (dialoghi, traduzioni) è in repository condivisi:
''' - DialogRepository: projectId + dialogVersion → RuntimeTask
''' - TranslationRepository: projectId + locale + textKey → testo
'''
''' La sessione contiene solo:
''' - Stato runtime della chiamata (currentNodeId, runtimeData)
''' - Riferimenti alla configurazione (projectId, dialogVersion, locale)
''' </summary>
Public Class TaskSession
    ' ✅ STATELESS: Identificatori sessione
    Public Property SessionId As String  ' callId

    ' ✅ STATELESS: Riferimenti alla configurazione immutabile (non duplicata)
    Public Property ProjectId As String
    Public Property DialogVersion As String
    Public Property Locale As String

    ' ✅ STATELESS: Stato runtime (unico per questa chiamata)
    Public Property CurrentNodeId As String
    Public Property RuntimeData As Dictionary(Of String, Object)  ' Dati raccolti durante la chiamata

    ' ✅ STATELESS: Oggetti runtime (non serializzati, ricreati ad ogni accesso)
    ' ✅ REMOVED: TaskInstance - legacy code from old engine, no longer needed
    Public Property EventEmitter As EventEmitter

    ' ✅ STATELESS: Stato comunicazione
    Public Property Messages As New List(Of Object)
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
    Public Property SseConnected As Boolean = False

    ' ✅ STATELESS: Snapshot dello stato del TaskUtterance (serializzato su Redis).
    ' La configurazione (Steps, NlpContract) viene sempre ricostruita dal dialogo compilato.
    Public Property TaskUtteranceState As TaskEngine.TaskUtteranceStateSnapshot

    ' ✅ STATELESS: DialogueContext serializzato (per il nuovo motore stateless)
    Public Property DialogueContextJson As String

    ' ❌ RIMOSSO: RuntimeTask (configurazione immutabile - carica da DialogRepository)
    ' ❌ RIMOSSO: Translations (configurazione immutabile - carica da TranslationRepository)
End Class

''' <summary>
''' Risultato della validazione traduzioni
''' </summary>
Public Class TranslationValidationResult
    Public Property IsValid As Boolean
    Public Property MissingKeys As List(Of String)
    Public Property ErrorMessage As String

    Public Sub New(isValid As Boolean, missingKeys As List(Of String), errorMessage As String)
        Me.IsValid = isValid
        Me.MissingKeys = If(missingKeys, New List(Of String)())
        Me.ErrorMessage = errorMessage
    End Sub
End Class

''' <summary>
''' SessionManager: gestisce tutte le sessioni attive
''' </summary>
Public Class SessionManager
    ' ✅ STATELESS: Solo Redis, nessun fallback
    Private Shared _storage As ApiServer.Interfaces.ISessionStorage
    ' ✅ STATELESS: Storage per ExecutionState
    Private Shared _executionStateStorage As ApiServer.Interfaces.IExecutionStateStorage
    ' ✅ FASE 2: Aggiunto supporto per ILogger
    Private Shared _logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
    Private Shared ReadOnly _lock As New Object
    ' ✅ STATELESS: EventEmitter condivisi per sessione (non serializzati, rimangono in memoria)
    Private Shared ReadOnly _eventEmitters As New Dictionary(Of String, EventEmitter)
    ' ✅ STATELESS: Redis connection per Pub/Sub (per notifiche SSE connected)
    Private Shared _redisConnectionString As String = Nothing
    Private Shared _redisKeyPrefix As String = Nothing
    Private Shared _sessionTTL As Integer = 3600
    ' ✅ STATELESS: Repository per configurazione immutabile
    Private Shared _dialogRepository As ApiServer.Repositories.IDialogRepository = Nothing
    Private Shared _translationRepository As ApiServer.Repositories.ITranslationRepository = Nothing

    ' ✅ STATELESS: Dizionari rimossi - tutto lo stato è in Redis

    ''' <summary>
    ''' ✅ STATELESS: Configura il storage (solo Redis) e connection string per Pub/Sub
    ''' </summary>
    Public Shared Sub ConfigureStorage(storage As ApiServer.Interfaces.ISessionStorage, Optional redisConnectionString As String = Nothing, Optional redisKeyPrefix As String = Nothing, Optional sessionTTL As Integer = 3600)
        If storage Is Nothing Then
            Throw New ArgumentNullException(NameOf(storage), "Storage cannot be Nothing. Redis is required.")
        End If
        SyncLock _lock
            _storage = storage
            If Not String.IsNullOrEmpty(redisConnectionString) Then
                _redisConnectionString = redisConnectionString
            End If
            If Not String.IsNullOrEmpty(redisKeyPrefix) Then
                _redisKeyPrefix = redisKeyPrefix
            End If
            _sessionTTL = sessionTTL

            ' ✅ STATELESS: Crea RedisExecutionStateStorage se abbiamo i parametri necessari
            If Not String.IsNullOrEmpty(_redisConnectionString) AndAlso Not String.IsNullOrEmpty(_redisKeyPrefix) Then
                Try
                    _executionStateStorage = New ApiServer.SessionStorage.RedisExecutionStateStorage(_redisConnectionString, _redisKeyPrefix, _sessionTTL)
                Catch ex As Exception
                    ' Non solleviamo eccezione perché ExecutionState storage è opzionale per retrocompatibilità
                End Try
            End If

            ' ✅ STATELESS: Crea repository per configurazione immutabile
            If Not String.IsNullOrEmpty(_redisConnectionString) AndAlso Not String.IsNullOrEmpty(_redisKeyPrefix) Then
                Try
                    _dialogRepository = New ApiServer.Repositories.RedisDialogRepository(_redisConnectionString, _redisKeyPrefix)
                    _translationRepository = New ApiServer.Repositories.RedisTranslationRepository(_redisConnectionString, _redisKeyPrefix)
                Catch ex As Exception
                    Throw ' I repository sono obbligatori per il runtime stateless
                End Try
            End If
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ FASE 2: Configura il logger da usare
    ''' </summary>
    Public Shared Sub ConfigureLogger(logger As ApiServer.Interfaces.ILogger)
        SyncLock _lock
            _logger = logger
        End SyncLock
    End Sub

    ''' <summary>
    ''' Crea una nuova sessione e avvia l'orchestrator
    ''' </summary>
    Public Shared Function CreateSession(
        sessionId As String,
        compilationResult As FlowCompilationResult,
        tasks As List(Of Object),
        translations As Dictionary(Of String, String)
    ) As OrchestratorSession
        SyncLock _lock
            ' ✅ REMOVED: taskEngine (Motore) - FlowOrchestrator no longer requires it
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .IsWaitingForInput = False
            }
            ' ✅ STATELESS: Crea FlowOrchestrator (no longer requires Motore)
            session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(compilationResult, sessionId, _executionStateStorage)

            AddHandler session.Orchestrator.MessageToShow, Sub(sender, text)
                                                               Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                               Dim msg = New With {
                    .id = msgId,
                    .text = text,
                    .stepType = "message",
                    .timestamp = DateTime.UtcNow.ToString("O"),
                    .taskId = ""
                }
                                                               session.Messages.Add(msg)
                                                               session.EventEmitter.Emit("message", msg)
                                                           End Sub

            AddHandler session.Orchestrator.StateUpdated, Sub(sender, state)
                                                              Dim stateData = New With {
                    .currentNodeId = state.CurrentNodeId,
                    .executedTaskIds = state.ExecutedTaskIds.ToList(),
                    .variableStore = state.VariableStore
                }
                                                              session.EventEmitter.Emit("stateUpdate", stateData)
                                                          End Sub

            AddHandler session.Orchestrator.ExecutionCompleted, Sub(sender, e)
                                                                    Dim completeData = New With {
                    .success = True,
                    .timestamp = DateTime.UtcNow.ToString("O")
                }
                                                                    session.EventEmitter.Emit("complete", completeData)
                                                                End Sub

            AddHandler session.Orchestrator.ExecutionError, Sub(sender, ex)
                                                                Dim errorData = New With {
                    .error = ex.Message,
                    .timestamp = DateTime.UtcNow.ToString("O")
                }
                                                                session.EventEmitter.Emit("error", errorData)
                                                            End Sub

            ' ✅ STATELESS: Salva solo su Redis
            _storage.SaveOrchestratorSession(session)

            ' ✅ STATELESS: Esegui orchestrator senza delay artificiale (sincronizzazione via Redis/PubSub)
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function()
                                                                     Try
                                                                         If session.Orchestrator IsNot Nothing Then
                                                                             Await session.Orchestrator.ExecuteDialogueAsync()
                                                                         End If
                                                                     Catch ex As Exception
                                                                         Dim errorData = New With {
                                                                             .error = ex.Message,
                                                                             .timestamp = DateTime.UtcNow.ToString("O")
                                                                         }
                                                                         session.EventEmitter.Emit("error", errorData)
                                                                     End Try
                                                                 End Function)

            Return session
        End SyncLock
    End Function

    ''' <summary>
    ''' Recupera una sessione esistente
    ''' </summary>
    ''' <summary>
    ''' ✅ STATELESS: Recupera sessione da Redis e ricrea FlowOrchestrator con ExecutionStateStorage
    ''' </summary>
    Public Shared Function GetSession(sessionId As String) As OrchestratorSession
        SyncLock _lock
            Dim session = _storage.GetOrchestratorSession(sessionId)
            If session IsNot Nothing AndAlso session.CompilationResult IsNot Nothing AndAlso session.Orchestrator Is Nothing Then
                ' ✅ STATELESS: Ricrea FlowOrchestrator (no longer requires Motore)
                session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(session.CompilationResult, sessionId, _executionStateStorage)

                ' Ricollega eventi
                AddHandler session.Orchestrator.MessageToShow, Sub(sender, text)
                                                                   Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                                   Dim msg = New With {
                                                                       .id = msgId,
                                                                       .text = text,
                                                                       .stepType = "message",
                                                                       .timestamp = DateTime.UtcNow.ToString("O"),
                                                                       .taskId = ""
                                                                   }
                                                                   session.Messages.Add(msg)
                                                                   session.EventEmitter.Emit("message", msg)
                                                               End Sub
                AddHandler session.Orchestrator.StateUpdated, Sub(sender, state)
                                                                  Dim stateData = New With {
                                                                      .currentNodeId = state.CurrentNodeId,
                                                                      .executedTaskIds = state.ExecutedTaskIds.ToList(),
                                                                      .variableStore = state.VariableStore
                                                                  }
                                                                  session.EventEmitter.Emit("stateUpdate", stateData)
                                                              End Sub
                AddHandler session.Orchestrator.ExecutionCompleted, Sub(sender, e)
                                                                        Dim completeData = New With {
                                                                            .success = True,
                                                                            .timestamp = DateTime.UtcNow.ToString("O")
                                                                        }
                                                                        session.EventEmitter.Emit("complete", completeData)
                                                                    End Sub
                AddHandler session.Orchestrator.ExecutionError, Sub(sender, ex)
                                                                    Dim errorData = New With {
                                                                        .error = ex.Message,
                                                                        .timestamp = DateTime.UtcNow.ToString("O")
                                                                    }
                                                                    session.EventEmitter.Emit("error", errorData)
                                                                End Sub
            End If
            Return session
        End SyncLock
    End Function

    ''' <summary>
    ''' Elimina una sessione
    ''' </summary>
    ''' <summary>
    ''' ✅ STATELESS: Elimina sessione da Redis
    ''' </summary>
    Public Shared Sub DeleteSession(sessionId As String)
        SyncLock _lock
            Dim session = _storage.GetOrchestratorSession(sessionId)
            If session IsNot Nothing AndAlso session.Orchestrator IsNot Nothing Then
                session.Orchestrator.Stop()
            End If
            _storage.DeleteOrchestratorSession(sessionId)
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Crea una nuova TaskSession con solo stato runtime
    '''
    ''' Il dialogo e le traduzioni sono caricati dai repository quando necessario.
    ''' La sessione contiene solo riferimenti (projectId, dialogVersion, locale) e stato runtime.
    ''' </summary>
    Public Shared Function CreateTaskSession(
        sessionId As String,
        projectId As String,
        dialogVersion As String,
        locale As String
    ) As TaskSession
        ' ❌ ERRORE BLOCCANTE: parametri OBBLIGATORI
        If String.IsNullOrWhiteSpace(projectId) Then
            Throw New ArgumentException("ProjectId cannot be null or empty. ProjectId is mandatory.", NameOf(projectId))
        End If
        If String.IsNullOrWhiteSpace(dialogVersion) Then
            Throw New ArgumentException("DialogVersion cannot be null or empty. DialogVersion is mandatory.", NameOf(dialogVersion))
        End If
        If String.IsNullOrWhiteSpace(locale) Then
            Throw New ArgumentException("Locale cannot be null or empty. Locale is mandatory.", NameOf(locale))
        End If

        SyncLock _lock
            ' ✅ FASE 2: Usa ILogger invece di Console.WriteLine
            _logger.LogInfo("Creating task session", New With {
                .sessionId = sessionId,
                .projectId = projectId,
                .dialogVersion = dialogVersion,
                .locale = locale
            })
            ' ✅ REMOVED: taskEngine (Motore) - no longer needed
            ' ✅ STATELESS: Usa EventEmitter condiviso (non serializzato, rimane in memoria)
            Dim sharedEmitter = GetOrCreateEventEmitter(sessionId)
            Dim session As New TaskSession() With {
                .SessionId = sessionId,
                .ProjectId = projectId.Trim(),
                .DialogVersion = dialogVersion.Trim(),
                .Locale = locale.Trim(),
                .CurrentNodeId = Nothing,  ' Inizializzato quando il dialogo viene caricato
                .RuntimeData = New Dictionary(Of String, Object)(),
                .EventEmitter = sharedEmitter,
                .IsWaitingForInput = False
            }

            ' ✅ REMOVED: TaskEngine.MessageToShow handler - use StatelessDialogueEngine output instead
            ' I messaggi verranno gestiti direttamente dall'output di ProcessTurn()
            ' TODO: Implementare gestione messaggi con StatelessDialogueEngine.ProcessTurn()

            ' ✅ STATELESS: Salva solo su Redis (SseConnected=False inizialmente)
            _storage.SaveTaskSession(session)
            ' ✅ STATELESS: Session saved, waiting for SSE connection

            ' ✅ STATELESS: Iscriviti a Redis Pub/Sub per notifica quando SSE si connette
            If Not String.IsNullOrEmpty(_redisConnectionString) Then
                Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                         Try
                                                                             Dim redis = ApiServer.Infrastructure.RedisConnectionManager.GetConnection(_redisConnectionString)
                                                                             Dim subscriber = redis.GetSubscriber()
                                                                             Dim channelName = $"omnia:events:sse-connected:{sessionId}"
                                                                             Dim handler As Action(Of StackExchange.Redis.RedisChannel, StackExchange.Redis.RedisValue) = Sub(redisChannel, message)
                                                                                                                                                                              Try
                                                                                                                                                                                  Dim sessionToUse = _storage.GetTaskSession(sessionId)
                                                                                                                                                                                  If sessionToUse Is Nothing OrElse Not sessionToUse.SseConnected Then
                                                                                                                                                                                      Return
                                                                                                                                                                                  End If
                                                                                                                                                                                  System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                                                                                                                                                      Await StartTaskExecutionAsync(sessionId)
                                                                                                                                                                                                                      subscriber.Unsubscribe(channelName)
                                                                                                                                                                                                                  End Function)
                                                                                                                                                                              Catch ex As Exception
                                                                                                                                                                                  ' Log removed
                                                                                                                                                                              End Try
                                                                                                                                                                          End Sub
                                                                             subscriber.Subscribe(channelName, handler)
                                                                         Catch ex As Exception
                                                                             ' Log removed
                                                                         End Try
                                                                     End Function)
            End If

            Return session
        End SyncLock
    End Function


    ''' <summary>
    ''' ✅ NEW: Carica dialogo dal repository per una sessione (nuovo formato)
    ''' </summary>
    Public Shared Function LoadDialogForSession(session As TaskSession) As Compiler.CompiledUtteranceTask
        If session Is Nothing Then
            Return Nothing
        End If

        If String.IsNullOrWhiteSpace(session.ProjectId) OrElse String.IsNullOrWhiteSpace(session.DialogVersion) Then
            Return Nothing
        End If

        If _dialogRepository Is Nothing Then
            Return Nothing
        End If

        Try
            Dim compiledTask = _dialogRepository.GetDialog(session.ProjectId, session.DialogVersion)
            Return compiledTask
        Catch ex As Exception
            Return Nothing
        End Try
    End Function


    ''' <summary>
    ''' ✅ STATELESS: Avvia l'esecuzione del task se necessario (per sessioni recuperate da Redis)
    ''' </summary>
    Public Shared Sub StartTaskExecutionIfNeeded(sessionId As String)
        SyncLock _lock
            Dim session = _storage.GetTaskSession(sessionId)
            If session Is Nothing Then
                Return
            End If

            ' ✅ REMOVED: TaskInstance legacy code - new TaskEngine handles execution via FlowOrchestrator
            ' Task execution is now handled by FlowOrchestrator.ExecuteDialogueAsync()
            ' No need to create TaskInstance or DialogueContext here
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Ottiene o crea l'EventEmitter condiviso per una sessione
    ''' L'EventEmitter non viene serializzato, rimane in memoria per gestire gli eventi
    ''' </summary>
    Public Shared Function GetOrCreateEventEmitter(sessionId As String) As EventEmitter
        SyncLock _lock
            If Not _eventEmitters.ContainsKey(sessionId) Then
                _eventEmitters(sessionId) = New EventEmitter()
                ' Log rimosso: non essenziale per flusso motore
            End If
            Return _eventEmitters(sessionId)
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Rimuove l'EventEmitter condiviso quando la sessione viene eliminata
    ''' </summary>
    Public Shared Sub RemoveEventEmitter(sessionId As String)
        SyncLock _lock
            If _eventEmitters.ContainsKey(sessionId) Then
                _eventEmitters.Remove(sessionId)
                ' Log rimosso: non essenziale per flusso motore
            End If
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Avvia l'esecuzione del task (chiamato da Redis Pub/Sub quando SSE si connette)
    ''' </summary>
    Friend Shared Async Function StartTaskExecutionAsync(sessionId As String) As System.Threading.Tasks.Task
        SyncLock _lock
            Dim session = _storage.GetTaskSession(sessionId)
            If session Is Nothing Then
                Return
            End If

            ' ✅ REMOVED: TaskInstance legacy code - new TaskEngine handles execution via FlowOrchestrator
            ' Task execution is now handled by FlowOrchestrator.ExecuteDialogueAsync()
            ' No need to create TaskInstance here
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Recupera TaskSession da Redis
    ''' </summary>
    Public Shared Function GetTaskSession(sessionId As String) As TaskSession
        SyncLock _lock
            Return _storage.GetTaskSession(sessionId)
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Salva TaskSession su Redis (metodo pubblico per handler SSE)
    ''' </summary>
    Public Shared Sub SaveTaskSession(session As TaskSession)
        SyncLock _lock
            _storage.SaveTaskSession(session)
        End SyncLock
    End Sub

    ''' <summary>
    ''' Elimina una TaskSession
    ''' </summary>
    ''' <summary>
    ''' ✅ STATELESS: Elimina TaskSession da Redis
    ''' </summary>
    Public Shared Sub DeleteTaskSession(sessionId As String)
        SyncLock _lock
            _storage.DeleteTaskSession(sessionId)
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Restituisce DialogRepository (per ProcessTurn)
    ''' </summary>
    Public Shared Function GetDialogRepository() As ApiServer.Repositories.IDialogRepository
        SyncLock _lock
            Return _dialogRepository
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Restituisce TranslationRepository (per ProcessTurn)
    ''' </summary>
    Public Shared Function GetTranslationRepository() As ApiServer.Repositories.ITranslationRepository
        SyncLock _lock
            Return _translationRepository
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Risolve una traduzione dal TranslationRepository
    ''' Usato da MessageTask per risolvere textKey → testo
    ''' </summary>
    ''' <param name="projectId">ID del progetto</param>
    ''' <param name="locale">Locale (es. "it-IT")</param>
    ''' <param name="textKey">Chiave di traduzione (GUID)</param>
    ''' <returns>Testo tradotto o Nothing se non trovato</returns>
    Public Shared Function ResolveTranslation(projectId As String, locale As String, textKey As String) As String
        If _translationRepository Is Nothing Then
            Return Nothing
        End If

        If String.IsNullOrWhiteSpace(projectId) OrElse String.IsNullOrWhiteSpace(locale) OrElse String.IsNullOrWhiteSpace(textKey) Then
            Return Nothing
        End If

        Try
            Return _translationRepository.GetTranslation(projectId, locale, textKey)
        Catch ex As Exception
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Estrae tutte le chiavi di traduzione (textKey) dal dialogo compilato
    ''' Usato per validare che tutte le traduzioni esistano nel TranslationRepository
    ''' </summary>
    ''' <param name="compiledTask">CompiledUtteranceTask compilato</param>
    ''' <returns>Lista di textKey (GUID) usate nel dialogo</returns>
    Public Shared Function ExtractTextKeysFromCompiledTask(compiledTask As Compiler.CompiledUtteranceTask) As List(Of String)
        If compiledTask Is Nothing Then
            Return New List(Of String)()
        End If

        Dim keys = CollectTranslationKeys(compiledTask)
        Return keys.ToList()
    End Function

    ''' <summary>
    ''' Raccoglie tutte le chiavi di traduzione usate nel grafo
    ''' </summary>
    Private Shared Function CollectTranslationKeys(compiledTask As Compiler.CompiledUtteranceTask) As HashSet(Of String)
        Dim keys As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        CollectTranslationKeysRecursive(compiledTask, keys)
        Return keys
    End Function

    ''' <summary>
    ''' Raccoglie ricorsivamente tutte le chiavi di traduzione
    ''' </summary>
    Private Shared Sub CollectTranslationKeysRecursive(compiledTask As Compiler.CompiledUtteranceTask, keys As HashSet(Of String))
        ' ✅ Itera tutti gli step e escalation per trovare MessageTask
        If compiledTask.Steps IsNot Nothing Then
            For Each dstep As TaskEngine.DialogueStep In compiledTask.Steps
                If dstep.Escalations IsNot Nothing Then
                    For Each escalation As TaskEngine.Escalation In dstep.Escalations
                        If escalation.Tasks IsNot Nothing Then
                            For Each itask As ITask In escalation.Tasks
                                If TypeOf itask Is MessageTask Then
                                    Dim msgTask As MessageTask = DirectCast(itask, MessageTask)
                                    If Not String.IsNullOrWhiteSpace(msgTask.TextKey) Then
                                        keys.Add(msgTask.TextKey)
                                    End If
                                End If
                            Next
                        End If
                    Next
                End If
            Next
        End If

        ' ✅ Ricorsivo per subTasks
        If compiledTask.SubTasks IsNot Nothing Then
            For Each subTask As Compiler.CompiledUtteranceTask In compiledTask.SubTasks
                CollectTranslationKeysRecursive(subTask, keys)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida che tutte le chiavi usate nel grafo siano presenti nel dizionario traduzioni
    ''' </summary>
    Public Shared Function ValidateTranslations(
        compiledTask As Compiler.CompiledUtteranceTask,
        translations As Dictionary(Of String, String)
    ) As TranslationValidationResult
        If compiledTask Is Nothing Then
            Return New TranslationValidationResult(False, Nothing, "CompiledUtteranceTask cannot be Nothing")
        End If

        If translations Is Nothing OrElse translations.Count = 0 Then
            Return New TranslationValidationResult(False, Nothing, "Translations dictionary cannot be Nothing or empty")
        End If

        ' ✅ Raccogli tutte le chiavi usate nel grafo
        Dim usedKeys = CollectTranslationKeys(compiledTask)

        If usedKeys.Count = 0 Then
            ' Nessuna chiave usata: valido ma potrebbe essere un errore
            Return New TranslationValidationResult(True, New List(Of String)(), Nothing)
        End If

        ' ✅ Verifica che tutte le chiavi siano presenti nel dizionario
        Dim missingKeys As New List(Of String)()
        For Each key In usedKeys
            If Not translations.ContainsKey(key) Then
                missingKeys.Add(key)
            ElseIf String.IsNullOrWhiteSpace(translations(key)) Then
                ' ✅ Chiave presente ma valore vuoto: anche questo è un errore
                missingKeys.Add($"{key} (empty value)")
            End If
        Next

        If missingKeys.Count > 0 Then
            Dim errorMsg = $"Translation validation failed: {missingKeys.Count} missing or empty translation key(s): {String.Join(", ", missingKeys.Take(10))}"
            If missingKeys.Count > 10 Then
                errorMsg += $" ... and {missingKeys.Count - 10} more"
            End If
            Return New TranslationValidationResult(False, missingKeys, errorMsg)
        End If

        Return New TranslationValidationResult(True, New List(Of String)(), Nothing)
    End Function




    ''' <summary>
    ''' ✅ STATELESS: Carica DialogueContext dalla sessione (o lo crea se non esiste)
    ''' </summary>
    Public Shared Function GetOrCreateDialogueContext(session As TaskSession) As TaskEngine.Orchestrator.TaskEngine.DialogueContext
        Console.WriteLine("═══════════════════════════════════════════════════════════")
        Console.WriteLine("🔥🔥🔥 GetOrCreateDialogueContext CALLED")
        System.Diagnostics.Debug.WriteLine("🔥🔥🔥 GetOrCreateDialogueContext CALLED")
        Console.WriteLine($"   SessionId: {If(session IsNot Nothing, session.SessionId, "NULL")}")
        System.Diagnostics.Debug.WriteLine($"   SessionId: {If(session IsNot Nothing, session.SessionId, "NULL")}")
        If session IsNot Nothing Then
            Console.WriteLine($"   HasDialogueContextJson: {Not String.IsNullOrEmpty(session.DialogueContextJson)}")
            System.Diagnostics.Debug.WriteLine($"   HasDialogueContextJson: {Not String.IsNullOrEmpty(session.DialogueContextJson)}")
            If Not String.IsNullOrEmpty(session.DialogueContextJson) Then
                Console.WriteLine($"   DialogueContextJsonLength: {session.DialogueContextJson.Length}")
                System.Diagnostics.Debug.WriteLine($"   DialogueContextJsonLength: {session.DialogueContextJson.Length}")
            End If
        End If
        Console.Out.Flush()
        System.Diagnostics.Debug.Flush()

        If session Is Nothing Then
            Console.WriteLine("⚠️ GetOrCreateDialogueContext: session is Nothing, RETURNING Nothing")
            Console.Out.Flush()
            Return Nothing
        End If

        ' ✅ Log: Stato PRIMA del caricamento
        Dim hasJson As Boolean = Not String.IsNullOrEmpty(session.DialogueContextJson)
        Dim jsonLength As Integer = If(hasJson, session.DialogueContextJson.Length, 0)

        _logger.LogInfo("📥 [GetOrCreateDialogueContext] Loading DialogueContext from session", New With {
            .sessionId = session.SessionId,
            .hasJson = hasJson,
            .jsonLength = jsonLength,
            .jsonPreview = If(hasJson AndAlso jsonLength > 200, session.DialogueContextJson.Substring(0, 200) & "...", If(hasJson, session.DialogueContextJson, "null"))
        })

        ' ✅ Log diretto su Console per visibilità immediata
        Console.WriteLine($"📥 [GetOrCreateDialogueContext] Loading SessionId={session.SessionId}, HasJson={hasJson}, JsonLength={jsonLength}")
        Console.Out.Flush()

        ' Se esiste già un DialogueContext salvato, deserializzalo
        If hasJson Then
            Try
                ' ✅ AGGIUNGI LOG PER VEDERE IL VALORE DI Mode NEL JSON PRIMA DELLA DESERIALIZZAZIONE:
                Console.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: BEFORE deserialization - Checking Mode value in JSON")
                System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: BEFORE deserialization - Checking Mode value in JSON")

                ' Cerca il valore di Mode nel JSON
                If session.DialogueContextJson.Contains("""" & "Mode" & """:") Then
                    Try
                        Dim modeIndex = session.DialogueContextJson.IndexOf("""" & "Mode" & """:")
                        Dim modeValueStart = modeIndex + 8 ' "Mode":
                        Dim modeValueEnd = session.DialogueContextJson.IndexOf(",", modeValueStart)
                        If modeValueEnd = -1 Then modeValueEnd = session.DialogueContextJson.IndexOf("}", modeValueStart)
                        If modeValueEnd > modeValueStart Then
                            Dim modeValue = session.DialogueContextJson.Substring(modeValueStart, modeValueEnd - modeValueStart).Trim()
                            Console.WriteLine($"   Mode raw value in JSON BEFORE deserialization: {modeValue}")
                            System.Diagnostics.Debug.WriteLine($"   Mode raw value in JSON BEFORE deserialization: {modeValue}")
                        End If
                    Catch ex As Exception
                        Console.WriteLine($"   Error extracting Mode value: {ex.Message}")
                        System.Diagnostics.Debug.WriteLine($"   Error extracting Mode value: {ex.Message}")
                    End Try
                End If

                ' Mostra un estratto del JSON intorno a "Mode"
                Dim modeIndex2 = session.DialogueContextJson.IndexOf("""" & "Mode" & """")
                If modeIndex2 >= 0 Then
                    Try
                        Dim start = Math.Max(0, modeIndex2 - 50)
                        Dim length = Math.Min(200, session.DialogueContextJson.Length - start)
                        Dim excerpt = session.DialogueContextJson.Substring(start, length)
                        Console.WriteLine($"   JSON excerpt around Mode BEFORE deserialization: {excerpt}")
                        System.Diagnostics.Debug.WriteLine($"   JSON excerpt around Mode BEFORE deserialization: {excerpt}")
                    Catch ex As Exception
                        Console.WriteLine($"   Error extracting excerpt: {ex.Message}")
                        System.Diagnostics.Debug.WriteLine($"   Error extracting excerpt: {ex.Message}")
                    End Try
                End If

                Console.Out.Flush()
                System.Diagnostics.Debug.Flush()

                Console.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: About to deserialize DialogueContextJson")
                System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: About to deserialize DialogueContextJson")
                Console.WriteLine($"   JsonLength: {jsonLength}")
                System.Diagnostics.Debug.WriteLine($"   JsonLength: {jsonLength}")
                Console.Out.Flush()
                System.Diagnostics.Debug.Flush()

                ' ✅ Usa StringEnumConverter per deserializzare gli enum come stringhe invece che numeri
                ' ✅ Usa ITaskConverter per deserializzare ITask (interfaccia) nelle sue implementazioni concrete
                Dim deserializeSettings As New JsonSerializerSettings() With {
                    .Converters = New List(Of JsonConverter) From {
                        New Newtonsoft.Json.Converters.StringEnumConverter(),
                        New TaskEngine.ITaskConverter()
                    }
                }
                Dim deserialized = Newtonsoft.Json.JsonConvert.DeserializeObject(Of TaskEngine.Orchestrator.TaskEngine.DialogueContext)(session.DialogueContextJson, deserializeSettings)

                ' ✅ Log: Stato DOPO la deserializzazione
                Console.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: AFTER deserialization")
                System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 GetOrCreateDialogueContext: AFTER deserialization")
                If deserialized IsNot Nothing Then
                    Console.WriteLine($"   Deserialized is NOT NULL")
                    System.Diagnostics.Debug.WriteLine($"   Deserialized is NOT NULL")
                    If deserialized.DialogueState IsNot Nothing Then
                        Console.WriteLine($"   DialogueState is NOT NULL")
                        System.Diagnostics.Debug.WriteLine($"   DialogueState is NOT NULL")
                        Console.WriteLine($"   DialogueState.Mode: {deserialized.DialogueState.Mode}")
                        System.Diagnostics.Debug.WriteLine($"   DialogueState.Mode: {deserialized.DialogueState.Mode}")
                        Console.WriteLine($"   DialogueState.TurnState: {deserialized.DialogueState.TurnState}")
                        System.Diagnostics.Debug.WriteLine($"   DialogueState.TurnState: {deserialized.DialogueState.TurnState}")
                        Console.WriteLine($"   DialogueState.IsCompleted: {deserialized.DialogueState.IsCompleted}")
                        System.Diagnostics.Debug.WriteLine($"   DialogueState.IsCompleted: {deserialized.DialogueState.IsCompleted}")
                    Else
                        Console.WriteLine($"   ⚠️ DialogueState is NULL!")
                        System.Diagnostics.Debug.WriteLine($"   ⚠️ DialogueState is NULL!")
                    End If
                Else
                    Console.WriteLine($"   ⚠️ Deserialized is NULL!")
                    System.Diagnostics.Debug.WriteLine($"   ⚠️ Deserialized is NULL!")
                End If
                Console.Out.Flush()
                System.Diagnostics.Debug.Flush()

                Dim modeAfterDeserialize As String = "null"
                Dim turnStateAfterDeserialize As String = "null"
                Dim hasDialogueStateAfterDeserialize As Boolean = False
                If deserialized IsNot Nothing AndAlso deserialized.DialogueState IsNot Nothing Then
                    hasDialogueStateAfterDeserialize = True
                    modeAfterDeserialize = deserialized.DialogueState.Mode.ToString()
                    turnStateAfterDeserialize = deserialized.DialogueState.TurnState.ToString()
                End If

                _logger.LogInfo("✅ [GetOrCreateDialogueContext] DialogueContext deserialized successfully", New With {
                    .sessionId = session.SessionId,
                    .hasDialogueState = hasDialogueStateAfterDeserialize,
                    .mode = modeAfterDeserialize,
                    .turnState = turnStateAfterDeserialize,
                    .isNothing = deserialized Is Nothing
                })

                ' ✅ Log diretto su Console per visibilità immediata
                Console.WriteLine($"✅ [GetOrCreateDialogueContext] Deserialized Mode={modeAfterDeserialize}, TurnState={turnStateAfterDeserialize}, SessionId={session.SessionId}")
                Console.Out.Flush()

                Return deserialized
            Catch ex As Exception
                _logger.LogError("❌ [GetOrCreateDialogueContext] Failed to deserialize DialogueContext from session", ex, New With {
                    .sessionId = session.SessionId,
                    .jsonLength = jsonLength,
                    .jsonPreview = If(jsonLength > 200, session.DialogueContextJson.Substring(0, 200) & "...", session.DialogueContextJson)
                })
                ' Se la deserializzazione fallisce, ricrea il context
            End Try
        Else
            _logger.LogInfo("⚠️ [GetOrCreateDialogueContext] No DialogueContextJson found in session", New With {
                .sessionId = session.SessionId
            })
            ' ✅ Log diretto su Console per visibilità immediata
            Console.WriteLine($"⚠️ [GetOrCreateDialogueContext] No DialogueContextJson found, SessionId={session.SessionId}")
            Console.Out.Flush()
        End If

        ' ✅ REMOVED: CreateDialogueContextFromRuntimeTask - legacy code
        ' DialogueContext is now created by CompiledTaskAdapter.CreateDialogueContextFromTask()
        ' which is called by FlowOrchestrator when needed
        ' This function should not be used anymore - DialogueContext is managed by TaskEngine
        _logger.LogInfo("⚠️ [GetOrCreateDialogueContext] Returning Nothing (no context found)", New With {
            .sessionId = session.SessionId
        })
        ' ✅ Log diretto su Console per visibilità immediata
        Console.WriteLine($"⚠️ [GetOrCreateDialogueContext] Returning Nothing, SessionId={session.SessionId}")
        Console.Out.Flush()
        Return Nothing
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Salva DialogueContext nella sessione e persiste su Redis
    ''' </summary>
    Public Shared Sub SaveDialogueContext(session As TaskSession, ctx As TaskEngine.Orchestrator.TaskEngine.DialogueContext)
        Console.WriteLine("═══════════════════════════════════════════════════════════")
        Console.WriteLine("🔥 SaveDialogueContext CALLED")
        Console.WriteLine($"   SessionId: {If(session IsNot Nothing, session.SessionId, "NULL")}")
        Console.WriteLine($"   Context: {If(ctx IsNot Nothing, "NOT NULL", "NULL")}")
        Console.Out.Flush()

        If session Is Nothing OrElse ctx Is Nothing Then
            Console.WriteLine("⚠️ SaveDialogueContext: session or ctx is Nothing, RETURNING")
            Console.Out.Flush()
            Return
        End If

        ' ✅ Log: Stato PRIMA del salvataggio
        Dim modeBeforeSave As String = "null"
        Dim turnStateBeforeSave As String = "null"
        Dim hasDialogueState As Boolean = False
        If ctx.DialogueState IsNot Nothing Then
            hasDialogueState = True
            modeBeforeSave = ctx.DialogueState.Mode.ToString()
            turnStateBeforeSave = ctx.DialogueState.TurnState.ToString()
        End If

        ' ✅ Risolve il problema del riferimento circolare (Parent property in UtteranceTaskInstance)
        ' ✅ Usa StringEnumConverter per serializzare gli enum come stringhe invece che numeri
        ' ✅ Usa ITaskConverter per deserializzare ITask (anche se CanWrite=False, è comunque necessario per la deserializzazione)
        Dim settings As New JsonSerializerSettings() With {
            .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
            .NullValueHandling = NullValueHandling.Ignore,
            .Converters = New List(Of JsonConverter) From {
                New Newtonsoft.Json.Converters.StringEnumConverter(),
                New TaskEngine.ITaskConverter()
            }
        }
        session.DialogueContextJson = Newtonsoft.Json.JsonConvert.SerializeObject(ctx, settings)

        ' ✅ Log: Verifica che DialogueContextJson contenga il Mode
        Dim jsonContainsMode As Boolean = session.DialogueContextJson.Contains("""" & modeBeforeSave & """")

        ' ✅ LOG DETTAGLIATO CON ENTRAMBI I METODI
        Console.WriteLine($"🔥🔥🔥 SaveDialogueContext: DialogueContextJson SET - Length={session.DialogueContextJson.Length}")
        System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 SaveDialogueContext: DialogueContextJson SET - Length={session.DialogueContextJson.Length}")
        Console.WriteLine($"   SessionId: {session.SessionId}")
        Console.WriteLine($"   Mode: {modeBeforeSave}")
        Console.WriteLine($"   TurnState: {turnStateBeforeSave}")
        Console.WriteLine($"   JsonPreview: {If(session.DialogueContextJson.Length > 300, session.DialogueContextJson.Substring(0, 300) & "...", session.DialogueContextJson)}")
        Console.WriteLine($"   Contains Mode: {session.DialogueContextJson.Contains("Mode")}")
        Console.WriteLine($"   Contains WaitingForUtterance: {session.DialogueContextJson.Contains("WaitingForUtterance")}")
        Console.WriteLine($"   Contains ExecutingStep: {session.DialogueContextJson.Contains("ExecutingStep")}")

        ' ✅ Cerca il valore di Mode nel JSON
        Console.WriteLine($"🔥🔥🔥 SaveDialogueContext: JSON CONTENT CHECK")
        System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 SaveDialogueContext: JSON CONTENT CHECK")
        Console.WriteLine($"   Mode value in JSON: {If(session.DialogueContextJson.Contains("""" & "WaitingForUtterance" & """"), "FOUND WaitingForUtterance", If(session.DialogueContextJson.Contains("""" & "ExecutingStep" & """"), "FOUND ExecutingStep", "NOT FOUND"))}")
        System.Diagnostics.Debug.WriteLine($"   Mode value in JSON: {If(session.DialogueContextJson.Contains("""" & "WaitingForUtterance" & """"), "FOUND WaitingForUtterance", If(session.DialogueContextJson.Contains("""" & "ExecutingStep" & """"), "FOUND ExecutingStep", "NOT FOUND"))}")

        ' Cerca il valore numerico dell'enum (0=ExecutingStep, 1=WaitingForUtterance, 2=Completed)
        If session.DialogueContextJson.Contains("""" & "Mode" & """:") Then
            Try
                Dim modeIndex = session.DialogueContextJson.IndexOf("""" & "Mode" & """:")
                Dim modeValueStart = modeIndex + 8 ' "Mode":
                Dim modeValueEnd = session.DialogueContextJson.IndexOf(",", modeValueStart)
                If modeValueEnd = -1 Then modeValueEnd = session.DialogueContextJson.IndexOf("}", modeValueStart)
                If modeValueEnd > modeValueStart Then
                    Dim modeValue = session.DialogueContextJson.Substring(modeValueStart, modeValueEnd - modeValueStart).Trim()
                    Console.WriteLine($"   Mode raw value in JSON: {modeValue}")
                    System.Diagnostics.Debug.WriteLine($"   Mode raw value in JSON: {modeValue}")
                End If
            Catch ex As Exception
                Console.WriteLine($"   Error extracting Mode value: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"   Error extracting Mode value: {ex.Message}")
            End Try
        End If

        ' Mostra un estratto del JSON intorno a "Mode"
        Dim modeIndex2 = session.DialogueContextJson.IndexOf("""" & "Mode" & """")
        If modeIndex2 >= 0 Then
            Try
                Dim start = Math.Max(0, modeIndex2 - 50)
                Dim length = Math.Min(200, session.DialogueContextJson.Length - start)
                Dim excerpt = session.DialogueContextJson.Substring(start, length)
                Console.WriteLine($"   JSON excerpt around Mode: {excerpt}")
                System.Diagnostics.Debug.WriteLine($"   JSON excerpt around Mode: {excerpt}")
            Catch ex As Exception
                Console.WriteLine($"   Error extracting excerpt: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"   Error extracting excerpt: {ex.Message}")
            End Try
        End If

        Console.Out.Flush()
        System.Diagnostics.Debug.Flush()

        _logger.LogInfo("💾 [SaveDialogueContext] Saving DialogueContext to Redis", New With {
            .sessionId = session.SessionId,
            .hasDialogueState = hasDialogueState,
            .mode = modeBeforeSave,
            .turnState = turnStateBeforeSave,
            .jsonLength = session.DialogueContextJson.Length,
            .jsonContainsMode = jsonContainsMode,
            .jsonPreview = If(session.DialogueContextJson.Length > 200, session.DialogueContextJson.Substring(0, 200) & "...", session.DialogueContextJson)
        })

        ' ✅ Salva automaticamente su Redis per garantire persistenza dello stato
        Console.WriteLine($"🔥🔥🔥 SaveDialogueContext: Calling SaveTaskSession")
        System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 SaveDialogueContext: Calling SaveTaskSession")
        Console.Out.Flush()
        System.Diagnostics.Debug.Flush()

        SaveTaskSession(session)

        Console.WriteLine($"🔥🔥🔥 SaveDialogueContext: SaveTaskSession COMPLETED")
        System.Diagnostics.Debug.WriteLine($"🔥🔥🔥 SaveDialogueContext: SaveTaskSession COMPLETED")
        Console.Out.Flush()
        System.Diagnostics.Debug.Flush()

        _logger.LogInfo("✅ [SaveDialogueContext] DialogueContext saved to Redis", New With {
            .sessionId = session.SessionId,
            .mode = modeBeforeSave
        })
    End Sub

    ''' <summary>
    ''' ✅ REMOVED: DialogueStepType non esiste più - questa funzione non è più usata
    ''' </summary>
    Private Shared Function GetMessageFromStep(compiledTask As Compiler.CompiledUtteranceTask, stepType As Object, projectId As String, locale As String) As String
        ' ✅ REMOVED: DialogueStepType non esiste più
        ' TODO: Usa il nuovo TaskEngine per estrarre messaggi
        Return Nothing
    End Function
End Class

