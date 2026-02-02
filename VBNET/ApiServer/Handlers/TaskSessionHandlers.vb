Option Strict On
Option Explicit On
Imports System.IO
Imports ApiServer.Converters
Imports ApiServer.Helpers
Imports ApiServer.Models
Imports ApiServer.Services
Imports ApiServer.Validators
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles task session-related API endpoints (Chat Simulator)
    ''' </summary>
    Public Module TaskSessionHandlers
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

                Dim request = JsonConvert.DeserializeObject(Of TaskSessionStartRequest)(body, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })

                Return (True, request, Nothing)
            Catch ex As Exception
                Return (False, Nothing, $"Failed to parse request body as JSON. Error: {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' Creates a new task session and registers it in the SessionManager.
        ''' </summary>
        ''' <param name="compiledTask">The compiled task containing the runtime properties.</param>
        ''' <param name="translations">Optional dictionary of translations for the session.</param>
        ''' <returns>The session ID of the newly created session.</returns>
        Private Function CreateTaskSession(compiledTask As Compiler.CompiledUtteranceTask, translations As Dictionary(Of String, String)) As String
            Console.WriteLine($"[API] CreateTaskSession ENTRY: TaskId={compiledTask.Id}")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession ENTRY: TaskId={compiledTask.Id}")
            Console.Out.Flush()
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"[API] CreateTaskSession: Generated sessionId={sessionId}")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Generated sessionId={sessionId}")
            Console.Out.Flush()
            Dim translationsDict = If(translations, New Dictionary(Of String, String)())
            Console.WriteLine($"[API] CreateTaskSession: Converting CompiledTask to RuntimeTask...")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Converting CompiledTask to RuntimeTask...")
            Console.Out.Flush()
            Dim runtimeTask = RuntimeTaskConverter.ConvertCompiledToRuntimeTask(compiledTask)
            Console.WriteLine($"[API] CreateTaskSession: Calling SessionManager.CreateTaskSession...")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession: Calling SessionManager.CreateTaskSession...")
            Console.Out.Flush()
            SessionManager.CreateTaskSession(sessionId, runtimeTask, translationsDict)
            Console.WriteLine($"[API] Session created: {sessionId}, TaskId={compiledTask.Id}")
            System.Diagnostics.Debug.WriteLine($"[API] Session created: {sessionId}, TaskId={compiledTask.Id}")
            Console.Out.Flush()
            Return sessionId
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
        ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
        ''' </summary>
        Public Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
            Try
                Dim parseResult = Await ReadAndParseRequest(context)
                If Not parseResult.Success Then
                    Return ResponseHelpers.CreateErrorResponse(parseResult.ErrorMessage, 400)
                End If
                Dim request = parseResult.Request

                Dim validationResult = RequestValidators.ValidateRequest(request)
                If Not validationResult.IsValid Then
                    Return ResponseHelpers.CreateErrorResponse(validationResult.ErrorMessage, 400)
                End If

                Dim compiledTask As Compiler.CompiledUtteranceTask = Nothing

                If request.TaskTree IsNot Nothing Then
                    Console.WriteLine($"[API] Starting session for taskId={request.TaskId} using TaskTree")
                    Try
                        Dim taskTreeExpanded = TaskTreeConverter.ConvertTaskTreeToTaskTreeExpanded(request.TaskTree, request.TaskId)
                        If taskTreeExpanded Is Nothing Then
                            Return ResponseHelpers.CreateErrorResponse($"Failed to convert TaskTree to TaskTreeExpanded for task '{request.TaskId}'.", 400)
                        End If

                        ' ✅ Aggiungi traduzioni al TaskTreeExpanded per la risoluzione dei GUID
                        If request.Translations IsNot Nothing AndAlso request.Translations.Count > 0 Then
                            If taskTreeExpanded.Translations Is Nothing Then
                                taskTreeExpanded.Translations = New Dictionary(Of String, String)()
                            End If
                            For Each kvp In request.Translations
                                taskTreeExpanded.Translations(kvp.Key) = kvp.Value
                            Next
                            Console.WriteLine($"[API] Added {request.Translations.Count} translations to TaskTreeExpanded")
                        End If

                        Dim compileResult = Await TaskCompilationService.CompileTaskTreeExpandedToCompiledTask(taskTreeExpanded, request.Translations, request.ProjectId, request.TaskId)

                        If compileResult Is Nothing Then
                            Return ResponseHelpers.CreateErrorResponse("Compilation failed: compileResult is Nothing", 500)
                        End If

                        If Not compileResult.Success Then
                            Console.WriteLine($"[API] ERROR: Compilation failed for task {request.TaskId}: {compileResult.ErrorMessage}")
                            Return ResponseHelpers.CreateErrorResponse($"Compilation failed for task '{request.TaskId}'. Error: {compileResult.ErrorMessage}", 500)
                        End If

                        If compileResult.Result Is Nothing Then
                            Console.WriteLine($"[API] ERROR: Compilation succeeded but Result is Nothing for task {request.TaskId}")
                            Return ResponseHelpers.CreateErrorResponse($"Compilation succeeded but returned no task for task '{request.TaskId}'.", 500)
                        End If

                        compiledTask = compileResult.Result
                    Catch ex As Exception
                        Console.WriteLine($"[API] ERROR: Exception processing TaskTree for task {request.TaskId}: {ex.GetType().Name} - {ex.Message}")
                        Return ResponseHelpers.CreateErrorResponse($"Failed to process TaskTree for task '{request.TaskId}'. Error: {ex.Message}", 400)
                    End Try
                Else
                    Console.WriteLine($"[API] Loading task {request.TaskId} from database (fallback)")

                    ' 3. Fetch tasks from Node.js
                    Dim fetchResult = Await TaskDataService.FetchTasksFromNodeJs(request.ProjectId)
                    If Not fetchResult.Success Then
                        Return ResponseHelpers.CreateErrorResponse(fetchResult.ErrorMessage, 400)
                    End If
                    Dim tasksArray = fetchResult.TasksArray

                    ' 4. Find task by ID
                    Dim taskObj = TaskDataService.FindTaskById(tasksArray, request.TaskId)
                    If taskObj Is Nothing Then
                        Return ResponseHelpers.CreateErrorResponse($"Task with ID '{request.TaskId}' was not found in project '{request.ProjectId}'. The task may have been deleted or the ID may be incorrect.", 400)
                    End If

                    ' 5. Find template for task
                    Dim templateResult = TaskDataService.FindTemplateForTask(tasksArray, taskObj, request.TaskId)
                    Dim templateObj = templateResult.TemplateObj
                    Dim templateId = templateResult.TemplateId

                    ' 6. Load all sub-templates recursively
                    Dim loadedTemplateIds As New HashSet(Of String)()
                    Dim allTemplatesList As New List(Of JObject)()

                    If templateObj IsNot Nothing Then
                        allTemplatesList.Add(templateObj)
                        loadedTemplateIds.Add(templateId)
                    End If

                    If taskObj IsNot Nothing AndAlso Not loadedTemplateIds.Contains(request.TaskId) Then
                        allTemplatesList.Add(taskObj)
                        loadedTemplateIds.Add(request.TaskId)
                    End If

                    If templateObj IsNot Nothing Then
                        TaskDataService.LoadSubTemplatesRecursively(tasksArray, templateObj, loadedTemplateIds, allTemplatesList)
                    End If

                    ' 7. Deserialize all templates
                    Dim deserializeResult = TaskDataService.DeserializeTasks(allTemplatesList)
                    If Not deserializeResult.Success Then
                        Return ResponseHelpers.CreateErrorResponse(deserializeResult.ErrorMessage, 400)
                    End If
                    Dim allTemplates = deserializeResult.Tasks

                    ' 8. Find main task and template in deserialized list
                    Dim task = allTemplates.FirstOrDefault(Function(t) t.Id = request.TaskId)
                    Dim template = allTemplates.FirstOrDefault(Function(t) t.Id = templateId)

                    If task Is Nothing Then
                        Return ResponseHelpers.CreateErrorResponse($"Failed to deserialize task with ID '{request.TaskId}'. The task JSON may be malformed.", 400)
                    End If

                    If template Is Nothing Then
                        Return ResponseHelpers.CreateErrorResponse($"Failed to deserialize template with ID '{templateId}' for task '{request.TaskId}'. The template JSON may be malformed.", 400)
                    End If

                    ' Ensure task has templateId
                    If String.IsNullOrEmpty(task.TemplateId) Then
                        task.TemplateId = template.Id
                    End If

                    ' 9. Validate task type
                    Dim typeValidationResult = RequestValidators.ValidateTaskType(task)
                    If Not typeValidationResult.IsValid Then
                        Return ResponseHelpers.CreateErrorResponse(typeValidationResult.ErrorMessage, 400)
                    End If

                    ' 10. Compile task
                    Dim compileResult = TaskCompilationService.CompileTaskToRuntime(task, allTemplates)
                    If Not compileResult.Success Then
                        Return ResponseHelpers.CreateErrorResponse(compileResult.ErrorMessage, 400)
                    End If
                    compiledTask = compileResult.Result
                End If

                If compiledTask Is Nothing Then
                    Console.WriteLine($"[API] ERROR: compiledTask is Nothing - cannot create session")
                    Return ResponseHelpers.CreateErrorResponse("Compiled task is null. The compilation may have failed silently.", 500)
                End If

                Dim sessionId As String = Nothing
                Try
                    Console.WriteLine($"[API] About to call CreateTaskSession for taskId={request.TaskId}")
                    System.Diagnostics.Debug.WriteLine($"[API] About to call CreateTaskSession for taskId={request.TaskId}")
                    Console.Out.Flush()
                    sessionId = CreateTaskSession(compiledTask, request.Translations)
                    Console.WriteLine($"[API] CreateTaskSession returned: sessionId={If(String.IsNullOrEmpty(sessionId), "EMPTY", sessionId)}")
                    System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession returned: sessionId={If(String.IsNullOrEmpty(sessionId), "EMPTY", sessionId)}")
                    Console.Out.Flush()
                    If String.IsNullOrEmpty(sessionId) Then
                        Console.WriteLine($"[API] ERROR: CreateTaskSession returned empty sessionId")
                        System.Diagnostics.Debug.WriteLine($"[API] ERROR: CreateTaskSession returned empty sessionId")
                        Console.Out.Flush()
                        Return ResponseHelpers.CreateErrorResponse("Failed to create session: sessionId is empty.", 500)
                    End If
                Catch ex As Exception
                    Console.WriteLine($"[API] ERROR: Exception in CreateTaskSession: {ex.GetType().Name} - {ex.Message}")
                    Console.WriteLine($"[API] ERROR: Stack trace: {ex.StackTrace}")
                    System.Diagnostics.Debug.WriteLine($"[API] ERROR: Exception in CreateTaskSession: {ex.GetType().Name} - {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"[API] ERROR: Stack trace: {ex.StackTrace}")
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Failed to create session: {ex.Message}", 500)
                End Try

                Dim responseObj = New With {
                    .sessionId = sessionId,
                    .timestamp = DateTime.UtcNow.ToString("O")
                }
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore
                })

                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = jsonResponse.Length
                Await context.Response.WriteAsync(jsonResponse)

                Return Results.Empty

            Catch ex As Exception
                Console.WriteLine($"[API] ERROR: Unhandled exception in HandleTaskSessionStart: {ex.GetType().Name} - {ex.Message}")
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
                    Await writer.WriteLineAsync($"event: waitingForInput")
                    Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(session.WaitingForInputData)}")
                    Await writer.WriteLineAsync()
                    Await writer.FlushAsync()
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
                                                                                                         Await writer.WriteLineAsync($"event: waitingForInput")
                                                                                                         Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                                                         Await writer.WriteLineAsync()
                                                                                                         Await writer.FlushAsync()
                                                                                                     Catch ex As Exception
                                                                                                         Console.WriteLine($"[API] ERROR: SSE error sending waitingForInput: {ex.Message}")
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
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                Dim request = JsonConvert.DeserializeObject(Of TaskSessionInputRequest)(body)

                If request Is Nothing OrElse String.IsNullOrEmpty(request.Input) Then
                    Console.WriteLine($"[API] ERROR: Invalid request or empty input for session {sessionId}")
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    Console.WriteLine($"[API] ERROR: Session not found: {sessionId}")
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If

                Console.WriteLine($"[API] Processing input for session {sessionId}")

                ' TODO: Process input and continue DDT execution
                ' Per ora, solo acknowledge receipt
                ' In futuro, questo dovrebbe:
                ' 1. Passare input al Parser
                ' 2. Continuare esecuzione DDT

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
