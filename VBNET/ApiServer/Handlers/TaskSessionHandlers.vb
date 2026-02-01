Option Strict On
Option Explicit On

Imports System
Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports System.Collections.Generic
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler
Imports TaskEngine
Imports ApiServer.Models
Imports ApiServer.Helpers
Imports ApiServer.Validators
Imports ApiServer.Converters
Imports ApiServer.Services

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
        Private Function CreateTaskSession(compiledTask As Compiler.CompiledTaskUtteranceInterpretation, translations As Dictionary(Of String, String)) As String
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"🔍 [CreateTaskSession] START")
            Console.WriteLine($"   compiledTask IsNot Nothing: {compiledTask IsNot Nothing}")
            If compiledTask IsNot Nothing Then
                Console.WriteLine($"   compiledTask.Id: {compiledTask.Id}")
                Console.WriteLine($"   compiledTask.Steps IsNot Nothing: {compiledTask.Steps IsNot Nothing}")
                Console.WriteLine($"   compiledTask.Steps.Count: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)}")
                Console.WriteLine($"   compiledTask.HasSubTasks: {compiledTask.HasSubTasks()}")
            End If
            Console.WriteLine($"   translations IsNot Nothing: {translations IsNot Nothing}")
            Console.WriteLine($"   translations.Count: {If(translations IsNot Nothing, translations.Count, 0)}")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"🔍 [CreateTaskSession] Generated sessionId: {sessionId}")

            Dim translationsDict = If(translations, New Dictionary(Of String, String)())
            Console.WriteLine($"🔍 [CreateTaskSession] Converting CompiledTaskUtteranceInterpretation to RuntimeTask...")
            ' ✅ TODO: SessionManager deve essere aggiornato per accettare CompiledTaskUtteranceInterpretation
            ' Per ora convertiamo in RuntimeTask (temporaneo)
            Dim runtimeTask = RuntimeTaskConverter.ConvertCompiledToRuntimeTask(compiledTask)
            Console.WriteLine($"✅ [CreateTaskSession] ConvertCompiledToRuntimeTask completed")
            Console.WriteLine($"   runtimeTask.Id: {runtimeTask.Id}")
            Console.WriteLine($"   runtimeTask.Steps.Count: {If(runtimeTask.Steps IsNot Nothing, runtimeTask.Steps.Count, 0)}")
            Console.WriteLine($"   runtimeTask.HasSubTasks: {runtimeTask.HasSubTasks()}")

            Console.WriteLine($"🔍 [CreateTaskSession] Calling SessionManager.CreateTaskSession...")
            SessionManager.CreateTaskSession(sessionId, runtimeTask, translationsDict)
            Console.WriteLine($"✅ [CreateTaskSession] SessionManager.CreateTaskSession completed")
            Console.WriteLine($"🔍 [CreateTaskSession] END - Returning sessionId: {sessionId}")
            Return sessionId
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
        ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
        ''' </summary>
        Public Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"🚀 [HandleTaskSessionStart] FUNCTION CALLED")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.Out.Flush()
            System.Diagnostics.Debug.WriteLine($"🚀 [HandleTaskSessionStart] FUNCTION CALLED")
            Try
                ' 1. Parse request
                Console.WriteLine($"🔍 [HandleTaskSessionStart] Step 1: Parsing request...")
                Console.Out.Flush()
                Dim parseResult = Await ReadAndParseRequest(context)
                If Not parseResult.Success Then
                    Return ResponseHelpers.CreateErrorResponse(parseResult.ErrorMessage, 400)
                End If
                Dim request = parseResult.Request

                ' 2. Validate request
                Dim validationResult = RequestValidators.ValidateRequest(request)
                If Not validationResult.IsValid Then
                    Return ResponseHelpers.CreateErrorResponse(validationResult.ErrorMessage, 400)
                End If

                ' ✅ NUOVO MODELLO: Se TaskTree è presente, usalo direttamente (working copy dalla memoria)
                ' Altrimenti, carica dal database (fallback per compatibilità)
                Dim compiledTask As Compiler.CompiledTaskUtteranceInterpretation = Nothing

                If request.TaskTree IsNot Nothing Then
                    ' ✅ CASO A: Usa TaskTree dalla working copy (fonte di verità)
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"✅ [HandleTaskSessionStart] Using TaskTree from working copy (taskId={request.TaskId})")
                    Console.WriteLine($"🔍 [HandleTaskSessionStart] TaskTree IsNot Nothing: {request.TaskTree IsNot Nothing}")
                    If request.TaskTree IsNot Nothing Then
                        Dim taskTreeKeysList As New List(Of String)()
                        For Each prop In request.TaskTree.Properties()
                            taskTreeKeysList.Add(prop.Name)
                        Next
                        Dim taskTreeKeys = String.Join(", ", taskTreeKeysList)
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] TaskTree JSON keys: {taskTreeKeys}")
                    End If
                    System.Diagnostics.Debug.WriteLine($"✅ [HandleTaskSessionStart] Using TaskTree from working copy")

                    Try
                        ' Converti TaskTree (JSON) in TaskTreeExpanded (AST montato) per il compilatore
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] Calling ConvertTaskTreeToTaskTreeExpanded...")
                        Dim taskTreeExpanded = TaskTreeConverter.ConvertTaskTreeToTaskTreeExpanded(request.TaskTree, request.TaskId)
                        If taskTreeExpanded Is Nothing Then
                            Console.WriteLine($"❌ [HandleTaskSessionStart] ConvertTaskTreeToTaskTreeExpanded returned Nothing")
                            Return ResponseHelpers.CreateErrorResponse($"Failed to convert TaskTree to TaskTreeExpanded for task '{request.TaskId}'.", 400)
                        End If
                        Console.WriteLine($"✅ [HandleTaskSessionStart] ConvertTaskTreeToTaskTreeExpanded succeeded")
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] taskTreeExpanded IsNot Nothing: {taskTreeExpanded IsNot Nothing}")
                        Console.Out.Flush()

                        ' ✅ CORRETTO: Usa UtteranceInterpretationTaskCompiler (compilazione completa)
                        ' Compila TaskTreeExpanded → CompiledTaskUtteranceInterpretation
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] About to Await CompileTaskTreeExpandedToCompiledTask...")
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] Parameters: projectId={request.ProjectId}, taskId={request.TaskId}")
                        Console.Out.Flush()
                        Dim compileResult = Await TaskCompilationService.CompileTaskTreeExpandedToCompiledTask(taskTreeExpanded, request.Translations, request.ProjectId, request.TaskId)
                        Console.WriteLine($"🔍 [HandleTaskSessionStart] Await CompileTaskTreeExpandedToCompiledTask completed")
                        Console.Out.Flush()

                        ' ✅ LOGGING BRUTALE del risultato
                        Console.WriteLine("═══════════════════════════════════════════════════════════════")
                        Console.WriteLine("🔍 [HandleTaskSessionStart] CompileTaskTreeExpandedToCompiledTask result:")
                        Console.WriteLine($"   Success: {compileResult IsNot Nothing AndAlso compileResult.Success}")
                        Console.WriteLine($"   ErrorMessage: {If(compileResult IsNot Nothing, compileResult.ErrorMessage, "compileResult is Nothing")}")
                        Console.WriteLine($"   HasResult: {compileResult IsNot Nothing AndAlso compileResult.Result IsNot Nothing}")
                        If compileResult IsNot Nothing AndAlso compileResult.Result IsNot Nothing Then
                            Console.WriteLine($"   Result Type: {compileResult.Result.GetType().FullName}")
                            Dim utteranceTask = TryCast(compileResult.Result, Compiler.CompiledTaskUtteranceInterpretation)
                            If utteranceTask IsNot Nothing Then
                                Console.WriteLine($"   Steps Count: {If(utteranceTask.Steps IsNot Nothing, utteranceTask.Steps.Count, 0)}")
                                Console.WriteLine($"   HasSubTasks: {utteranceTask.HasSubTasks()}")
                            End If
                        End If
                        Console.WriteLine("═══════════════════════════════════════════════════════════════")
                        Console.Out.Flush()

                        If compileResult Is Nothing Then
                            Return ResponseHelpers.CreateErrorResponse("Compilation failed: compileResult is Nothing", 500)
                        End If

                        If Not compileResult.Success Then
                            Console.WriteLine($"❌ [HandleTaskSessionStart] Compilation failed: {compileResult.ErrorMessage}")
                            Return ResponseHelpers.CreateErrorResponse($"Compilation failed for task '{request.TaskId}'. Error: {compileResult.ErrorMessage}", 500)
                        End If

                        If compileResult.Result Is Nothing Then
                            Console.WriteLine($"❌ [HandleTaskSessionStart] Compilation succeeded but Result is Nothing")
                            Return ResponseHelpers.CreateErrorResponse($"Compilation succeeded but returned no task for task '{request.TaskId}'.", 500)
                        End If

                        compiledTask = compileResult.Result
                    Catch ex As Exception
                        Console.WriteLine("═══════════════════════════════════════════════════════════════")
                        Console.WriteLine("❌ [HandleTaskSessionStart] UNHANDLED EXCEPTION processing TaskTree")
                        Console.WriteLine($"   Type: {ex.GetType().FullName}")
                        Console.WriteLine($"   Message: {ex.Message}")
                        Console.WriteLine($"   StackTrace: {ex.StackTrace}")

                        If ex.InnerException IsNot Nothing Then
                            Console.WriteLine("   ── Inner Exception ──")
                            Console.WriteLine($"   Type: {ex.InnerException.GetType().FullName}")
                            Console.WriteLine($"   Message: {ex.InnerException.Message}")
                            Console.WriteLine($"   StackTrace: {ex.InnerException.StackTrace}")
                        End If

                        ' ✅ Se è JsonSerializationException, logga dettagli aggiuntivi
                        Dim jsonEx = TryCast(ex, JsonSerializationException)
                        If jsonEx IsNot Nothing Then
                            Console.WriteLine("   ── JSON Exception Details ──")
                            Console.WriteLine($"   JSON Path: {jsonEx.Path}")
                            Console.WriteLine($"   LineNumber: {jsonEx.LineNumber}")
                            Console.WriteLine($"   LinePosition: {jsonEx.LinePosition}")
                        End If

                        Console.WriteLine("═══════════════════════════════════════════════════════════════")
                        Console.Out.Flush()
                        Return ResponseHelpers.CreateErrorResponse($"Failed to process TaskTree for task '{request.TaskId}'. Error: {ex.Message}", 400)
                    End Try
                    Console.WriteLine($"🔍 [HandleTaskSessionStart] After Try-Catch block, compiledTask IsNot Nothing: {compiledTask IsNot Nothing}")
                    Console.Out.Flush()
                Else
                    ' ✅ CASO B: Fallback - carica dal database (compatibilità legacy)
                    Console.WriteLine($"⚠️ [HandleTaskSessionStart] TaskTree not provided, loading from database (taskId={request.TaskId})")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [HandleTaskSessionStart] Loading from database (fallback)")

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

                ' 11. Validate compiled task before creating session
                If compiledTask Is Nothing Then
                    Console.WriteLine($"❌ [HandleTaskSessionStart] compiledTask is Nothing - cannot create session")
                    Return ResponseHelpers.CreateErrorResponse("Compiled task is null. The compilation may have failed silently.", 500)
                End If

                ' 12. Create session
                Dim sessionId As String = Nothing
                Try
                    sessionId = CreateTaskSession(compiledTask, request.Translations)
                    If String.IsNullOrEmpty(sessionId) Then
                        Console.WriteLine($"❌ [HandleTaskSessionStart] CreateTaskSession returned empty sessionId")
                        Return ResponseHelpers.CreateErrorResponse("Failed to create session: sessionId is empty.", 500)
                    End If
                    Console.WriteLine($"✅ [HandleTaskSessionStart] Session created successfully: {sessionId}")
                Catch ex As Exception
                    Console.WriteLine($"❌ [HandleTaskSessionStart] Exception in CreateTaskSession: {ex.Message}")
                    Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                    End If
                    Console.Out.Flush()
                    Return ResponseHelpers.CreateErrorResponse($"Failed to create session: {ex.Message}", 500)
                End Try

                ' 12. Return success
                Dim responseObj = New With {
                    .sessionId = sessionId,
                    .timestamp = DateTime.UtcNow.ToString("O")
                }
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore
                })
                Console.WriteLine($"✅ [HandleTaskSessionStart] Session created: {sessionId}")

                ' ✅ Scrivi direttamente nel response stream (come HandleOrchestratorSessionStart)
                ' Questo garantisce che la risposta venga inviata correttamente
                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = jsonResponse.Length
                Await context.Response.WriteAsync(jsonResponse)

                ' ✅ Restituisci Results.Empty dopo aver scritto direttamente
                Return Results.Empty

            Catch ex As Exception
                Console.WriteLine("═══════════════════════════════════════════════════════════════")
                Console.WriteLine("❌ [HandleTaskSessionStart] UNHANDLED EXCEPTION")
                Console.WriteLine($"   Type: {ex.GetType().FullName}")
                Console.WriteLine($"   Message: {ex.Message}")
                Console.WriteLine($"   StackTrace: {ex.StackTrace}")

                If ex.InnerException IsNot Nothing Then
                    Console.WriteLine("   ── Inner Exception ──")
                    Console.WriteLine($"   Type: {ex.InnerException.GetType().FullName}")
                    Console.WriteLine($"   Message: {ex.InnerException.Message}")
                    Console.WriteLine($"   StackTrace: {ex.InnerException.StackTrace}")
                End If

                ' ✅ Se è JsonSerializationException, logga dettagli aggiuntivi
                Dim jsonEx = TryCast(ex, JsonSerializationException)
                If jsonEx IsNot Nothing Then
                    Console.WriteLine("   ── JSON Exception Details ──")
                    Console.WriteLine($"   JSON Path: {jsonEx.Path}")
                    Console.WriteLine($"   LineNumber: {jsonEx.LineNumber}")
                    Console.WriteLine($"   LinePosition: {jsonEx.LinePosition}")
                End If

                Console.WriteLine("═══════════════════════════════════════════════════════════════")
                Console.Out.Flush()
                System.Diagnostics.Debug.WriteLine($"❌ [HandleTaskSessionStart] UNHANDLED EXCEPTION: {ex.GetType().FullName} - {ex.Message}")
                Return ResponseHelpers.CreateErrorResponse($"Unexpected error while starting task session: {ex.Message}", 500)
            End Try
        End Function

        ''' <summary>
        ''' Handles GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
            Try
                Console.WriteLine($"📡 [HandleTaskSessionStream] SSE connection opened for TaskSession: {sessionId}")

                ' Get session
                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    Console.WriteLine($"❌ [HandleTaskSessionStream] TaskSession not found: {sessionId}")
                    context.Response.StatusCode = 404
                    Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                    Return
                End If

                Console.WriteLine($"✅ [HandleTaskSessionStream] TaskSession found: {sessionId}")

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
                                                                                                 Console.WriteLine($"❌ [SSE] Error sending message: {ex.Message}")
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
                                                                                                         Console.WriteLine($"❌ [SSE] Error sending waitingForInput: {ex.Message}")
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
                                                                                                  Console.WriteLine($"❌ [SSE] Error sending complete: {ex.Message}")
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
                                                                                               Console.WriteLine($"❌ [SSE] Error sending error: {ex.Message}")
                                                                                           End Try
                                                                                       End Function)
                                                   End Sub

                ' Register listeners
                session.EventEmitter.[On]("message", onMessage)
                session.EventEmitter.[On]("waitingForInput", onWaitingForInput)
                session.EventEmitter.[On]("complete", onComplete)
                session.EventEmitter.[On]("error", onError)

                ' Cleanup on disconnect
                context.RequestAborted.Register(Sub()
                                                    Console.WriteLine($"✅ [HandleTaskSessionStream] SSE connection closed for TaskSession: {sessionId}")
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
                    Console.WriteLine($"✅ [HandleTaskSessionStream] Connection closed normally for TaskSession: {sessionId}")
                Finally
                    heartbeatTimer.Dispose()
                End Try
            Catch ex As Exception
                Console.WriteLine($"❌ [HandleTaskSessionStream] ERROR: {ex.Message}")
                Console.WriteLine($"Stack trace: {ex.StackTrace}")
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        ''' </summary>
        Public Async Function HandleTaskSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
            Console.WriteLine($"📥 [HandleTaskSessionInput] Received input for TaskSession: {sessionId}")

            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                Dim request = JsonConvert.DeserializeObject(Of TaskSessionInputRequest)(body)

                If request Is Nothing OrElse String.IsNullOrEmpty(request.Input) Then
                    Console.WriteLine("❌ [HandleTaskSessionInput] Invalid request or empty input")
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                ' Get session
                Dim session = SessionManager.GetTaskSession(sessionId)
                If session Is Nothing Then
                    Console.WriteLine($"❌ [HandleTaskSessionInput] TaskSession not found: {sessionId}")
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If

                Console.WriteLine($"✅ [HandleTaskSessionInput] Processing input: {request.Input.Substring(0, Math.Min(100, request.Input.Length))}")

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
                Console.WriteLine($"❌ [HandleTaskSessionInput] Exception: {ex.Message}")
                Console.WriteLine($"Stack trace: {ex.StackTrace}")
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
