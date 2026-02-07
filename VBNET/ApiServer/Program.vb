Option Strict On
Option Explicit On
Imports System.IO
Imports System.Threading
Imports ApiServer.Helpers
Imports ApiServer.Models
Imports ApiServer.Interfaces
Imports ApiServer.Logging
Imports ApiServer.SessionStorage
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Hosting
Imports Microsoft.AspNetCore.Http
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Hosting
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Module Program
    ''' <summary>
    ''' Main entry point - runs ASP.NET Core HTTP server
    ''' </summary>
    Sub Main(args As String())
        Console.WriteLine("🔥🔥🔥 PROGRAM STARTED - THIS IS THE REAL BINARY")
        Console.Out.Flush()
        Console.WriteLine("🚀 [Main] ApiServer starting...")
        Console.WriteLine($"   Args count: {args.Length}")
        RunHttpServerMode(args)
    End Sub

    ''' <summary>
    ''' Runs in HTTP server mode (ASP.NET Core Web API)
    ''' </summary>
    Private Sub RunHttpServerMode(args As String())
        Console.WriteLine("🌐 [RunHttpServerMode] Initializing ASP.NET Core Web API...")
        Try
            Dim builder = WebApplication.CreateBuilder(args)

            ' ✅ FASE 2: Configura Dependency Injection
            ' Registra ILogger come singleton
            Dim logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
            builder.Services.AddSingleton(Of ApiServer.Interfaces.ILogger)(logger)

            ' Registra ISessionStorage come singleton (default: InMemory)
            Dim storage As ApiServer.Interfaces.ISessionStorage = New ApiServer.SessionStorage.InMemorySessionStorage()
            builder.Services.AddSingleton(Of ApiServer.Interfaces.ISessionStorage)(storage)

            ' Configura SessionManager con i servizi registrati
            SessionManager.ConfigureStorage(storage)
            SessionManager.ConfigureLogger(logger)

            ' Configura TaskSessionHandlers con logger
            ApiServer.Handlers.TaskSessionHandlers.ConfigureLogger(logger)

            Console.WriteLine("✅ [FASE 2] Dependency Injection configured: ILogger and ISessionStorage")

            ' Add services
            builder.Services.AddControllers().AddNewtonsoftJson(Sub(options)
                                                                    options.SerializerSettings.NullValueHandling = NullValueHandling.Ignore
                                                                    options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore
                                                                    options.SerializerSettings.Formatting = Formatting.None
                                                                End Sub)
            builder.Services.AddCors(Sub(options)
                                         options.AddDefaultPolicy(Sub(policy)
                                                                      policy.AllowAnyOrigin()
                                                                      policy.AllowAnyMethod()
                                                                      policy.AllowAnyHeader()
                                                                  End Sub)
                                     End Sub)

            Dim app = builder.Build()

            ' Configure pipeline
            app.UseCors()
            Console.WriteLine("🔥 Registering ExceptionLoggingMiddleware...")
            Console.Out.Flush()
            app.UseMiddleware(Of ApiServer.Middleware.ExceptionLoggingMiddleware)()
            Console.WriteLine("✅ ExceptionLoggingMiddleware registered")
            Console.Out.Flush()

            ' Add global exception handler
            app.UseExceptionHandler(Sub(appBuilder)
                                        appBuilder.Run(Async Function(context As HttpContext) As System.Threading.Tasks.Task
                                                           Dim exceptionHandlerPathFeature = context.Features.Get(Of Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature)()
                                                           Dim ex = exceptionHandlerPathFeature?.Error
                                                           If ex IsNot Nothing Then
                                                               Console.WriteLine("═══════════════════════════════════════════════════════════════")
                                                               Console.WriteLine("❌ [GlobalExceptionHandler] UNHANDLED EXCEPTION")
                                                               Console.WriteLine($"   Path: {context.Request.Path}")
                                                               Console.WriteLine($"   Method: {context.Request.Method}")
                                                               Console.WriteLine($"   Type: {ex.GetType().FullName}")
                                                               Console.WriteLine($"   Message: {ex.Message}")
                                                               Console.WriteLine($"   StackTrace: {ex.StackTrace}")

                                                               If ex.InnerException IsNot Nothing Then
                                                                   Console.WriteLine("   ── Inner Exception ──")
                                                                   Console.WriteLine($"   Type: {ex.InnerException.GetType().FullName}")
                                                                   Console.WriteLine($"   Message: {ex.InnerException.Message}")
                                                                   Console.WriteLine($"   StackTrace: {ex.InnerException.StackTrace}")
                                                               End If

                                                               Dim jsonEx = TryCast(ex, JsonSerializationException)
                                                               If jsonEx IsNot Nothing Then
                                                                   Console.WriteLine("   ── JSON Exception Details ──")
                                                                   Console.WriteLine($"   JSON Path: {jsonEx.Path}")
                                                                   Console.WriteLine($"   LineNumber: {jsonEx.LineNumber}")
                                                                   Console.WriteLine($"   LinePosition: {jsonEx.LinePosition}")
                                                               End If

                                                               Console.WriteLine("═══════════════════════════════════════════════════════════════")
                                                               Console.Out.Flush()
                                                           End If
                                                           context.Response.StatusCode = 500
                                                           Await context.Response.WriteAsync("Internal Server Error")
                                                       End Function)
                                    End Sub)

            app.UseRouting()

            ' Map API endpoints (we map manually, so we don't need MapControllers())
            Console.WriteLine("🔥 MapApiEndpoints CALLED")
            Console.Out.Flush()
            MapApiEndpoints(app)

            ' Start server on port 5000
            Console.WriteLine("🚀 ApiServer starting on http://localhost:5000")
            Console.WriteLine("✅ Server is running. Press Ctrl+C to stop.")

            ' Run the server (this blocks until the server is stopped)
            ' Specify URL explicitly to ensure it listens on the correct port
            app.Run("http://localhost:5000")
        Catch ex As Exception
            Console.WriteLine($"❌ Error starting HTTP server: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Throw
        End Try
    End Sub

    ''' <summary>
    ''' Maps all API endpoints
    ''' </summary>
    Private Sub MapApiEndpoints(app As WebApplication)
        ' GET /api/health - Test endpoint
        app.MapGet("/api/health", Function() As IResult
                                      Console.WriteLine("✅ [Health] Health check requested")
                                      Return Results.Ok(New With {.status = "ok", .timestamp = DateTime.UtcNow.ToString("O")})
                                  End Function)

        ' POST /api/runtime/compile - Read body manually to use Newtonsoft.Json (handles string->int conversion)
        app.MapPost("/api/runtime/compile", Function(context As HttpContext) As System.Threading.Tasks.Task
                                                Return ApiServer.Handlers.CompilationHandlers.HandleCompileFlow(context)
                                            End Function)

        ' POST /api/runtime/compile/task - Compile a single task (for chat simulator)
        app.MapPost("/api/runtime/compile/task", Function(context As HttpContext) As System.Threading.Tasks.Task(Of IResult)
                                                     Return ApiServer.Handlers.CompilationHandlers.HandleCompileTask(context)
                                                 End Function)

        ' POST /api/runtime/task/session/start - Chat Simulator diretto (solo UtteranceInterpretation)
        Console.WriteLine("🔥 REGISTERING ENDPOINT: /api/runtime/task/session/start")
        System.Diagnostics.Debug.WriteLine("🔥 REGISTERING ENDPOINT: /api/runtime/task/session/start")
        Console.Out.Flush()
        app.MapPost("/api/runtime/task/session/start", Async Function(context As HttpContext) As Task(Of IResult)
                                                           Console.WriteLine("═══════════════════════════════════════════════════════════════")
                                                           Console.WriteLine("🔵 [MapPost] /api/runtime/task/session/start - ENTRY POINT")
                                                           System.Diagnostics.Debug.WriteLine("🔵 [MapPost] /api/runtime/task/session/start - ENTRY POINT")
                                                           Console.Out.Flush()
                                                           Try
                                                               Console.WriteLine("🔵 [MapPost] About to call HandleTaskSessionStart...")
                                                               System.Diagnostics.Debug.WriteLine("🔵 [MapPost] About to call HandleTaskSessionStart...")
                                                               Console.Out.Flush()

                                                               Dim result = Await ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionStart(context)

                                                               Console.WriteLine($"🔵 [MapPost] HandleTaskSessionStart returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                               System.Diagnostics.Debug.WriteLine($"🔵 [MapPost] HandleTaskSessionStart returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                               Console.Out.Flush()

                                                               ' ✅ Esegui esplicitamente l'IResult per scrivere nel context.Response
                                                               If result IsNot Nothing Then
                                                                   Console.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                   Console.Out.Flush()

                                                                   Await result.ExecuteAsync(context)

                                                                   Console.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                   Console.Out.Flush()
                                                               End If

                                                               Return Results.Empty
                                                           Catch ex As Exception
                                                               Console.WriteLine($"🔴 [MapPost] Exception: {ex}")
                                                               System.Diagnostics.Debug.WriteLine($"🔴 [MapPost] Exception: {ex}")
                                                               Console.Out.Flush()
                                                               Throw
                                                           End Try
                                                       End Function)

        ' GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        app.MapGet("/api/runtime/task/session/{id}/stream", Function(context As HttpContext, id As String) As System.Threading.Tasks.Task
                                                                Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionStream(context, id)
                                                            End Function)

        ' POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        app.MapPost("/api/runtime/task/session/{id}/input", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionInput(context, id)
                                                            End Function)

        ' DELETE /api/runtime/task/session/{id} - Chat Simulator diretto
        app.MapDelete("/api/runtime/task/session/{id}", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                            Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionDelete(context, id)
                                                        End Function)

        ' POST /api/runtime/orchestrator/session/start
        app.MapPost("/api/runtime/orchestrator/session/start", Async Function(context As HttpContext) As Task(Of IResult)
                                                                   Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
                                                                   Console.WriteLine("🔵 [MapPost] /api/runtime/orchestrator/session/start - Handler called")
                                                                   Console.Out.Flush()
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] Handler called")
                                                                   Console.WriteLine("🔵 [MapPost] Entering Try block...")
                                                                   Console.Out.Flush()
                                                                   Try
                                                                       Console.WriteLine("🔵 [MapPost] About to call HandleOrchestratorSessionStart...")
                                                                       Console.Out.Flush()
                                                                       System.Diagnostics.Debug.WriteLine("🔵 [MapPost] About to call function")
                                                                       Dim result = Await HandleOrchestratorSessionStart(context)
                                                                       System.Diagnostics.Debug.WriteLine($"🔵 [MapPost] Function returned")
                                                                       Console.WriteLine($"🔵 [MapPost] Handler returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                                       Console.Out.Flush()
                                                                       Return result
                                                                   Catch ex As Exception
                                                                       Console.WriteLine($"🔵 [MapPost] EXCEPTION CAUGHT: {ex.GetType().Name}")
                                                                       Console.WriteLine($"🔵 [MapPost] Exception message: {ex.Message}")
                                                                       Console.WriteLine($"🔵 [MapPost] Stack trace: {ex.StackTrace}")
                                                                       Console.Out.Flush()
                                                                       System.Diagnostics.Debug.WriteLine($"🔵 [MapPost] Exception: {ex.Message}")
                                                                       If ex.InnerException IsNot Nothing Then
                                                                           Console.WriteLine($"🔵 [MapPost] Inner exception: {ex.InnerException.Message}")
                                                                           Console.Out.Flush()
                                                                       End If
                                                                       Return Results.Problem(
                                                                            title:="Handler exception",
                                                                            detail:=ex.Message,
                                                                            statusCode:=500
                                                                        )
                                                                   End Try
                                                               End Function)

        ' GET /api/runtime/orchestrator/session/{id}/stream (SSE)
        app.MapGet("/api/runtime/orchestrator/session/{id}/stream", Function(context As HttpContext, id As String) As System.Threading.Tasks.Task
                                                                        Return HandleOrchestratorSessionStream(context, id)
                                                                    End Function)

        ' POST /api/runtime/orchestrator/session/{id}/input
        app.MapPost("/api/runtime/orchestrator/session/{id}/input", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                        Return HandleOrchestratorSessionInput(context, id)
                                                                    End Function)

        ' DELETE /api/runtime/orchestrator/session/{id}
        app.MapDelete("/api/runtime/orchestrator/session/{id}", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                    Return HandleOrchestratorSessionDelete(context, id)
                                                                End Function)
    End Sub

    ' HandleCompileFlow, HandleCompileTask, HandleCompileFlowWithModel moved to ApiServer.Handlers.CompilationHandlers

    ''' <summary>
    ''' Handles POST /api/runtime/orchestrator/session/start
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStart(context As HttpContext) As Task(Of IResult)
        Try
            ' Read request body
            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
                Console.WriteLine($"📦 [API][OrchestratorSession] Body read: {If(body IsNot Nothing, body.Length, 0)} chars")
                System.Diagnostics.Debug.WriteLine($"📦 [API][OrchestratorSession] Body read: {If(body IsNot Nothing, body.Length, 0)} chars")
                Console.Out.Flush()
            Catch readEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Error reading body: {readEx.Message}")
                System.Diagnostics.Debug.WriteLine($"❌ [API][OrchestratorSession] Error reading body: {readEx.Message}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Failed to read request body"})
            End Try

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [API][OrchestratorSession] Empty body")
                System.Diagnostics.Debug.WriteLine("❌ [API][OrchestratorSession] Empty body")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Empty request body"})
            End If

            ' Deserialize request
            Dim request As OrchestratorSessionStartRequest = Nothing
            Try
                request = JsonConvert.DeserializeObject(Of OrchestratorSessionStartRequest)(body, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [API][OrchestratorSession] Request deserialized")
                System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Request deserialized")
                Console.Out.Flush()
            Catch jsonEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] JSON error: {jsonEx.Message}")
                System.Diagnostics.Debug.WriteLine($"❌ [API][OrchestratorSession] JSON error: {jsonEx.Message}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Invalid JSON", .message = jsonEx.Message})
            End Try

            ' ❌ RIMOSSO: Debug request.DDTs legacy - non più usato

            If request Is Nothing OrElse request.CompilationResult Is Nothing Then
                Console.WriteLine("❌ [API][OrchestratorSession] Missing CompilationResult")
                System.Diagnostics.Debug.WriteLine("❌ [API][OrchestratorSession] Missing CompilationResult")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Missing CompilationResult"})
            End If

            ' Deserialize CompilationResult
            Dim compilationResult As Compiler.FlowCompilationResult = Nothing
            Try
                ' Log what we received
                Console.WriteLine($"🔍 [API][OrchestratorSession] CompilationResult type: {If(request.CompilationResult IsNot Nothing, request.CompilationResult.GetType().Name, "Nothing")}")
                System.Diagnostics.Debug.WriteLine($"🔍 [API][OrchestratorSession] CompilationResult type: {If(request.CompilationResult IsNot Nothing, request.CompilationResult.GetType().Name, "Nothing")}")

                ' Try to deserialize directly if it's already a JObject
                If TypeOf request.CompilationResult Is JObject Then
                    Dim jObj = CType(request.CompilationResult, JObject)
                    Console.WriteLine($"🔍 [API][OrchestratorSession] CompilationResult is JObject, checking taskGroups...")
                    System.Diagnostics.Debug.WriteLine($"🔍 [API][OrchestratorSession] CompilationResult is JObject")

                    ' Log all keys in JObject
                    Console.WriteLine($"   All keys in CompilationResult: {String.Join(", ", jObj.Properties().Select(Function(p) p.Name))}")
                    System.Diagnostics.Debug.WriteLine($"   All keys in CompilationResult: {String.Join(", ", jObj.Properties().Select(Function(p) p.Name))}")

                    ' Log full JSON structure (first 1000 chars)
                    Dim fullJson = jObj.ToString()
                    Console.WriteLine($"   Full JSON (first 1000 chars): {fullJson.Substring(0, Math.Min(1000, fullJson.Length))}")
                    System.Diagnostics.Debug.WriteLine($"   Full JSON (first 1000 chars): {fullJson.Substring(0, Math.Min(1000, fullJson.Length))}")

                    ' Check if taskGroups exists
                    If jObj("taskGroups") IsNot Nothing Then
                        Dim taskGroupsToken = jObj("taskGroups")
                        Console.WriteLine($"✅ [API][OrchestratorSession] taskGroups found in JObject")
                        Console.WriteLine($"   taskGroups type: {taskGroupsToken.GetType().Name}")
                        System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] taskGroups found")
                        System.Diagnostics.Debug.WriteLine($"   taskGroups type: {taskGroupsToken.GetType().Name}")

                        If TypeOf taskGroupsToken Is JArray Then
                            Dim taskGroupsArray = CType(taskGroupsToken, JArray)
                            Console.WriteLine($"   taskGroups is JArray, count: {taskGroupsArray.Count}")
                            System.Diagnostics.Debug.WriteLine($"   taskGroups is JArray, count: {taskGroupsArray.Count}")

                            If taskGroupsArray.Count = 0 Then
                                Console.WriteLine($"   ⚠️ taskGroups array is EMPTY!")
                                System.Diagnostics.Debug.WriteLine($"   ⚠️ taskGroups array is EMPTY!")
                            Else
                                Console.WriteLine($"   taskGroups array has {taskGroupsArray.Count} items")
                                System.Diagnostics.Debug.WriteLine($"   taskGroups array has {taskGroupsArray.Count} items")
                                ' Log first item structure
                                If taskGroupsArray(0) IsNot Nothing Then
                                    Console.WriteLine($"   First taskGroup keys: {String.Join(", ", CType(taskGroupsArray(0), JObject).Properties().Select(Function(p) p.Name))}")
                                    System.Diagnostics.Debug.WriteLine($"   First taskGroup keys: {String.Join(", ", CType(taskGroupsArray(0), JObject).Properties().Select(Function(p) p.Name))}")
                                End If
                            End If
                        Else
                            Console.WriteLine($"   ⚠️ taskGroups is NOT a JArray, it's: {taskGroupsToken.GetType().Name}")
                            System.Diagnostics.Debug.WriteLine($"   ⚠️ taskGroups is NOT a JArray, it's: {taskGroupsToken.GetType().Name}")
                        End If
                    Else
                        Console.WriteLine($"⚠️ [API][OrchestratorSession] taskGroups NOT found in JObject")
                        System.Diagnostics.Debug.WriteLine($"⚠️ [API][OrchestratorSession] taskGroups NOT found in JObject")
                    End If

                    ' Deserialize from JObject directly
                    compilationResult = jObj.ToObject(Of Compiler.FlowCompilationResult)(New JsonSerializer() With {
                        .NullValueHandling = NullValueHandling.Ignore,
                        .MissingMemberHandling = MissingMemberHandling.Ignore
                    })
                Else
                    ' ❌ ERRORE BLOCCANTE: CompilationResult OBBLIGATORIO, nessun fallback
                    Throw New InvalidOperationException("CompilationResult is required and cannot be null. The session cannot start without a valid CompilationResult.")
                End If

                Console.WriteLine($"✅ [API][OrchestratorSession] CompilationResult deserialized: {If(compilationResult IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")
                System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] CompilationResult deserialized: {If(compilationResult IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")

                If compilationResult IsNot Nothing AndAlso compilationResult.TaskGroups IsNot Nothing Then
                    Console.WriteLine($"   TaskGroups details:")
                    System.Diagnostics.Debug.WriteLine($"   TaskGroups details:")
                    For i = 0 To Math.Min(4, compilationResult.TaskGroups.Count - 1)
                        Dim tg = compilationResult.TaskGroups(i)
                        Console.WriteLine($"     TaskGroup[{i}]: NodeId={tg.NodeId}, Tasks count={If(tg.Tasks IsNot Nothing, tg.Tasks.Count, 0)}")
                        System.Diagnostics.Debug.WriteLine($"     TaskGroup[{i}]: NodeId={tg.NodeId}, Tasks count={If(tg.Tasks IsNot Nothing, tg.Tasks.Count, 0)}")
                    Next
                End If

                Console.Out.Flush()
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] CompilationResult error: {deserializeEx.Message}")
                Console.WriteLine($"   Stack trace: {deserializeEx.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [API][OrchestratorSession] CompilationResult error: {deserializeEx.Message}")
                System.Diagnostics.Debug.WriteLine($"   Stack trace: {deserializeEx.StackTrace}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Failed to deserialize CompilationResult", .message = deserializeEx.Message})
            End Try

            ' Generate session ID
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"✅ [API][OrchestratorSession] Session ID: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Session ID: {sessionId}")
            Console.Out.Flush()

            ' Create session in SessionManager
            Try
                Console.WriteLine($"🔄 [API][OrchestratorSession] Calling SessionManager.CreateSession...")
                System.Diagnostics.Debug.WriteLine($"🔄 [API][OrchestratorSession] Calling SessionManager.CreateSession...")
                Console.Out.Flush()
                Dim session = SessionManager.CreateSession(
                    sessionId,
                    compilationResult,
                    request.Tasks,
                    request.Translations
                )
                Console.WriteLine($"✅ [API][OrchestratorSession] Session created successfully")
                System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Session created successfully")
                Console.Out.Flush()
            Catch sessionEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Session creation error: {sessionEx.Message}")
                Console.WriteLine($"Stack trace: {sessionEx.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [API][OrchestratorSession] Session creation error: {sessionEx.Message}")
                System.Diagnostics.Debug.WriteLine($"Stack trace: {sessionEx.StackTrace}")
                Console.Out.Flush()
                Return Results.Problem(title:="Failed to create session", detail:=sessionEx.Message, statusCode:=500)
            End Try

            ' ✅ UNIFICA: Usa CreateSuccessResponse invece di scrivere direttamente
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            Console.WriteLine($"✅ [API][OrchestratorSession] Returning success response")
            System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Returning success response")
            Console.Out.Flush()

            Return ResponseHelpers.CreateSuccessResponse(responseObj)
        Catch ex As Exception
            Console.WriteLine($"❌ [API][OrchestratorSession] ERROR: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [API][OrchestratorSession] ERROR: {ex.Message}")
            System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}")
            Console.Out.Flush()
            Return Results.Problem(detail:=ex.Message, statusCode:=500)
        End Try
    End Function

    ''' <summary>
    ''' Handles GET /api/runtime/orchestrator/session/{id}/stream (SSE)
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
        Try
            Console.WriteLine($"📡 [HandleOrchestratorSessionStream] SSE connection opened for session: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"📡 [HandleOrchestratorSessionStream] SSE connection opened for session: {sessionId}")
            Console.Out.Flush()

            ' Get session
            Dim session = SessionManager.GetSession(sessionId)
            If session Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionStream] Session not found: {sessionId}")
                System.Diagnostics.Debug.WriteLine($"❌ [HandleOrchestratorSessionStream] Session not found: {sessionId}")
                Console.Out.Flush()
                context.Response.StatusCode = 404
                Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                Return
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Session found: {sessionId}, Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
            System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Session found: {sessionId}, Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
            Console.Out.Flush()

            ' Setup SSE headers PRIMA di iniziare a scrivere
            context.Response.ContentType = "text/event-stream"
            context.Response.Headers.Add("Cache-Control", "no-cache")
            context.Response.Headers.Add("Connection", "keep-alive")
            context.Response.Headers.Add("X-Accel-Buffering", "no")

            ' IMPORTANTE: Flush gli header prima di continuare
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

            ' Register event handlers (using Action with Task.Run for async operations)
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

            Dim onStateUpdate As Action(Of Object) = Sub(data)
                                                         System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                                             Try
                                                                                                 Await writer.WriteLineAsync($"event: stateUpdate")
                                                                                                 Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                                                 Await writer.WriteLineAsync()
                                                                                                 Await writer.FlushAsync()
                                                                                             Catch ex As Exception
                                                                                                 Console.WriteLine($"❌ [SSE] Error sending stateUpdate: {ex.Message}")
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
            session.EventEmitter.[On]("stateUpdate", onStateUpdate)
            session.EventEmitter.[On]("complete", onComplete)
            session.EventEmitter.[On]("error", onError)

            ' Cleanup on disconnect
            context.RequestAborted.Register(Sub()
                                                Console.WriteLine($"✅ [HandleOrchestratorSessionStream] SSE connection closed for session: {sessionId}")
                                                session.EventEmitter.RemoveListener("message", onMessage)
                                                session.EventEmitter.RemoveListener("waitingForInput", onWaitingForInput)
                                                session.EventEmitter.RemoveListener("stateUpdate", onStateUpdate)
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
                Await System.Threading.Tasks.Task.Delay(Timeout.Infinite, context.RequestAborted)
            Catch ex As System.Threading.Tasks.TaskCanceledException
                ' Connection closed normally
                Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Connection closed normally for session: {sessionId}")
                System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Connection closed normally for session: {sessionId}")
            Finally
                heartbeatTimer.Dispose()
            End Try
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleOrchestratorSessionStream] ERROR: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [HandleOrchestratorSessionStream] ERROR: {ex.Message}")
            System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}")
            Console.Out.Flush()
        End Try
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/orchestrator/session/{id}/input
    ''' </summary>
    Private Async Function HandleOrchestratorSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
        Console.WriteLine($"📥 [HandleOrchestratorSessionInput] Received input for session: {sessionId}")

        Try
            Dim reader As New StreamReader(context.Request.Body)
            Dim body = Await reader.ReadToEndAsync()
            Dim request = JsonConvert.DeserializeObject(Of OrchestratorSessionInputRequest)(body)

            If request Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionInput] Invalid request")
                Return Results.BadRequest(New With {.error = "Invalid request"})
            End If

            If String.IsNullOrEmpty(request.Input) Then
                Console.WriteLine("❌ [HandleOrchestratorSessionInput] Empty input")
                Return Results.BadRequest(New With {.error = "Input is required"})
            End If

            ' Get session
            Dim session = SessionManager.GetSession(sessionId)
            If session Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Session not found: {sessionId}")
                Return Results.NotFound(New With {.error = "Session not found"})
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionInput] Processing input: {request.Input.Substring(0, Math.Min(100, request.Input.Length))}")

            ' TODO: Process input and continue orchestrator execution
            ' For now, just acknowledge receipt
            ' In the future, this should:
            ' 1. Add input to session state
            ' 2. Continue orchestrator execution if it was waiting for input
            ' 3. Trigger next task execution

            ' Clear waiting state
            session.IsWaitingForInput = False
            session.WaitingForInputData = Nothing

            Return Results.Ok(New With {
                .success = True,
                .timestamp = DateTime.UtcNow.ToString("O")
            })
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return Results.Problem(
                title:="Failed to provide input",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

    ' ReadAndParseRequest, CreateTaskSession, HandleTaskSessionStart, HandleTaskSessionStream, HandleTaskSessionInput, HandleTaskSessionDelete moved to ApiServer.Handlers.TaskSessionHandlers

    ''' <summary>
    ''' Handles DELETE /api/runtime/orchestrator/session/{id}
    ''' </summary>
    Private Async Function HandleOrchestratorSessionDelete(context As HttpContext, sessionId As String) As Task(Of IResult)
        Try
            ' TODO: Implement session deletion using Orchestrator project
            ' SessionManager.DeleteSession(sessionId)

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

    ' ============================================================================
    ' API Data Models moved to ApiServer.Models namespace
    ' ============================================================================
End Module


