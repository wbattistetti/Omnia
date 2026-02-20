Option Strict On
Option Explicit On
Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports ApiServer.Converters
Imports ApiServer.Helpers
Imports ApiServer.Interfaces
Imports ApiServer.Logging
Imports ApiServer.Models
Imports ApiServer.Services
Imports ApiServer.Validators
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

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

                ' ✅ STATELESS: STEP 2: Carica dialogo da DialogRepository
                Dim dialogRepository = New ApiServer.Repositories.RedisDialogRepository(
                    Program.GetRedisConnectionString(),
                    Program.GetRedisKeyPrefix()
                )

                Dim runtimeTask = dialogRepository.GetDialog(projectId, dialogVersion)

                If runtimeTask Is Nothing Then
                    Return ResponseHelpers.CreateErrorResponse(
                        $"Dialog not found for projectId '{projectId}' and version '{dialogVersion}'. Please ensure the dialog is compiled and saved to the repository using POST /api/runtime/dialog/save.",
                        404
                    )
                End If

                ' ✅ STATELESS: STEP 3: Estrai textKeys dal dialogo
                Dim textKeys = SessionManager.ExtractTextKeysFromRuntimeTask(runtimeTask)

                ' ✅ STATELESS: STEP 4: Valida che tutte le traduzioni esistano in TranslationRepository
                Dim translationRepository = New ApiServer.Repositories.RedisTranslationRepository(
                    Program.GetRedisConnectionString(),
                    Program.GetRedisKeyPrefix()
                )

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

                ' ✅ STATELESS: STEP 5: Crea sessione con solo stato runtime
                Dim newSessionId = CreateTaskSession(projectId, dialogVersion, locale)

                LogInfo("Task session created", New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                })

                Dim sessionCreated = New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                }

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

                ' Avvia il primo turno del motore se il TaskInstance non è ancora stato inizializzato.
                If session.TaskInstance Is Nothing Then
                    SessionManager.StartTaskExecutionIfNeeded(sessionId)
                    session = SessionManager.GetTaskSession(sessionId)
                End If

                ' ✅ Usa SseStreamManager per aprire connessione SSE
                _sseStreamManager.OpenStream(sessionId, context.Response)

                ' ✅ Invia messaggi bufferizzati se presenti
                Dim streamManager = DirectCast(_sseStreamManager, ApiServer.Streaming.SseStreamManager)
                streamManager.SendBufferedMessages(sessionId)

                ' ✅ STATELESS: Send existing messages first (from Redis) usando SseStreamManager
                If session.Messages IsNot Nothing AndAlso session.Messages.Count > 0 Then
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
                                                             _sseStreamManager.EmitEvent(sessionId, "message", data)
                                                         Catch ex As Exception
                                                             ' Log removed
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
                sharedEmitter.[On]("message", onMessage)
                sharedEmitter.[On]("waitingForInput", onWaitingForInput)
                sharedEmitter.[On]("complete", onComplete)
                sharedEmitter.[On]("error", onError)

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

                ' ✅ STEP 1: Ensure TaskInstance is loaded — rebuild from DialogRepository if needed
                ' (TaskInstance is never persisted to Redis; it must be reconstructed on every request.)
                If Not SessionManager.EnsureTaskInstanceLoaded(session) Then
                    Return Results.BadRequest(New With {.error = "Dialog not found or could not be loaded for this session. Please restart the session."})
                End If

                ' ✅ STEP 2: Parse input and run the next dialogue step in a single call.
                SessionManager.AttachTaskEngineHandlers(session)
                session.TaskEngine.HandleUserTurn(session.TaskInstance, request.Input)

                ' ✅ STATELESS: Salva la sessione su Redis dopo l'esecuzione
                SessionManager.SaveTaskSession(session)

                ' ✅ STATELESS: Verifica se tutti i task sono completati e emetti evento "complete"
                Dim allCompleted = session.TaskInstance IsNot Nothing AndAlso session.TaskInstance.SubTasks.All(Function(t) t.IsComplete())
                If allCompleted Then
                    Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                    Dim completeData = New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                    sharedEmitter.Emit("complete", completeData)
                End If

                ' Clear waiting state
                session.IsWaitingForInput = False
                session.WaitingForInputData = Nothing

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
