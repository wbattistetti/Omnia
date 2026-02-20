Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports ApiServer.Interfaces
Imports ApiServer.SessionStorage

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
    Public Property TaskEngine As Motore
    Public Property Messages As New List(Of Object)
    Public Property EventEmitter As EventEmitter
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
End Class

''' <summary>
''' EventEmitter: gestisce eventi per SSE
''' </summary>
Public Class EventEmitter
    Private ReadOnly _listeners As New Dictionary(Of String, List(Of Action(Of Object)))

    Public Sub [On](eventName As String, handler As Action(Of Object))
        If Not _listeners.ContainsKey(eventName) Then
            _listeners(eventName) = New List(Of Action(Of Object))
        End If
        _listeners(eventName).Add(handler)
    End Sub

    Public Sub Emit(eventName As String, data As Object)
        If _listeners.ContainsKey(eventName) Then
            For Each handler In _listeners(eventName)
                Try
                    handler(data)
                Catch ex As Exception
                    ' Log removed
                End Try
            Next
        End If
    End Sub

    Public Sub RemoveListener(eventName As String, handler As Action(Of Object))
        If _listeners.ContainsKey(eventName) Then
            _listeners(eventName).Remove(handler)
        End If
    End Sub

    Public Function ListenerCount(eventName As String) As Integer
        If _listeners.ContainsKey(eventName) Then
            Return _listeners(eventName).Count
        End If
        Return 0
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
    Public Property TaskEngine As Motore
    Public Property TaskInstance As TaskEngine.TaskUtterance
    Public Property EventEmitter As EventEmitter

    ' ✅ STATELESS: Stato comunicazione
    Public Property Messages As New List(Of Object)
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
    Public Property SseConnected As Boolean = False

    ' ✅ STATELESS: Snapshot dello stato del TaskUtterance (serializzato su Redis).
    ' La configurazione (Steps, NlpContract) viene sempre ricostruita dal dialogo compilato.
    Public Property TaskUtteranceState As TaskEngine.TaskUtteranceStateSnapshot

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
            Dim taskEngine As New Motore()
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }
            ' ✅ STATELESS: Crea FlowOrchestrator con ExecutionStateStorage se disponibile
            session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(compilationResult, taskEngine, sessionId, _executionStateStorage)

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
                ' ✅ STATELESS: Ricrea FlowOrchestrator con ExecutionStateStorage se non presente
                Dim taskEngine = If(session.TaskEngine, New Motore())
                session.TaskEngine = taskEngine
                session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(session.CompilationResult, taskEngine, sessionId, _executionStateStorage)

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
            Dim taskEngine As New Motore()
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
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }

            AddHandler taskEngine.MessageToShow, Sub(sender, e)
                                                     ' ✅ FASE 2: Usa ILogger invece di Console.WriteLine
                                                     _logger.LogDebug("MessageToShow event raised", New With {
                                                         .sessionId = sessionId,
                                                         .message = e.Message
                                                     })
                                                     Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                     Dim msg = New With {
                           .id = msgId,
                           .text = e.Message,
                           .stepType = "ask",
                           .timestamp = DateTime.UtcNow.ToString("O")
                       }
                                                     session.Messages.Add(msg)
                                                     Dim emitter = GetOrCreateEventEmitter(sessionId)
                                                     emitter.Emit("message", msg)

                                                     session.IsWaitingForInput = True
                                                     ' ✅ STATELESS: CurrentNodeId è già impostato quando il dialogo viene caricato
                                                     Dim firstNodeId As String = If(String.IsNullOrEmpty(session.CurrentNodeId), "", session.CurrentNodeId)
                                                     session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                     emitter.Emit("waitingForInput", session.WaitingForInputData)

                                                     Try
                                                         _storage.SaveTaskSession(session)
                                                     Catch saveEx As Exception
                                                         ' Log removed
                                                     End Try
                                                 End Sub

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
    ''' ✅ STATELESS: Collega gli event handler del Motore all'EventEmitter (per sessioni recuperate da Redis)
    ''' </summary>
    Public Shared Sub AttachTaskEngineHandlers(session As TaskSession)
        ' Rimuovi eventuali handler esistenti
        RemoveHandler session.TaskEngine.MessageToShow, Nothing

        ' ✅ STATELESS: Usa EventEmitter condiviso, non session.EventEmitter
        Dim sharedEmitter = GetOrCreateEventEmitter(session.SessionId)
        ' Log rimosso: non essenziale per flusso motore

        ' Collega l'handler MessageToShow del Motore all'EventEmitter condiviso
        AddHandler session.TaskEngine.MessageToShow, Sub(sender, e)
                                                        _logger.LogDebug("MessageToShow event raised (recovered session)", New With {
                                                            .sessionId = session.SessionId,
                                                            .message = e.Message
                                                        })
                                                        Dim msgId = $"{session.SessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                        Dim msg = New With {
                                .id = msgId,
                                .text = e.Message,
                                .stepType = "ask",
                                .timestamp = DateTime.UtcNow.ToString("O")
                            }
                                                        session.Messages.Add(msg)
                                                        ' ✅ STATELESS: Usa EventEmitter condiviso
                                                        sharedEmitter.Emit("message", msg)

                                                        ' ✅ STATELESS: Imposta waitingForInput solo se non tutti i task sono completati
                                                        Dim allCompleted = session.TaskInstance IsNot Nothing AndAlso session.TaskInstance.SubTasks.All(Function(t) t.IsComplete())
                                                        If Not allCompleted Then
                                                            session.IsWaitingForInput = True
                                                            ' ✅ STATELESS: Usa CurrentNodeId dalla sessione (già impostato quando il dialogo viene caricato)
                                                            Dim firstNodeId As String = If(String.IsNullOrEmpty(session.CurrentNodeId), "", session.CurrentNodeId)
                                                            session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                            ' ✅ STATELESS: Usa EventEmitter condiviso
                                                            sharedEmitter.Emit("waitingForInput", session.WaitingForInputData)
                                                        Else
                                                            ' Tutti i task sono completati, non impostare waitingForInput
                                                            session.IsWaitingForInput = False
                                                            session.WaitingForInputData = Nothing
                                                        End If

                                                        ' ✅ STATELESS: Salva su Redis dopo ogni messaggio
                                                        Try
                                                            _storage.SaveTaskSession(session)
                                                            ' Log rimosso: salvataggio non essenziale per flusso motore
                                                        Catch saveEx As Exception
                                                            ' Log removed
                                                        End Try
                                                    End Sub
        ' Log rimosso: non essenziale per flusso motore
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Carica il dialogo dal DialogRepository quando necessario
    ''' </summary>
    Private Shared Function LoadDialogForSession(session As TaskSession) As Compiler.RuntimeTask
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
            Dim runtimeTask = _dialogRepository.GetDialog(session.ProjectId, session.DialogVersion)
            Return runtimeTask
        Catch ex As Exception
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Ensures TaskInstance is loaded on the session, rebuilding it from the
    ''' DialogRepository if it is Nothing (e.g. after a Redis round-trip that strips runtime objects).
    ''' Does NOT run ExecuteTurn — use this before processing user input.
    ''' Returns True if TaskInstance is ready; False if the dialog cannot be loaded.
    ''' </summary>
    Public Shared Function EnsureTaskInstanceLoaded(session As TaskSession) As Boolean
        If session Is Nothing Then Return False
        If session.TaskInstance IsNot Nothing Then Return True

        Dim runtimeTask = LoadDialogForSession(session)
        If runtimeTask Is Nothing Then Return False

        Try
            Dim taskInstance = ConvertRuntimeTaskToTaskInstance(runtimeTask, session.ProjectId, session.Locale)

            ' Re-apply the persisted state snapshot so that EscalationCounters, State
            ' and Value are restored exactly as they were before the Redis round-trip.
            If session.TaskUtteranceState IsNot Nothing Then
                taskInstance.ApplyState(session.TaskUtteranceState)
                ' Also try to apply to each sub-task that maps to the root snapshot.
                For Each child As TaskEngine.TaskUtterance In taskInstance.SubTasks
                    Dim childSnap = session.TaskUtteranceState.SubStates?.FirstOrDefault(Function(s) s.Id = child.Id)
                    If childSnap IsNot Nothing Then child.ApplyState(childSnap)
                Next
            End If

            session.TaskInstance = taskInstance
            Return True
        Catch ex As Exception
            If _logger IsNot Nothing Then
                _logger.LogError("EnsureTaskInstanceLoaded failed to rebuild TaskInstance", ex, New With {.sessionId = session.SessionId})
            End If
            Return False
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

            ' Se il task è già stato eseguito o è in esecuzione, assicurati solo che gli handler siano collegati
            If session.TaskInstance IsNot Nothing Then
                ' ✅ STATELESS: Collega gli handler anche se il task è già stato eseguito
                AttachTaskEngineHandlers(session)
                Return
            End If

            ' ✅ STATELESS: Carica dialogo dal repository se necessario
            Dim runtimeTask = LoadDialogForSession(session)
            If runtimeTask Is Nothing Then
                Return
            End If

            ' ✅ STATELESS: Collega gli handler PRIMA di eseguire il task
            AttachTaskEngineHandlers(session)

            ' Avvia l'esecuzione del task
            Try
                Dim taskInstance = ConvertRuntimeTaskToTaskInstance(runtimeTask, session.ProjectId, session.Locale)
                session.TaskInstance = taskInstance
                AttachTaskEngineHandlers(session)
                _storage.SaveTaskSession(session)

                ' Esegui il primo turno — invia il messaggio di apertura all'utente.
                session.TaskEngine.ExecuteTurn(taskInstance)

                ' Controlla se tutti i sub-task sono già completati (es. dialogo vuoto).
                Dim sharedEmitterRecovered = GetOrCreateEventEmitter(sessionId)
                Dim allCompleted = taskInstance.SubTasks IsNot Nothing AndAlso taskInstance.SubTasks.All(Function(t) t.IsComplete())
                If allCompleted Then
                    sharedEmitterRecovered.Emit("complete", New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    })
                End If
            Catch ex As Exception
                _logger.LogError("Failed to start task execution for recovered session", ex, New With {.sessionId = sessionId})
            End Try
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

            ' Se il task è già stato eseguito, non fare nulla
            If session.TaskInstance IsNot Nothing Then
                Return
            End If

            ' ✅ STATELESS: Carica dialogo dal repository se necessario
            Dim runtimeTask = LoadDialogForSession(session)
            If runtimeTask Is Nothing Then
                Return
            End If

            ' ✅ STATELESS: Collega gli handler PRIMA di eseguire il task
            AttachTaskEngineHandlers(session)

            Try
                ' ✅ STATELESS: Carica dialogo dal repository se necessario
                Dim loadedRuntimeTask = LoadDialogForSession(session)
                If loadedRuntimeTask Is Nothing Then
                    Return
                End If
                Dim taskInstance = ConvertRuntimeTaskToTaskInstance(loadedRuntimeTask, session.ProjectId, session.Locale)
                session.TaskInstance = taskInstance
                AttachTaskEngineHandlers(session)
                _storage.SaveTaskSession(session)

                ' Esegui il primo turno — invia il messaggio di apertura all'utente.
                session.TaskEngine.ExecuteTurn(taskInstance)

                ' Controlla se tutti i sub-task sono già completati (es. dialogo vuoto).
                Dim sharedEmitter = GetOrCreateEventEmitter(sessionId)
                Dim allCompleted = taskInstance.SubTasks IsNot Nothing AndAlso taskInstance.SubTasks.All(Function(t) t.IsComplete())
                If allCompleted Then
                    sharedEmitter.Emit("complete", New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    })
                End If
            Catch ex As Exception
                _logger.LogError("Runtime execution error", ex, New With {.sessionId = sessionId})
                Dim sharedEmitter = GetOrCreateEventEmitter(sessionId)
                Dim errorData = New With {
                    .error = ex.Message,
                    .timestamp = DateTime.UtcNow.ToString("O")
                }
                sharedEmitter.Emit("error", errorData)
            End Try
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
    ''' <param name="runtimeTask">RuntimeTask compilato</param>
    ''' <returns>Lista di textKey (GUID) usate nel dialogo</returns>
    Public Shared Function ExtractTextKeysFromRuntimeTask(runtimeTask As Compiler.RuntimeTask) As List(Of String)
        If runtimeTask Is Nothing Then
            Return New List(Of String)()
        End If

        Dim keys = CollectTranslationKeys(runtimeTask)
        Return keys.ToList()
    End Function

    ''' <summary>
    ''' Raccoglie tutte le chiavi di traduzione usate nel grafo
    ''' </summary>
    Private Shared Function CollectTranslationKeys(runtimeTask As Compiler.RuntimeTask) As HashSet(Of String)
        Dim keys As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        CollectTranslationKeysRecursive(runtimeTask, keys)
        Return keys
    End Function

    ''' <summary>
    ''' Raccoglie ricorsivamente tutte le chiavi di traduzione
    ''' </summary>
    Private Shared Sub CollectTranslationKeysRecursive(runtimeTask As Compiler.RuntimeTask, keys As HashSet(Of String))
        ' ✅ Itera tutti gli step e escalation per trovare MessageTask
        If runtimeTask.Steps IsNot Nothing Then
            For Each dstep As TaskEngine.DialogueStep In runtimeTask.Steps
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
        If runtimeTask.SubTasks IsNot Nothing Then
            For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                CollectTranslationKeysRecursive(subTask, keys)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida che tutte le chiavi usate nel grafo siano presenti nel dizionario traduzioni
    ''' </summary>
    Public Shared Function ValidateTranslations(
        runtimeTask As Compiler.RuntimeTask,
        translations As Dictionary(Of String, String)
    ) As TranslationValidationResult
        If runtimeTask Is Nothing Then
            Return New TranslationValidationResult(False, Nothing, "RuntimeTask cannot be Nothing")
        End If

        If translations Is Nothing OrElse translations.Count = 0 Then
            Return New TranslationValidationResult(False, Nothing, "Translations dictionary cannot be Nothing or empty")
        End If

        ' ✅ Raccogli tutte le chiavi usate nel grafo
        Dim usedKeys = CollectTranslationKeys(runtimeTask)

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
    ''' Converts a compiled RuntimeTask into a TaskUtterance tree ready for engine execution.
    ''' ProjectId, Locale and TranslationResolver are propagated to EVERY node in the tree
    ''' so that MessageTask.Execute can resolve translations at any level.
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskInstance(runtimeTask As Compiler.RuntimeTask, projectId As String, locale As String) As TaskEngine.TaskUtterance
        If runtimeTask Is Nothing Then
            Throw New ArgumentNullException(NameOf(runtimeTask), "RuntimeTask cannot be Nothing.")
        End If
        If String.IsNullOrWhiteSpace(projectId) Then
            Throw New ArgumentException("ProjectId is required for translation lookup.", NameOf(projectId))
        End If
        If String.IsNullOrWhiteSpace(locale) Then
            Throw New ArgumentException("Locale is required for translation lookup.", NameOf(locale))
        End If

        Dim translationResolver As TaskEngine.Interfaces.ITranslationResolver = Nothing
        If _translationRepository IsNot Nothing Then
            translationResolver = New ApiServer.Repositories.TranslationResolverAdapter(_translationRepository)
        End If

        ' Build root TaskUtterance that wraps the compiled task tree.
        Dim root As New TaskEngine.TaskUtterance() With {
            .Id = runtimeTask.Id,
            .Label = "",
            .ProjectId = projectId,
            .Locale = locale,
            .TranslationResolver = translationResolver,
            .IsAggregate = False,
            .Introduction = Nothing,
            .SuccessResponse = Nothing
        }

        ' Compile the RuntimeTask tree recursively — pass projectId/locale/resolver to every node.
        Dim mainNode = ConvertRuntimeTaskNode(runtimeTask, Nothing, projectId, locale, translationResolver)
        root.SubTasks.Add(mainNode)

        If _logger IsNot Nothing Then
            _logger.LogDebug("RuntimeTask converted to TaskUtterance", New With {
                .rootId = root.Id,
                .subTasksCount = root.SubTasks.Count
            })
        End If

        Return root
    End Function

    ''' <summary>
    ''' Recursively converts a RuntimeTask node into a TaskUtterance.
    ''' ProjectId, Locale and TranslationResolver are set on every node so that
    ''' MessageTask.Execute can resolve translations regardless of tree depth.
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskNode(
            runtimeTask As Compiler.RuntimeTask,
            parent As TaskEngine.TaskUtterance,
            projectId As String,
            locale As String,
            translationResolver As TaskEngine.Interfaces.ITranslationResolver) As TaskEngine.TaskUtterance

        Dim node As New TaskEngine.TaskUtterance() With {
            .Id = runtimeTask.Id,
            .ProjectId = projectId,
            .Locale = locale,
            .TranslationResolver = translationResolver,
            .Steps = If(runtimeTask.Steps, New List(Of TaskEngine.DialogueStep)()),
            .ValidationConditions = If(runtimeTask.Constraints, New List(Of TaskEngine.ValidationCondition)()),
            .NlpContract = runtimeTask.NlpContract,
            .State = TaskEngine.DialogueState.Start,
            .Value = Nothing,
            .ParentData = parent
        }

        If runtimeTask.HasSubTasks() Then
            For Each child As Compiler.RuntimeTask In runtimeTask.SubTasks
                Dim childNode = ConvertRuntimeTaskNode(child, node, projectId, locale, translationResolver)
                node.SubTasks.Add(childNode)
            Next
        End If

        Return node
    End Function
End Class

