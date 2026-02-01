Option Strict On
Option Explicit On

Imports System
Imports System.IO
Imports System.Linq
Imports System.Threading
Imports System.Threading.Tasks
Imports System.Collections.Generic
Imports System.Net.Http
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Hosting
Imports Microsoft.AspNetCore.Http
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Hosting
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler
Imports TaskEngine
Imports ApiServer.Models
Imports ApiServer.Helpers
Imports ApiServer.Validators
Imports ApiServer.Converters
Imports ApiServer.Services

Module Program
    ''' <summary>
    ''' Main entry point - runs ASP.NET Core HTTP server
    ''' </summary>
    Sub Main(args As String())
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
                                                Return HandleCompileFlow(context)
                                            End Function)

        ' POST /api/runtime/compile/task - Compile a single task (for chat simulator)
        app.MapPost("/api/runtime/compile/task", Function(context As HttpContext) As System.Threading.Tasks.Task(Of IResult)
                                                     Return HandleCompileTask(context)
                                                 End Function)

        ' POST /api/runtime/task/session/start - Chat Simulator diretto (solo UtteranceInterpretation)
        app.MapPost("/api/runtime/task/session/start", Async Function(context As HttpContext) As Task(Of IResult)
                                                           Console.WriteLine("🔵 [MapPost] /api/runtime/task/session/start - Handler called")
                                                           Return Await HandleTaskSessionStart(context)
                                                       End Function)

        ' GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        app.MapGet("/api/runtime/task/session/{id}/stream", Function(context As HttpContext, id As String) As System.Threading.Tasks.Task
                                                                Return HandleTaskSessionStream(context, id)
                                                            End Function)

        ' POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        app.MapPost("/api/runtime/task/session/{id}/input", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                Return HandleTaskSessionInput(context, id)
                                                            End Function)

        ' DELETE /api/runtime/task/session/{id} - Chat Simulator diretto
        app.MapDelete("/api/runtime/task/session/{id}", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                            Return HandleTaskSessionDelete(context, id)
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

    ''' <summary>
    ''' Handles POST /api/runtime/compile
    ''' </summary>
    Private Async Function HandleCompileFlow(context As HttpContext) As System.Threading.Tasks.Task
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
                System.Diagnostics.Debug.WriteLine($"📦 [HandleCompileFlow] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
            Catch readEx As Exception
                Console.WriteLine($"❌ [HandleCompileFlow] Error reading request body: {readEx.Message}")
                Console.WriteLine($"Stack trace: {readEx.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileFlow] Error reading request body: {readEx.Message}")

                Dim errorJson = "{""status"":""error"",""message"":""Failed to read request body"",""error"":""" & readEx.Message.Replace("""", "\""") & """}"
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 400
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                Return
            End Try

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [HandleCompileFlow] Empty request body")
                System.Diagnostics.Debug.WriteLine("❌ [HandleCompileFlow] Empty request body")

                Dim errorJson = "{""status"":""error"",""message"":""Empty request body""}"
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 400
                Await context.Response.WriteAsync(errorJson)
                Return
            End If

            Console.WriteLine($"📦 [HandleCompileFlow] Request body preview (first 1000 chars): {body.Substring(0, Math.Min(1000, body.Length))}")
            System.Diagnostics.Debug.WriteLine($"📦 [HandleCompileFlow] Request body preview (first 1000 chars): {body.Substring(0, Math.Min(1000, body.Length))}")

            ' Try to parse as JObject to inspect structure
            Try
                Dim jObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                If jObj("nodes") IsNot Nothing Then
                    Dim nodesArray = CType(jObj("nodes"), Newtonsoft.Json.Linq.JArray)
                    Console.WriteLine($"🔍 [HandleCompileFlow] JSON has {nodesArray.Count} nodes")
                    System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] JSON has {nodesArray.Count} nodes")

                    If nodesArray.Count > 0 Then
                        Dim firstNode = CType(nodesArray(0), Newtonsoft.Json.Linq.JObject)
                        Console.WriteLine($"🔍 [HandleCompileFlow] First node keys: {String.Join(", ", firstNode.Properties().Select(Function(p) p.Name))}")
                        System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] First node keys: {String.Join(", ", firstNode.Properties().Select(Function(p) p.Name))}")

                        ' Check for rows property
                        If firstNode("rows") IsNot Nothing Then
                            Dim rowsArray = CType(firstNode("rows"), Newtonsoft.Json.Linq.JArray)
                            Console.WriteLine($"✅ [HandleCompileFlow] First node has 'rows' property with {rowsArray.Count} items")
                            System.Diagnostics.Debug.WriteLine($"✅ [HandleCompileFlow] First node has 'rows' property with {rowsArray.Count} items")

                            If rowsArray.Count > 0 Then
                                Dim firstRow = CType(rowsArray(0), Newtonsoft.Json.Linq.JObject)
                                Console.WriteLine($"   First row keys: {String.Join(", ", firstRow.Properties().Select(Function(p) p.Name))}")
                                System.Diagnostics.Debug.WriteLine($"   First row keys: {String.Join(", ", firstRow.Properties().Select(Function(p) p.Name))}")
                            End If
                        Else
                            Console.WriteLine($"⚠️ [HandleCompileFlow] First node does NOT have 'rows' property!")
                            System.Diagnostics.Debug.WriteLine($"⚠️ [HandleCompileFlow] First node does NOT have 'rows' property!")

                            ' Check for alternative property names
                            Dim possibleNames = {"row", "data", "dataRows", "items", "tasks"}
                            For Each name In possibleNames
                                If firstNode(name) IsNot Nothing Then
                                    Console.WriteLine($"   Found alternative property: '{name}'")
                                    System.Diagnostics.Debug.WriteLine($"   Found alternative property: '{name}'")
                                End If
                            Next
                        End If
                    End If
                End If
            Catch parseEx As Exception
                Console.WriteLine($"⚠️ [HandleCompileFlow] Could not parse JSON for inspection: {parseEx.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [HandleCompileFlow] Could not parse JSON for inspection: {parseEx.Message}")
            End Try

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

                ' ✅ DEBUG: Log deserialized tasks to verify type and templateId
                If request.Tasks IsNot Nothing AndAlso request.Tasks.Count > 0 Then
                    Console.WriteLine($"🔍 [HandleCompileFlow] Deserialized {request.Tasks.Count} tasks:")
                    For i = 0 To Math.Min(4, request.Tasks.Count - 1)
                        Dim t = request.Tasks(i)
                        Console.WriteLine($"   Task[{i}]: Id={t.Id}, Type={If(t.Type.HasValue, t.Type.Value.ToString(), "NULL")}, TemplateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL/EMPTY", t.TemplateId)}, Value keys={If(t.Value IsNot Nothing, String.Join(", ", t.Value.Keys), "NULL")}")
                        System.Diagnostics.Debug.WriteLine($"   Task[{i}]: Id={t.Id}, Type={If(t.Type.HasValue, t.Type.Value.ToString(), "NULL")}, TemplateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL/EMPTY", t.TemplateId)}")
                    Next
                Else
                    Console.WriteLine($"⚠️ [HandleCompileFlow] No tasks in request (Tasks is Nothing or empty)")
                End If
            Catch jsonEx As JsonReaderException
                Console.WriteLine($"❌ [HandleCompileFlow] JSON deserialization error: {jsonEx.Message}")
                Console.WriteLine($"   Line: {jsonEx.LineNumber}, Position: {jsonEx.LinePosition}")
                Console.WriteLine($"   Path: {jsonEx.Path}")

                Dim errorJson = "{""status"":""error"",""message"":""Invalid JSON format"",""error"":""" & jsonEx.Message.Replace("""", "\""") & """,""line"":" & jsonEx.LineNumber & ",""position"":" & jsonEx.LinePosition & "}"
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 400
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                Return
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleCompileFlow] Deserialization error: {deserializeEx.Message}")
                Console.WriteLine($"Stack trace: {deserializeEx.StackTrace}")
                If deserializeEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {deserializeEx.InnerException.Message}")
                End If

                Dim errorJson = "{""status"":""error"",""message"":""Failed to deserialize request"",""error"":""" & deserializeEx.Message.Replace("""", "\""") & """}"
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 400
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                Return
            End Try

            If request Is Nothing Then
                Console.WriteLine("❌ [HandleCompileFlow] Deserialized request is Nothing")

                Dim errorJson = "{""status"":""error"",""message"":""Invalid request format""}"
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 400
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                Return
            End If

            Console.WriteLine($"✅ [HandleCompileFlow] Request deserialized: {If(request.Nodes IsNot Nothing, request.Nodes.Count, 0)} nodes, {If(request.Edges IsNot Nothing, request.Edges.Count, 0)} edges, {If(request.Tasks IsNot Nothing, request.Tasks.Count, 0)} tasks")
            System.Diagnostics.Debug.WriteLine($"✅ [HandleCompileFlow] Request deserialized: {If(request.Nodes IsNot Nothing, request.Nodes.Count, 0)} nodes")

            ' ✅ DEBUG: Log node details including rows
            If request.Nodes IsNot Nothing AndAlso request.Nodes.Count > 0 Then
                Console.WriteLine($"🔍 [HandleCompileFlow] Node details:")
                System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] Node details:")
                For i = 0 To Math.Min(4, request.Nodes.Count - 1)
                    Dim node = request.Nodes(i)
                    Dim rowsCount = If(node.Rows IsNot Nothing, node.Rows.Count, 0)
                    Console.WriteLine($"   Node[{i}]: Id={node.Id}, Label={If(String.IsNullOrEmpty(node.Label), "NULL/EMPTY", node.Label)}, Rows count={rowsCount}")
                    System.Diagnostics.Debug.WriteLine($"   Node[{i}]: Id={node.Id}, Rows count={rowsCount}")

                    If rowsCount > 0 Then
                        Console.WriteLine($"     Rows:")
                        System.Diagnostics.Debug.WriteLine($"     Rows:")
                        For j = 0 To Math.Min(4, rowsCount - 1)
                            Dim row = node.Rows(j)
                            Console.WriteLine($"       Row[{j}]: Id={row.Id}, TaskId={If(String.IsNullOrEmpty(row.TaskId), "NULL/EMPTY", row.TaskId)}")
                            System.Diagnostics.Debug.WriteLine($"       Row[{j}]: Id={row.Id}, TaskId={If(String.IsNullOrEmpty(row.TaskId), "NULL/EMPTY", row.TaskId)}")
                        Next
                    Else
                        Console.WriteLine($"     ⚠️ Node has NO rows!")
                        System.Diagnostics.Debug.WriteLine($"     ⚠️ Node has NO rows!")
                    End If
                Next
            End If

            ' ✅ DEBUG: Verify first few tasks have templateId
            If request.Tasks IsNot Nothing AndAlso request.Tasks.Count > 0 Then
                Console.WriteLine($"🔍 [HandleCompileFlow] First task details: Id={request.Tasks(0).Id}, TemplateId={If(String.IsNullOrEmpty(request.Tasks(0).TemplateId), "NULL/EMPTY", request.Tasks(0).TemplateId)}")
                System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] First task details: Id={request.Tasks(0).Id}, TemplateId={If(String.IsNullOrEmpty(request.Tasks(0).TemplateId), "NULL/EMPTY", request.Tasks(0).TemplateId)}")
            End If

            ' Validate and initialize - allow empty flows
            If request.Nodes Is Nothing Then
                request.Nodes = New List(Of Compiler.FlowNode)()
            End If
            If request.Edges Is Nothing Then
                request.Edges = New List(Of Compiler.FlowEdge)()
            End If
            If request.Tasks Is Nothing Then
                request.Tasks = New List(Of Compiler.Task)()
            End If
            ' ❌ RIMOSSO: request.DDTs - non più usato, struttura costruita da template

            ' Check if flow is empty - return valid JSON instead of calling compiler
            If request.Nodes.Count = 0 AndAlso request.Tasks.Count = 0 Then
                Console.WriteLine("⚠️ [HandleCompileFlow] Flow is empty, returning empty result")

                ' Use plain JSON string instead of object serialization
                Dim emptyFlowJson = "{""status"":""ok"",""message"":""Flow is empty"",""taskGroups"":[],""entryTaskGroupId"":null,""tasks"":[],""compiledBy"":""VB.NET_RUNTIME"",""timestamp"":""" & DateTime.UtcNow.ToString("O") & """}"

                Console.WriteLine("📤 [HandleCompileFlow] Returning empty flow response")
                Console.WriteLine($"   Response: {emptyFlowJson}")

                ' Return JSON string directly with proper content type
                context.Response.ContentType = "application/json"
                Await context.Response.WriteAsync(emptyFlowJson)
                Return
            End If

            ' Create Flow structure
            Dim flow As New Compiler.Flow() With {
                .Nodes = If(request.Nodes, New List(Of Compiler.FlowNode)()),
                .Edges = If(request.Edges, New List(Of Compiler.FlowEdge)()),
                .Tasks = If(request.Tasks, New List(Of Compiler.Task)())
            }

            ' Log Flow structure after creation
            Console.WriteLine($"🔍 [HandleCompileFlow] Flow structure created:")
            System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] Flow structure created:")
            Console.WriteLine($"   Flow.Nodes count: {If(flow.Nodes IsNot Nothing, flow.Nodes.Count, 0)}")
            System.Diagnostics.Debug.WriteLine($"   Flow.Nodes count: {If(flow.Nodes IsNot Nothing, flow.Nodes.Count, 0)}")
            If flow.Nodes IsNot Nothing AndAlso flow.Nodes.Count > 0 Then
                For i = 0 To Math.Min(4, flow.Nodes.Count - 1)
                    Dim node = flow.Nodes(i)
                    Dim rowsCount = If(node.Rows IsNot Nothing, node.Rows.Count, 0)
                    Console.WriteLine($"   Flow.Nodes[{i}]: Id={node.Id}, Rows count={rowsCount}")
                    System.Diagnostics.Debug.WriteLine($"   Flow.Nodes[{i}]: Id={node.Id}, Rows count={rowsCount}")
                Next
            End If

            ' Compile flow
            Dim compiler = New Compiler.FlowCompiler()
            Dim compilationResult = compiler.CompileFlow(flow)

            Console.WriteLine($"✅ [HandleCompileFlow] Compilation successful: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")
            System.Diagnostics.Debug.WriteLine($"✅ [HandleCompileFlow] Compilation successful: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")

            ' Detailed logging
            If compilationResult.TaskGroups IsNot Nothing Then
                Console.WriteLine($"   TaskGroups count: {compilationResult.TaskGroups.Count}")
                System.Diagnostics.Debug.WriteLine($"   TaskGroups count: {compilationResult.TaskGroups.Count}")
                For i = 0 To Math.Min(4, compilationResult.TaskGroups.Count - 1)
                    Dim tg = compilationResult.TaskGroups(i)
                    Console.WriteLine($"     TaskGroup[{i}]: NodeId={tg.NodeId}, Tasks count={If(tg.Tasks IsNot Nothing, tg.Tasks.Count, 0)}")
                    System.Diagnostics.Debug.WriteLine($"     TaskGroup[{i}]: NodeId={tg.NodeId}, Tasks count={If(tg.Tasks IsNot Nothing, tg.Tasks.Count, 0)}")
                Next
            Else
                Console.WriteLine($"   ⚠️ TaskGroups is Nothing!")
                System.Diagnostics.Debug.WriteLine($"   ⚠️ TaskGroups is Nothing!")
            End If

            Console.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
            Console.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")
            System.Diagnostics.Debug.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
            System.Diagnostics.Debug.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")

            ' Serialize response manually and write directly to response stream
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

            Console.WriteLine("📤 [HandleCompileFlow] Serializing response manually...")

            ' Serialize manually using Newtonsoft.Json to avoid Results.Json() issues
            Dim jsonResponse = Newtonsoft.Json.JsonConvert.SerializeObject(responseObj)

            Console.WriteLine($"   JSON length: {jsonResponse.Length} characters")
            Console.WriteLine($"   JSON preview: {If(jsonResponse.Length > 200, jsonResponse.Substring(0, 200) & "...", jsonResponse)}")

            context.Response.ContentType = "application/json"
            Await context.Response.WriteAsync(jsonResponse)
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleCompileFlow] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")

            ' Return error as plain JSON string
            Dim errorJson = "{""status"":""error"",""message"":""Compilation failed"",""error"":""" & ex.Message.Replace("""", "\""") & """,""timestamp"":""" & DateTime.UtcNow.ToString("O") & """}"

            Console.WriteLine("📤 [HandleCompileFlow] Returning error response")
            Console.WriteLine($"   Error: {errorJson}")

            context.Response.ContentType = "application/json"
            context.Response.StatusCode = 500
            context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
        End Try
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/compile/task - Compile a single task
    ''' </summary>
    Private Async Function HandleCompileTask(context As HttpContext) As Task(Of IResult)
        Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine("📥 [HandleCompileTask] Received single task compilation request")
        System.Diagnostics.Debug.WriteLine("📥 [HandleCompileTask] Received single task compilation request")

        Try
            ' Enable buffering
            Try
                context.Request.EnableBuffering()
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleCompileTask] EnableBuffering failed: {ex.Message}")
            End Try

            ' Reset stream position
            Try
                context.Request.Body.Position = 0
            Catch ex As Exception
                Console.WriteLine($"⚠️ [HandleCompileTask] Cannot reset stream position: {ex.Message}")
            End Try

            ' Read request body
            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
                Console.WriteLine($"📦 [HandleCompileTask] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
            Catch readEx As Exception
                Console.WriteLine($"❌ [HandleCompileTask] Error reading request body: {readEx.Message}")
                Return Results.BadRequest(New With {.error = "Failed to read request body", .message = readEx.Message})
            End Try

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [HandleCompileTask] Empty request body")
                Return Results.BadRequest(New With {.error = "Empty request body"})
            End If

            ' Deserialize request - use JObject to parse and extract task
            Dim requestObj As Newtonsoft.Json.Linq.JObject = Nothing
            Try
                Console.WriteLine("🔄 [HandleCompileTask] Starting JSON deserialization...")
                requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                Console.WriteLine($"✅ [HandleCompileTask] JSON deserialization completed")
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [HandleCompileTask] Deserialization error: {deserializeEx.Message}")
                Return Results.BadRequest(New With {.error = "Failed to deserialize request", .message = deserializeEx.Message})
            End Try

            If requestObj Is Nothing OrElse requestObj("task") Is Nothing Then
                Console.WriteLine("❌ [HandleCompileTask] Request or task is Nothing")
                Return Results.BadRequest(New With {.error = "Missing task in request"})
            End If

            ' Deserialize task
            Dim task As Compiler.Task = Nothing
            Try
                Dim taskJson = requestObj("task").ToString()
                task = JsonConvert.DeserializeObject(Of Compiler.Task)(taskJson, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
            Catch ex As Exception
                Console.WriteLine($"❌ [HandleCompileTask] Error deserializing task: {ex.Message}")
                Return Results.BadRequest(New With {.error = "Failed to deserialize task", .message = ex.Message})
            End Try

            If task Is Nothing Then
                Console.WriteLine("❌ [HandleCompileTask] Task is Nothing after deserialization")
                Return Results.BadRequest(New With {.error = "Task is null"})
            End If

            ' ❌ RIMOSSO: Deserializzazione ddts legacy
            ' Il nuovo modello usa TaskTree costruito da template, non più ddts array
            Console.WriteLine($"🔍 [HandleCompileTask] Task received: Id={task.Id}, Type={If(task.Type.HasValue, task.Type.Value.ToString(), "NULL")}")

            ' Validate task type
            If Not task.Type.HasValue Then
                Console.WriteLine("❌ [HandleCompileTask] Task has no Type")
                Return Results.BadRequest(New With {.error = "Task has no Type. Type is required."})
            End If

            Dim typeValue = task.Type.Value
            If Not [Enum].IsDefined(GetType(TaskEngine.TaskTypes), typeValue) Then
                Console.WriteLine($"❌ [HandleCompileTask] Invalid TaskType: {typeValue}")
                Return Results.BadRequest(New With {.error = $"Invalid TaskType: {typeValue}"})
            End If

            Dim taskType = CType(typeValue, TaskEngine.TaskTypes)
            Console.WriteLine($"✅ [HandleCompileTask] TaskType: {taskType} (value={typeValue})")

            ' Get appropriate compiler based on task type
            Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
            Console.WriteLine($"✅ [HandleCompileTask] Using compiler: {compiler.GetType().Name}")

            ' Create flow with task (no dummy row/node needed - compiler doesn't need them)
            Dim dummyFlow As New Compiler.Flow() With {
                .Tasks = New List(Of Compiler.Task) From {task},
                .Nodes = New List(Of Compiler.FlowNode)(),
                .Edges = New List(Of Compiler.FlowEdge)()
            }

            ' Compile the task (Chat Simulator: no flowchart metadata)
            Console.WriteLine($"🔄 [HandleCompileTask] Calling compiler.Compile for task {task.Id}...")
            Dim compiledTask = compiler.Compile(task, task.Id, dummyFlow)
            Console.WriteLine($"✅ [HandleCompileTask] Task compiled successfully: {compiledTask.GetType().Name}")

            ' Build response
            Dim responseObj = New With {
                .success = True,
                .taskId = task.Id,
                .taskType = taskType.ToString(),
                .compiler = compiler.GetType().Name,
                .compiledTaskType = compiledTask.GetType().Name,
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            Console.WriteLine($"✅ [HandleCompileTask] Compilation completed successfully")
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")

            Return Results.Ok(responseObj)

        Catch ex As Exception
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"❌ [HandleCompileTask] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileTask] Exception: {ex.Message}")
            If ex.InnerException IsNot Nothing Then
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}")
            End If
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
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
                .Tasks = If(request.Tasks, New List(Of Compiler.Task)())
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
                    ' Fallback: serialize and deserialize
                    Dim compilationResultJson = JsonConvert.SerializeObject(request.CompilationResult)
                    Console.WriteLine($"🔍 [API][OrchestratorSession] Serialized CompilationResult JSON length: {compilationResultJson.Length}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [API][OrchestratorSession] Serialized JSON length: {compilationResultJson.Length}")

                    ' Log first 500 chars of JSON to see structure
                    Console.WriteLine($"   JSON preview: {compilationResultJson.Substring(0, Math.Min(500, compilationResultJson.Length))}")
                    System.Diagnostics.Debug.WriteLine($"   JSON preview: {compilationResultJson.Substring(0, Math.Min(500, compilationResultJson.Length))}")

                    compilationResult = JsonConvert.DeserializeObject(Of Compiler.FlowCompilationResult)(compilationResultJson, New JsonSerializerSettings() With {
                        .NullValueHandling = NullValueHandling.Ignore,
                        .MissingMemberHandling = MissingMemberHandling.Ignore
                    })
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

            ' Return response
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            Dim jsonResponse = JsonConvert.SerializeObject(responseObj)
            context.Response.ContentType = "application/json; charset=utf-8"
            Await context.Response.WriteAsync(jsonResponse)

            Console.WriteLine($"✅ [API][OrchestratorSession] Response sent: {jsonResponse}")
            System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Response sent: {jsonResponse}")
            Console.Out.Flush()

            Return Results.Empty
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
    ''' Handles POST /api/runtime/orchestrator/session/start - OLD COMPLEX VERSION
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStart_OLD(context As HttpContext) As Task(Of IResult)
        ' Use both Console.WriteLine and System.Diagnostics.Debug for maximum visibility
        Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine("📥 [API][OrchestratorSession] FUNCTION STARTED")
        Console.WriteLine($"   Method: {context.Request.Method}")
        Console.WriteLine($"   Path: {context.Request.Path}")
        Console.WriteLine($"   Content-Type: {context.Request.ContentType}")
        Console.WriteLine($"   Content-Length: {If(context.Request.ContentLength.HasValue, context.Request.ContentLength.Value.ToString(), "unknown")}")
        Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine("📥 [API][OrchestratorSession] Function called")
        Console.WriteLine("🔍 [API][OrchestratorSession] Starting execution flow...")
        Console.WriteLine("🔍 [API][OrchestratorSession] About to enter Try block...")
        Console.WriteLine("🔍 [API][OrchestratorSession] BEFORE TRY BLOCK - Line 406")
        System.Diagnostics.Debug.WriteLine("🔍 BEFORE TRY BLOCK")

        Try
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine("🔍 [API][OrchestratorSession] INSIDE TRY BLOCK - Line 407")
            Console.Out.Flush()
            System.Diagnostics.Debug.WriteLine("🔍 INSIDE TRY BLOCK")
            Console.WriteLine("🔍 [API][OrchestratorSession] Inside Try block")
            Console.Out.Flush()
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.Out.Flush()
            Console.WriteLine("🔍 [API][OrchestratorSession] Line 415 - About to enable buffering...")
            Console.Out.Flush()
            ' Enable buffering to allow reading the body
            Try
                Console.WriteLine("🔍 [API][OrchestratorSession] Line 417 - Calling EnableBuffering()...")
                context.Request.EnableBuffering()
                Console.WriteLine("✅ [API][OrchestratorSession] EnableBuffering() succeeded")
            Catch ex As Exception
                Console.WriteLine($"⚠️ [API][OrchestratorSession] EnableBuffering failed (may already be enabled): {ex.Message}")
            End Try

            ' Reset stream position to beginning
            Console.WriteLine("🔍 [API][OrchestratorSession] Line 423 - About to reset stream position...")
            Try
                Console.WriteLine("🔍 [API][OrchestratorSession] Line 424 - Setting Body.Position = 0...")
                context.Request.Body.Position = 0
                Console.WriteLine("✅ [API][OrchestratorSession] Stream position reset succeeded")
            Catch ex As Exception
                Console.WriteLine($"⚠️ [API][OrchestratorSession] Cannot reset stream position: {ex.Message}")
            End Try

            Console.WriteLine("🔍 [API][OrchestratorSession] Line 429 - About to read request body...")
            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
                Console.WriteLine($"📦 [API][OrchestratorSession] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
                Console.WriteLine($"📦 [API][OrchestratorSession] Body preview (first 200 chars): {If(body IsNot Nothing, body.Substring(0, Math.Min(200, body.Length)), "null")}")
            Catch readEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Error reading request body: {readEx.Message}")
                Console.WriteLine($"Stack trace: {readEx.StackTrace}")
                Return Results.BadRequest(New With {
                    .error = "Failed to read request body",
                    .message = readEx.Message
                })
            End Try

            Console.WriteLine("🔍 [API][OrchestratorSession] Checking if body is empty... - Line 434")
            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("❌ [API][OrchestratorSession] Empty request body - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Empty request body"})
            End If
            Console.WriteLine("✅ [API][OrchestratorSession] Body is not empty, proceeding...")

            Console.WriteLine("🔍 [API][OrchestratorSession] About to deserialize request... - Line 443")
            Dim request As OrchestratorSessionStartRequest = Nothing
            Try
                Console.WriteLine("🔄 [API][OrchestratorSession] Starting JSON deserialization... - Line 445")
                request = JsonConvert.DeserializeObject(Of OrchestratorSessionStartRequest)(body, New JsonSerializerSettings() With {
                    .Error = Sub(sender, args)
                                 Console.WriteLine($"❌ [API][OrchestratorSession] JSON Error: {args.ErrorContext.Error.Message}")
                                 Console.WriteLine($"   Path: {args.ErrorContext.Path}")
                             End Sub,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [API][OrchestratorSession] JSON deserialization completed")
            Catch jsonEx As JsonReaderException
                Console.WriteLine($"❌ [API][OrchestratorSession] JSON deserialization error: {jsonEx.Message}")
                Console.WriteLine($"   Line: {jsonEx.LineNumber}, Position: {jsonEx.LinePosition}")
                Console.WriteLine($"   Path: {jsonEx.Path}")
                Return Results.BadRequest(New With {
                    .error = "Invalid JSON format",
                    .message = jsonEx.Message,
                    .line = jsonEx.LineNumber,
                    .position = jsonEx.LinePosition
                })
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Deserialization error: {deserializeEx.Message}")
                Console.WriteLine($"Stack trace: {deserializeEx.StackTrace}")
                If deserializeEx.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {deserializeEx.InnerException.Message}")
                End If
                Return Results.BadRequest(New With {
                    .error = "Failed to deserialize request",
                    .message = deserializeEx.Message
                })
            End Try

            Console.WriteLine("🔍 [API][OrchestratorSession] Checking if request is Nothing... - Line 477")
            If request Is Nothing Then
                Console.WriteLine("❌ [API][OrchestratorSession] Deserialized request is Nothing - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Invalid request format"})
            End If
            Console.WriteLine("✅ [API][OrchestratorSession] Request is not Nothing")

            Console.WriteLine("🔍 [API][OrchestratorSession] Checking if CompilationResult is Nothing... - Line 482")
            If request.CompilationResult Is Nothing Then
                Console.WriteLine("❌ [API][OrchestratorSession] Missing compilationResult - RETURNING BAD REQUEST")
                Return Results.BadRequest(New With {.error = "Missing compilationResult"})
            End If
            Console.WriteLine("✅ [API][OrchestratorSession] CompilationResult is not Nothing")

            ' Deserializza CompilationResult
            Console.WriteLine("🔍 [API][OrchestratorSession] About to deserialize CompilationResult... - Line 487")
            Dim compilationResult As Compiler.FlowCompilationResult = Nothing
            Try
                Console.WriteLine($"🔄 [API][OrchestratorSession] Starting CompilationResult deserialization... - Line 490")
                Dim compilationResultJson = JsonConvert.SerializeObject(request.CompilationResult)
                Console.WriteLine($"📦 [API][OrchestratorSession] CompilationResult JSON length: {compilationResultJson.Length} characters")
                Console.WriteLine($"📦 [API][OrchestratorSession] CompilationResult JSON preview: {compilationResultJson.Substring(0, Math.Min(500, compilationResultJson.Length))}")

                compilationResult = JsonConvert.DeserializeObject(Of Compiler.FlowCompilationResult)(compilationResultJson, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
                Console.WriteLine($"✅ [API][OrchestratorSession] CompilationResult deserialized: {If(compilationResult IsNot Nothing, compilationResult.TaskGroups.Count, 0)} task groups")
                If compilationResult IsNot Nothing Then
                    Console.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
                    Console.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")
                    Console.WriteLine($"   TaskGroups count: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)}")
                End If
            Catch deserializeEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Error deserializing CompilationResult: {deserializeEx.Message}")
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
                Console.WriteLine("❌ [API][OrchestratorSession] Deserialized CompilationResult is Nothing")
                Return Results.BadRequest(New With {.error = "Invalid CompilationResult format"})
            End If

            ' Genera session ID
            Dim sessionId = Guid.NewGuid().ToString()
            Console.WriteLine($"✅ [API][OrchestratorSession] Generated session ID: {sessionId}")

            ' Crea sessione usando SessionManager
            Try
                Console.WriteLine($"🔄 [API][OrchestratorSession] Calling SessionManager.CreateSession...")
                Dim session = SessionManager.CreateSession(
                    sessionId,
                    compilationResult,
                    request.Tasks,
                    request.Translations
                )
                Console.WriteLine($"✅ [API][OrchestratorSession] Session created successfully, orchestrator should be starting...")
            Catch sessionEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Error creating session: {sessionEx.Message}")
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

            Console.WriteLine("🔍 [API][OrchestratorSession] Line 551 - About to create response object...")
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }
            Console.WriteLine("🔍 [API][OrchestratorSession] Line 556 - Response object created")

            Console.WriteLine($"✅ [API][OrchestratorSession] Line 557 - Returning response: sessionId={sessionId}")

            ' Serialize manually to ensure Newtonsoft.Json is used
            Try
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .Formatting = Formatting.None
                })
                Console.WriteLine($"✅ [API][OrchestratorSession] Serialized response: {jsonResponse.Length} characters")
                Console.WriteLine($"   Response preview: {jsonResponse}")
                System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Serialized: {jsonResponse}")

                ' Set response headers and write directly to response stream
                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = jsonResponse.Length
                Await context.Response.WriteAsync(jsonResponse)
                Console.WriteLine($"✅ [API][OrchestratorSession] Response written to stream")
                System.Diagnostics.Debug.WriteLine($"✅ [API][OrchestratorSession] Response written")

                ' Return empty since we've written directly
                Return Results.Empty
            Catch serializationEx As Exception
                Console.WriteLine($"❌ [API][OrchestratorSession] Error serializing response: {serializationEx.Message}")
                Console.WriteLine($"Stack trace: {serializationEx.StackTrace}")
                ' Fallback to Results.Ok (will use default serializer)
                Return Results.Ok(responseObj)
            End Try
        Catch ex As Exception
            Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"❌ [API][OrchestratorSession] EXCEPTION CAUGHT IN OUTER CATCH BLOCK")
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
        Console.WriteLine("⚠️ [API][OrchestratorSession] AFTER TRY-CATCH BLOCK - This should never be reached")
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

    ''' <summary>
    ''' Reads and parses the HTTP request body as a TaskSessionStartRequest.
    ''' </summary>
    ''' <param name="context">The HTTP context containing the request body.</param>
    ''' <returns>A tuple containing: (Success As Boolean, Request As TaskSessionStartRequest, ErrorMessage As String)</returns>
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

    ' ValidateRequest moved to ApiServer.Validators.RequestValidators

    ' FetchTasksFromNodeJs, FindTaskById, FindTemplateForTask, LoadSubTemplatesRecursively, DeserializeTasks moved to ApiServer.Services.TaskDataService

    ' CompileTaskToRuntime moved to ApiServer.Services.TaskCompilationService

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

    ' ConvertCompiledToRuntimeTask moved to ApiServer.Converters.RuntimeTaskConverter

    ' ConvertTaskTreeToTaskTreeExpanded and ApplyStepsToTaskNodes moved to ApiServer.Converters.TaskTreeConverter

    ' CompileTaskTreeExpandedToCompiledTask moved to ApiServer.Services.TaskCompilationService

    ' ExtractTemplateIdFromTaskTreeExpanded, BuildStepsOverrideFromTaskTreeExpanded, ProcessNodeForStepsOverride moved to ApiServer.Converters.TaskTreeConverter

    ' ConvertRuntimeTaskToCompiledTaskUtteranceInterpretation moved to ApiServer.Converters.RuntimeTaskConverter

    ' CreateErrorResponse moved to ApiServer.Helpers.ResponseHelpers

    ''' <summary>
    ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
    ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
    ''' </summary>
    Private Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
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
                        Return CreateErrorResponse($"Failed to convert TaskTree to TaskTreeExpanded for task '{request.TaskId}'.", 400)
                    End If
                    Console.WriteLine($"✅ [HandleTaskSessionStart] ConvertTaskTreeToTaskTreeExpanded succeeded")

                    ' ✅ CORRETTO: Usa UtteranceInterpretationTaskCompiler (compilazione completa)
                    ' Compila TaskTreeExpanded → CompiledTaskUtteranceInterpretation
                    Dim compileResult = Await TaskCompilationService.CompileTaskTreeExpandedToCompiledTask(taskTreeExpanded, request.Translations, request.ProjectId, request.TaskId)

                    If compileResult Is Nothing Then
                        Return ResponseHelpers.CreateErrorResponse("Compilation failed: compileResult is Nothing", 500)
                    End If

                    If Not compileResult.Success Then
                        Console.WriteLine($"❌ [HandleTaskSessionStart] Compilation failed: {compileResult.ErrorMessage}")
                        Return CreateErrorResponse(compileResult.ErrorMessage, 400)
                    End If

                    compiledTask = compileResult.Result
                Catch ex As Exception
                    Console.WriteLine($"❌ [HandleTaskSessionStart] Exception processing TaskTree: {ex.Message}")
                    Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                    End If
                    Return CreateErrorResponse($"Failed to process TaskTree for task '{request.TaskId}'. Error: {ex.Message}", 400)
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
                    Return CreateErrorResponse(fetchResult.ErrorMessage, 400)
                End If
                Dim tasksArray = fetchResult.TasksArray

                ' 4. Find task by ID
                Dim taskObj = TaskDataService.FindTaskById(tasksArray, request.TaskId)
                If taskObj Is Nothing Then
                    Return CreateErrorResponse($"Task with ID '{request.TaskId}' was not found in project '{request.ProjectId}'. The task may have been deleted or the ID may be incorrect.", 400)
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
                    Return CreateErrorResponse(deserializeResult.ErrorMessage, 400)
                End If
                Dim allTemplates = deserializeResult.Tasks

                ' 8. Find main task and template in deserialized list
                Dim task = allTemplates.FirstOrDefault(Function(t) t.Id = request.TaskId)
                Dim template = allTemplates.FirstOrDefault(Function(t) t.Id = templateId)

                If task Is Nothing Then
                    Return CreateErrorResponse($"Failed to deserialize task with ID '{request.TaskId}'. The task JSON may be malformed.", 400)
                End If

                If template Is Nothing Then
                    Return CreateErrorResponse($"Failed to deserialize template with ID '{templateId}' for task '{request.TaskId}'. The template JSON may be malformed.", 400)
                End If

                ' Ensure task has templateId
                If String.IsNullOrEmpty(task.TemplateId) Then
                    task.TemplateId = template.Id
                End If

                ' 9. Validate task type
                Dim typeValidationResult = RequestValidators.ValidateTaskType(task)
                If Not typeValidationResult.IsValid Then
                    Return CreateErrorResponse(typeValidationResult.ErrorMessage, 400)
                End If

                ' 10. Compile task
                Dim compileResult = TaskCompilationService.CompileTaskToRuntime(task, allTemplates)
                If Not compileResult.Success Then
                    Return CreateErrorResponse(compileResult.ErrorMessage, 400)
                End If
                compiledTask = compileResult.Result
            End If

            ' 11. Validate compiled task before creating session
            If compiledTask Is Nothing Then
                Console.WriteLine($"❌ [HandleTaskSessionStart] compiledTask is Nothing - cannot create session")
                Return CreateErrorResponse("Compiled task is null. The compilation may have failed silently.", 500)
            End If

            ' 12. Create session
            Dim sessionId As String = Nothing
            Try
                sessionId = CreateTaskSession(compiledTask, request.Translations)
                If String.IsNullOrEmpty(sessionId) Then
                    Console.WriteLine($"❌ [HandleTaskSessionStart] CreateTaskSession returned empty sessionId")
                    Return CreateErrorResponse("Failed to create session: sessionId is empty.", 500)
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
                Return CreateErrorResponse($"Failed to create session: {ex.Message}", 500)
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
            Console.WriteLine($"❌ [HandleTaskSessionStart] UNEXPECTED EXCEPTION: {ex.Message}")
            Console.WriteLine($"   Exception type: {ex.GetType().Name}")
            Console.WriteLine($"   Stack trace: {ex.StackTrace}")
            If ex.InnerException IsNot Nothing Then
                Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                Console.WriteLine($"   Inner stack trace: {ex.InnerException.StackTrace}")
            End If
            Console.Out.Flush()
            System.Diagnostics.Debug.WriteLine($"❌ [HandleTaskSessionStart] UNEXPECTED EXCEPTION: {ex.Message}")
            Return CreateErrorResponse($"Unexpected error while starting task session: {ex.Message}", 500)
        End Try
    End Function

    ''' <summary>
    ''' Handles GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
    ''' </summary>
    Private Async Function HandleTaskSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
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
                Await System.Threading.Tasks.Task.Delay(Timeout.Infinite, context.RequestAborted)
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
    Private Async Function HandleTaskSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
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
    Private Async Function HandleTaskSessionDelete(context As HttpContext, sessionId As String) As Task(Of IResult)
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


