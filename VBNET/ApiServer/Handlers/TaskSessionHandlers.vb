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
            Else
                Console.WriteLine($"[DEBUG] {message}")
            End If
        End Sub

        Private Sub LogInfo(message As String, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then
                _logger.LogInfo(message, data)
            Else
                Console.WriteLine($"[INFO] {message}")
            End If
        End Sub

        Private Sub LogError(message As String, ex As Exception, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then
                _logger.LogError(message, ex, data)
            Else
                Console.WriteLine($"[ERROR] {message}: {ex.Message}")
            End If
        End Sub
        ''' <summary>
        ''' Reads and parses the request body for task session start
        ''' </summary>
        Private Async Function ReadAndParseRequest(context As HttpContext) As Task(Of (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String))
            ' Log rimosso: non essenziale per flusso motore
            System.Diagnostics.Debug.WriteLine("🔵 [ReadAndParseRequest] ENTRY")
            Console.Out.Flush()

            Try
                Console.WriteLine("🔵 [ReadAndParseRequest] Reading request body...")
                System.Diagnostics.Debug.WriteLine("🔵 [ReadAndParseRequest] Reading request body...")
                Console.Out.Flush()

                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()

                Console.WriteLine($"🔵 [ReadAndParseRequest] Body read: length={If(body IsNot Nothing, body.Length, 0)}")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] Body read: length={If(body IsNot Nothing, body.Length, 0)}")
                Console.Out.Flush()

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine("🔵 [ReadAndParseRequest] Body is empty, returning error")
                    System.Diagnostics.Debug.WriteLine("🔵 [ReadAndParseRequest] Body is empty, returning error")
                    Console.Out.Flush()
                    Return (False, Nothing, "Request body is empty. Expected JSON with taskId and projectId fields.")
                End If

                Console.WriteLine($"🔵 [ReadAndParseRequest] Deserializing JSON...")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] Deserializing JSON...")
                Console.Out.Flush()

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Deserializzazione JSON
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Calling JsonConvert.DeserializeObject...")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] BEFORE: Calling JsonConvert.DeserializeObject...")
                Console.Out.Flush()

                Dim request As TaskSessionStartRequest = Nothing
                Try
                    request = JsonConvert.DeserializeObject(Of TaskSessionStartRequest)(body, New JsonSerializerSettings() With {
                        .NullValueHandling = NullValueHandling.Ignore,
                        .MissingMemberHandling = MissingMemberHandling.Ignore
                    })
                    Console.WriteLine("🔴 [DIAG] OK: JsonConvert.DeserializeObject completed")
                    System.Diagnostics.Debug.WriteLine("🔴 [DIAG] OK: JsonConvert.DeserializeObject completed")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine("🔴 [DIAG] EXCEPTION in JsonConvert.DeserializeObject:")
                    Console.WriteLine(ex.ToString())
                    System.Diagnostics.Debug.WriteLine($"🔴 [DIAG] EXCEPTION in JsonConvert.DeserializeObject: {ex.ToString()}")
                    Console.Out.Flush()
                    Return (False, Nothing, $"Failed to deserialize JSON. Error: {ex.Message}")
                End Try

                Console.WriteLine($"🔵 [ReadAndParseRequest] ✅ STATELESS: Deserialization successful: ProjectId={If(request IsNot Nothing, request.ProjectId, "Nothing")}, DialogVersion={If(request IsNot Nothing, request.DialogVersion, "Nothing")}, Locale={If(request IsNot Nothing, request.Locale, "Nothing")}")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] ✅ STATELESS: Deserialization successful: ProjectId={If(request IsNot Nothing, request.ProjectId, "Nothing")}, DialogVersion={If(request IsNot Nothing, request.DialogVersion, "Nothing")}, Locale={If(request IsNot Nothing, request.Locale, "Nothing")}")
                Console.Out.Flush()

                Return (True, request, Nothing)
            Catch ex As Exception
                ' Log errore mantenuto ma semplificato
                Console.WriteLine($"[ERROR] ReadAndParseRequest failed: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Console.Out.Flush()
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
            Console.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: projectId={projectId}, dialogVersion={dialogVersion}, locale={locale}")
            System.Diagnostics.Debug.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: projectId={projectId}, dialogVersion={dialogVersion}, locale={locale}")
            Console.Out.Flush()
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: Generated sessionId={sessionId}")
            System.Diagnostics.Debug.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: Generated sessionId={sessionId}")
            Console.Out.Flush()
            Console.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: Calling SessionManager.CreateTaskSession (will save to Redis)...")
            System.Diagnostics.Debug.WriteLine($"[API] ✅ STATELESS: CreateTaskSession: Calling SessionManager.CreateTaskSession (will save to Redis)...")
            Console.Out.Flush()
            SessionManager.CreateTaskSession(sessionId, projectId, dialogVersion, locale)
            Console.WriteLine($"[API] ✅ STATELESS: Session created and saved to Redis: {sessionId}, ProjectId={projectId}, DialogVersion={dialogVersion}, Locale={locale}")
            System.Diagnostics.Debug.WriteLine($"[API] ✅ STATELESS: Session created and saved to Redis: {sessionId}, ProjectId={projectId}, DialogVersion={dialogVersion}, Locale={locale}")
            Console.Out.Flush()
            Return sessionId
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
        ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
        ''' </summary>
        Public Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
            Console.WriteLine("═══════════════════════════════════════════════════════════════")
            Console.WriteLine("🔵 [HandleTaskSessionStart] ENTRY")
            System.Diagnostics.Debug.WriteLine("🔵 [HandleTaskSessionStart] ENTRY")
            Console.Out.Flush()

            ' ═══════════════════════════════════════════════════════════════
            ' DIAGNOSTIC: Top of handler
            ' ═══════════════════════════════════════════════════════════════
            Console.WriteLine("🔴 [DIAG] TOP OF HANDLER — MUST APPEAR")
            System.Diagnostics.Debug.WriteLine("🔴 [DIAG] TOP OF HANDLER — MUST APPEAR")
            Console.Out.Flush()

            Try
                Console.WriteLine("🔵 [HandleTaskSessionStart] About to parse request...")
                System.Diagnostics.Debug.WriteLine("🔵 [HandleTaskSessionStart] About to parse request...")
                Console.Out.Flush()

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Chiamata a ReadAndParseRequest
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Calling ReadAndParseRequest...")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] BEFORE: Calling ReadAndParseRequest...")
                Console.Out.Flush()

                Dim parseResult As (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String) = Nothing

                Try
                    parseResult = Await ReadAndParseRequest(context)
                    Console.WriteLine("🔴 [DIAG] OK: ReadAndParseRequest completed")
                    System.Diagnostics.Debug.WriteLine("🔴 [DIAG] OK: ReadAndParseRequest completed")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine("🔴 [DIAG] EXCEPTION in ReadAndParseRequest:")
                    Console.WriteLine(ex.ToString())
                    System.Diagnostics.Debug.WriteLine($"🔴 [DIAG] EXCEPTION in ReadAndParseRequest: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception in ReadAndParseRequest: {ex.Message}", 500)
                End Try

                Console.WriteLine("🔵 [HandleTaskSessionStart] ReadAndParseRequest COMPLETED")
                System.Diagnostics.Debug.WriteLine("🔵 [HandleTaskSessionStart] ReadAndParseRequest COMPLETED")
                Console.Out.Flush()

                Console.WriteLine($"🔵 [HandleTaskSessionStart] ParseResult.Success: {parseResult.Success}")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleTaskSessionStart] ParseResult.Success: {parseResult.Success}")
                Console.Out.Flush()

                If Not parseResult.Success Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] Parse failed: {parseResult.ErrorMessage}")
                    System.Diagnostics.Debug.WriteLine($"🔵 [HandleTaskSessionStart] Parse failed: {parseResult.ErrorMessage}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(parseResult.ErrorMessage, 400)
                End If

                Console.WriteLine($"🔵 [HandleTaskSessionStart] ParseResult.Request: IsNothing={parseResult.Request Is Nothing}")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleTaskSessionStart] ParseResult.Request: IsNothing={parseResult.Request Is Nothing}")
                Console.Out.Flush()

                Dim request = parseResult.Request

                If request Is Nothing Then
                    Console.WriteLine("🔵 [HandleTaskSessionStart] Request is Nothing!")
                    System.Diagnostics.Debug.WriteLine("🔵 [HandleTaskSessionStart] Request is Nothing!")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse("Request is Nothing after parsing", 500)
                End If

                ' ✅ STATELESS: Request parsed - ora estraiamo solo projectId, dialogVersion, locale
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: Request parsed successfully")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: Request parsed successfully")
                Console.Out.Flush()

                ' ✅ STATELESS: STEP 1: Estrai projectId, dialogVersion, locale dal request
                Console.WriteLine("🔵 [HandleTaskSessionStart] ✅ STATELESS: Extracting projectId, dialogVersion, locale...")
                Console.Out.Flush()

                Dim projectId As String = Nothing
                Dim dialogVersion As String = Nothing
                Dim locale As String = Nothing

                Try
                    projectId = request.ProjectId
                    dialogVersion = request.DialogVersion
                    locale = request.Locale
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: projectId={projectId}, dialogVersion={dialogVersion}, locale={locale}")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] ❌ Exception accessing request properties: {ex.Message}")
                    Console.Out.Flush()
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
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: STEP 2 - Loading dialog from DialogRepository...")
                Console.WriteLine($"   ProjectId: {projectId}")
                Console.WriteLine($"   DialogVersion: {dialogVersion}")
                Console.WriteLine($"   Locale: {locale}")
                Console.Out.Flush()

                Dim dialogRepository = New ApiServer.Repositories.RedisDialogRepository(
                    Program.GetRedisConnectionString(),
                    Program.GetRedisKeyPrefix()
                )
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ DialogRepository created, calling GetDialog({projectId}, {dialogVersion})...")
                Console.Out.Flush()

                Dim runtimeTask = dialogRepository.GetDialog(projectId, dialogVersion)

                If runtimeTask Is Nothing Then
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] ❌ Dialog not found in repository!")
                    Console.WriteLine($"   ProjectId: {projectId}")
                    Console.WriteLine($"   DialogVersion: {dialogVersion}")
                    Console.WriteLine($"   Redis Key: omnia:dialog:{projectId}:{dialogVersion}")
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(
                        $"Dialog not found for projectId '{projectId}' and version '{dialogVersion}'. Please ensure the dialog is compiled and saved to the repository using POST /api/runtime/dialog/save.",
                        404
                    )
                End If

                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ Dialog loaded successfully from repository!")
                Console.WriteLine($"   RuntimeTask.Id: {runtimeTask.Id}")
                Console.WriteLine($"   HasSubTasks: {runtimeTask.HasSubTasks()}")
                If runtimeTask.HasSubTasks() Then
                    Console.WriteLine($"   SubTasks.Count: {runtimeTask.SubTasks.Count}")
                End If
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.Out.Flush()

                ' ✅ STATELESS: STEP 3: Estrai textKeys dal dialogo
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: Extracting textKeys from dialog...")
                Console.Out.Flush()
                Dim textKeys = SessionManager.ExtractTextKeysFromRuntimeTask(runtimeTask)

                If textKeys Is Nothing OrElse textKeys.Count = 0 Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] ⚠️ No textKeys found in dialog (dialog may not have any messages)")
                    Console.Out.Flush()
                Else
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ Found {textKeys.Count} textKeys in dialog")
                    Console.Out.Flush()
                End If

                ' ✅ STATELESS: STEP 4: Valida che tutte le traduzioni esistano in TranslationRepository
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: Validating translations in TranslationRepository...")
                Console.Out.Flush()

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
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] ❌ {errorMsg}")
                        Console.Out.Flush()
                        Return ResponseHelpers.CreateErrorResponse(errorMsg, 400)
                    End If
                End If

                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ All translations validated")
                Console.Out.Flush()

                ' ✅ STATELESS: STEP 5: Crea sessione con solo stato runtime
                Console.WriteLine($"🔵 [HandleTaskSessionStart] ✅ STATELESS: Creating session...")
                Console.Out.Flush()
                Dim newSessionId = CreateTaskSession(projectId, dialogVersion, locale)

                LogInfo("Task session created", New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                })

                Dim responseObj = New With {
                    .sessionId = newSessionId,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .locale = locale
                }

                LogDebug("Creating success response")
                Dim successResponse = ResponseHelpers.CreateSuccessResponse(responseObj)

                LogDebug("Success response created", New With {
                    .responseType = If(successResponse IsNot Nothing, successResponse.GetType().Name, "Nothing")
                })

                Return successResponse

            Catch ex As Exception
                Console.WriteLine($"🔵 [HandleTaskSessionStart] UNHANDLED EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Console.WriteLine($"🔵 [HandleTaskSessionStart] StackTrace: {ex.StackTrace}")
                Console.Out.Flush()
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
                Console.WriteLine($"[API] ✅ STATELESS: SSE connection opened for session: {sessionId} (retrieved from Redis)")

                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    Console.WriteLine($"[API] ❌ ERROR: Session not found in Redis: {sessionId}")
                    context.Response.StatusCode = 404
                    Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                    Return
                End If

                ' ✅ STATELESS: Imposta il flag SseConnected=True e salva su Redis
                session.SseConnected = True
                SessionManager.SaveTaskSession(session)
                Console.WriteLine($"[API] ✅ STATELESS: SSE connection flag set to True and saved to Redis for session: {sessionId}")

                ' ✅ STATELESS: Pubblica evento Redis Pub/Sub per notificare che SSE è connesso
                Try
                    ' ✅ STATELESS: Usa la stessa connection string configurata in Program.vb
                    ' La connection string è già disponibile tramite RedisConnectionManager
                    Dim redis = ApiServer.Infrastructure.RedisConnectionManager.GetConnection("localhost:6379")
                    Dim subscriber = redis.GetSubscriber()
                    Dim channel = $"omnia:events:sse-connected:{sessionId}"
                    Await subscriber.PublishAsync(channel, "connected")
                    Console.WriteLine($"[API] ✅ STATELESS: Published SSE connected event to Redis Pub/Sub channel: {channel}")
                Catch ex As Exception
                    Console.WriteLine($"[API] ⚠️ STATELESS: Failed to publish Redis Pub/Sub event: {ex.Message}")
                    ' Non bloccare il flusso se Pub/Sub fallisce - il flag è già salvato su Redis
                End Try

                ' ✅ DISABLED: Se il task non è ancora stato eseguito, avvialo ora (SSE è connesso)
                Console.WriteLine($"[API] ⚠️  EXECUTION DISABLED: Checking TaskInstance for session: {sessionId}, IsNothing: {session.TaskInstance Is Nothing}")
                If session.TaskInstance Is Nothing Then
                    Console.WriteLine($"[API] ⚠️  EXECUTION DISABLED: TaskInstance is Nothing, but StartTaskExecutionIfNeeded is commented out for debugging")
                    ' SessionManager.StartTaskExecutionIfNeeded(sessionId)
                    ' Ricarica la sessione dopo aver avviato l'esecuzione
                    session = SessionManager.GetTaskSession(sessionId)
                    Console.WriteLine($"[API] ✅ STATELESS: Session reloaded, TaskInstance IsNothing: {session.TaskInstance Is Nothing}")
                Else
                    Console.WriteLine($"[API] ⚠️  EXECUTION DISABLED: TaskInstance already exists, but StartTaskExecutionIfNeeded is commented out for debugging")
                    ' ✅ STATELESS: Assicurati che gli handler siano collegati anche se il task è già stato eseguito
                    ' SessionManager.StartTaskExecutionIfNeeded(sessionId)
                End If

                ' ✅ Usa SseStreamManager per aprire connessione SSE
                _sseStreamManager.OpenStream(sessionId, context.Response)

                ' ✅ Invia messaggi bufferizzati se presenti
                Dim streamManager = DirectCast(_sseStreamManager, ApiServer.Streaming.SseStreamManager)
                streamManager.SendBufferedMessages(sessionId)

                ' ✅ STATELESS: Send existing messages first (from Redis) usando SseStreamManager
                Console.WriteLine($"[API] ✅ STATELESS: Checking for existing messages in Redis session: {sessionId}")
                Console.WriteLine($"[API] ✅ STATELESS: session.Messages IsNothing: {session.Messages Is Nothing}, Count: {If(session.Messages IsNot Nothing, session.Messages.Count, 0)}")
                If session.Messages IsNot Nothing AndAlso session.Messages.Count > 0 Then
                    Console.WriteLine($"[API] ✅ STATELESS: Sending {session.Messages.Count} existing messages from Redis for session: {sessionId}")
                    For Each msg In session.Messages
                        Console.WriteLine($"[API] ✅ STATELESS: Sending existing message: {JsonConvert.SerializeObject(msg)}")
                        _sseStreamManager.EmitEvent(sessionId, "message", msg)
                    Next
                Else
                    Console.WriteLine($"[API] ⚠️ STATELESS: No existing messages in Redis session: {sessionId} (task may not have executed yet)")
                End If

                ' Send waitingForInput event if already waiting
                If session.IsWaitingForInput Then
                    Console.WriteLine($"[API] ✅ STATELESS: Session is already waiting for input, sending waitingForInput event")
                    _sseStreamManager.EmitEvent(sessionId, "waitingForInput", session.WaitingForInputData)
                    Console.WriteLine($"[API] Initial waitingForInput event sent successfully")
                End If

                ' ✅ Register event handlers usando SseStreamManager
                Dim onMessage As Action(Of Object) = Sub(data)
                                                         Console.WriteLine($"[API] ✅ STATELESS: onMessage handler called for session: {sessionId}")
                                                         Try
                                                             _sseStreamManager.EmitEvent(sessionId, "message", data)
                                                             Console.WriteLine($"[API] ✅ STATELESS: Message sent to SSE stream for session: {sessionId}")
                                                         Catch ex As Exception
                                                             Console.WriteLine($"[API] ❌ ERROR: SSE error sending message: {ex.Message}")
                                                         End Try
                                                     End Sub

                Dim onWaitingForInput As Action(Of Object) = Sub(data)
                                                                 Try
                                                                     session.IsWaitingForInput = True
                                                                     session.WaitingForInputData = data
                                                                     _sseStreamManager.EmitEvent(sessionId, "waitingForInput", data)
                                                                     Console.WriteLine($"[API] waitingForInput event sent successfully")
                                                                 Catch ex As Exception
                                                                     Console.WriteLine($"[API] ERROR: SSE error sending waitingForInput: {ex.GetType().Name} - {ex.Message}")
                                                                 End Try
                                                             End Sub

                Dim onComplete As Action(Of Object) = Sub(data)
                                                          Try
                                                              _sseStreamManager.EmitEvent(sessionId, "complete", data)
                                                              _sseStreamManager.CloseStream(sessionId)
                                                          Catch ex As Exception
                                                              Console.WriteLine($"[API] ERROR: SSE error sending complete: {ex.Message}")
                                                          End Try
                                                      End Sub

                Dim onError As Action(Of Object) = Sub(data)
                                                       Try
                                                           _sseStreamManager.EmitEvent(sessionId, "error", data)
                                                           _sseStreamManager.CloseStream(sessionId)
                                                       Catch ex As Exception
                                                           Console.WriteLine($"[API] ERROR: SSE error sending error: {ex.Message}")
                                                       End Try
                                                   End Sub

                ' ✅ STATELESS: Registra gli handler sull'EventEmitter condiviso
                Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                Console.WriteLine($"[API] ✅ STATELESS: Registering event listeners on shared EventEmitter for session: {sessionId}")
                sharedEmitter.[On]("message", onMessage)
                sharedEmitter.[On]("waitingForInput", onWaitingForInput)
                sharedEmitter.[On]("complete", onComplete)
                sharedEmitter.[On]("error", onError)
                Console.WriteLine($"[API] ✅ STATELESS: Event listeners registered on shared EventEmitter for session: {sessionId}")
                Console.WriteLine($"[API] ✅ STATELESS: Shared EventEmitter listener count - message: {sharedEmitter.ListenerCount("message")}, waitingForInput: {sharedEmitter.ListenerCount("waitingForInput")}")

                ' ✅ STATELESS: Quando la connessione SSE si chiude, imposta SseConnected=False
                context.RequestAborted.Register(Sub()
                                                    Try
                                                        Dim closedSession = SessionManager.GetTaskSession(sessionId)
                                                        If closedSession IsNot Nothing Then
                                                            closedSession.SseConnected = False
                                                            SessionManager.SaveTaskSession(closedSession)
                                                            Console.WriteLine($"[API] ✅ STATELESS: SSE connection closed, flag set to False for session: {sessionId}")
                                                        End If
                                                    Catch
                                                        ' Ignore errors during cleanup
                                                    End Try
                                                End Sub)

                ' ✅ STATELESS: Salva la sessione con gli handler registrati
                SessionManager.SaveTaskSession(session)
                Console.WriteLine($"[API] ✅ STATELESS: Session saved with event listeners for session: {sessionId}")

                ' ✅ STATELESS: Mantieni connessione aperta con heartbeat integrato
                ' Il task in background verrà avviato quando SseConnected diventa True (via Redis Pub/Sub)
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
                    Console.WriteLine($"[API] ✅ STATELESS: SSE connection closed, heartbeat timer disposed for session: {sessionId}")
                End Try
            Catch ex As Exception
                ' ✅ FASE 2: Usa logger invece di Console.WriteLine
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
                    Console.WriteLine($"[MOTORE] ❌ ERROR: Invalid request or empty input")
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                Dim session = SessionManager.GetTaskSession(sessionId)

                If session Is Nothing Then
                    Console.WriteLine($"[API] ERROR: Session not found: {sessionId}")
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If

                Console.WriteLine($"[MOTORE] 📥 Input received: '{request.Input}', SessionId={sessionId}")

                ' ✅ STEP 1: Verifica che TaskInstance esista
                If session.TaskInstance Is Nothing Then
                    Console.WriteLine($"[MOTORE] ❌ ERROR: TaskInstance is Nothing")
                    Return Results.BadRequest(New With {.error = "TaskInstance not initialized"})
                End If

                ' ✅ STEP 2: Ottieni il task corrente (quello che sta aspettando input)
                Dim currTaskNode = session.TaskEngine.GetNextTask(session.TaskInstance)
                If currTaskNode Is Nothing Then
                    Console.WriteLine($"[MOTORE] ❌ ERROR: GetNextTask returned Nothing (no task waiting for input)")
                    Return Results.BadRequest(New With {.error = "No task waiting for input"})
                End If
                Console.WriteLine($"[MOTORE] 📍 Current node: Id={currTaskNode.Id}, State={currTaskNode.State}")

                ' ✅ STEP 3: Invia input al Parser (thread-safe, Shared method)
                Parser.SetUserInput(request.Input)

                ' ✅ STEP 4: Processa l'input con il Parser
                Dim parseResult = session.TaskEngine.Parser.InterpretUtterance(currTaskNode)
                Console.WriteLine($"[MOTORE] 🔍 ParseResult: {parseResult.Result}")

                ' ✅ STEP 5: Aggiorna lo stato del task
                session.TaskEngine.SetState(parseResult, currTaskNode.State, currTaskNode)
                Console.WriteLine($"[MOTORE] 🔄 State updated: {currTaskNode.State}")

                ' ✅ STEP 6: Assicurati che gli handler siano collegati prima di eseguire il task
                SessionManager.AttachTaskEngineHandlers(session)

                ' ✅ DISABLED: STEP 7: Continua l'esecuzione del motore
                Console.WriteLine($"[MOTORE] ⚠️  EXECUTION DISABLED: ExecuteTask is commented out for debugging")
                ' session.TaskEngine.ExecuteTask(session.TaskInstance)
                ' Console.WriteLine($"[MOTORE] ✅ ExecuteTask completed")

                ' ✅ STATELESS: Salva la sessione su Redis dopo l'esecuzione (include eventuali messaggi del SuccessResponse)
                ' Nota: I messaggi del SuccessResponse vengono emessi durante ExecuteTask tramite MessageToShow event,
                ' che li aggiunge a session.Messages e li emette sull'EventEmitter. Questo salvataggio cattura tutti i messaggi.
                SessionManager.SaveTaskSession(session)
                Console.WriteLine($"[MOTORE] 💾 Session saved, Messages.Count={session.Messages.Count}")

                ' ✅ STATELESS: Verifica se tutti i task sono completati e emetti evento "complete"
                Dim allCompleted = session.TaskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
                Console.WriteLine($"[MOTORE] ✅ All tasks completed: {allCompleted}")
                If allCompleted Then
                    Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                    Dim completeData = New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                    sharedEmitter.Emit("complete", completeData)
                    Console.WriteLine($"[MOTORE] 🎉 Complete event emitted for session: {sessionId}")
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
