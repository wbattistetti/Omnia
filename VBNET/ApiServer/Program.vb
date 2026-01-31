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
            If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
                Console.WriteLine($"❌ [HandleCompileTask] Invalid TaskType: {typeValue}")
                Return Results.BadRequest(New With {.error = $"Invalid TaskType: {typeValue}"})
            End If

            Dim taskType = CType(typeValue, TaskTypes)
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

    ''' <summary>
    ''' Validates that the TaskSessionStartRequest contains all required fields (taskId and projectId).
    ''' </summary>
    ''' <param name="request">The request object to validate.</param>
    ''' <returns>A tuple containing: (IsValid As Boolean, ErrorMessage As String)</returns>
    Private Function ValidateRequest(request As TaskSessionStartRequest) As (IsValid As Boolean, ErrorMessage As String)
        If request Is Nothing Then
            Return (False, "Request object is null. Expected a valid TaskSessionStartRequest with taskId and projectId.")
        End If

        If String.IsNullOrEmpty(request.TaskId) Then
            Return (False, "TaskId is missing or empty. The request must include a valid taskId field.")
        End If

        If String.IsNullOrEmpty(request.ProjectId) Then
            Return (False, "ProjectId is missing or empty. The request must include a valid projectId field.")
        End If

        Return (True, Nothing)
    End Function

    ''' <summary>
    ''' Fetches all tasks (project tasks + referenced factory templates) from the Node.js backend API.
    ''' </summary>
    ''' <param name="projectId">The project identifier to load tasks for.</param>
    ''' <returns>A tuple containing: (Success As Boolean, TasksArray As JArray, ErrorMessage As String)</returns>
    Private Async Function FetchTasksFromNodeJs(projectId As String) As Task(Of (Success As Boolean, TasksArray As JArray, ErrorMessage As String))
        Try
            Using httpClient As New HttpClient()
                httpClient.Timeout = TimeSpan.FromSeconds(30)

                Dim tasksUrl = $"http://localhost:3100/api/projects/{Uri.EscapeDataString(projectId)}/tasks"
                Dim response = Await httpClient.GetAsync(tasksUrl)

                If Not response.IsSuccessStatusCode Then
                    Return (False, Nothing, $"Node.js API returned error status {response.StatusCode} when fetching tasks for project '{projectId}'. URL: {tasksUrl}")
                End If

                Dim responseJson = Await response.Content.ReadAsStringAsync()
                Dim responseObj = JsonConvert.DeserializeObject(Of JObject)(responseJson)
                Dim itemsToken = responseObj("items")
                Dim tasksArray As JArray = If(itemsToken IsNot Nothing AndAlso TypeOf itemsToken Is JArray, CType(itemsToken, JArray), New JArray())

                Return (True, tasksArray, Nothing)
            End Using
        Catch ex As Exception
            Return (False, Nothing, $"Failed to fetch tasks from Node.js API for project '{projectId}'. Error: {ex.Message}")
        End Try
    End Function

    ''' <summary>
    ''' Finds a task object by its ID within a JArray of tasks.
    ''' </summary>
    ''' <param name="tasksArray">The array of tasks to search in.</param>
    ''' <param name="taskId">The task identifier to find.</param>
    ''' <returns>The JObject representing the task, or Nothing if not found.</returns>
    Private Function FindTaskById(tasksArray As JArray, taskId As String) As JObject
        For Each item In tasksArray
            Dim idToken = item("id")
            If idToken IsNot Nothing AndAlso idToken.ToString() = taskId Then
                Return CType(item, JObject)
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>
    ''' Finds the template object for a given task. If the task has a templateId, searches for that template.
    ''' Otherwise, uses the task itself as the template.
    ''' </summary>
    ''' <param name="tasksArray">The array of tasks to search in.</param>
    ''' <param name="taskObj">The task object to find the template for.</param>
    ''' <param name="taskId">The task identifier (used as fallback if templateId is missing).</param>
    ''' <returns>A tuple containing: (TemplateObj As JObject, TemplateId As String)</returns>
    Private Function FindTemplateForTask(tasksArray As JArray, taskObj As JObject, taskId As String) As (TemplateObj As JObject, TemplateId As String)
        Dim templateIdToken = taskObj("templateId")
        Dim templateId = If(templateIdToken IsNot Nothing, templateIdToken.ToString(), taskId)

        If String.IsNullOrEmpty(templateId) OrElse templateId = taskId Then
            ' Task is standalone, use itself as template
            Return (taskObj, taskId)
        End If

        ' Search for template in tasks array
        Dim templateObj = FindTaskById(tasksArray, templateId)
        If templateObj IsNot Nothing Then
            Return (templateObj, templateId)
        End If

        ' Template not found, fallback to task itself
        Return (taskObj, taskId)
    End Function

    ''' <summary>
    ''' Recursively loads all sub-templates referenced by a template's subTasksIds field.
    ''' </summary>
    ''' <param name="tasksArray">The array of all available tasks (project + factory).</param>
    ''' <param name="rootTemplate">The root template to start loading from.</param>
    ''' <param name="loadedTemplateIds">A set of already loaded template IDs to avoid duplicates.</param>
    ''' <param name="allTemplatesList">The list to accumulate all loaded templates.</param>
    Private Sub LoadSubTemplatesRecursively(tasksArray As JArray, rootTemplate As JObject, ByRef loadedTemplateIds As HashSet(Of String), ByRef allTemplatesList As List(Of JObject))
        If rootTemplate Is Nothing Then Return

        Dim subTasksIds = rootTemplate("subTasksIds")
        If subTasksIds Is Nothing OrElse Not TypeOf subTasksIds Is JArray Then Return

        For Each subTaskIdToken In CType(subTasksIds, JArray)
            Dim subTaskId = If(subTaskIdToken IsNot Nothing, subTaskIdToken.ToString(), Nothing)
            If String.IsNullOrEmpty(subTaskId) OrElse loadedTemplateIds.Contains(subTaskId) Then
                Continue For
            End If

            Dim subTemplateObj = FindTaskById(tasksArray, subTaskId)
            If subTemplateObj IsNot Nothing Then
                allTemplatesList.Add(subTemplateObj)
                loadedTemplateIds.Add(subTaskId)
                ' Recursively load sub-templates of this sub-template
                LoadSubTemplatesRecursively(tasksArray, subTemplateObj, loadedTemplateIds, allTemplatesList)
            Else
                Dim rootTemplateIdToken = rootTemplate("id")
                Dim rootTemplateId = If(rootTemplateIdToken IsNot Nothing, rootTemplateIdToken.ToString(), "unknown")
                Console.WriteLine($"⚠️ [LoadSubTemplatesRecursively] Sub-template with ID '{subTaskId}' referenced by template '{rootTemplateId}' was not found in tasks array. This may cause compilation errors.")
            End If
        Next
    End Sub

    ''' <summary>
    ''' Deserializes a list of JObject tasks into Compiler.Task objects.
    ''' </summary>
    ''' <param name="templatesList">The list of JObject templates to deserialize.</param>
    ''' <returns>A tuple containing: (Success As Boolean, Tasks As List(Of Compiler.Task), ErrorMessage As String)</returns>
    Private Function DeserializeTasks(templatesList As List(Of JObject)) As (Success As Boolean, Tasks As List(Of Compiler.Task), ErrorMessage As String)
        Dim settings As New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore,
            .MissingMemberHandling = MissingMemberHandling.Ignore
        }
        settings.Converters.Add(New DialogueStepListConverter())

        Dim deserializedTasks As New List(Of Compiler.Task)()

        For Each templateObj In templatesList
            Try
                Dim task = JsonConvert.DeserializeObject(Of Compiler.Task)(templateObj.ToString(), settings)
                If task IsNot Nothing Then
                    deserializedTasks.Add(task)
                End If
            Catch ex As Exception
                Dim templateIdToken = templateObj("id")
                Dim templateId = If(templateIdToken IsNot Nothing, templateIdToken.ToString(), "unknown")
                Return (False, Nothing, $"Failed to deserialize template with ID '{templateId}'. Error: {ex.Message}")
            End Try
        Next

        Return (True, deserializedTasks, Nothing)
    End Function

    ''' <summary>
    ''' Validates that a task is of type UtteranceInterpretation, which is required for task session compilation.
    ''' </summary>
    ''' <param name="task">The task to validate.</param>
    ''' <returns>A tuple containing: (IsValid As Boolean, ErrorMessage As String)</returns>
    Private Function ValidateTaskType(task As Compiler.Task) As (IsValid As Boolean, ErrorMessage As String)
        If task Is Nothing Then
            Return (False, "Task object is null. Cannot validate task type.")
        End If

        If Not task.Type.HasValue Then
            Return (False, $"Task with ID '{task.Id}' has no type specified. Expected type: UtteranceInterpretation.")
        End If

        If task.Type.Value <> TaskTypes.UtteranceInterpretation Then
            Dim actualType = task.Type.Value.ToString()
            Return (False, $"Task with ID '{task.Id}' has type '{actualType}', but expected type 'UtteranceInterpretation'. Only UtteranceInterpretation tasks can be compiled into task sessions.")
        End If

        Return (True, Nothing)
    End Function

    ''' <summary>
    ''' Compiles a task into a TaskTreeRuntime using the UtteranceInterpretationTaskCompiler.
    ''' Requires all referenced templates to be available in the Flow object.
    ''' </summary>
    ''' <param name="task">The task instance to compile.</param>
    ''' <param name="allTemplates">All templates (main + sub-templates) needed for compilation.</param>
    ''' <returns>A tuple containing: (Success As Boolean, Result As Compiler.CompiledTaskUtteranceInterpretation, ErrorMessage As String)</returns>
    Private Function CompileTaskToRuntime(task As Compiler.Task, allTemplates As List(Of Compiler.Task)) As (Success As Boolean, Result As Compiler.CompiledTaskUtteranceInterpretation, ErrorMessage As String)
        Try
            Dim flow As New Compiler.Flow() With {
                .Tasks = allTemplates
            }

            ' Compile task (Chat Simulator: no flowchart metadata needed)
            Dim compiler As New UtteranceInterpretationTaskCompiler()
            Dim compiledTask = compiler.Compile(task, task.Id, flow)

            If compiledTask Is Nothing Then
                Return (False, Nothing, $"Task compiler returned null for task '{task.Id}'. The task may be malformed or missing required fields.")
            End If

            If TypeOf compiledTask IsNot Compiler.CompiledTaskUtteranceInterpretation Then
                Dim actualType = compiledTask.GetType().Name
                Return (False, Nothing, $"Task compiler returned unexpected type '{actualType}' for task '{task.Id}'. Expected CompiledTaskUtteranceInterpretation.")
            End If

            Dim utteranceTask = DirectCast(compiledTask, Compiler.CompiledTaskUtteranceInterpretation)
            If (utteranceTask.Steps Is Nothing OrElse utteranceTask.Steps.Count = 0) AndAlso
               Not utteranceTask.HasSubTasks() Then
                Return (False, Nothing, $"Compiled task for '{task.Id}' has no Steps or SubTasks. The compilation may have failed silently.")
            End If

            Return (True, utteranceTask, Nothing)
        Catch ex As Exception
            Return (False, Nothing, $"Failed to compile task '{task.Id}' into TaskTreeRuntime. Error: {ex.Message}")
        End Try
    End Function

    ''' <summary>
    ''' Creates a new task session and registers it in the SessionManager.
    ''' </summary>
    ''' <param name="compiledTask">The compiled task containing the runtime properties.</param>
    ''' <param name="translations">Optional dictionary of translations for the session.</param>
    ''' <returns>The session ID of the newly created session.</returns>
    Private Function CreateTaskSession(compiledTask As Compiler.CompiledTaskUtteranceInterpretation, translations As Dictionary(Of String, String)) As String
        Dim sessionId = Guid.NewGuid().ToString()
        Dim translationsDict = If(translations, New Dictionary(Of String, String)())
        ' ✅ TODO: SessionManager deve essere aggiornato per accettare CompiledTaskUtteranceInterpretation
        ' Per ora convertiamo in RuntimeTask (temporaneo)
        Dim runtimeTask = ConvertCompiledToRuntimeTask(compiledTask)
        SessionManager.CreateTaskSession(sessionId, runtimeTask, translationsDict)
        Return sessionId
    End Function

    ''' <summary>
    ''' Converte CompiledTaskUtteranceInterpretation in RuntimeTask (helper temporaneo)
    ''' TODO: Aggiornare SessionManager per accettare direttamente CompiledTaskUtteranceInterpretation
    ''' </summary>
    Private Function ConvertCompiledToRuntimeTask(compiled As Compiler.CompiledTaskUtteranceInterpretation) As Compiler.RuntimeTask
        Dim runtimeTask As New Compiler.RuntimeTask() With {
            .Id = compiled.Id,
            .Condition = compiled.Condition,
            .Steps = compiled.Steps,
            .Constraints = compiled.Constraints,
            .NlpContract = compiled.NlpContract
        }

        ' ✅ Copia SubTasks ricorsivamente (solo se presenti)
        If compiled.HasSubTasks() Then
            runtimeTask.SubTasks = New List(Of Compiler.RuntimeTask)()
            For Each subCompiled As Compiler.CompiledTaskUtteranceInterpretation In compiled.SubTasks
                runtimeTask.SubTasks.Add(ConvertCompiledToRuntimeTask(subCompiled))
            Next
        End If

        Return runtimeTask
    End Function

    ''' <summary>
    ''' ✅ NUOVO: Converte TaskTree (JSON dal frontend) in TaskTreeRuntime (per il compilatore)
    ''' Applica gli steps ai nodi durante la conversione
    ''' </summary>
    ''' <param name="taskTreeJson">Il TaskTree come JObject dal frontend</param>
    ''' <param name="taskId">L'ID del task (per identificazione)</param>
    ''' <returns>TaskTreeRuntime pronto per la compilazione</returns>
    Private Function ConvertTaskTreeToTaskTreeRuntime(taskTreeJson As JObject, taskId As String) As Compiler.TaskTreeRuntime
        Try
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] START - Converting TaskTree to TaskTreeRuntime (taskId={taskId})")
            System.Diagnostics.Debug.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] START - Converting TaskTree to TaskTreeRuntime")

            ' ✅ Verifica che taskTreeJson non sia null
            If taskTreeJson Is Nothing Then
                Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeRuntime] taskTreeJson is Nothing")
                Return Nothing
            End If

            ' ✅ Log struttura JSON
            Dim jsonKeysList As New List(Of String)()
            For Each prop In taskTreeJson.Properties()
                jsonKeysList.Add(prop.Name)
            Next
            Dim jsonKeys = String.Join(", ", jsonKeysList)
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] TaskTree JSON keys: {jsonKeys}")

            Dim jsonString = taskTreeJson.ToString()
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] JSON length: {jsonString.Length}")
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] JSON preview (first 1000 chars): {jsonString.Substring(0, Math.Min(1000, jsonString.Length))}")

            ' ✅ Estrai steps dal TaskTree (keyed by templateId)
            Dim stepsDict As Dictionary(Of String, Object) = Nothing
            If taskTreeJson("steps") IsNot Nothing Then
                Try
                    Dim stepsJson = taskTreeJson("steps").ToString()
                    Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Steps JSON found, length: {stepsJson.Length}")
                    Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Steps JSON preview: {stepsJson.Substring(0, Math.Min(500, stepsJson.Length))}")

                    stepsDict = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(stepsJson)
                    Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Found {If(stepsDict IsNot Nothing, stepsDict.Count, 0)} step overrides")
                    If stepsDict IsNot Nothing Then
                        For Each kvp In stepsDict
                            Console.WriteLine($"   - templateId: {kvp.Key}, value type: {If(kvp.Value IsNot Nothing, kvp.Value.GetType().Name, "Nothing")}")
                        Next
                    End If
                Catch ex As Exception
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeRuntime] Failed to parse steps: {ex.Message}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                End Try
            Else
                Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeRuntime] No 'steps' property found in TaskTree")
            End If

            ' Deserializza TaskTree JSON in TaskTreeRuntime (senza steps, che verranno applicati dopo)
            Dim settings As New JsonSerializerSettings() With {
                .NullValueHandling = NullValueHandling.Ignore,
                .MissingMemberHandling = MissingMemberHandling.Ignore
            }

            ' ✅ TaskTree dal frontend ha: { label, nodes, steps, constraints, introduction }
            ' ✅ TaskTreeRuntime ha: { id, label, nodes, translations, introduction, constraints }
            ' La conversione è diretta, ma dobbiamo aggiungere l'id e applicare gli steps
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Attempting deserialization...")
            Dim taskTreeRuntime = JsonConvert.DeserializeObject(Of Compiler.TaskTreeRuntime)(taskTreeJson.ToString(), settings)
            If taskTreeRuntime Is Nothing Then
                Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeRuntime] Failed to deserialize TaskTree - returned Nothing")
                Return Nothing
            End If
            Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Deserialization successful")

            ' ✅ Imposta ID se mancante
            If String.IsNullOrEmpty(taskTreeRuntime.Id) Then
                taskTreeRuntime.Id = taskId
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Set Id to: {taskId}")
            Else
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Id already set: {taskTreeRuntime.Id}")
            End If

            ' ✅ Inizializza collections se mancanti
            If taskTreeRuntime.Nodes Is Nothing Then
                taskTreeRuntime.Nodes = New List(Of Compiler.TaskNode)()
                Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeRuntime] Nodes was Nothing, initialized empty list")
            Else
                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Nodes count: {taskTreeRuntime.Nodes.Count}")
                For i = 0 To taskTreeRuntime.Nodes.Count - 1
                    Dim node = taskTreeRuntime.Nodes(i)
                    Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Name={node.Name}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}, SubTasks.Count={If(node.SubTasks IsNot Nothing, node.SubTasks.Count, 0)}")
                Next
            End If
            If taskTreeRuntime.Translations Is Nothing Then
                taskTreeRuntime.Translations = New Dictionary(Of String, String)()
            End If
            If taskTreeRuntime.Constraints Is Nothing Then
                taskTreeRuntime.Constraints = New List(Of Object)()
            End If

            ' ✅ Applica steps ai nodi (se presenti)
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Checking if steps should be applied...")
            Console.WriteLine($"   stepsDict IsNot Nothing: {stepsDict IsNot Nothing}")
            Console.WriteLine($"   stepsDict.Count: {If(stepsDict IsNot Nothing, stepsDict.Count, 0)}")
            Console.WriteLine($"   taskTreeRuntime.Nodes.Count: {taskTreeRuntime.Nodes.Count}")

            If stepsDict IsNot Nothing AndAlso stepsDict.Count > 0 AndAlso taskTreeRuntime.Nodes.Count > 0 Then
                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Applying steps to nodes...")
                ApplyStepsToTaskNodes(taskTreeRuntime.Nodes, stepsDict)
            Else
                Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeRuntime] Steps NOT applied - conditions not met")
            End If

            ' ✅ Log finale stato dei nodi dopo applicazione steps
            Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeRuntime] Final node states after steps application:")
            For i = 0 To taskTreeRuntime.Nodes.Count - 1
                Dim node = taskTreeRuntime.Nodes(i)
                Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}")
                If node.Steps IsNot Nothing AndAlso node.Steps.Count > 0 Then
                    For j = 0 To node.Steps.Count - 1
                        Dim stepItem = node.Steps(j)
                        Console.WriteLine($"      Step[{j}]: Type={stepItem.Type}, Escalations.Count={If(stepItem.Escalations IsNot Nothing, stepItem.Escalations.Count, 0)}")
                    Next
                End If
            Next

            Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Converted successfully: {taskTreeRuntime.Nodes.Count} nodes, {If(stepsDict IsNot Nothing, stepsDict.Count, 0)} step overrides applied")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            System.Diagnostics.Debug.WriteLine($"✅ [ConvertTaskTreeToTaskTreeRuntime] Converted successfully")

            Return taskTreeRuntime
        Catch ex As Exception
            Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeRuntime] Error: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [ConvertTaskTreeToTaskTreeRuntime] Error: {ex.ToString()}")
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' ✅ Helper: Applica steps override ai TaskNode (ricorsivo)
    ''' Usa la stessa logica di UtteranceInterpretationTaskCompiler.ApplyStepsOverrides
    ''' </summary>
    Private Sub ApplyStepsToTaskNodes(nodes As List(Of Compiler.TaskNode), stepsDict As Dictionary(Of String, Object))
        Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] START - Processing {nodes.Count} nodes, {stepsDict.Count} step overrides available")
        For Each node In nodes
            Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Processing node: Id={node.Id}, TemplateId={node.TemplateId}, CurrentSteps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}")

            ' ✅ Applica steps se presente override per questo templateId
            If String.IsNullOrEmpty(node.TemplateId) Then
                Console.WriteLine($"⚠️ [ApplyStepsToTaskNodes] Node {node.Id} has empty TemplateId, skipping")
            ElseIf Not stepsDict.ContainsKey(node.TemplateId) Then
                Console.WriteLine($"⚠️ [ApplyStepsToTaskNodes] Node {node.Id} (templateId={node.TemplateId}) not found in stepsDict")
                Console.WriteLine($"   Available templateIds in stepsDict: {String.Join(", ", stepsDict.Keys)}")
            Else
                Console.WriteLine($"✅ [ApplyStepsToTaskNodes] Found override for node {node.Id} (templateId={node.TemplateId})")
                Try
                    Dim overrideValue As Object = stepsDict(node.TemplateId)
                    Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Override value type: {If(overrideValue IsNot Nothing, overrideValue.GetType().Name, "Nothing")}")

                    If overrideValue IsNot Nothing Then
                        ' ✅ Usa DialogueStepListConverter per convertire oggetto → List(Of DialogueStep)
                        Dim overrideJson = JsonConvert.SerializeObject(overrideValue)
                        Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Serialized override JSON length: {overrideJson.Length}")
                        Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Override JSON preview: {overrideJson.Substring(0, Math.Min(500, overrideJson.Length))}")

                        Dim settings As New JsonSerializerSettings()
                        settings.Converters.Add(New Compiler.DialogueStepListConverter())
                        Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of Compiler.DialogueStep))(overrideJson, settings)

                        If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                            node.Steps = overrideSteps
                            Console.WriteLine($"✅ [ApplyStepsToTaskNodes] Applied {overrideSteps.Count} steps to node {node.Id} (templateId={node.TemplateId})")
                            For i = 0 To overrideSteps.Count - 1
                                Dim stepItem = overrideSteps(i)
                                Console.WriteLine($"   Step[{i}]: Type={stepItem.Type}, Escalations.Count={If(stepItem.Escalations IsNot Nothing, stepItem.Escalations.Count, 0)}")
                            Next
                        Else
                            Console.WriteLine($"⚠️ [ApplyStepsToTaskNodes] Deserialized steps list is Nothing or empty for node {node.Id}")
                        End If
                    Else
                        Console.WriteLine($"⚠️ [ApplyStepsToTaskNodes] Override value is Nothing for node {node.Id}")
                    End If
                Catch ex As Exception
                    Console.WriteLine($"❌ [ApplyStepsToTaskNodes] Failed to apply steps to node {node.Id}: {ex.Message}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                End Try
            End If

            ' ✅ Ricorsione per subTasks
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Recursing into {node.SubTasks.Count} subTasks of node {node.Id}")
                ApplyStepsToTaskNodes(node.SubTasks, stepsDict)
            End If
        Next
        Console.WriteLine($"✅ [ApplyStepsToTaskNodes] END - Processed {nodes.Count} nodes")
    End Sub

    ''' <summary>
    ''' ✅ NUOVO: Compila TaskTreeRuntime in CompiledTaskUtteranceInterpretation
    ''' Usa TaskAssembler per compilare TaskTreeRuntime → RuntimeTask, poi converte in CompiledTaskUtteranceInterpretation
    ''' </summary>
    ''' <param name="taskTreeRuntime">Il TaskTreeRuntime da compilare</param>
    ''' <param name="translations">Le traduzioni per la risoluzione dei GUID</param>
    ''' <returns>Risultato della compilazione</returns>
    Private Function CompileTaskTreeRuntimeToRuntime(taskTreeRuntime As Compiler.TaskTreeRuntime, translations As Dictionary(Of String, String)) As (Success As Boolean, Result As Compiler.CompiledTaskUtteranceInterpretation, ErrorMessage As String)
        Try
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] START - Compiling TaskTreeRuntime (id={taskTreeRuntime.Id})")
            System.Diagnostics.Debug.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] START - Compiling TaskTreeRuntime")

            ' ✅ Log stato iniziale TaskTreeRuntime
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] TaskTreeRuntime state:")
            Console.WriteLine($"   Id: {taskTreeRuntime.Id}")
            Console.WriteLine($"   Label: {taskTreeRuntime.Label}")
            Console.WriteLine($"   Nodes.Count: {If(taskTreeRuntime.Nodes IsNot Nothing, taskTreeRuntime.Nodes.Count, 0)}")
            If taskTreeRuntime.Nodes IsNot Nothing Then
                For i = 0 To taskTreeRuntime.Nodes.Count - 1
                    Dim node = taskTreeRuntime.Nodes(i)
                    Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}")
                    If node.Steps IsNot Nothing AndAlso node.Steps.Count > 0 Then
                        For j = 0 To node.Steps.Count - 1
                            Dim stepItem = node.Steps(j)
                            Console.WriteLine($"      Step[{j}]: Type={stepItem.Type}, Escalations.Count={If(stepItem.Escalations IsNot Nothing, stepItem.Escalations.Count, 0)}")
                        Next
                    End If
                Next
            End If

            ' ✅ Usa TaskAssembler per compilare TaskTreeRuntime → RuntimeTask
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Creating TaskAssembler...")
            Dim assembler As New Compiler.TaskAssembler()
            If translations IsNot Nothing Then
                assembler.SetTranslations(translations)
                Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Set {translations.Count} translations")
            End If

            ' ✅ Imposta traduzioni nel TaskTreeRuntime per la risoluzione GUID
            If translations IsNot Nothing Then
                taskTreeRuntime.Translations = translations
            End If

            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Calling assembler.Compile()...")
            Dim runtimeTask = assembler.Compile(taskTreeRuntime)
            If runtimeTask Is Nothing Then
                Console.WriteLine($"❌ [CompileTaskTreeRuntimeToRuntime] TaskAssembler returned null")
                Return (False, Nothing, $"TaskAssembler returned null for TaskTreeRuntime '{taskTreeRuntime.Id}'. The TaskTree may be malformed.")
            End If
            Console.WriteLine($"✅ [CompileTaskTreeRuntimeToRuntime] TaskAssembler.Compile() returned RuntimeTask")

            ' ✅ Log stato RuntimeTask dopo compilazione
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] RuntimeTask state:")
            Console.WriteLine($"   Id: {runtimeTask.Id}")
            Console.WriteLine($"   Steps.Count: {If(runtimeTask.Steps IsNot Nothing, runtimeTask.Steps.Count, 0)}")
            If runtimeTask.Steps IsNot Nothing AndAlso runtimeTask.Steps.Count > 0 Then
                For i = 0 To runtimeTask.Steps.Count - 1
                    Dim stepItem = runtimeTask.Steps(i)
                    Console.WriteLine($"   Step[{i}]: Type={stepItem.Type}, Escalations.Count={If(stepItem.Escalations IsNot Nothing, stepItem.Escalations.Count, 0)}")
                Next
            End If
            Console.WriteLine($"   HasSubTasks: {runtimeTask.HasSubTasks()}")
            If runtimeTask.HasSubTasks() Then
                Console.WriteLine($"   SubTasks.Count: {runtimeTask.SubTasks.Count}")
            End If

            ' ✅ Converti RuntimeTask in CompiledTaskUtteranceInterpretation
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Converting RuntimeTask to CompiledTaskUtteranceInterpretation...")
            Dim compiledTask As New Compiler.CompiledTaskUtteranceInterpretation() With {
                .Id = runtimeTask.Id,
                .Condition = runtimeTask.Condition,
                .Steps = runtimeTask.Steps,
                .Constraints = runtimeTask.Constraints,
                .NlpContract = runtimeTask.NlpContract
            }
            Console.WriteLine($"✅ [CompileTaskTreeRuntimeToRuntime] Created CompiledTaskUtteranceInterpretation")
            Console.WriteLine($"   Steps.Count: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)}")

            ' ✅ Copia SubTasks ricorsivamente (solo se presenti)
            If runtimeTask.HasSubTasks() Then
                Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Copying {runtimeTask.SubTasks.Count} SubTasks...")
                compiledTask.SubTasks = New List(Of Compiler.CompiledTaskUtteranceInterpretation)()
                For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                    Dim subCompiled = ConvertRuntimeTaskToCompiledTaskUtteranceInterpretation(subTask)
                    compiledTask.SubTasks.Add(subCompiled)
                    Console.WriteLine($"   SubTask: Id={subCompiled.Id}, Steps.Count={If(subCompiled.Steps IsNot Nothing, subCompiled.Steps.Count, 0)}")
                Next
            Else
                compiledTask.SubTasks = Nothing
                Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] No SubTasks (atomic task)")
            End If

            ' ✅ Valida che abbia almeno Steps o SubTasks
            Console.WriteLine($"🔍 [CompileTaskTreeRuntimeToRuntime] Validating compiled task...")
            Console.WriteLine($"   Steps IsNot Nothing: {compiledTask.Steps IsNot Nothing}")
            Console.WriteLine($"   Steps.Count: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)}")
            Console.WriteLine($"   HasSubTasks: {compiledTask.HasSubTasks()}")

            If (compiledTask.Steps Is Nothing OrElse compiledTask.Steps.Count = 0) AndAlso
               Not compiledTask.HasSubTasks() Then
                Console.WriteLine($"❌ [CompileTaskTreeRuntimeToRuntime] Validation FAILED - no Steps and no SubTasks")
                Return (False, Nothing, $"Compiled TaskTreeRuntime '{taskTreeRuntime.Id}' has no Steps or SubTasks. The compilation may have failed silently.")
            End If

            Console.WriteLine($"✅ [CompileTaskTreeRuntimeToRuntime] Compiled successfully: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)} steps, {If(compiledTask.HasSubTasks(), compiledTask.SubTasks.Count, 0)} subTasks")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            System.Diagnostics.Debug.WriteLine($"✅ [CompileTaskTreeRuntimeToRuntime] Compiled successfully")

            Return (True, compiledTask, Nothing)
        Catch ex As Exception
            Console.WriteLine($"❌ [CompileTaskTreeRuntimeToRuntime] Error: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [CompileTaskTreeRuntimeToRuntime] Error: {ex.ToString()}")
            Return (False, Nothing, $"Failed to compile TaskTreeRuntime. Error: {ex.Message}")
        End Try
    End Function

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in CompiledTaskUtteranceInterpretation (ricorsivo)
    ''' </summary>
    Private Function ConvertRuntimeTaskToCompiledTaskUtteranceInterpretation(runtimeTask As Compiler.RuntimeTask) As Compiler.CompiledTaskUtteranceInterpretation
        Dim compiled As New Compiler.CompiledTaskUtteranceInterpretation() With {
            .Id = runtimeTask.Id,
            .Condition = runtimeTask.Condition,
            .Steps = runtimeTask.Steps,
            .Constraints = runtimeTask.Constraints,
            .NlpContract = runtimeTask.NlpContract
        }

        ' ✅ Copia SubTasks ricorsivamente (solo se presenti)
        If runtimeTask.HasSubTasks() Then
            compiled.SubTasks = New List(Of Compiler.CompiledTaskUtteranceInterpretation)()
            For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                compiled.SubTasks.Add(ConvertRuntimeTaskToCompiledTaskUtteranceInterpretation(subTask))
            Next
        Else
            compiled.SubTasks = Nothing
        End If

        Return compiled
    End Function

    ''' <summary>
    ''' Creates a standardized JSON error response.
    ''' </summary>
    ''' <param name="errorMessage">The error message to include in the response.</param>
    ''' <param name="statusCode">The HTTP status code to return.</param>
    ''' <returns>An IResult containing the error response.</returns>
    Private Function CreateErrorResponse(errorMessage As String, statusCode As Integer) As IResult
        Dim errorObj = New With {
            .error = errorMessage,
            .timestamp = DateTime.UtcNow.ToString("O")
        }
        Dim errorJson = JsonConvert.SerializeObject(errorObj, New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore
        })
        Return Results.Content(errorJson, "application/json", Nothing, statusCode)
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/task/session/start - Creates a new task session for the Chat Simulator.
    ''' Orchestrates the entire flow: request parsing, task loading, template resolution, compilation, and session creation.
    ''' </summary>
    Private Async Function HandleTaskSessionStart(context As HttpContext) As Task(Of IResult)
        Try
            ' 1. Parse request
            Dim parseResult = Await ReadAndParseRequest(context)
            If Not parseResult.Success Then
                Return CreateErrorResponse(parseResult.ErrorMessage, 400)
            End If
            Dim request = parseResult.Request

            ' 2. Validate request
            Dim validationResult = ValidateRequest(request)
            If Not validationResult.IsValid Then
                Return CreateErrorResponse(validationResult.ErrorMessage, 400)
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
                    ' Converti TaskTree (JSON) in TaskTreeRuntime per il compilatore
                    Console.WriteLine($"🔍 [HandleTaskSessionStart] Calling ConvertTaskTreeToTaskTreeRuntime...")
                    Dim taskTreeRuntime = ConvertTaskTreeToTaskTreeRuntime(request.TaskTree, request.TaskId)
                    If taskTreeRuntime Is Nothing Then
                        Console.WriteLine($"❌ [HandleTaskSessionStart] ConvertTaskTreeToTaskTreeRuntime returned Nothing")
                        Return CreateErrorResponse($"Failed to convert TaskTree to TaskTreeRuntime for task '{request.TaskId}'.", 400)
                    End If
                    Console.WriteLine($"✅ [HandleTaskSessionStart] ConvertTaskTreeToTaskTreeRuntime succeeded")

                    ' Compila direttamente TaskTreeRuntime → CompiledTaskUtteranceInterpretation
                    Console.WriteLine($"🔍 [HandleTaskSessionStart] Calling CompileTaskTreeRuntimeToRuntime...")
                    Dim compileResult = CompileTaskTreeRuntimeToRuntime(taskTreeRuntime, request.Translations)
                    If Not compileResult.Success Then
                        Console.WriteLine($"❌ [HandleTaskSessionStart] CompileTaskTreeRuntimeToRuntime failed: {compileResult.ErrorMessage}")
                        Return CreateErrorResponse(compileResult.ErrorMessage, 400)
                    End If
                    compiledTask = compileResult.Result
                    Console.WriteLine($"✅ [HandleTaskSessionStart] CompileTaskTreeRuntimeToRuntime succeeded")
                    Console.WriteLine($"   Compiled task Steps.Count: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)}")
                    Console.WriteLine($"   Compiled task HasSubTasks: {compiledTask.HasSubTasks()}")
                Catch ex As Exception
                    Console.WriteLine($"❌ [HandleTaskSessionStart] Exception processing TaskTree: {ex.Message}")
                    Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                    End If
                    Return CreateErrorResponse($"Failed to process TaskTree for task '{request.TaskId}'. Error: {ex.Message}", 400)
                End Try
            Else
                ' ✅ CASO B: Fallback - carica dal database (compatibilità legacy)
                Console.WriteLine($"⚠️ [HandleTaskSessionStart] TaskTree not provided, loading from database (taskId={request.TaskId})")
                System.Diagnostics.Debug.WriteLine($"⚠️ [HandleTaskSessionStart] Loading from database (fallback)")

                ' 3. Fetch tasks from Node.js
                Dim fetchResult = Await FetchTasksFromNodeJs(request.ProjectId)
                If Not fetchResult.Success Then
                    Return CreateErrorResponse(fetchResult.ErrorMessage, 400)
                End If
                Dim tasksArray = fetchResult.TasksArray

                ' 4. Find task by ID
                Dim taskObj = FindTaskById(tasksArray, request.TaskId)
                If taskObj Is Nothing Then
                    Return CreateErrorResponse($"Task with ID '{request.TaskId}' was not found in project '{request.ProjectId}'. The task may have been deleted or the ID may be incorrect.", 400)
                End If

                ' 5. Find template for task
                Dim templateResult = FindTemplateForTask(tasksArray, taskObj, request.TaskId)
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
                    LoadSubTemplatesRecursively(tasksArray, templateObj, loadedTemplateIds, allTemplatesList)
                End If

                ' 7. Deserialize all templates
                Dim deserializeResult = DeserializeTasks(allTemplatesList)
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
                Dim typeValidationResult = ValidateTaskType(task)
                If Not typeValidationResult.IsValid Then
                    Return CreateErrorResponse(typeValidationResult.ErrorMessage, 400)
                End If

                ' 10. Compile task
                Dim compileResult = CompileTaskToRuntime(task, allTemplates)
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

            ' 11. Create session
            Console.WriteLine($"🔍 [HandleTaskSessionStart] Creating session for compiled task...")
            Console.WriteLine($"   Compiled task Id: {compiledTask.Id}")
            Console.WriteLine($"   Compiled task Steps.Count: {If(compiledTask.Steps IsNot Nothing, compiledTask.Steps.Count, 0)}")
            Console.WriteLine($"   Compiled task HasSubTasks: {compiledTask.HasSubTasks()}")

            Dim sessionId As String = Nothing
            Try
                sessionId = CreateTaskSession(compiledTask, request.Translations)
                If String.IsNullOrEmpty(sessionId) Then
                    Console.WriteLine($"❌ [HandleTaskSessionStart] CreateTaskSession returned empty sessionId")
                    Return CreateErrorResponse("Failed to create session: sessionId is empty.", 500)
                End If
                Console.WriteLine($"✅ [HandleTaskSessionStart] Session created: {sessionId}")
            Catch ex As Exception
                Console.WriteLine($"❌ [HandleTaskSessionStart] Exception in CreateTaskSession: {ex.Message}")
                Console.WriteLine($"   Stack trace: {ex.StackTrace}")
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
            Console.WriteLine($"✅ [HandleTaskSessionStart] Returning response: {jsonResponse}")
            Console.WriteLine($"   Response length: {jsonResponse.Length}")
            Console.WriteLine($"   SessionId: {sessionId}")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.Out.Flush()
            System.Diagnostics.Debug.WriteLine($"✅ [HandleTaskSessionStart] Returning response: {jsonResponse}")

            ' ✅ Scrivi direttamente nel response stream (come HandleOrchestratorSessionStart)
            ' Questo garantisce che la risposta venga inviata correttamente
            context.Response.ContentType = "application/json; charset=utf-8"
            context.Response.ContentLength = jsonResponse.Length
            Await context.Response.WriteAsync(jsonResponse)
            Console.WriteLine($"✅ [HandleTaskSessionStart] Response written to stream")
            Console.Out.Flush()

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
    ' API Data Models
    ' ============================================================================
End Module

''' <summary>
''' Compile Flow Request
''' </summary>
Public Class CompileFlowRequest
    <JsonProperty("nodes")>
    Public Property Nodes As List(Of Compiler.FlowNode)

    <JsonProperty("edges")>
    Public Property Edges As List(Of Compiler.FlowEdge)

    <JsonProperty("tasks")>
    Public Property Tasks As List(Of Compiler.Task)

    ' ❌ RIMOSSO: DDTs property - non più usato, struttura costruita da template
    ' <JsonProperty("ddts")>
    ' Public Property DDTs As List(Of Compiler.AssembledDDT)

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)
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
''' Orchestrator Session Start Request
''' </summary>
Public Class OrchestratorSessionStartRequest
    <JsonProperty("compilationResult")>
    Public Property CompilationResult As Object

    <JsonProperty("tasks")>
    Public Property Tasks As List(Of Object)

    ' ❌ RIMOSSO: DDTs property - non più usato, struttura costruita da template
    ' <JsonProperty("ddts")>
    ' Public Property DDTs As List(Of Compiler.AssembledDDT)

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)
End Class

''' <summary>
''' Orchestrator Session Input Request
''' </summary>
Public Class OrchestratorSessionInputRequest
    Public Property Input As String
End Class

''' <summary>
''' Task Session Start Request (Chat Simulator diretto)
''' ✅ NUOVO MODELLO: Accetta TaskTree opzionale (working copy) invece di caricare dal database
''' </summary>
Public Class TaskSessionStartRequest
    <JsonProperty("taskId")>
    Public Property TaskId As String

    <JsonProperty("projectId")>
    Public Property ProjectId As String

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)

    ''' <summary>
    ''' ✅ NUOVO: TaskTree completo (working copy) dalla memoria frontend
    ''' Se presente, viene usato direttamente invece di caricare dal database
    ''' </summary>
    <JsonProperty("taskTree")>
    Public Property TaskTree As JObject
End Class

''' <summary>
''' Task Session Input Request
''' </summary>
Public Class TaskSessionInputRequest
    <JsonProperty("input")>
    Public Property Input As String
End Class


