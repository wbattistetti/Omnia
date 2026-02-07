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
                    Console.WriteLine($"[API] ERROR: EventEmitter handler error for {eventName}: {ex.Message}")
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
''' Task Session: sessione per Chat Simulator diretto (solo UtteranceInterpretation)
''' Più semplice di OrchestratorSession, usa solo DDTEngine
''' </summary>
Public Class TaskSession
    Public Property SessionId As String
    Public Property RuntimeTask As Compiler.RuntimeTask
    Public Property Language As String
    Public Property Translations As Dictionary(Of String, String)
    Public Property TaskEngine As Motore
    Public Property TaskInstance As TaskEngine.TaskInstance
    Public Property Messages As New List(Of Object)
    Public Property EventEmitter As EventEmitter
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
    ' ✅ STATELESS: Flag per indicare se lo stream SSE è connesso e pronto
    Public Property SseConnected As Boolean = False
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
    ' ✅ FASE 2: Aggiunto supporto per ILogger
    Private Shared _logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
    Private Shared ReadOnly _lock As New Object
    ' ✅ STATELESS: EventEmitter condivisi per sessione (non serializzati, rimangono in memoria)
    Private Shared ReadOnly _eventEmitters As New Dictionary(Of String, EventEmitter)

    ' ✅ STATELESS: Dizionari rimossi - tutto lo stato è in Redis

    ''' <summary>
    ''' ✅ STATELESS: Configura il storage (solo Redis)
    ''' </summary>
    Public Shared Sub ConfigureStorage(storage As ApiServer.Interfaces.ISessionStorage)
        If storage Is Nothing Then
            Throw New ArgumentNullException(NameOf(storage), "Storage cannot be Nothing. Redis is required.")
        End If
        SyncLock _lock
            _storage = storage
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
            session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(compilationResult, taskEngine)

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

            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function()
                                                                     Try
                                                                         Await System.Threading.Tasks.Task.Delay(100)
                                                                         If session.Orchestrator IsNot Nothing Then
                                                                             Await session.Orchestrator.ExecuteDialogueAsync()
                                                                         End If
                                                                     Catch ex As Exception
                                                                         Console.WriteLine($"[API] ERROR: Execution error for session {sessionId}: {ex.GetType().Name} - {ex.Message}")
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
    ''' ✅ STATELESS: Recupera sessione da Redis
    ''' </summary>
    Public Shared Function GetSession(sessionId As String) As OrchestratorSession
        SyncLock _lock
            Return _storage.GetOrchestratorSession(sessionId)
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
    ''' Crea una nuova TaskSession per Chat Simulator diretto
    ''' </summary>
    Public Shared Function CreateTaskSession(
        sessionId As String,
        runtimeTask As Compiler.RuntimeTask,
        language As String,
        translations As Dictionary(Of String, String)
    ) As TaskSession
        ' ❌ ERRORE BLOCCANTE: lingua OBBLIGATORIA
        If String.IsNullOrWhiteSpace(language) Then
            Throw New ArgumentException("Language cannot be null, empty, or whitespace. Language is mandatory.", NameOf(language))
        End If

        ' ❌ ERRORE BLOCCANTE: traduzioni OBBLIGATORIE
        If translations Is Nothing OrElse translations.Count = 0 Then
            Throw New ArgumentException("Translations dictionary cannot be Nothing or empty. Translations are mandatory.", NameOf(translations))
        End If

        ' ✅ NOTA: La validazione traduzioni contro il grafo deve essere fatta PRIMA di chiamare questa funzione
        ' Qui assumiamo che le traduzioni siano già state validate

        SyncLock _lock
            ' ✅ FASE 2: Usa ILogger invece di Console.WriteLine
            _logger.LogInfo("Creating task session", New With {
                .sessionId = sessionId,
                .language = language
            })
            Dim taskEngine As New Motore()
            ' ✅ STATELESS: Usa EventEmitter condiviso (non serializzato, rimane in memoria)
            Dim sharedEmitter = GetOrCreateEventEmitter(sessionId)
            Dim session As New TaskSession() With {
                .SessionId = sessionId,
                .RuntimeTask = runtimeTask,
                .Language = language.Trim(),
                .Translations = translations,
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
                                                     Console.WriteLine($"[SessionManager] ✅ STATELESS: Message added to session.Messages, count: {session.Messages.Count}")
                                                     ' ✅ STATELESS: Usa EventEmitter condiviso
                                                     Dim emitter = GetOrCreateEventEmitter(sessionId)
                                                     Console.WriteLine($"[SessionManager] ✅ STATELESS: Emitting message event on shared EventEmitter, listener count: {emitter.ListenerCount("message")}")
                                                     emitter.Emit("message", msg)
                                                     Console.WriteLine($"[SessionManager] ✅ STATELESS: Message event emitted on shared EventEmitter for session: {sessionId}")

                                                     session.IsWaitingForInput = True
                                                     Dim firstNodeId As String = ""
                                                     If session.RuntimeTask IsNot Nothing Then
                                                         If session.RuntimeTask.SubTasks IsNot Nothing AndAlso session.RuntimeTask.SubTasks.Count > 0 Then
                                                             firstNodeId = session.RuntimeTask.SubTasks(0).Id
                                                         Else
                                                             firstNodeId = session.RuntimeTask.Id
                                                         End If
                                                     End If
                                                     session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                     Console.WriteLine($"[SessionManager] ✅ STATELESS: Emitting waitingForInput event on shared EventEmitter for session: {sessionId}")
                                                     emitter.Emit("waitingForInput", session.WaitingForInputData)

                                                     ' ✅ STATELESS: Salva su Redis dopo ogni messaggio
                                                     Try
                                                         _storage.SaveTaskSession(session)
                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Session saved to Redis after message for session: {sessionId}")
                                                     Catch saveEx As Exception
                                                         Console.WriteLine($"[SessionManager] ❌ STATELESS: Failed to save session to Redis: {saveEx.Message}")
                                                     End Try
                                                 End Sub

            ' ✅ STATELESS: Salva solo su Redis (SseConnected=False inizialmente)
            _storage.SaveTaskSession(session)
            Console.WriteLine($"[SessionManager] ✅ STATELESS: Session saved to Redis: {sessionId}, SseConnected=False (will wait for SSE connection)")

            ' ✅ STATELESS: NON avviare il task qui - aspetta che SSE si connetta
            ' Il task verrà avviato quando l'handler SSE imposterà SseConnected=True
            Console.WriteLine($"[SessionManager] ✅ STATELESS: Task execution will start when SSE connects (SseConnected flag)")

            ' ✅ STATELESS: Avvia un task in background che aspetta che SSE si connetta
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                     Try
                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Waiting for SSE connection for session: {sessionId}")
                                                                         ' ✅ STATELESS: Polling fino a quando SSE non si connette (max 10 secondi)
                                                                         Dim maxWaitTime = TimeSpan.FromSeconds(10)
                                                                         Dim pollInterval = TimeSpan.FromMilliseconds(100)
                                                                         Dim startTime = DateTime.UtcNow

                                                                         While DateTime.UtcNow - startTime < maxWaitTime
                                                                             ' Ricarica la sessione da Redis per verificare il flag
                                                                             Dim currentSession = _storage.GetTaskSession(sessionId)
                                                                             If currentSession IsNot Nothing AndAlso currentSession.SseConnected Then
                                                                                 Console.WriteLine($"[SessionManager] ✅ STATELESS: SSE connected! Starting task execution for session: {sessionId}")
                                                                                 Exit While
                                                                             End If
                                                                             Await System.Threading.Tasks.Task.Delay(pollInterval)
                                                                         End While

                                                                         ' Verifica ancora una volta prima di procedere
                                                                         Dim sessionToUse = _storage.GetTaskSession(sessionId)
                                                                         If sessionToUse Is Nothing Then
                                                                             Console.WriteLine($"[SessionManager] ❌ STATELESS: Session not found, aborting task execution: {sessionId}")
                                                                             Return
                                                                         End If

                                                                         If Not sessionToUse.SseConnected Then
                                                                             Console.WriteLine($"[SessionManager] ⚠️ STATELESS: SSE not connected after {maxWaitTime.TotalSeconds}s, starting task anyway: {sessionId}")
                                                                         End If

                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Proceeding with task execution for session: {sessionId}")

                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Converting RuntimeTask to TaskInstance for session: {sessionId}")
                                                                         Dim taskInstance = ConvertRuntimeTaskToTaskInstance(sessionToUse.RuntimeTask, sessionToUse.Translations)
                                                                         _logger.LogDebug("Converted to TaskInstance", New With {
                                                                             .sessionId = sessionId,
                                                                             .taskListCount = taskInstance.TaskList.Count
                                                                         })
                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: TaskInstance created: {taskInstance.TaskList.Count} tasks for session: {sessionId}")
                                                                         sessionToUse.TaskInstance = taskInstance
                                                                         _storage.SaveTaskSession(sessionToUse) ' ✅ STATELESS: Salva TaskInstance su Redis
                                                                         _logger.LogDebug("TaskInstance saved to session", New With {.sessionId = sessionId})
                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Executing task for session: {sessionId}")
                                                                         sessionToUse.TaskEngine.ExecuteTask(taskInstance)
                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Task execution completed for session: {sessionId}")

                                                                         ' ✅ STATELESS: Usa EventEmitter condiviso per emettere eventi
                                                                         Dim emitterForComplete = GetOrCreateEventEmitter(sessionId)
                                                                         ' ✅ Check if all tasks are completed
                                                                         Dim allCompleted = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
                                                                         _logger.LogDebug("Tasks completion check", New With {
                                                                             .sessionId = sessionId,
                                                                             .allCompleted = allCompleted
                                                                         })
                                                                         If allCompleted Then
                                                                             Dim completeData = New With {
                                                                                 .success = True,
                                                                                 .timestamp = DateTime.UtcNow.ToString("O")
                                                                             }
                                                                             emitterForComplete.Emit("complete", completeData)
                                                                             Console.WriteLine($"[SessionManager] ✅ STATELESS: Complete event emitted on shared EventEmitter for session: {sessionId}")
                                                                         End If
                                                                     Catch ex As Exception
                                                                         _logger.LogError("Runtime execution error", ex, New With {.sessionId = sessionId})
                                                                         Dim emitterForError = GetOrCreateEventEmitter(sessionId)
                                                                         Dim errorData = New With {
                                                                             .error = ex.Message,
                                                                             .timestamp = DateTime.UtcNow.ToString("O")
                                                                         }
                                                                         emitterForError.Emit("error", errorData)
                                                                         Console.WriteLine($"[SessionManager] ✅ STATELESS: Error event emitted on shared EventEmitter for session: {sessionId}")
                                                                     End Try
                                                                 End Function)

            Return session
        End SyncLock
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Collega gli event handler del Motore all'EventEmitter (per sessioni recuperate da Redis)
    ''' </summary>
    Private Shared Sub AttachTaskEngineHandlers(session As TaskSession)
        ' Rimuovi eventuali handler esistenti
        RemoveHandler session.TaskEngine.MessageToShow, Nothing

        ' ✅ STATELESS: Usa EventEmitter condiviso, non session.EventEmitter
        Dim sharedEmitter = GetOrCreateEventEmitter(session.SessionId)
        Console.WriteLine($"[SessionManager] ✅ STATELESS: Attaching TaskEngine handlers to shared EventEmitter for session: {session.SessionId}")

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
                                                        Console.WriteLine($"[SessionManager] ✅ STATELESS: Message event emitted on shared EventEmitter for session: {session.SessionId}")

                                                        session.IsWaitingForInput = True
                                                        Dim firstNodeId As String = ""
                                                        If session.RuntimeTask IsNot Nothing Then
                                                            If session.RuntimeTask.SubTasks IsNot Nothing AndAlso session.RuntimeTask.SubTasks.Count > 0 Then
                                                                firstNodeId = session.RuntimeTask.SubTasks(0).Id
                                                            Else
                                                                firstNodeId = session.RuntimeTask.Id
                                                            End If
                                                        End If
                                                        session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                        ' ✅ STATELESS: Usa EventEmitter condiviso
                                                        sharedEmitter.Emit("waitingForInput", session.WaitingForInputData)
                                                        Console.WriteLine($"[SessionManager] ✅ STATELESS: Emitted waitingForInput event on shared EventEmitter for session: {session.SessionId}")

                                                        ' ✅ STATELESS: Salva su Redis dopo ogni messaggio
                                                        Try
                                                            _storage.SaveTaskSession(session)
                                                            Console.WriteLine($"[SessionManager] ✅ STATELESS: Session saved to Redis after message for session: {session.SessionId}")
                                                        Catch saveEx As Exception
                                                            Console.WriteLine($"[SessionManager] ❌ STATELESS: Failed to save session to Redis: {saveEx.Message}")
                                                        End Try
                                                    End Sub
        Console.WriteLine($"[SessionManager] ✅ STATELESS: TaskEngine handlers attached successfully for session: {session.SessionId}")
    End Sub

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

            ' Se non c'è RuntimeTask, non possiamo eseguire
            If session.RuntimeTask Is Nothing Then
                Console.WriteLine($"[SessionManager] ⚠️ Cannot start execution: RuntimeTask is Nothing for session {sessionId}")
                Return
            End If

            ' ✅ STATELESS: Collega gli handler PRIMA di eseguire il task
            AttachTaskEngineHandlers(session)

            ' Avvia l'esecuzione del task
            Console.WriteLine($"[SessionManager] ✅ STATELESS: Starting task execution for session {sessionId} (recovered from Redis)")
            Try
                Dim taskInstance = ConvertRuntimeTaskToTaskInstance(session.RuntimeTask, session.Translations)
                session.TaskInstance = taskInstance
                _storage.SaveTaskSession(session) ' Salva su Redis

                ' Esegui il task in background
                Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                         Try
                                                                             Await System.Threading.Tasks.Task.Delay(100)
                                                                             session.TaskEngine.ExecuteTask(taskInstance)

                                                                             ' Check if all tasks are completed
                                                                             Dim allCompleted = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
                                                                             If allCompleted Then
                                                                                 Dim completeData = New With {
                                                                                     .success = True,
                                                                                     .timestamp = DateTime.UtcNow.ToString("O")
                                                                                 }
                                                                                 session.EventEmitter.Emit("complete", completeData)
                                                                             End If
                                                                         Catch ex As Exception
                                                                             _logger.LogError("Runtime execution error (recovered session)", ex, New With {.sessionId = sessionId})
                                                                             Dim errorData = New With {
                                                                                 .error = ex.Message,
                                                                                 .timestamp = DateTime.UtcNow.ToString("O")
                                                                             }
                                                                             session.EventEmitter.Emit("error", errorData)
                                                                         End Try
                                                                     End Function)
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
                Console.WriteLine($"[SessionManager] ✅ STATELESS: Created shared EventEmitter for session: {sessionId}")
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
                Console.WriteLine($"[SessionManager] ✅ STATELESS: Removed shared EventEmitter for session: {sessionId}")
            End If
        End SyncLock
    End Sub

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
    ''' ✅ Helper: Converte RuntimeTask in TaskInstance per compatibilità con ExecuteTask
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskInstance(runtimeTask As Compiler.RuntimeTask, translations As Dictionary(Of String, String)) As TaskEngine.TaskInstance
        ' ❌ ERRORE BLOCCANTE: traduzioni OBBLIGATORIE
        If translations Is Nothing OrElse translations.Count = 0 Then
            Throw New ArgumentException("Translations dictionary cannot be Nothing or empty. TaskInstance requires translations for runtime execution.", NameOf(translations))
        End If

        ' ✅ FASE 2: Usa ILogger invece di Console.WriteLine (se disponibile, altrimenti fallback)
        If _logger IsNot Nothing Then
            _logger.LogDebug("Converting RuntimeTask to TaskInstance", New With {
                .runtimeTaskId = runtimeTask.Id,
                .hasSubTasks = runtimeTask.HasSubTasks()
            })
        Else
            Console.WriteLine($"[SESSION] ConvertRuntimeTaskToTaskInstance: runtimeTaskId={runtimeTask.Id}, HasSubTasks={runtimeTask.HasSubTasks()}")
        End If

        Dim taskInstance As New TaskEngine.TaskInstance() With {
            .Id = runtimeTask.Id,
            .Label = "",
            .Translations = translations, ' ✅ Sempre presente
            .IsAggregate = False,
            .Introduction = Nothing,
            .SuccessResponse = Nothing,
            .TaskList = New List(Of TaskEngine.TaskNode)()
        }

        Dim rootNode = ConvertRuntimeTaskToTaskNode(runtimeTask)
        taskInstance.TaskList.Add(rootNode)
        ' ✅ FASE 2: Usa ILogger invece di Console.WriteLine
        If _logger IsNot Nothing Then
            _logger.LogDebug("TaskInstance conversion completed", New With {
                .rootNodeId = rootNode.Id,
                .stepsCount = rootNode.Steps.Count,
                .subTasksCount = rootNode.SubTasks.Count
            })
        Else
            Console.WriteLine($"[SESSION] ConvertRuntimeTaskToTaskInstance: rootNodeId={rootNode.Id}, Steps.Count={rootNode.Steps.Count}, SubTasks.Count={rootNode.SubTasks.Count}")
        End If

        Return taskInstance
    End Function

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in TaskNode (ricorsivo)
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskNode(runtimeTask As Compiler.RuntimeTask) As TaskEngine.TaskNode
        Dim taskNode As New TaskEngine.TaskNode() With {
            .Id = runtimeTask.Id,
            .Steps = If(runtimeTask.Steps, New List(Of TaskEngine.DialogueStep)()),
            .ValidationConditions = If(runtimeTask.Constraints, New List(Of TaskEngine.ValidationCondition)()),
            .NlpContract = runtimeTask.NlpContract,
            .State = TaskEngine.DialogueState.Start,
            .Value = Nothing,
            .SubTasks = New List(Of TaskEngine.TaskNode)()
        }

        If runtimeTask.HasSubTasks() Then
            For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                Dim subNode = ConvertRuntimeTaskToTaskNode(subTask)
                subNode.ParentData = taskNode
                taskNode.SubTasks.Add(subNode)
            Next
        End If

        Return taskNode
    End Function
End Class

