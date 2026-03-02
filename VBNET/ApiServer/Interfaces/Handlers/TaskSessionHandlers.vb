Option Strict On
Option Explicit On
Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports ApiServer.Helpers
Imports ApiServer.Interfaces
Imports ApiServer.Logging
Imports ApiServer.Models
Imports ApiServer.Validators
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine
Imports TaskEngine.Orchestrator
Imports Engine

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles task session-related API endpoints (Chat Simulator)
    ''' </summary>
    Public Module TaskSessionHandlers
        ' ✅ FASE 2: Logger statico (default: StdoutLogger per backward compatibility)
        Private _logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()

        ' ✅ Streaming: Manager SSE (singleton)
        Private ReadOnly _sseStreamManager As ApiServer.Streaming.ISseStreamManager = New ApiServer.Streaming.SseStreamManager()

        ''' <summary>
        ''' ✅ FASE 2: Configura il logger da usare
        ''' </summary>
        Public Sub ConfigureLogger(logger As ApiServer.Interfaces.ILogger)
            _logger = logger
        End Sub

        ''' <summary>
        ''' ✅ FASE 2: Helper per logging (usa logger se disponibile, altrimenti Console.WriteLine)
        ''' </summary>
        Private Sub LogDebug(message As String, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then
                _logger.LogDebug(message, data)
            End If
        End Sub

        Private Sub LogInfo(message As String, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then
                _logger.LogInfo(message, data)
            End If
        End Sub

        Private Sub LogError(message As String, ex As Exception, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then
                _logger.LogError(message, ex, data)
            End If
        End Sub
        ''' <summary>
        ''' Reads and parses the request body for task session start
        ''' </summary>
        Private Async Function ReadAndParseRequest(context As HttpContext) As Task(Of (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String))
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()

                If String.IsNullOrEmpty(body) Then
                    Return (False, Nothing, "Request body is empty. Expected JSON with taskId and projectId fields.")
                End If

                Dim request As TaskSessionStartRequest = Nothing
                Try
                    request = JsonConvert.DeserializeObject(Of TaskSessionStartRequest)(body, New JsonSerializerSettings() With {
                        .NullValueHandling = NullValueHandling.Ignore,
                        .MissingMemberHandling = MissingMemberHandling.Ignore
                    })
                Catch ex As Exception
                    Return (False, Nothing, $"Failed to deserialize JSON. Error: {ex.Message}")
                End Try

                Return (True, request, Nothing)
            Catch ex As Exception
                Return (False, Nothing, $"Failed to parse request body as JSON. Error: {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' ✅ STATELESS: Crea una nuova task session con solo stato runtime
        ''' Il dialogo e le traduzioni sono nei repository, non nella sessione
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="dialogVersion">Versione del dialogo</param>
        ''' <param name="locale">Locale (es. "it-IT")</param>
        ''' <returns>Session ID della sessione creata</returns>
        Private Function CreateTaskSession(projectId As String, dialogVersion As String, locale As String) As String
            Dim sessionId = Guid.NewGuid().ToString()
            SessionManager.CreateTaskSession(sessionId, projectId, dialogVersion, locale)
            Return sessionId
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
        ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
        ''' </summary>
        Public Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
            Try
                ' ✅ Log rimosso: troppo verboso

                Dim parseResult As (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String) = Nothing

                Try
                    parseResult = Await ReadAndParseRequest(context)
                Catch ex As Exception
                    Return ResponseHelpers.CreateErrorResponse($"Exception in ReadAndParseRequest: {ex.Message}", 500)
                End Try

                If Not parseResult.Success Then
                    Return ResponseHelpers.CreateErrorResponse(parseResult.ErrorMessage, 400)
                End If

                Dim request = parseResult.Request

                If request Is Nothing Then
                    Return ResponseHelpers.CreateErrorResponse("Request is Nothing after parsing", 500)
                End If

                Dim projectId As String = Nothing
                Dim dialogVersion As String = Nothing
                Dim locale As String = Nothing

                Try
                    projectId = request.ProjectId
                    dialogVersion = request.DialogVersion
                    locale = request.Locale
                Catch ex As Exception
                    Return ResponseHelpers.CreateErrorResponse($"Exception accessing request properties: {ex.Message}", 500)
                End Try

                ' ✅ STATELESS: Valida parametri obbligatori
                If String.IsNullOrWhiteSpace(projectId) Then
                    Return ResponseHelpers.CreateErrorResponse("ProjectId is required and cannot be empty.", 400)
                End If
                ' ✅ DialogVersion è obbligatorio - deve essere fornito dal frontend
                If String.IsNullOrWhiteSpace(dialogVersion) Then
                    Return ResponseHelpers.CreateErrorResponse("DialogVersion is required and cannot be empty. Please provide the project version.", 400)
                End If
                If String.IsNullOrWhiteSpace(locale) Then
                    Return ResponseHelpers.CreateErrorResponse("Locale is required and cannot be empty.", 400)
                End If

                ' ✅ PASSO 1: Carica DialogRepository
                ' ✅ Log rimosso: troppo verboso
                Dim dialogRepository = SessionManager.GetDialogRepository()
                If dialogRepository Is Nothing Then
                    Return ResponseHelpers.CreateErrorResponse("DialogRepository not available", 500)
                End If

                ' ✅ PASSO 2: Carica dialogo da DialogRepository
                ' ✅ Log rimosso: troppo verboso
                Dim compiledTask As Compiler.CompiledUtteranceTask = dialogRepository.GetDialog(projectId, dialogVersion)

                If compiledTask Is Nothing Then
                    Return ResponseHelpers.CreateErrorResponse(
                        $"Dialog not found for projectId '{projectId}' and version '{dialogVersion}'. Please ensure the dialog is compiled and saved to the repository using POST /api/runtime/dialog/save.",
                        404
                    )
                End If

                ' ✅ PASSO 3: Carica TranslationRepository
                ' ✅ Log rimosso: troppo verboso
                Dim translationRepository = SessionManager.GetTranslationRepository()
                If translationRepository Is Nothing Then
                    Return ResponseHelpers.CreateErrorResponse("TranslationRepository not available", 500)
                End If

                ' ✅ STATELESS: STEP 3: Estrai textKeys dal dialogo (nuovo formato)
                Dim textKeys = SessionManager.ExtractTextKeysFromCompiledTask(compiledTask)

                If textKeys IsNot Nothing AndAlso textKeys.Count > 0 Then
                    Dim missingKeys As New List(Of String)()
                    For Each textKey In textKeys
                        If Not translationRepository.TranslationExists(projectId, locale, textKey) Then
                            missingKeys.Add(textKey)
                        End If
                    Next

                    If missingKeys.Count > 0 Then
                        Dim errorMsg = $"Translation validation failed: {missingKeys.Count} translation(s) not found in TranslationRepository for projectId '{projectId}' and locale '{locale}'. Missing keys: {String.Join(", ", missingKeys.Take(10))}"
                        If missingKeys.Count > 10 Then
                            errorMsg += $" ... and {missingKeys.Count - 10} more"
                        End If
                        Return ResponseHelpers.CreateErrorResponse(errorMsg, 400)
                    End If
                End If

                ' ✅ PASSO 5: Crea sessione
                ' ✅ Log rimosso: troppo verboso
                Dim newSessionId = CreateTaskSession(projectId, dialogVersion, locale)

                ' ✅ PASSO 6: Verifica salvataggio sessione su Redis
                ' ✅ Log rimosso: troppo verboso
                Try
                    Dim testSession = SessionManager.GetTaskSession(newSessionId)
                    If testSession Is Nothing Then
                        Return ResponseHelpers.CreateErrorResponse("Session not found in Redis after creation", 500)
                    End If
                Catch ex As Exception
                    Return ResponseHelpers.CreateErrorResponse($"Failed to load session: {ex.Message}", 500)
                End Try

                LogInfo("Task session created", New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                })

                ' ✅ PASSO 7: Carica/Crea DialogueState
                ' ✅ Per costruzione, DialogueContext viene creato qui se non esiste
                Dim session = SessionManager.GetTaskSession(newSessionId)
                Dim dialogueState As TaskEngine.DialogueState = Nothing
                Dim dialogueContext As TaskEngine.Orchestrator.DialogueContext = Nothing

                Try
                    dialogueContext = SessionManager.GetOrCreateDialogueContext(session)
                    If dialogueContext Is Nothing Then
                        ' ✅ Crea DialogueContext dal compiledTask (prima volta - per costruzione)
                        dialogueContext = New TaskEngine.Orchestrator.DialogueContext() With {
                            .TaskId = compiledTask.Id,
                            .dialogueState = New TaskEngine.DialogueState(),
                            .CurrentData = Nothing,
                            .LastTurnEvent = Nothing
                        }
                        ' ✅ Salva il DialogueContext creato
                        SessionManager.SaveDialogueContext(session, dialogueContext)
                    End If

                    If dialogueContext.DialogueState IsNot Nothing Then
                        dialogueState = dialogueContext.DialogueState
                    Else
                        dialogueState = New TaskEngine.DialogueState()
                        dialogueContext.DialogueState = dialogueState
                        SessionManager.SaveDialogueContext(session, dialogueContext)
                    End If
                Catch ex As Exception
                    ' ✅ Fallback: crea DialogueContext e DialogueState da zero
                    dialogueState = New TaskEngine.DialogueState()
                    dialogueContext = New TaskEngine.Orchestrator.DialogueContext() With {
                        .TaskId = compiledTask.Id,
                        .dialogueState = dialogueState,
                        .CurrentData = Nothing,
                        .LastTurnEvent = Nothing
                    }
                    SessionManager.SaveDialogueContext(session, dialogueContext)
                End Try

                ' ✅ PASSO 8: Verifica caricamento traduzioni (esempio)
                ' ✅ Log rimosso: troppo verboso
                ' Verifica traduzioni silenziosa (solo per validazione)
                Try
                    If compiledTask.Steps IsNot Nothing AndAlso compiledTask.Steps.Count > 0 Then
                        Dim firstStep = compiledTask.Steps(0)
                        If firstStep.Escalations IsNot Nothing AndAlso firstStep.Escalations.Count > 0 Then
                            Dim firstEscalation = firstStep.Escalations(0)
                            If firstEscalation.Tasks IsNot Nothing Then
                                For Each taskObj In firstEscalation.Tasks
                                    ' ✅ FIX: MessageTask è in TaskEngine namespace, non DDTEngine
                                    If TypeOf taskObj Is TaskEngine.MessageTask Then
                                        Dim msgTask = DirectCast(taskObj, TaskEngine.MessageTask)
                                        Dim translation = translationRepository.GetTranslation(projectId, locale, msgTask.TextKey)
                                        If Not String.IsNullOrEmpty(translation) Then
                                            Exit For
                                        End If
                                    End If
                                Next
                            End If
                        End If
                    End If
                Catch ex As Exception
                    ' ✅ Log rimosso: troppo verboso
                End Try

                ' ✅ PASSO 9: Chiama ProcessTurn (FASE 1: Invio messaggio iniziale)
                Try
                    ' ✅ Crea funzione per risolvere traduzioni on-demand (più efficiente)
                    Dim resolveTranslation As Func(Of String, String) = Function(textKey As String) As String
                                                                            If String.IsNullOrEmpty(textKey) Then
                                                                                Return Nothing
                                                                            End If
                                                                            Dim translation = translationRepository.GetTranslation(projectId, locale, textKey)
                                                                            Return If(String.IsNullOrEmpty(translation), textKey, translation)
                                                                        End Function

                    ' ✅ Inizializza CurrentTask se non esiste
                    If dialogueState.CurrentTask Is Nothing Then
                        dialogueState.CurrentTask = compiledTask
                        dialogueState.RootTask = compiledTask
                        dialogueState.CurrentStepType = Global.TaskEngine.DialogueStepType.Start
                    End If

                    ' ✅ Chiama ProcessTurn (FASE 1: solo messaggio iniziale)
                    Dim result = TaskUtteranceStepExecutor.ProcessTurn(dialogueState, "", resolveTranslation)

                    ' ✅ Emetti messaggi via SSE
                    Dim processTurnEmitter As EventEmitter = SessionManager.GetOrCreateEventEmitter(newSessionId)
                    If result.Messages IsNot Nothing AndAlso result.Messages.Count > 0 Then
                        For Each messageText As String In result.Messages
                            Dim messageData As Object = New With {
                                .text = messageText,
                                .stepType = "start",
                                .timestamp = DateTime.UtcNow.ToString("O")
                            }
                            processTurnEmitter.Emit("message", messageData)
                        Next
                    End If

                    ' ✅ Salva nuovo DialogueState nella sessione
                    ' ✅ Per costruzione, dialogueContext esiste sempre (creato al PASSO 7)
                    If result.NewState IsNot Nothing Then
                        dialogueContext = SessionManager.GetOrCreateDialogueContext(session)
                        dialogueContext.DialogueState = result.NewState
                        SessionManager.SaveDialogueContext(session, dialogueContext)
                    End If

                    ' ✅ Emetti evento waitingForInput se necessario
                    If result.Status = "waiting_for_input" Then
                        Dim waitingData As Object = New With {
                            .taskId = compiledTask.Id,
                            .timestamp = DateTime.UtcNow.ToString("O")
                        }
                        processTurnEmitter.Emit("waitingForInput", waitingData)
                    End If

                Catch ex As Exception
                    If TypeOf ex Is NotImplementedException OrElse ex.Message.Contains("non è ancora implementato") OrElse ex.Message.Contains("not yet implemented") Then
                        LogInfo("STUB: ProcessTurn non ancora implementato", New With {
                            .sessionId = newSessionId,
                            .projectId = projectId,
                            .dialogVersion = dialogVersion
                        })
                        Return ResponseHelpers.CreateErrorResponse("ProcessTurn not implemented. All previous steps are OK. Next: Implement ProcessTurnEngine.ProcessTurn()", 501)
                    ElseIf ex.Message.Contains("ProcessTurnEngine") OrElse ex.Message.Contains("non è definito") OrElse ex.Message.Contains("not defined") OrElse TypeOf ex Is MissingMemberException Then
                        LogInfo("STUB: ProcessTurn non ancora implementato", New With {
                            .sessionId = newSessionId,
                            .projectId = projectId,
                            .dialogVersion = dialogVersion
                        })
                        Return ResponseHelpers.CreateErrorResponse("ProcessTurn not implemented. All previous steps are OK. Next: Implement ProcessTurnEngine.vb", 501)
                    Else
                        LogError("ProcessTurn error", ex, New With {
                            .sessionId = newSessionId,
                            .projectId = projectId,
                            .dialogVersion = dialogVersion
                        })
                        Return ResponseHelpers.CreateErrorResponse($"ProcessTurn error: {ex.Message}", 500)
                    End If
                End Try

                ' ✅ STEP 7: ProcessTurn già completato per UtteranceInterpretation tasks
                ' Per altri tipi di task (SayMessage, BackendCall, etc.), vengono gestiti da TaskExecutor nel FlowOrchestrator
                ' Non serve più TaskEngine legacy

                Dim sessionCreated = New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                }

                ' ✅ Ritorna risposta immediata (l'esecuzione continua in background)
                Return ResponseHelpers.CreateSuccessResponse(sessionCreated)

            Catch ex As Exception
                Return ResponseHelpers.CreateErrorResponse($"Unexpected error while starting task session: {ex.Message}", 500)
            End Try
        End Function

        ''' <summary>
        ''' Handles GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        ''' </summary>
        ''' <summary>
        ''' Handles GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
            Try
                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    context.Response.StatusCode = 404
                    Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                    Return
                End If

                ' ✅ STATELESS: Imposta il flag SseConnected=True e salva su Redis
                session.SseConnected = True
                SessionManager.SaveTaskSession(session)

                ' ✅ STATELESS: Pubblica evento Redis Pub/Sub per notificare che SSE è connesso
                Try
                    Dim redis = ApiServer.Infrastructure.RedisConnectionManager.GetConnection("localhost:6379")
                    Dim subscriber = redis.GetSubscriber()
                    Dim channel = $"omnia:events:sse-connected:{sessionId}"
                    Await subscriber.PublishAsync(channel, "connected")
                Catch ex As Exception
                    ' Non bloccare il flusso se Pub/Sub fallisce - il flag è già salvato su Redis
                End Try

                ' ✅ REMOVED: TaskInstance legacy code - task execution is now handled by FlowOrchestrator

                ' ✅ Usa SseStreamManager per aprire connessione SSE
                LogInfo("🔌 [SSE Stream] Opening SSE stream", New With {
                    .sessionId = sessionId
                })
                _sseStreamManager.OpenStream(sessionId, context.Response)

                ' ✅ Invia messaggi bufferizzati se presenti
                Dim streamManager = DirectCast(_sseStreamManager, ApiServer.Streaming.SseStreamManager)
                LogInfo("📦 [SSE Stream] Sending buffered messages", New With {
                    .sessionId = sessionId
                })
                streamManager.SendBufferedMessages(sessionId)

                ' ✅ STATELESS: Send existing messages first (from Redis) usando SseStreamManager
                If session.Messages IsNot Nothing AndAlso session.Messages.Count > 0 Then
                    LogInfo("📨 [SSE Stream] Sending existing session messages", New With {
                        .sessionId = sessionId,
                        .messagesCount = session.Messages.Count
                    })
                    For Each msg In session.Messages
                        _sseStreamManager.EmitEvent(sessionId, "message", msg)
                    Next
                End If

                ' Send waitingForInput event if already waiting
                If session.IsWaitingForInput Then
                    _sseStreamManager.EmitEvent(sessionId, "waitingForInput", session.WaitingForInputData)
                End If

                ' ✅ Register event handlers usando SseStreamManager
                Dim onMessage As Action(Of Object) = Sub(data)
                                                         Try
                                                             ' ✅ Log dettagliato del messaggio ricevuto
                                                             Dim dataJson As String = "null"
                                                             If data IsNot Nothing Then
                                                                 Try
                                                                     dataJson = JsonConvert.SerializeObject(data)
                                                                 Catch
                                                                     dataJson = data.ToString()
                                                                 End Try
                                                             End If
                                                             LogInfo("📨 [SSE Stream] onMessage handler called", New With {
                                                                 .sessionId = sessionId,
                                                                 .dataType = If(data IsNot Nothing, data.GetType().Name, "null"),
                                                                 .dataPreview = If(dataJson.Length > 200, dataJson.Substring(0, 200) + "...", dataJson),
                                                                 .dataLength = dataJson.Length,
                                                                 .isStreamOpen = _sseStreamManager.IsStreamOpen(sessionId)
                                                             })
                                                             _sseStreamManager.EmitEvent(sessionId, "message", data)
                                                         Catch ex As Exception
                                                             LogError("❌ [SSE Stream] Error in onMessage handler", ex, New With {
                                                                 .sessionId = sessionId,
                                                                 .errorMessage = ex.Message,
                                                                 .stackTrace = ex.StackTrace
                                                             })
                                                         End Try
                                                     End Sub

                Dim onWaitingForInput As Action(Of Object) = Sub(data)
                                                                 Try
                                                                     session.IsWaitingForInput = True
                                                                     session.WaitingForInputData = data
                                                                     _sseStreamManager.EmitEvent(sessionId, "waitingForInput", data)
                                                                 Catch ex As Exception
                                                                     ' Log removed
                                                                 End Try
                                                             End Sub

                Dim onComplete As Action(Of Object) = Sub(data)
                                                          Try
                                                              _sseStreamManager.EmitEvent(sessionId, "complete", data)
                                                              _sseStreamManager.CloseStream(sessionId)
                                                          Catch ex As Exception
                                                              ' Log removed
                                                          End Try
                                                      End Sub

                Dim onError As Action(Of Object) = Sub(data)
                                                       Try
                                                           _sseStreamManager.EmitEvent(sessionId, "error", data)
                                                           _sseStreamManager.CloseStream(sessionId)
                                                       Catch ex As Exception
                                                           ' Log removed
                                                       End Try
                                                   End Sub

                ' ✅ STATELESS: Registra gli handler sull'EventEmitter condiviso
                Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                Dim listenerCountBefore = sharedEmitter.ListenerCount("message")
                LogInfo("📝 [SSE Stream] Registering EventEmitter listeners", New With {
                    .sessionId = sessionId,
                    .listenerCountBefore = listenerCountBefore
                })
                sharedEmitter.[On]("message", onMessage)
                sharedEmitter.[On]("waitingForInput", onWaitingForInput)
                sharedEmitter.[On]("complete", onComplete)
                sharedEmitter.[On]("error", onError)
                Dim listenerCountAfter = sharedEmitter.ListenerCount("message")

                ' ✅ STATELESS: Quando la connessione SSE si chiude, imposta SseConnected=False
                context.RequestAborted.Register(Sub()
                                                    Try
                                                        Dim closedSession = SessionManager.GetTaskSession(sessionId)
                                                        If closedSession IsNot Nothing Then
                                                            closedSession.SseConnected = False
                                                            SessionManager.SaveTaskSession(closedSession)
                                                        End If
                                                    Catch
                                                        ' Ignore errors during cleanup
                                                    End Try
                                                End Sub)

                ' ✅ STATELESS: Salva la sessione con gli handler registrati
                SessionManager.SaveTaskSession(session)

                ' ✅ STATELESS: Mantieni connessione aperta con heartbeat integrato
                Dim heartbeatTimer As New System.Threading.Timer(Sub(state)
                                                                     Try
                                                                         _sseStreamManager.EmitEvent(sessionId, "heartbeat", New With {.timestamp = DateTime.UtcNow.ToString("O")})
                                                                     Catch ex As Exception
                                                                         ' Connection closed
                                                                     End Try
                                                                 End Sub, Nothing, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30))

                ' ✅ STATELESS: Mantieni connessione aperta fino a chiusura
                Try
                    Await System.Threading.Tasks.Task.Delay(System.Threading.Timeout.Infinite, context.RequestAborted)
                Catch ex As System.Threading.Tasks.TaskCanceledException
                    ' Connection closed normally
                Finally
                    heartbeatTimer.Dispose()
                    _sseStreamManager.CloseStream(sessionId)
                End Try
            Catch ex As Exception
                LogError("HandleTaskSessionStream exception", ex, New With {.sessionId = sessionId})
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        ''' </summary>
        ''' <summary>
        ''' Handles POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
            ' ✅ FASE 2: Usa logger invece di Console.WriteLine
            LogDebug("HandleTaskSessionInput entry", New With {.sessionId = sessionId})
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                Dim request = JsonConvert.DeserializeObject(Of TaskSessionInputRequest)(body)

                If request Is Nothing OrElse String.IsNullOrEmpty(request.Input) Then
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                Dim session = SessionManager.GetTaskSession(sessionId)

                If session Is Nothing Then
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If

                ' ✅ Runtime: Carica task già compilato dal repository
                ' La compilazione avviene in startSession (frontend chiama /api/runtime/compile/task e /api/runtime/dialog/save)
                ' Questo handler processa solo input utente, non compila
                ' ============================================
                ' STEP 1 — Carica Task compilato dal repository
                ' ============================================
                LogInfo("Loading compiled task from repository", New With {.sessionId = sessionId})

                Dim compiledTask As CompiledUtteranceTask = Nothing

                Try
                    ' ✅ STATELESS: Carica DialogRepository e ottieni CompiledUtteranceTask dalla sessione
                    Dim dialogRepo = SessionManager.GetDialogRepository()
                    If dialogRepo Is Nothing Then
                        Return Results.Problem(
                            title:="DialogRepository not available",
                            detail:="DialogRepository is not available. Please ensure it is properly initialized.",
                            statusCode:=500
                        )
                    End If

                    ' ✅ STATELESS: Carica CompiledUtteranceTask usando projectId e dialogVersion dalla sessione
                    compiledTask = dialogRepo.GetDialog(session.ProjectId, session.DialogVersion)
                    If compiledTask Is Nothing Then
                        Return Results.Problem(
                            title:="Dialog not found",
                            detail:=$"Dialog not found for projectId '{session.ProjectId}' and version '{session.DialogVersion}'. " &
                                    $"Please ensure the dialog is compiled and saved before starting the session.",
                            statusCode:=404
                        )
                    End If

                    LogInfo("Task loaded from repository successfully", New With {
                        .sessionId = sessionId,
                        .projectId = session.ProjectId,
                        .dialogVersion = session.DialogVersion,
                        .taskId = compiledTask.Id
                    })
                Catch ex As Exception
                    LogError("Error loading task from repository", ex, New With {
                        .sessionId = sessionId,
                        .projectId = session.ProjectId,
                        .dialogVersion = session.DialogVersion
                    })
                    Return Results.Problem(
                        title:="Error loading task",
                        detail:=ex.Message,
                        statusCode:=500
                    )
                End Try

                ' ============================================
                ' STEP 2 — Sistema pronto per l'esecuzione
                ' ============================================
                LogInfo("Sistema pronto per l'esecuzione del task", New With {
                    .sessionId = sessionId,
                    .projectId = session.ProjectId,
                    .dialogVersion = session.DialogVersion
                })

                ' ============================================
                ' STEP 3 — Chiama ProcessTurn con l'input dell'utente
                ' ============================================

                ' ✅ Carica DialogueState dalla sessione
                Console.WriteLine("═══════════════════════════════════════════════════════════")
                Console.WriteLine("🔥 HandleTaskSessionInput: About to load DialogueState")
                Console.WriteLine($"   SessionId: {sessionId}")
                Console.Out.Flush()

                LogInfo("📥 [HandleTaskSessionInput] BEFORE loading DialogueState from session", New With {
                    .sessionId = sessionId
                })

                Dim dialogueContext = SessionManager.GetOrCreateDialogueContext(session)

                Console.WriteLine($"🔥 HandleTaskSessionInput: AFTER GetOrCreateDialogueContext")
                Console.WriteLine($"   HasContext: {dialogueContext IsNot Nothing}")
                Console.WriteLine($"   HasState: {If(dialogueContext IsNot Nothing, dialogueContext.DialogueState IsNot Nothing, False)}")
                If dialogueContext IsNot Nothing AndAlso dialogueContext.DialogueState IsNot Nothing Then
                    Console.WriteLine($"   State.Mode: {dialogueContext.DialogueState.Mode}")
                    Console.WriteLine($"   State.TurnState: {dialogueContext.DialogueState.TurnState}")
                End If
                Console.Out.Flush()
                Dim dialogueState As TaskEngine.DialogueState = Nothing
                If dialogueContext IsNot Nothing AndAlso dialogueContext.DialogueState IsNot Nothing Then
                    dialogueState = dialogueContext.DialogueState
                Else
                    ' ⚠️ PROBLEMA: Lo stato non è stato trovato!
                    ' ✅ Se non esiste, crea un nuovo DialogueState
                    dialogueState = New TaskEngine.DialogueState()
                    If dialogueContext Is Nothing Then
                        dialogueContext = New TaskEngine.Orchestrator.DialogueContext() With {
                            .TaskId = compiledTask.Id,
                            .dialogueState = dialogueState,
                            .CurrentData = Nothing,
                            .LastTurnEvent = Nothing
                        }
                    Else
                        dialogueContext.DialogueState = dialogueState
                    End If
                    SessionManager.SaveDialogueContext(session, dialogueContext)
                End If

                ' ✅ Carica TranslationRepository
                Dim translationRepository = SessionManager.GetTranslationRepository()
                If translationRepository Is Nothing Then
                    Return Results.Problem(
                        title:="TranslationRepository not available",
                        detail:="TranslationRepository is not available. Please ensure it is properly initialized.",
                        statusCode:=500
                    )
                End If

                ' ✅ Crea funzione per risolvere traduzioni on-demand (più efficiente)
                Dim resolveTranslation As Func(Of String, String) = Function(textKey As String) As String
                                                                        If String.IsNullOrEmpty(textKey) Then
                                                                            Return Nothing
                                                                        End If
                                                                        Dim translation = translationRepository.GetTranslation(session.ProjectId, session.Locale, textKey)
                                                                        Return If(String.IsNullOrEmpty(translation), textKey, translation)
                                                                    End Function

                ' ✅ Inizializza CurrentTask se non esiste
                If dialogueState.CurrentTask Is Nothing Then
                    dialogueState.CurrentTask = compiledTask
                    dialogueState.RootTask = compiledTask
                    dialogueState.CurrentStepType = Global.TaskEngine.DialogueStepType.Start
                End If

                ' ✅ Chiama ProcessTurn con l'input dell'utente e la funzione di risoluzione
                Dim processTurnResult = TaskUtteranceStepExecutor.ProcessTurn(
                    dialogueState,
                    request.Input,
                    resolveTranslation
                )


                ' ✅ Salva il nuovo DialogueState (SaveDialogueContext salva automaticamente su Redis)
                If processTurnResult.NewState IsNot Nothing Then
                    dialogueContext.DialogueState = processTurnResult.NewState
                    SessionManager.SaveDialogueContext(session, dialogueContext)
                End If

                ' ✅ Emetti messaggi via SSE
                Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                If processTurnResult.Messages IsNot Nothing AndAlso processTurnResult.Messages.Count > 0 Then
                    For Each messageText As String In processTurnResult.Messages
                        Dim messageData As Object = New With {
                            .text = messageText,
                            .stepType = If(processTurnResult.NewState IsNot Nothing, processTurnResult.NewState.TurnState.ToString(), "unknown"),
                            .timestamp = DateTime.UtcNow.ToString("O")
                        }
                        sharedEmitter.Emit("message", messageData)
                    Next
                End If

                ' ✅ Aggiorna stato waiting
                If processTurnResult.Status = "waiting_for_input" Then
                    session.IsWaitingForInput = True
                    session.WaitingForInputData = New With {
                        .taskId = compiledTask.Id,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                ElseIf processTurnResult.Status = "completed" Then
                    session.IsWaitingForInput = False
                    session.WaitingForInputData = Nothing
                    ' ✅ Emetti evento complete
                    Dim completeData = New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                    sharedEmitter.Emit("complete", completeData)
                End If

                ' ✅ Salva sessione
                SessionManager.SaveTaskSession(session)

                Return Results.Ok(New With {
                    .success = True,
                    .timestamp = DateTime.UtcNow.ToString("O")
                })
            Catch ex As Exception
                ' ✅ FASE 2: Usa logger invece di Console.WriteLine
                LogError("HandleTaskSessionInput exception", ex, New With {.sessionId = sessionId})
                Return Results.Problem(
                    title:="Failed to provide input",
                    detail:=ex.Message,
                    statusCode:=500
                )
            End Try
        End Function

        ' ✅ REMOVED: ConvertRuntimeTaskToCompiled - RuntimeTask eliminato, non serve più conversione

        ''' <summary>
        ''' Handles DELETE /api/runtime/task/session/{id} - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionDelete(context As HttpContext, sessionId As String) As Task(Of IResult)
            Try
                SessionManager.DeleteTaskSession(sessionId)
                Return Results.Ok(New With {
                    .success = True,
                    .timestamp = DateTime.UtcNow.ToString("O")
                })
            Catch ex As Exception
                Return Results.Problem(
                    title:="Failed to delete session",
                    detail:=ex.Message,
                    statusCode:=500
                )
            End Try
        End Function
    End Module
End Namespace
