Option Strict On
Option Explicit On

Imports System
Imports System.IO
Imports System.Threading
Imports System.Threading.Tasks
Imports System.Collections.Generic
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Hosting
Imports Microsoft.AspNetCore.Http
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Hosting
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Module Program
    ''' <summary>
    ''' Main entry point - supports both HTTP server and stdin/stdout modes
    ''' </summary>
    Sub Main(args As String())
        ' Check if running in stdin/stdout mode (for Ruby backend compatibility)
        ' When called from Ruby, stdin and stdout are redirected
        ' When running from Visual Studio, use HTTP mode
        Dim isStdinMode As Boolean = False

        Try
            ' Try to detect stdin/stdout redirection
            ' This works when called from Ruby backend via stdin/stdout
            ' Note: These properties are available in .NET Core/.NET 5+
            isStdinMode = Console.IsInputRedirected AndAlso Console.IsOutputRedirected
        Catch
            ' If properties are not available or throw exception, assume HTTP mode
            isStdinMode = False
        End Try

        If isStdinMode Then
            ' Stdin/stdout mode (called by Ruby backend)
            RunStdinStdoutMode()
        Else
            ' HTTP server mode (default when running from Visual Studio)
            RunHttpServerMode(args)
        End If
    End Sub

    ''' <summary>
    ''' Runs in stdin/stdout mode (for Ruby backend compatibility)
    ''' </summary>
    Private Sub RunStdinStdoutMode()
        Try
            ' Read command from stdin (JSON)
            Dim inputJson = Console.In.ReadToEnd()

            If String.IsNullOrEmpty(inputJson) Then
                WriteError("No input provided")
                Environment.Exit(1)
                Return
            End If

            Dim command = JsonConvert.DeserializeObject(Of ApiCommand)(inputJson)

            If command Is Nothing OrElse String.IsNullOrEmpty(command.Command) Then
                WriteError("Invalid command format")
                Environment.Exit(1)
                Return
            End If

            Dim result As Object = Nothing

            Select Case command.Command.ToLower()
                Case "compile-flow"
                    ' Deserialize command data
                    Dim requestJson = JsonConvert.SerializeObject(command.Data)
                    Dim request = JsonConvert.DeserializeObject(Of CompileFlowRequest)(requestJson)

                    If request Is Nothing Then
                        Throw New Exception("Invalid compile-flow request")
                    End If

                    ' Validate request
                    If request.Nodes Is Nothing OrElse request.Nodes.Count = 0 Then
                        Throw New Exception("No nodes provided")
                    End If

                    ' Create Flow structure
                    Dim flow As New Compiler.Flow() With {
                        .Nodes = If(request.Nodes, New List(Of Compiler.FlowNode)()),
                        .Edges = If(request.Edges, New List(Of Compiler.FlowEdge)()),
                        .Tasks = If(request.Tasks, New List(Of Compiler.Task)()),
                        .DDTs = If(request.DDTs, New List(Of Object)())
                    }

                    ' Compile flow
                    Dim compiler = New Compiler.FlowCompiler()
                    Dim compilationResult = compiler.CompileFlow(flow)

                    ' Build response
                    result = New CompileFlowResponse() With {
                        .TaskGroups = compilationResult.TaskGroups,
                        .EntryTaskGroupId = compilationResult.EntryTaskGroupId,
                        .Tasks = compilationResult.Tasks
                    }
                Case "compile-ddt"
                    result = ExecuteCompileDDT(command)
                Case "run-ddt"
                    result = ExecuteRunDDT(command)
                Case Else
                    Throw New Exception($"Unknown command: {command.Command}")
            End Select

            ' Write result to stdout (JSON)
            Dim outputJson = JsonConvert.SerializeObject(New ApiResponse() With {
                .Success = True,
                .Data = result
            }, New JsonSerializerSettings() With {
                .NullValueHandling = NullValueHandling.Ignore
            })
            Console.Out.Write(outputJson)

        Catch ex As Exception
            ' Write error to stdout (JSON)
            WriteError(ex.Message, ex.StackTrace)
            Environment.Exit(1)
        End Try
    End Sub

    ''' <summary>
    ''' Runs in HTTP server mode (ASP.NET Core Web API)
    ''' </summary>
    Private Sub RunHttpServerMode(args As String())
        Try
            Dim builder = WebApplication.CreateBuilder(args)

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
            app.UseRouting()

            ' Map API endpoints (we map manually, so we don't need MapControllers())
            MapApiEndpoints(app)

            ' Start server on port 5000
            Console.WriteLine("🚀 ApiServer HTTP mode starting on http://localhost:5000")
            Console.WriteLine("📝 Stdin/stdout mode available when called from Ruby backend")
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
        app.MapPost("/api/runtime/compile", Function(context As HttpContext) As Task(Of IResult)
                                                Return HandleCompileFlow(context)
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
        app.MapGet("/api/runtime/orchestrator/session/{id}/stream", Function(context As HttpContext, id As String) As Task
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

    ''' <summary>
    ''' Handles POST /api/runtime/compile
    ''' </summary>
    Private Async Function HandleCompileFlow(context As HttpContext) As Task(Of IResult)
        Console.WriteLine("📥 [HandleCompileFlow] Received compilation request")

        Try
            ' Enable buffering to allow reading the body multiple times if needed
            Try
                context.Request.EnableBuffering()
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleCompileFlow] EnableBuffering failed (may already be enabled): {ex.Message}")
            End Try

            ' Reset stream position to beginning
            Try
                context.Request.Body.Position = 0
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleCompileFlow] Cannot reset stream position: {ex.Message}")
            End Try

            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
                Console.WriteLine($"📦 [HandleCompileFlow] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
            Catch readEx As Exception
                Console.WriteLine($"❌ [HandleCompileFlow] Error reading request body: {readEx.Message}")
                Console.WriteLine($"Stack trace: {readEx.StackTrace}")
                Return Results.BadRequest(New With {
                    .error = "Failed to read request body",
                    .message = readEx.Message
                })
            End Try

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [HandleCompileFlow] Empty request body")
                Return Results.BadRequest(New With {.error = "Empty request body"})
            End If

            Console.WriteLine($"📦 [HandleCompileFlow] Request body preview (first 500 chars): {body.Substring(0, Math.Min(500, body.Length))}")

            Dim request As CompileFlowRequest = Nothing
            Try
                Console.WriteLine("🔄 [HandleCompileFlow] Starting JSON deserialization...")
                request = JsonConvert.DeserializeObject(Of CompileFlowRequest)(body, New JsonSerializerSettings() With {
                    .Error = Sub(sender, args)
                                 Console.WriteLine($"❌ [HandleCompileFlow] JSON Error: {args.ErrorContext.Error.Message}")
                                 Console.WriteLine($"   Path: {args.ErrorContext.Path}")
                                 args.ErrorContext.Handled = True
                             End Sub
                })
                Console.WriteLine($"✅ [HandleCompileFlow] JSON deserialization completed")
            Catch jsonEx As JsonReaderException
                Console.WriteLine($"❌ [HandleCompileFlow] JSON deserialization error: {jsonEx.Message}")
                Console.WriteLine($"   Line: {jsonEx.LineNumber}, Position: {jsonEx.LinePosition}")
                Console.WriteLine($"   Path: {jsonEx.Path}")
                Return Results.BadRequest(New With {
                    .error = "Invalid JSON format",
                    .message = jsonEx.Message,
                    .line = jsonEx.LineNumber,
                    .position = jsonEx.LinePosition
                })
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleCompileFlow] Deserialization error: {deserializeEx.Message}")
                Console.WriteLine($"Stack trace: {deserializeEx.StackTrace}")
                If deserializeEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {deserializeEx.InnerException.Message}")
                End If
                Return Results.BadRequest(New With {
                    .error = "Failed to deserialize request",
                    .message = deserializeEx.Message
                })
            End Try

            If request Is Nothing Then
                Console.WriteLine("❌ [HandleCompileFlow] Deserialized request is Nothing")
                Return Results.BadRequest(New With {.error = "Invalid request format"})
            End If

            Console.WriteLine($"✅ [HandleCompileFlow] Request deserialized: {If(request.Nodes IsNot Nothing, request.Nodes.Count, 0)} nodes, {If(request.Edges IsNot Nothing, request.Edges.Count, 0)} edges, {If(request.Tasks IsNot Nothing, request.Tasks.Count, 0)} tasks")

            ' Validate request
            If request.Nodes Is Nothing OrElse request.Nodes.Count = 0 Then
                Return Results.BadRequest(New With {.error = "No nodes provided"})
            End If

            ' Create Flow structure
            Dim flow As New Compiler.Flow() With {
                .Nodes = If(request.Nodes, New List(Of Compiler.FlowNode)()),
                .Edges = If(request.Edges, New List(Of Compiler.FlowEdge)()),
                .Tasks = If(request.Tasks, New List(Of Compiler.Task)()),
                .DDTs = If(request.DDTs, New List(Of Object)())
            }

            ' Compile flow
            Dim compiler = New Compiler.FlowCompiler()
            Dim compilationResult = compiler.CompileFlow(flow)

            Console.WriteLine($"✅ [HandleCompileFlow] Compilation successful: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")

            ' Serialize response manually and write directly to response stream
            Try
                Dim responseObj = New With {
                    .taskGroups = compilationResult.TaskGroups,
                    .entryTaskGroupId = compilationResult.EntryTaskGroupId,
                    .tasks = compilationResult.Tasks,
                    .compiledBy = "VB.NET_RUNTIME",
                    .timestamp = DateTime.UtcNow.ToString("O")
                }

                Console.WriteLine($"✅ [HandleCompileFlow] Building response object...")
                Console.WriteLine($"   - TaskGroups: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)}")
                Console.WriteLine($"   - Tasks: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")

                Console.WriteLine("📤 [HandleCompileFlow] Serializing response...")
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .Formatting = Formatting.None
                })
                Console.WriteLine($"✅ [HandleCompileFlow] Serialization successful: {jsonResponse.Length} characters")

                If String.IsNullOrEmpty(jsonResponse) Then
                    Throw New Exception("Serialization returned empty string")
                End If

                ' Write directly to response stream
                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = System.Text.Encoding.UTF8.GetByteCount(jsonResponse)
                Await context.Response.WriteAsync(jsonResponse)

                Console.WriteLine($"✅ [HandleCompileFlow] Response written to stream: {jsonResponse.Length} characters")

                ' Return empty since we've written directly
                Return Results.Empty
            Catch serializationEx As Exception
                Console.WriteLine($"❌ [HandleCompileFlow] Error serializing/writing response: {serializationEx.Message}")
                Console.WriteLine($"Stack trace: {serializationEx.StackTrace}")
                If serializationEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {serializationEx.InnerException.Message}")
                    Console.WriteLine($"Inner stack trace: {serializationEx.InnerException.StackTrace}")
                End If

                ' Return error response using Results.Problem (can't use Await in Catch)
                Return Results.Problem(
                    title:="Serialization failed",
                    detail:=$"Failed to serialize response: {serializationEx.Message}",
                    statusCode:=500
                )
            End Try
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleCompileFlow] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return Results.Problem(
                title:="Compilation failed",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/compile using model binding (simpler approach)
    ''' </summary>
    Private Async Function HandleCompileFlowWithModel(request As CompileFlowRequest) As Task(Of IResult)
        Console.WriteLine("📥 [HandleCompileFlowWithModel] Received compilation request via model binding")

        Try
            If request Is Nothing Then
                Console.WriteLine("❌ [HandleCompileFlowWithModel] Request is Nothing")
                Return Results.BadRequest(New With {.error = "Request is null"})
            End If

            Console.WriteLine($"✅ [HandleCompileFlowWithModel] Request received: {If(request.Nodes IsNot Nothing, request.Nodes.Count, 0)} nodes, {If(request.Edges IsNot Nothing, request.Edges.Count, 0)} edges, {If(request.Tasks IsNot Nothing, request.Tasks.Count, 0)} tasks")

            ' Validate request
            If request.Nodes Is Nothing OrElse request.Nodes.Count = 0 Then
                Return Results.BadRequest(New With {.error = "No nodes provided"})
            End If

            ' Create Flow structure
            Dim flow As New Compiler.Flow() With {
                .Nodes = If(request.Nodes, New List(Of Compiler.FlowNode)()),
                .Edges = If(request.Edges, New List(Of Compiler.FlowEdge)()),
                .Tasks = If(request.Tasks, New List(Of Compiler.Task)()),
                .DDTs = If(request.DDTs, New List(Of Object)())
            }

            ' Compile flow
            Dim compiler = New Compiler.FlowCompiler()
            Dim compilationResult = compiler.CompileFlow(flow)

            Console.WriteLine($"✅ [HandleCompileFlowWithModel] Compilation successful: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")

            ' Build response object - ASP.NET Core will serialize it using Newtonsoft.Json
            Dim responseObj = New With {
                .taskGroups = compilationResult.TaskGroups,
                .entryTaskGroupId = compilationResult.EntryTaskGroupId,
                .tasks = compilationResult.Tasks,
                .compiledBy = "VB.NET_RUNTIME",
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            Console.WriteLine($"✅ [HandleCompileFlowWithModel] Returning response object (will be serialized by ASP.NET Core)")

            ' Return the object - ASP.NET Core will serialize it using Newtonsoft.Json
            Return Results.Ok(responseObj)
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleCompileFlowWithModel] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            If ex.InnerException IsNot Nothing Then
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}")
            End If
            Return Results.Problem(
                title:="Compilation failed",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

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
                Console.WriteLine($"📦 [HandleOrchestratorSessionStart] Body read: {If(body IsNot Nothing, body.Length, 0)} chars")
                Console.Out.Flush()
            Catch readEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Error reading body: {readEx.Message}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Failed to read request body"})
            End Try

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Empty body")
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
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Request deserialized")
                Console.Out.Flush()
            Catch jsonEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] JSON error: {jsonEx.Message}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Invalid JSON", .message = jsonEx.Message})
            End Try

            If request Is Nothing OrElse request.CompilationResult Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Missing CompilationResult")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Missing CompilationResult"})
            End If

            ' Deserialize CompilationResult
            Dim compilationResult As Compiler.FlowCompilationResult = Nothing
            Try
                Dim compilationResultJson = JsonConvert.SerializeObject(request.CompilationResult)
                compilationResult = JsonConvert.DeserializeObject(Of Compiler.FlowCompilationResult)(compilationResultJson, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] CompilationResult deserialized: {If(compilationResult IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")
                Console.Out.Flush()
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] CompilationResult error: {deserializeEx.Message}")
                Console.Out.Flush()
                Return Results.BadRequest(New With {.error = "Failed to deserialize CompilationResult"})
            End Try

            ' Generate session ID
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Session ID: {sessionId}")
            Console.Out.Flush()

            ' Create session in SessionManager
            Try
                Console.WriteLine($"🔄 [HandleOrchestratorSessionStart] Calling SessionManager.CreateSession...")
                Console.Out.Flush()
                Dim session = SessionManager.CreateSession(
                    sessionId,
                    compilationResult,
                    request.Tasks,
                    request.DDTs,
                    request.Translations
                )
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Session created successfully")
                Console.Out.Flush()
            Catch sessionEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Session creation error: {sessionEx.Message}")
                Console.WriteLine($"Stack trace: {sessionEx.StackTrace}")
                Console.Out.Flush()
                Return Results.Problem(title:="Failed to create session", detail:=sessionEx.Message, statusCode:=500)
            End Try

            ' Return response
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            Dim jsonResponse = JsonConvert.SerializeObject(responseObj)
            context.Response.ContentType = "application/json; charset=utf-8"
            Await context.Response.WriteAsync(jsonResponse)

            Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Response sent: {jsonResponse}")
            Console.Out.Flush()

            Return Results.Empty
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleOrchestratorSessionStart] ERROR: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Console.Out.Flush()
            Return Results.Problem(detail:=ex.Message, statusCode:=500)
        End Try
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/orchestrator/session/start - OLD COMPLEX VERSION
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStart_OLD(context As HttpContext) As Task(Of IResult)
        ' Use both Console.WriteLine and System.Diagnostics.Debug for maximum visibility
        Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine("📥 [HandleOrchestratorSessionStart] FUNCTION STARTED")
        Console.WriteLine($"   Method: {context.Request.Method}")
        Console.WriteLine($"   Path: {context.Request.Path}")
        Console.WriteLine($"   Content-Type: {context.Request.ContentType}")
        Console.WriteLine($"   Content-Length: {If(context.Request.ContentLength.HasValue, context.Request.ContentLength.Value.ToString(), "unknown")}")
        Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine("📥 [HandleOrchestratorSessionStart] Function called")
        Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Starting execution flow...")
        Console.WriteLine("🔍 [HandleOrchestratorSessionStart] About to enter Try block...")
        Console.WriteLine("🔍 [HandleOrchestratorSessionStart] BEFORE TRY BLOCK - Line 406")
        System.Diagnostics.Debug.WriteLine("🔍 BEFORE TRY BLOCK")

        Try
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] INSIDE TRY BLOCK - Line 407")
            Console.Out.Flush()
            System.Diagnostics.Debug.WriteLine("🔍 INSIDE TRY BLOCK")
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Inside Try block")
            Console.Out.Flush()
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.Out.Flush()
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 415 - About to enable buffering...")
            Console.Out.Flush()
            ' Enable buffering to allow reading the body
            Try
                Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 417 - Calling EnableBuffering()...")
                context.Request.EnableBuffering()
                Console.WriteLine("✅ [HandleOrchestratorSessionStart] EnableBuffering() succeeded")
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleOrchestratorSessionStart] EnableBuffering failed (may already be enabled): {ex.Message}")
            End Try

            ' Reset stream position to beginning
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 423 - About to reset stream position...")
            Try
                Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 424 - Setting Body.Position = 0...")
                context.Request.Body.Position = 0
                Console.WriteLine("✅ [HandleOrchestratorSessionStart] Stream position reset succeeded")
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleOrchestratorSessionStart] Cannot reset stream position: {ex.Message}")
            End Try

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 429 - About to read request body...")
            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
                Console.WriteLine($"📦 [HandleOrchestratorSessionStart] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
                Console.WriteLine($"📦 [HandleOrchestratorSessionStart] Body preview (first 200 chars): {If(body IsNot Nothing, body.Substring(0, Math.Min(200, body.Length)), "null")}")
            Catch readEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Error reading request body: {readEx.Message}")
                Console.WriteLine($"Stack trace: {readEx.StackTrace}")
                Return Results.BadRequest(New With {
                    .error = "Failed to read request body",
                    .message = readEx.Message
                })
            End Try

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Checking if body is empty... - Line 434")
            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Empty request body - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Empty request body"})
            End If
            Console.WriteLine("✅ [HandleOrchestratorSessionStart] Body is not empty, proceeding...")

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] About to deserialize request... - Line 443")
            Dim request As OrchestratorSessionStartRequest = Nothing
            Try
                Console.WriteLine("🔄 [HandleOrchestratorSessionStart] Starting JSON deserialization... - Line 445")
                request = JsonConvert.DeserializeObject(Of OrchestratorSessionStartRequest)(body, New JsonSerializerSettings() With {
                    .Error = Sub(sender, args)
                                 Console.WriteLine($"❌ [HandleOrchestratorSessionStart] JSON Error: {args.ErrorContext.Error.Message}")
                                 Console.WriteLine($"   Path: {args.ErrorContext.Path}")
                             End Sub,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] JSON deserialization completed")
            Catch jsonEx As JsonReaderException
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] JSON deserialization error: {jsonEx.Message}")
                Console.WriteLine($"   Line: {jsonEx.LineNumber}, Position: {jsonEx.LinePosition}")
                Console.WriteLine($"   Path: {jsonEx.Path}")
                Return Results.BadRequest(New With {
                    .error = "Invalid JSON format",
                    .message = jsonEx.Message,
                    .line = jsonEx.LineNumber,
                    .position = jsonEx.LinePosition
                })
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Deserialization error: {deserializeEx.Message}")
                Console.WriteLine($"Stack trace: {deserializeEx.StackTrace}")
                If deserializeEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {deserializeEx.InnerException.Message}")
                End If
                Return Results.BadRequest(New With {
                    .error = "Failed to deserialize request",
                    .message = deserializeEx.Message
                })
            End Try

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Checking if request is Nothing... - Line 477")
            If request Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Deserialized request is Nothing - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Invalid request format"})
            End If
            Console.WriteLine("✅ [HandleOrchestratorSessionStart] Request is not Nothing")

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Checking if CompilationResult is Nothing... - Line 482")
            If request.CompilationResult Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Missing compilationResult - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Missing compilationResult"})
            End If
            Console.WriteLine("✅ [HandleOrchestratorSessionStart] CompilationResult is not Nothing")

            ' Deserializza CompilationResult
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] About to deserialize CompilationResult... - Line 487")
            Dim compilationResult As Compiler.FlowCompilationResult = Nothing
            Try
                Console.WriteLine($"🔄 [HandleOrchestratorSessionStart] Starting CompilationResult deserialization... - Line 490")
                Dim compilationResultJson = JsonConvert.SerializeObject(request.CompilationResult)
                Console.WriteLine($"📦 [HandleOrchestratorSessionStart] CompilationResult JSON length: {compilationResultJson.Length} characters")
                Console.WriteLine($"📦 [HandleOrchestratorSessionStart] CompilationResult JSON preview: {compilationResultJson.Substring(0, Math.Min(500, compilationResultJson.Length))}")

                compilationResult = JsonConvert.DeserializeObject(Of Compiler.FlowCompilationResult)(compilationResultJson, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] CompilationResult deserialized: {If(compilationResult IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")
                If compilationResult IsNot Nothing Then
                    Console.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
                    Console.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")
                    Console.WriteLine($"   TaskGroups count: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)}")
                End If
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Error deserializing CompilationResult: {deserializeEx.Message}")
                Console.WriteLine($"Stack trace: {deserializeEx.StackTrace}")
                If deserializeEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {deserializeEx.InnerException.Message}")
                End If
                Return Results.BadRequest(New With {
                    .error = "Failed to deserialize CompilationResult",
                    .message = deserializeEx.Message
                })
            End Try

            If compilationResult Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionStart] Deserialized CompilationResult is Nothing")
                Return Results.BadRequest(New With {.error = "Invalid CompilationResult format"})
            End If

            ' Genera session ID
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Generated session ID: {sessionId}")

            ' Crea sessione usando SessionManager
            Try
                Console.WriteLine($"🔄 [HandleOrchestratorSessionStart] Calling SessionManager.CreateSession...")
                Dim session = SessionManager.CreateSession(
                    sessionId,
                    compilationResult,
                    request.Tasks,
                    request.DDTs,
                    request.Translations
                )
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Session created successfully, orchestrator should be starting...")
            Catch sessionEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Error creating session: {sessionEx.Message}")
                Console.WriteLine($"Stack trace: {sessionEx.StackTrace}")
                If sessionEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {sessionEx.InnerException.Message}")
                End If
                Return Results.Problem(
                    title:="Failed to create session",
                    detail:=sessionEx.Message,
                    statusCode:=500
                )
            End Try

            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 551 - About to create response object...")
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }
            Console.WriteLine("🔍 [HandleOrchestratorSessionStart] Line 556 - Response object created")

            Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Line 557 - Returning response: sessionId={sessionId}")

            ' Serialize manually to ensure Newtonsoft.Json is used
            Try
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .Formatting = Formatting.None
                })
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Serialized response: {jsonResponse.Length} characters")
                Console.WriteLine($"   Response preview: {jsonResponse}")
                System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStart] Serialized: {jsonResponse}")

                ' Set response headers and write directly to response stream
                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = jsonResponse.Length
                Await context.Response.WriteAsync(jsonResponse)
                Console.WriteLine($"✅ [HandleOrchestratorSessionStart] Response written to stream")
                System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStart] Response written")

                ' Return empty since we've written directly
                Return Results.Empty
            Catch serializationEx As Exception
                Console.WriteLine($"❌ [HandleOrchestratorSessionStart] Error serializing response: {serializationEx.Message}")
                Console.WriteLine($"Stack trace: {serializationEx.StackTrace}")
                ' Fallback to Results.Ok (will use default serializer)
                Return Results.Ok(responseObj)
            End Try
        Catch ex As Exception
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"❌ [HandleOrchestratorSessionStart] EXCEPTION CAUGHT IN OUTER CATCH BLOCK")
            Console.WriteLine($"   Exception Type: {ex.GetType().Name}")
            Console.WriteLine($"   Exception Message: {ex.Message}")
            Console.WriteLine($"   Stack trace: {ex.StackTrace}")
            If ex.InnerException IsNot Nothing Then
                Console.WriteLine($"   Inner exception Type: {ex.InnerException.GetType().Name}")
                Console.WriteLine($"   Inner exception Message: {ex.InnerException.Message}")
                Console.WriteLine($"   Inner stack trace: {ex.InnerException.StackTrace}")
            End If
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            System.Diagnostics.Debug.WriteLine($"❌ EXCEPTION: {ex.GetType().Name} - {ex.Message}")
            Return Results.Problem(
                title:="Failed to create session",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
        Console.WriteLine("⚠️ [HandleOrchestratorSessionStart] AFTER TRY-CATCH BLOCK - This should never be reached")
    End Function

    ''' <summary>
    ''' Handles GET /api/runtime/orchestrator/session/{id}/stream (SSE)
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStream(context As HttpContext, sessionId As String) As Task
        Console.WriteLine($"📡 [HandleOrchestratorSessionStream] SSE connection opened for session: {sessionId}")

        ' Get session
        Dim session = SessionManager.GetSession(sessionId)
        If session Is Nothing Then
            Console.WriteLine($"❌ [HandleOrchestratorSessionStream] Session not found: {sessionId}")
            context.Response.StatusCode = 404
            Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
            Return
        End If

        ' Setup SSE headers
        context.Response.ContentType = "text/event-stream"
        context.Response.Headers.Add("Cache-Control", "no-cache")
        context.Response.Headers.Add("Connection", "keep-alive")
        context.Response.Headers.Add("X-Accel-Buffering", "no")

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
                                                 Task.Run(Async Function()
                                                              Try
                                                                  Await writer.WriteLineAsync($"event: message")
                                                                  Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                  Await writer.WriteLineAsync()
                                                                  Await writer.FlushAsync()
                                                              Catch ex As Exception
                                                                  Console.WriteLine($"❌ [SSE] Error sending message: {ex.Message}")
                                                              End Try
                                                              Return Task.CompletedTask
                                                          End Function)
                                             End Sub

        Dim onDDTStart As Action(Of Object) = Sub(data)
                                                  Task.Run(Async Function()
                                                               Try
                                                                   Await writer.WriteLineAsync($"event: ddtStart")
                                                                   Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                   Await writer.WriteLineAsync()
                                                                   Await writer.FlushAsync()
                                                               Catch ex As Exception
                                                                   Console.WriteLine($"❌ [SSE] Error sending ddtStart: {ex.Message}")
                                                               End Try
                                                               Return Task.CompletedTask
                                                           End Function)
                                              End Sub

        Dim onWaitingForInput As Action(Of Object) = Sub(data)
                                                         Task.Run(Async Function()
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
                                                                      Return Task.CompletedTask
                                                                  End Function)
                                                     End Sub

        Dim onStateUpdate As Action(Of Object) = Sub(data)
                                                     Task.Run(Async Function()
                                                                  Try
                                                                      Await writer.WriteLineAsync($"event: stateUpdate")
                                                                      Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                      Await writer.WriteLineAsync()
                                                                      Await writer.FlushAsync()
                                                                  Catch ex As Exception
                                                                      Console.WriteLine($"❌ [SSE] Error sending stateUpdate: {ex.Message}")
                                                                  End Try
                                                                  Return Task.CompletedTask
                                                              End Function)
                                                 End Sub

        Dim onComplete As Action(Of Object) = Sub(data)
                                                  Task.Run(Async Function()
                                                               Try
                                                                   Await writer.WriteLineAsync($"event: complete")
                                                                   Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                   Await writer.WriteLineAsync()
                                                                   Await writer.FlushAsync()
                                                                   writer.Close()
                                                               Catch ex As Exception
                                                                   Console.WriteLine($"❌ [SSE] Error sending complete: {ex.Message}")
                                                               End Try
                                                               Return Task.CompletedTask
                                                           End Function)
                                              End Sub

        Dim onError As Action(Of Object) = Sub(data)
                                               Task.Run(Async Function()
                                                            Try
                                                                Await writer.WriteLineAsync($"event: error")
                                                                Await writer.WriteLineAsync($"data: {JsonConvert.SerializeObject(data)}")
                                                                Await writer.WriteLineAsync()
                                                                Await writer.FlushAsync()
                                                                writer.Close()
                                                            Catch ex As Exception
                                                                Console.WriteLine($"❌ [SSE] Error sending error: {ex.Message}")
                                                            End Try
                                                            Return Task.CompletedTask
                                                        End Function)
                                           End Sub

        ' Register listeners
        session.EventEmitter.[On]("message", onMessage)
        session.EventEmitter.[On]("ddtStart", onDDTStart)
        session.EventEmitter.[On]("waitingForInput", onWaitingForInput)
        session.EventEmitter.[On]("stateUpdate", onStateUpdate)
        session.EventEmitter.[On]("complete", onComplete)
        session.EventEmitter.[On]("error", onError)

        ' Cleanup on disconnect
        context.RequestAborted.Register(Sub()
                                            Console.WriteLine($"✅ [HandleOrchestratorSessionStream] SSE connection closed for session: {sessionId}")
                                            session.EventEmitter.RemoveListener("message", onMessage)
                                            session.EventEmitter.RemoveListener("ddtStart", onDDTStart)
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
            Await Task.Delay(Timeout.Infinite, context.RequestAborted)
        Catch ex As TaskCanceledException
            ' Connection closed normally
        Finally
            heartbeatTimer.Dispose()
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
    ' Existing command execution functions (used by both modes)
    ' ============================================================================


    Private Function ExecuteCompileDDT(command As ApiCommand) As Object
        Dim ddtCompiler = New Compiler.DDTCompiler
        Dim request = JsonConvert.DeserializeObject(Of CompileDDTRequest)(command.Data.ToString())

        If request Is Nothing OrElse String.IsNullOrEmpty(request.DdtJson) Then
            Throw New Exception("Invalid compile-ddt request: ddtJson is required")
        End If

        Dim result = ddtCompiler.Compile(request.DdtJson)

        Return New CompileDDTResponse() With {
            .IsValid = result.IsValid,
            .ValidationErrors = result.ValidationErrors,
            .Instance = result.Instance
        }
    End Function

    Private Function ExecuteRunDDT(command As ApiCommand) As Object
        ' TODO: Implement DDT execution
        ' This will call Motore.ExecuteDDT() with the DDT instance
        Throw New NotImplementedException("run-ddt command not yet implemented")
    End Function

    Private Function ConvertToFlowNodes(nodesJson As Object) As List(Of Compiler.FlowNode)
        Dim nodes As New List(Of Compiler.FlowNode)()
        If nodesJson Is Nothing Then Return nodes

        Dim jArray = TryCast(nodesJson, JArray)
        If jArray Is Nothing Then Return nodes

        For Each item In jArray
            Dim node = JsonConvert.DeserializeObject(Of Compiler.FlowNode)(item.ToString())
            If node IsNot Nothing Then
                nodes.Add(node)
            End If
        Next

        Return nodes
    End Function

    Private Function ConvertToFlowEdges(edgesJson As Object) As List(Of Compiler.FlowEdge)
        Dim edges As New List(Of Compiler.FlowEdge)()
        If edgesJson Is Nothing Then Return edges

        Dim jArray = TryCast(edgesJson, JArray)
        If jArray Is Nothing Then Return edges

        For Each item In jArray
            Dim edge = JsonConvert.DeserializeObject(Of Compiler.FlowEdge)(item.ToString())
            If edge IsNot Nothing Then
                edges.Add(edge)
            End If
        Next

        Return edges
    End Function

    Private Function ConvertToTasks(tasksJson As Object) As List(Of Compiler.Task)
        Dim tasks As New List(Of Compiler.Task)()
        If tasksJson Is Nothing Then Return tasks

        Dim jArray = TryCast(tasksJson, JArray)
        If jArray Is Nothing Then Return tasks

        For Each item In jArray
            Dim task = JsonConvert.DeserializeObject(Of Compiler.Task)(item.ToString())
            If task IsNot Nothing Then
                tasks.Add(task)
            End If
        Next

        Return tasks
    End Function

    Private Sub WriteError(message As String, Optional stackTrace As String = Nothing)
        Dim errorJson = JsonConvert.SerializeObject(New ApiResponse() With {
            .Success = False,
            .HasError = message,
            .StackTrace = stackTrace
        }, New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore
        })
        Console.Out.Write(errorJson)
    End Sub
End Module

' ============================================================================
' API Data Models
' ============================================================================

''' <summary>
''' API Command structure (for stdin/stdout mode)
''' </summary>
Public Class ApiCommand
    Public Property Command As String
    Public Property Data As Object
End Class

''' <summary>
''' API Response structure (for stdin/stdout mode)
''' </summary>
Public Class ApiResponse
    Public Property Success As Boolean
    Public Property Data As Object
    Public Property HasError As String
    Public Property StackTrace As String
End Class

''' <summary>
''' Compile Flow Request
''' </summary>
Public Class CompileFlowRequest
    Public Property Nodes As List(Of Compiler.FlowNode)
    Public Property Edges As List(Of Compiler.FlowEdge)
    Public Property Tasks As List(Of Compiler.Task)
    Public Property DDTs As List(Of Object)
End Class

''' <summary>
''' Compile Flow Response
''' </summary>
Public Class CompileFlowResponse
    Public Property TaskGroups As List(Of Compiler.TaskGroup)
    Public Property EntryTaskGroupId As String
    Public Property Tasks As List(Of Compiler.CompiledTask)
End Class

''' <summary>
''' Compile DDT Request
''' </summary>
Public Class CompileDDTRequest
    ''' <summary>
    ''' DDT JSON string (serialized DDTInstance)
    ''' </summary>
    Public Property DdtJson As String
End Class

''' <summary>
''' Compile DDT Response
''' </summary>
Public Class CompileDDTResponse
    Public Property IsValid As Boolean
    Public Property ValidationErrors As List(Of String)
    Public Property Instance As DDTEngine.DDTInstance
End Class

''' <summary>
''' Orchestrator Session Start Request
''' </summary>
Public Class OrchestratorSessionStartRequest
    Public Property CompilationResult As Object
    Public Property Tasks As List(Of Object)
    Public Property DDTs As List(Of Object)
    Public Property Translations As Dictionary(Of String, String)
End Class

''' <summary>
''' Orchestrator Session Input Request
''' </summary>
Public Class OrchestratorSessionInputRequest
    Public Property Input As String
End Class
