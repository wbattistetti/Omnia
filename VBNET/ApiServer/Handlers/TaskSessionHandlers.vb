Option Strict On
Option Explicit On
Imports System.IO
Imports System.Threading.Tasks
Imports ApiServer.Converters
Imports ApiServer.Helpers
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
        ''' <summary>
        ''' Reads and parses the request body for task session start
        ''' </summary>
        Private Async Function ReadAndParseRequest(context As HttpContext) As Task(Of (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String))
            Console.WriteLine("🔵 [ReadAndParseRequest] ENTRY")
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

                Console.WriteLine($"🔵 [ReadAndParseRequest] Deserialization successful: TaskId={If(request IsNot Nothing, request.TaskId, "Nothing")}")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] Deserialization successful: TaskId={If(request IsNot Nothing, request.TaskId, "Nothing")}")
                Console.Out.Flush()

                Return (True, request, Nothing)
            Catch ex As Exception
                Console.WriteLine($"🔵 [ReadAndParseRequest] EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Console.WriteLine($"🔵 [ReadAndParseRequest] StackTrace: {ex.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"🔵 [ReadAndParseRequest] EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Console.Out.Flush()
                Return (False, Nothing, $"Failed to parse request body as JSON. Error: {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' Creates a new task session and registers it in the SessionManager.
        ''' </summary>
        ''' <param name="compiledTask">The compiled task containing the runtime properties.</param>
        ''' <param name="translations">Dictionary of translations for the session (OBBLIGATORIO).</param>
        ''' <param name="language">Language code for the session (OBBLIGATORIO).</param>
        ''' <returns>The session ID of the newly created session.</returns>
        Private Function CreateTaskSession(compiledTask As Compiler.CompiledUtteranceTask, translations As Dictionary(Of String, String), language As String) As String
            Console.WriteLine($"[API] CreateTaskSession ENTRY: TaskId={compiledTask.Id}, Language={language}")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession ENTRY: TaskId={compiledTask.Id}, Language={language}")
            Console.Out.Flush()
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"[API] CreateTaskSession: Generated sessionId={sessionId}")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Generated sessionId={sessionId}")
            Console.Out.Flush()
            Console.WriteLine($"[API] CreateTaskSession: Converting CompiledTask to RuntimeTask...")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Converting CompiledTask to RuntimeTask...")
            Console.Out.Flush()
            Dim runtimeTask = RuntimeTaskConverter.ConvertCompiledToRuntimeTask(compiledTask)
            Console.WriteLine($"[API] CreateTaskSession: Calling SessionManager.CreateTaskSession...")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Calling SessionManager.CreateTaskSession...")
            Console.Out.Flush()
            SessionManager.CreateTaskSession(sessionId, runtimeTask, language, translations)
            Console.WriteLine($"[API] Session created: {sessionId}, TaskId={compiledTask.Id}, Language={language}")
            System.Diagnostics.Debug.WriteLine($"[API] Session created: {sessionId}, TaskId={compiledTask.Id}, Language={language}")
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

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Accesso a request.TaskId per log iniziale
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.TaskId for initial log...")
                Console.Out.Flush()
                Dim taskIdForLog As String = Nothing
                Try
                    taskIdForLog = request.TaskId
                    Console.WriteLine($"🔴 [DIAG] OK: request.TaskId accessed = '{taskIdForLog}'")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.TaskId: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.TaskId: {ex.Message}", 500)
                End Try

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Accesso a request.TaskTree per log iniziale
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.TaskTree for initial log...")
                Console.Out.Flush()
                Dim taskTreeForLog As JObject = Nothing
                Try
                    taskTreeForLog = request.TaskTree
                    Console.WriteLine($"🔴 [DIAG] OK: request.TaskTree accessed, IsNothing={taskTreeForLog Is Nothing}")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.TaskTree: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.TaskTree: {ex.Message}", 500)
                End Try

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Before Request parsed
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE Request parsed — MUST APPEAR")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] BEFORE Request parsed — MUST APPEAR")
                Console.Out.Flush()

                Console.WriteLine($"🔵 [HandleTaskSessionStart] Request parsed: TaskId={taskIdForLog}, HasTaskTree={taskTreeForLog IsNot Nothing}")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleTaskSessionStart] Request parsed: TaskId={taskIdForLog}, HasTaskTree={taskTreeForLog IsNot Nothing}")
                Console.Out.Flush()

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: After Request parsed
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] AFTER Request parsed — MUST APPEAR")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] AFTER Request parsed — MUST APPEAR")
                Console.Out.Flush()

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Before ValidateRequest
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE ValidateRequest call")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] BEFORE ValidateRequest call")
                Console.Out.Flush()

                Dim validationResult As (IsValid As Boolean, ErrorMessage As String)
                Try
                    validationResult = RequestValidators.ValidateRequest(request)
                    Console.WriteLine($"🔴 [DIAG] OK: ValidateRequest completed, IsValid={validationResult.IsValid}")
                    System.Diagnostics.Debug.WriteLine($"🔴 [DIAG] OK: ValidateRequest completed, IsValid={validationResult.IsValid}")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔴 [DIAG] EXCEPTION in ValidateRequest: {ex.ToString()}")
                    System.Diagnostics.Debug.WriteLine($"🔴 [DIAG] EXCEPTION in ValidateRequest: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception in ValidateRequest: {ex.Message}", 500)
                End Try

                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: After ValidateRequest try/catch
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] AFTER ValidateRequest try/catch — MUST APPEAR")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] AFTER ValidateRequest try/catch — MUST APPEAR")
                Console.Out.Flush()

                Console.WriteLine("🔴 [DIAG] BEFORE accessing validationResult.IsValid")
                System.Diagnostics.Debug.WriteLine("🔴 [DIAG] BEFORE accessing validationResult.IsValid")
                Console.Out.Flush()

                Dim isValidValue As Boolean = validationResult.IsValid
                Console.WriteLine($"🔴 [DIAG] OK: validationResult.IsValid accessed = {isValidValue}")
                System.Diagnostics.Debug.WriteLine($"🔴 [DIAG] OK: validationResult.IsValid accessed = {isValidValue}")
                Console.Out.Flush()

                Console.WriteLine($"🔵 [HandleTaskSessionStart] Validation.IsValid: {isValidValue}")
                Console.Out.Flush()

                If Not validationResult.IsValid Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] Validation failed, returning error")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(validationResult.ErrorMessage, 400)
                End If

                ' ✅ STEP 1: Valida lingua OBBLIGATORIA (prima di tutto)
                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Accesso a request.Language
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.Language...")
                Console.Out.Flush()
                Dim languageValue As String = Nothing
                Try
                    languageValue = request.Language
                    Console.WriteLine($"🔴 [DIAG] OK: request.Language accessed = '{languageValue}'")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.Language: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.Language: {ex.Message}", 500)
                End Try

                Console.WriteLine($"🔵 [HandleTaskSessionStart] Validating language: '{languageValue}'")
                Console.Out.Flush()

                If String.IsNullOrWhiteSpace(languageValue) Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] Language empty, returning error")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(
                        "Language is required and cannot be empty. The session cannot start without a valid language.",
                        400
                    )
                End If
                Dim language As String = languageValue.Trim()

                ' ✅ STEP 2: Valida traduzioni OBBLIGATORIE (ma non ancora validate contro il grafo)
                ' ═══════════════════════════════════════════════════════════════
                ' DIAGNOSTIC: Accesso a request.Translations
                ' ═══════════════════════════════════════════════════════════════
                Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.Translations...")
                Console.Out.Flush()
                Dim translationsValue As Dictionary(Of String, String) = Nothing
                Try
                    translationsValue = request.Translations
                    Console.WriteLine($"🔴 [DIAG] OK: request.Translations accessed, IsNothing={translationsValue Is Nothing}")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.Translations: {ex.ToString()}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.Translations: {ex.Message}", 500)
                End Try

                Console.WriteLine($"🔵 [HandleTaskSessionStart] Validating translations: Count={If(translationsValue IsNot Nothing, translationsValue.Count, 0)}")
                Console.Out.Flush()

                If translationsValue Is Nothing OrElse translationsValue.Count = 0 Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] Translations empty, returning error")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(
                        "Translations dictionary is required and cannot be empty. The session cannot start without translations.",
                        400
                    )
                End If

                Dim compiledTask As Compiler.CompiledUtteranceTask = Nothing

                If taskTreeForLog IsNot Nothing Then
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] TaskTree path: Starting compilation...")
                    Console.Out.Flush()

                    ' Dichiarare variabili fuori dal Try per renderle accessibili nel Catch
                    Dim taskIdForConversion As String = Nothing
                    Dim taskIdForCompilation As String = Nothing
                    Dim projectIdForCompilation As String = Nothing

                    Try
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Converting TaskTree to TaskTreeExpanded...")
                        Console.Out.Flush()

                        ' ═══════════════════════════════════════════════════════════════
                        ' DIAGNOSTIC: Accesso a request.TaskId per ConvertTaskTreeToTaskTreeExpanded
                        ' ═══════════════════════════════════════════════════════════════
                        Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.TaskInstanceId/TaskId for ConvertTaskTreeToTaskTreeExpanded...")
                        Console.Out.Flush()
                        Try
                            ' ✅ Estrai taskInstanceId dal request (o usa taskId come fallback)
                            taskIdForConversion = If(String.IsNullOrWhiteSpace(request.TaskInstanceId), request.TaskId, request.TaskInstanceId)
                            Console.WriteLine($"🔴 [DIAG] OK: taskInstanceId extracted = '{taskIdForConversion}' (from TaskInstanceId={request.TaskInstanceId}, TaskId={request.TaskId})")
                            Console.Out.Flush()
                        Catch ex As Exception
                            Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.TaskInstanceId/TaskId: {ex.ToString()}")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.TaskInstanceId/TaskId: {ex.Message}", 500)
                        End Try

                        Dim taskTreeExpanded = TaskTreeConverter.ConvertTaskTreeToTaskTreeExpanded(taskTreeForLog, taskIdForConversion)

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] TaskTreeExpanded: IsNothing={taskTreeExpanded Is Nothing}")
                        Console.Out.Flush()

                        If taskTreeExpanded Is Nothing Then
                            Console.WriteLine($"🔵 [HandleTaskSessionStart] Conversion failed, returning error")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Failed to convert TaskTree to TaskTreeExpanded for task '{taskIdForConversion}'.", 400)
                        End If

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Compiling TaskTreeExpanded...")
                        Console.Out.Flush()

                        ' ═══════════════════════════════════════════════════════════════
                        ' DIAGNOSTIC: Accesso a request.ProjectId per CompileTaskTreeExpandedToCompiledTask
                        ' ═══════════════════════════════════════════════════════════════
                        Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.ProjectId for CompileTaskTreeExpandedToCompiledTask...")
                        Console.Out.Flush()
                        Try
                            projectIdForCompilation = request.ProjectId
                            Console.WriteLine($"🔴 [DIAG] OK: request.ProjectId accessed = '{projectIdForCompilation}'")
                            Console.Out.Flush()
                        Catch ex As Exception
                            Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.ProjectId: {ex.ToString()}")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.ProjectId: {ex.Message}", 500)
                        End Try

                        ' ═══════════════════════════════════════════════════════════════
                        ' DIAGNOSTIC: Accesso a request.TaskId per CompileTaskTreeExpandedToCompiledTask
                        ' ═══════════════════════════════════════════════════════════════
                        Console.WriteLine("🔴 [DIAG] BEFORE: Accessing request.TaskId for CompileTaskTreeExpandedToCompiledTask...")
                        Console.Out.Flush()
                        Try
                            taskIdForCompilation = request.TaskId
                            Console.WriteLine($"🔴 [DIAG] OK: request.TaskId accessed = '{taskIdForCompilation}'")
                            Console.Out.Flush()
                        Catch ex As Exception
                            Console.WriteLine($"🔴 [DIAG] EXCEPTION accessing request.TaskId: {ex.ToString()}")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Exception accessing request.TaskId: {ex.Message}", 500)
                        End Try

                        Dim compileResult = Await TaskCompilationService.CompileTaskTreeExpandedToCompiledTask(taskTreeExpanded, translationsValue, projectIdForCompilation, taskIdForCompilation)

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] CompileResult: IsNothing={compileResult Is Nothing}, Success={If(compileResult IsNot Nothing, compileResult.Success, False)}")
                        Console.Out.Flush()

                        If compileResult Is Nothing Then
                            Console.WriteLine($"🔵 [HandleTaskSessionStart] CompileResult is Nothing, returning error")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse("Compilation failed: compileResult is Nothing", 500)
                        End If

                        If Not compileResult.Success Then
                            Console.WriteLine($"🔵 [HandleTaskSessionStart] Compilation failed: {compileResult.ErrorMessage}")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Compilation failed for task '{taskIdForCompilation}'. Error: {compileResult.ErrorMessage}", 500)
                        End If

                        If compileResult.Result Is Nothing Then
                            Console.WriteLine($"🔵 [HandleTaskSessionStart] CompileResult.Result is Nothing, returning error")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse($"Compilation succeeded but returned no task for task '{taskIdForCompilation}'.", 500)
                        End If

                        compiledTask = compileResult.Result
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Compilation successful: TaskId={compiledTask.Id}")
                        Console.Out.Flush()

                        ' ✅ STEP 3: ORA abbiamo il CompiledUtteranceTask → converti in RuntimeTask per validazione
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Converting to RuntimeTask for validation...")
                        Console.Out.Flush()
                        Dim runtimeTask = RuntimeTaskConverter.ConvertCompiledToRuntimeTask(compiledTask)

                        ' ✅ STEP 4: Validazione FORTE traduzioni contro il grafo compilato
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Validating translations against graph...")
                        Console.Out.Flush()
                        Dim translationValidationResult = SessionManager.ValidateTranslations(runtimeTask, translationsValue)

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] TranslationValidation.IsValid: {translationValidationResult.IsValid}")
                        Console.Out.Flush()

                        If Not translationValidationResult.IsValid Then
                            Console.WriteLine($"🔵 [HandleTaskSessionStart] Translation validation failed: {translationValidationResult.ErrorMessage}")
                            Console.Out.Flush()
                            Return ResponseHelpers.CreateErrorResponse(
                                $"Translation validation failed: {translationValidationResult.ErrorMessage}. The session cannot start with incomplete translations.",
                                400
                            )
                        End If

                        ' ✅ STEP 5: Solo se validazione passata → crea sessione
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Creating session...")
                        Console.Out.Flush()
                        Dim newSessionId = CreateTaskSession(compiledTask, translationsValue, language)

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Session created: sessionId={newSessionId}")
                        Console.Out.Flush()

                        Dim responseObj = New With {
                            .sessionId = newSessionId,
                            .taskId = taskIdForCompilation,
                            .language = language
                        }

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Creating success response...")
                        Console.Out.Flush()
                        Dim successResponse = ResponseHelpers.CreateSuccessResponse(responseObj)

                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Success response created, returning...")
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] Response type: {If(successResponse IsNot Nothing, successResponse.GetType().Name, "Nothing")}")
                        Console.Out.Flush()

                        Return successResponse
                    Catch ex As Exception
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] EXCEPTION in TaskTree path: {ex.GetType().Name} - {ex.Message}")
                        Console.WriteLine($"🔵 [HandleTaskSessionStart] StackTrace: {ex.StackTrace}")
                        Console.Out.Flush()
                        Dim taskIdForError As String = If(taskIdForCompilation IsNot Nothing, taskIdForCompilation, If(taskIdForConversion IsNot Nothing, taskIdForConversion, taskIdForLog))
                        Return ResponseHelpers.CreateErrorResponse($"Failed to process TaskTree for task '{taskIdForError}'. Error: {ex.Message}", 400)
                    End Try
                Else
                    ' ❌ ERRORE BLOCCANTE: TaskTree è OBBLIGATORIO, nessun fallback database
                    Console.WriteLine($"🔵 [HandleTaskSessionStart] TaskTree is Nothing, returning error")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse(
                        "TaskTree is required and cannot be empty. The session cannot start without a valid TaskTree. Database fallback is not supported.",
                        400
                    )
                End If

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
        Public Async Function HandleTaskSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
            Try
                Console.WriteLine($"[API] SSE connection opened for session: {sessionId}")

                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    Console.WriteLine($"[API] ERROR: Session not found: {sessionId}")
                    context.Response.StatusCode = 404
                    Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                    Return
                End If

                ' Setup SSE headers
                context.Response.ContentType = "text/event-stream"
                context.Response.Headers.Add("Cache-Control", "no-cache")
                context.Response.Headers.Add("Connection", "keep-alive")
                context.Response.Headers.Add("X-Accel-Buffering", "no")
                Await context.Response.Body.FlushAsync()

                Dim writer As New StreamWriter(context.Response.Body)

                ' Send existing messages first
                For Each msg In session.Messages
                    Await writer.WriteLineAsync($"event: message")
                    Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(msg)}")
                    Await writer.WriteLineAsync()
                    Await writer.FlushAsync()
                Next

                ' Send waitingForInput event if already waiting
                If session.IsWaitingForInput Then
                    Dim jsonData = JsonConvert.SerializeObject(session.WaitingForInputData)
                    Console.WriteLine($"[API] Sending initial waitingForInput event (session already waiting)")
                    Console.WriteLine($"[API] JSON data: {jsonData}")
                    Console.WriteLine($"[API] JSON length: {jsonData.Length}")

                    Await writer.WriteLineAsync($"event: waitingForInput")
                    Await writer.WriteLineAsync($"data: {jsonData}")
                    Await writer.WriteLineAsync()
                    Await writer.FlushAsync()

                    Console.WriteLine($"[API] Initial waitingForInput event sent successfully")
                End If

                ' Register event handlers
                Dim onMessage As Action(Of Object) = Sub(data)
                                                         System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                             Try
                                                                                                 Await writer.WriteLineAsync($"event: message")
                                                                                                 Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                                                 Await writer.WriteLineAsync()
                                                                                                 Await writer.FlushAsync()
                                                                                             Catch ex As Exception
                                                                                                 Console.WriteLine($"[API] ERROR: SSE error sending message: {ex.Message}")
                                                                                             End Try
                                                                                         End Function)
                                                     End Sub

                Dim onWaitingForInput As Action(Of Object) = Sub(data)
                                                                 System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                                     Try
                                                                                                         session.IsWaitingForInput = True
                                                                                                         session.WaitingForInputData = data

                                                                                                         Dim jsonData = JsonConvert.SerializeObject(data)
                                                                                                         Console.WriteLine($"[API] Sending waitingForInput event")
                                                                                                         Console.WriteLine($"[API] JSON data: {jsonData}")
                                                                                                         Console.WriteLine($"[API] JSON length: {jsonData.Length}")

                                                                                                         Await writer.WriteLineAsync($"event: waitingForInput")
                                                                                                         Await writer.WriteLineAsync($"data: {jsonData}")
                                                                                                         Await writer.WriteLineAsync()
                                                                                                         Await writer.FlushAsync()

                                                                                                         Console.WriteLine($"[API] waitingForInput event sent successfully")
                                                                                                     Catch ex As Exception
                                                                                                         Console.WriteLine($"[API] ERROR: SSE error sending waitingForInput: {ex.GetType().Name} - {ex.Message}")
                                                                                                         Console.WriteLine($"[API] ERROR: Stack trace: {ex.StackTrace}")
                                                                                                     End Try
                                                                                                 End Function)
                                                             End Sub

                Dim onComplete As Action(Of Object) = Sub(data)
                                                          System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                              Try
                                                                                                  Await writer.WriteLineAsync($"event: complete")
                                                                                                  Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                                                  Await writer.WriteLineAsync()
                                                                                                  Await writer.FlushAsync()
                                                                                                  writer.Close()
                                                                                              Catch ex As Exception
                                                                                                  Console.WriteLine($"[API] ERROR: SSE error sending complete: {ex.Message}")
                                                                                              End Try
                                                                                          End Function)
                                                      End Sub

                Dim onError As Action(Of Object) = Sub(data)
                                                       System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                           Try
                                                                                               Await writer.WriteLineAsync($"event: error")
                                                                                               Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                                               Await writer.WriteLineAsync()
                                                                                               Await writer.FlushAsync()
                                                                                               writer.Close()
                                                                                           Catch ex As Exception
                                                                                               Console.WriteLine($"[API] ERROR: SSE error sending error: {ex.Message}")
                                                                                           End Try
                                                                                       End Function)
                                                   End Sub

                ' Register listeners
                session.EventEmitter.[On]("message", onMessage)
                session.EventEmitter.[On]("waitingForInput", onWaitingForInput)
                session.EventEmitter.[On]("complete", onComplete)
                session.EventEmitter.[On]("error", onError)

                context.RequestAborted.Register(Sub()
                                                    Console.WriteLine($"[API] SSE connection closed for session: {sessionId}")
                                                    session.EventEmitter.RemoveListener("message", onMessage)
                                                    session.EventEmitter.RemoveListener("waitingForInput", onWaitingForInput)
                                                    session.EventEmitter.RemoveListener("complete", onComplete)
                                                    session.EventEmitter.RemoveListener("error", onError)
                                                End Sub)

                ' Keep connection alive (heartbeat every 30 seconds)
                Dim heartbeatTimer As New System.Threading.Timer(Async Sub(state)
                                                                     Try
                                                                         Await writer.WriteLineAsync($"event: heartbeat")
                                                                         Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(New With {.timestamp = DateTime.UtcNow.ToString("O")})}")
                                                                         Await writer.WriteLineAsync()
                                                                         Await writer.FlushAsync()
                                                                     Catch ex As Exception
                                                                         ' Connection closed
                                                                     End Try
                                                                 End Sub, Nothing, TimeSpan.FromSeconds(30), TimeSpan.FromSeconds(30))

                ' Wait for connection to close
                Try
                    Await System.Threading.Tasks.Task.Delay(System.Threading.Timeout.Infinite, context.RequestAborted)
                Catch ex As System.Threading.Tasks.TaskCanceledException
                    ' Connection closed normally
                Finally
                    heartbeatTimer.Dispose()
                End Try
            Catch ex As Exception
                Console.WriteLine($"[API] ERROR: HandleTaskSessionStream exception: {ex.GetType().Name} - {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
            Console.WriteLine($"[DIAG] HandleTaskSessionInput ENTRY: sessionId={sessionId}")
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                Dim request = JsonConvert.DeserializeObject(Of TaskSessionInputRequest)(body)

                Console.WriteLine($"[DIAG] Request parsed: Input='{If(request IsNot Nothing, request.Input, "Nothing")}'")

                If request Is Nothing OrElse String.IsNullOrEmpty(request.Input) Then
                    Console.WriteLine($"[API] ERROR: Invalid request or empty input for session {sessionId}")
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                Dim session = SessionManager.GetTaskSession(sessionId)
                Console.WriteLine($"[DIAG] Session found: IsNothing={session Is Nothing}, TaskEngine IsNothing={If(session IsNot Nothing, session.TaskEngine Is Nothing, True)}")

                If session Is Nothing Then
                    Console.WriteLine($"[API] ERROR: Session not found: {sessionId}")
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If

                Console.WriteLine($"[DIAG] HandleTaskSessionInput: Input received='{request.Input}', SessionId={sessionId}")
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: IsWaitingForInput={session.IsWaitingForInput}")

                ' ✅ STEP 1: Verifica che TaskInstance esista
                If session.TaskInstance Is Nothing Then
                    Console.WriteLine($"[DIAG] HandleTaskSessionInput: ERROR - TaskInstance is Nothing")
                    Return Results.BadRequest(New With {.error = "TaskInstance not initialized"})
                End If
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: TaskInstance found, TaskList.Count={session.TaskInstance.TaskList.Count}")

                ' ✅ STEP 2: Ottieni il task corrente (quello che sta aspettando input)
                Dim currTaskNode = session.TaskEngine.GetNextTask(session.TaskInstance)
                If currTaskNode Is Nothing Then
                    Console.WriteLine($"[DIAG] HandleTaskSessionInput: ERROR - GetNextTask returned Nothing (no task waiting for input)")
                    Return Results.BadRequest(New With {.error = "No task waiting for input"})
                End If
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: Current task node: Id={currTaskNode.Id}, State={currTaskNode.State}")

                ' ✅ STEP 3: Invia input al Parser (thread-safe, Shared method)
                Parser.SetUserInput(request.Input)
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: Input sent to Parser via SetUserInput")

                ' ✅ STEP 4: Processa l'input con il Parser
                Dim parseResult = session.TaskEngine.Parser.InterpretUtterance(currTaskNode)
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: ParseResult received: {parseResult.Result}")

                ' ✅ STEP 5: Aggiorna lo stato del task
                session.TaskEngine.SetState(parseResult, currTaskNode.State, currTaskNode)
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: Task state updated: {currTaskNode.State}")

                ' ✅ STEP 6: Continua l'esecuzione del motore
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: About to call ExecuteTask to continue execution")
                session.TaskEngine.ExecuteTask(session.TaskInstance)
                Console.WriteLine($"[DIAG] HandleTaskSessionInput: ExecuteTask completed")

                ' Clear waiting state
                session.IsWaitingForInput = False
                session.WaitingForInputData = Nothing

                Return Results.Ok(New With {
                    .success = True,
                    .timestamp = DateTime.UtcNow.ToString("O")
                })
            Catch ex As Exception
                Console.WriteLine($"[API] ERROR: HandleTaskSessionInput exception: {ex.GetType().Name} - {ex.Message}")
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
