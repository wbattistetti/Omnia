Option Strict On
Option Explicit On
Imports System.IO
Imports ApiServer.Models
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Serialization
Imports TaskEngine

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles compilation-related API endpoints
    ''' </summary>
    Public Module CompilationHandlers
        ''' <summary>
        ''' Handles POST /api/runtime/compile
        ''' </summary>
        Public Async Function HandleCompileFlow(context As HttpContext) As System.Threading.Tasks.Task
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

                ' ✅ CRITICAL: Serializza direttamente compilationResult per preservare JsonConverter attributes
                ' Gli oggetti anonimi non preservano gli attributi JsonConverter delle proprietà
                Console.WriteLine("📤 [HandleCompileFlow] Serializing compilationResult directly (preserves JsonConverter attributes)...")
                Console.WriteLine($"   - TaskGroups: {If(compilationResult.TaskGroups IsNot Nothing, compilationResult.TaskGroups.Count, 0)}")
                Console.WriteLine($"   - Tasks: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")

                ' Serialize compilationResult first (preserves JsonConverter on Tasks property)
                ' ✅ Usa stesso ContractResolver globale per coerenza camelCase
                Dim compilationJson = Newtonsoft.Json.JsonConvert.SerializeObject(compilationResult, New JsonSerializerSettings() With {
                    .ContractResolver = New CamelCasePropertyNamesContractResolver(),
                    .NullValueHandling = NullValueHandling.Ignore
                })
                Dim compilationObj = Newtonsoft.Json.Linq.JObject.Parse(compilationJson)

                ' Add extra fields
                compilationObj("compiledBy") = "VB.NET_RUNTIME"
                compilationObj("timestamp") = DateTime.UtcNow.ToString("O")

                Dim jsonResponse = compilationObj.ToString()

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
        Public Async Function HandleCompileTask(context As HttpContext) As System.Threading.Tasks.Task
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
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to read request body", .message = readEx.Message})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End Try

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine("❌ [HandleCompileTask] Empty request body")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Empty request body"})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                ' Deserialize request - use JObject to parse and extract task
                Dim requestObj As Newtonsoft.Json.Linq.JObject = Nothing
                Try
                    Console.WriteLine("🔄 [HandleCompileTask] Starting JSON deserialization...")
                    requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                    Console.WriteLine($"✅ [HandleCompileTask] JSON deserialization completed")
                Catch deserializeEx As Exception
                    Console.WriteLine($"❌ [HandleCompileTask] Deserialization error: {deserializeEx.Message}")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to deserialize request", .message = deserializeEx.Message})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End Try

                ' ✅ NUOVO: Riconosci input.TaskInstance
                Dim taskInstance As Compiler.Task = Nothing
                Dim allTemplates As List(Of Compiler.Task) = Nothing

                If requestObj("taskInstance") IsNot Nothing Then
                    ' ✅ NUOVO FORMATO: { taskInstance: {...}, allTemplates: [...] }
                    Console.WriteLine("✅ [HandleCompileTask] Detected TaskInstance input format")

                    ' Deserialize taskInstance
                    Try
                        Dim taskInstanceJson = requestObj("taskInstance").ToString()
                        taskInstance = JsonConvert.DeserializeObject(Of Compiler.Task)(taskInstanceJson, New JsonSerializerSettings() With {
                            .NullValueHandling = NullValueHandling.Ignore,
                            .MissingMemberHandling = MissingMemberHandling.Ignore
                        })
                    Catch ex As Exception
                        Console.WriteLine($"❌ [HandleCompileTask] Error deserializing taskInstance: {ex.Message}")
                        Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to deserialize taskInstance", .message = ex.Message})
                        context.Response.ContentType = "application/json"
                        context.Response.StatusCode = 400
                        context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                        Return
                    End Try

                    ' Deserialize allTemplates
                    If requestObj("allTemplates") IsNot Nothing Then
                        Try
                            Dim allTemplatesJson = requestObj("allTemplates").ToString()
                            allTemplates = JsonConvert.DeserializeObject(Of List(Of Compiler.Task))(allTemplatesJson, New JsonSerializerSettings() With {
                                .NullValueHandling = NullValueHandling.Ignore,
                                .MissingMemberHandling = MissingMemberHandling.Ignore
                            })
                        Catch ex As Exception
                            Console.WriteLine($"❌ [HandleCompileTask] Error deserializing allTemplates: {ex.Message}")
                            Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to deserialize allTemplates", .message = ex.Message})
                            context.Response.ContentType = "application/json"
                            context.Response.StatusCode = 400
                            context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                            Return
                        End Try
                    Else
                        ' ✅ Se allTemplates non è presente, usa solo taskInstance
                        allTemplates = New List(Of Compiler.Task) From {taskInstance}
                    End If

                ElseIf requestObj("task") IsNot Nothing Then
                    ' ⚠️ LEGACY FORMATO: { task: {...} } - mantenuto per retrocompatibilità
                    Console.WriteLine("⚠️ [HandleCompileTask] Detected legacy task input format")
                    Try
                        Dim taskJson = requestObj("task").ToString()
                        taskInstance = JsonConvert.DeserializeObject(Of Compiler.Task)(taskJson, New JsonSerializerSettings() With {
                            .NullValueHandling = NullValueHandling.Ignore,
                            .MissingMemberHandling = MissingMemberHandling.Ignore
                        })
                        allTemplates = New List(Of Compiler.Task) From {taskInstance}
                    Catch ex As Exception
                        Console.WriteLine($"❌ [HandleCompileTask] Error deserializing task: {ex.Message}")
                        Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to deserialize task", .message = ex.Message})
                        context.Response.ContentType = "application/json"
                        context.Response.StatusCode = 400
                        context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                        Return
                    End Try
                Else
                    Console.WriteLine("❌ [HandleCompileTask] Missing taskInstance or task in request")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Missing taskInstance or task in request"})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                If taskInstance Is Nothing Then
                    Console.WriteLine("❌ [HandleCompileTask] TaskInstance is Nothing after deserialization")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "TaskInstance is null"})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                Console.WriteLine($"🔍 [HandleCompileTask] TaskInstance received: Id={taskInstance.Id}, Type={If(taskInstance.Type.HasValue, taskInstance.Type.Value.ToString(), "NULL")}, AllTemplates count={If(allTemplates IsNot Nothing, allTemplates.Count, 0)}")

                ' Validate task type
                If Not taskInstance.Type.HasValue Then
                    Console.WriteLine("❌ [HandleCompileTask] TaskInstance has no Type")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "TaskInstance has no Type. Type is required."})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                Dim typeValue = taskInstance.Type.Value
                If Not [Enum].IsDefined(GetType(TaskEngine.TaskTypes), typeValue) Then
                    Console.WriteLine($"❌ [HandleCompileTask] Invalid TaskType: {typeValue}")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = $"Invalid TaskType: {typeValue}"})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                Dim taskType = CType(typeValue, TaskEngine.TaskTypes)
                Console.WriteLine($"✅ [HandleCompileTask] TaskType: {taskType} (value={typeValue})")

                ' Get appropriate compiler based on task type
                Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
                Console.WriteLine($"✅ [HandleCompileTask] Using compiler: {compiler.GetType().Name}")

                ' ✅ Pipeline pulita: compila TaskInstance direttamente con allTemplates
                ' NON usa Flow, NON usa rowId
                Console.WriteLine($"🔄 [HandleCompileTask] Calling compiler.Compile for TaskInstance {taskInstance.Id}...")
                Console.WriteLine($"   AllTemplates count: {If(allTemplates IsNot Nothing, allTemplates.Count, 0)}")

                Dim compiledTask = compiler.Compile(taskInstance, taskInstance.Id, allTemplates)
                Console.WriteLine($"✅ [HandleCompileTask] TaskInstance compiled successfully: {compiledTask.GetType().Name}")

                ' ✅ DIAG: Verifica steps nel CompiledTask prima di validare ID
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"[DIAG] HandleCompileTask: CompiledTask steps verification...")
                Console.WriteLine($"   TaskInstance.Id: {taskInstance.Id}")
                Console.WriteLine($"   TaskInstance.Steps IsNothing: {taskInstance.Steps Is Nothing}")
                If taskInstance.Steps IsNot Nothing Then
                    Console.WriteLine($"   TaskInstance.Steps.Count: {taskInstance.Steps.Count}")
                    Console.WriteLine($"   TaskInstance.Steps.Keys: {String.Join(", ", taskInstance.Steps.Keys)}")
                End If
                Dim compiledUtteranceTask = TryCast(compiledTask, CompiledUtteranceTask)
                If compiledUtteranceTask IsNot Nothing Then
                    Console.WriteLine($"   CompiledUtteranceTask.Steps IsNothing: {compiledUtteranceTask.Steps Is Nothing}")
                    If compiledUtteranceTask.Steps IsNot Nothing Then
                        Console.WriteLine($"   CompiledUtteranceTask.Steps.Count: {compiledUtteranceTask.Steps.Count}")
                        For Each step In compiledUtteranceTask.Steps
                            Console.WriteLine($"     - Step Type: {step.Type}, Escalations: {If(step.Escalations IsNot Nothing, step.Escalations.Count, 0)}")
                        Next
                    End If
                    Console.WriteLine($"   CompiledUtteranceTask.SubTasks IsNothing: {compiledUtteranceTask.SubTasks Is Nothing}")
                    If compiledUtteranceTask.SubTasks IsNot Nothing Then
                        Console.WriteLine($"   CompiledUtteranceTask.SubTasks.Count: {compiledUtteranceTask.SubTasks.Count}")
                    End If
                End If
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                ' ✅ CRITICAL: Verifica che compiledTask.Id = taskInstance.Id
                If compiledTask.Id <> taskInstance.Id Then
                    Console.WriteLine($"❌ [HandleCompileTask] ID MISMATCH: compiledTask.Id={compiledTask.Id}, taskInstance.Id={taskInstance.Id}")
                    Throw New InvalidOperationException($"CompiledTask.Id mismatch: expected {taskInstance.Id}, got {compiledTask.Id}. The compiler MUST set compiledTask.Id = taskInstance.Id for TaskInstance compilation.")
                End If

                ' ✅ Imposta debug info per TaskInstance (NON Flowchart)
                compiledTask.Debug = New TaskDebugInfo() With {
                    .SourceType = TaskSourceType.TaskInstance,
                    .NodeId = Nothing,
                    .RowId = Nothing,
                    .OriginalTaskId = taskInstance.Id
                }

                Console.WriteLine($"✅ [HandleCompileTask] CompiledTask.Id verified: {compiledTask.Id} = {taskInstance.Id}")

                ' Build response
                Dim responseObj = New With {
                    .success = True,
                    .taskId = taskInstance.Id,
                    .taskType = taskType.ToString(),
                    .compiler = compiler.GetType().Name,
                    .compiledTaskType = compiledTask.GetType().Name,
                    .compiledTask = compiledTask, ' ✅ Includi CompiledTask completo nella risposta
                    .timestamp = DateTime.UtcNow.ToString("O")
                }

                Console.WriteLine($"✅ [HandleCompileTask] Compilation completed successfully")
                Console.WriteLine($"   Response: success={responseObj.success}, taskId={responseObj.taskId}, compiledTask.Id={compiledTask.Id}")
                Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")

                ' ✅ Serializza manualmente usando Newtonsoft.Json (come in HandleCompileFlow)
                ' ✅ Usa stesso ContractResolver globale per coerenza camelCase
                Console.WriteLine("📤 [HandleCompileTask] Serializing response manually...")
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .ContractResolver = New CamelCasePropertyNamesContractResolver(),
                    .NullValueHandling = NullValueHandling.Ignore
                })
                Console.WriteLine($"📤 [HandleCompileTask] Serialized response JSON length: {jsonResponse.Length}")
                Console.WriteLine($"📤 [HandleCompileTask] Serialized response preview: {If(jsonResponse.Length > 200, jsonResponse.Substring(0, 200) & "...", jsonResponse)}")

                ' ✅ VERIFICA: Verifica che compiledTask.id sia in camelCase e che rowId non sia presente
                Try
                    Dim responseObjParsed = Newtonsoft.Json.Linq.JObject.Parse(jsonResponse)
                    Dim compiledTaskObj = responseObjParsed("compiledTask")
                    If compiledTaskObj IsNot Nothing Then
                        Dim compiledTaskId = compiledTaskObj("id")
                        Dim debugObj = compiledTaskObj("debug")
                        Dim rowId = If(debugObj IsNot Nothing, debugObj("rowId"), Nothing)

                        Console.WriteLine($"✅ [HandleCompileTask] JSON VERIFICATION:")
                        Console.WriteLine($"   - compiledTask.id present: {compiledTaskId IsNot Nothing}")
                        If compiledTaskId IsNot Nothing Then
                            Console.WriteLine($"   - compiledTask.id value: {compiledTaskId.ToString()}")
                        End If
                        Console.WriteLine($"   - debug.rowId present: {rowId IsNot Nothing}")
                        If rowId IsNot Nothing Then
                            Console.WriteLine($"   ⚠️  WARNING: rowId should NOT be present for TaskInstance compilation!")
                        Else
                            Console.WriteLine($"   ✅ OK: rowId correctly excluded from JSON (NullValueHandling.Ignore working)")
                        End If
                    End If
                Catch ex As Exception
                    Console.WriteLine($"⚠️  [HandleCompileTask] Error verifying JSON structure: {ex.Message}")
                End Try

                ' ✅ Scrivi direttamente nella risposta (come in HandleCompileFlow)
                context.Response.ContentType = "application/json"
                Await context.Response.WriteAsync(jsonResponse)
                Return ' ✅ Non restituire Results.Ok() se scrivi manualmente

            Catch ex As Exception
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"❌ [HandleCompileTask] Exception: {ex.Message}")
                Console.WriteLine($"Stack trace: {ex.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileTask] Exception: {ex.Message}")
                If ex.InnerException IsNot Nothing Then
                    Console.WriteLine($"Inner exception: {ex.InnerException.Message}")
                End If
                Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")

                ' ✅ Scrivi errore direttamente nella risposta (senza Await nel Catch)
                Dim errorJson = JsonConvert.SerializeObject(New With {
                    .status = "error",
                    .title = "Compilation failed",
                    .detail = ex.Message,
                    .timestamp = DateTime.UtcNow.ToString("O")
                })
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 500
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/runtime/compile using model binding (simpler approach)
        ''' </summary>
        Public Async Function HandleCompileFlowWithModel(request As CompileFlowRequest) As Task(Of IResult)
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
        ''' ✅ STATELESS: Salva un dialogo compilato nel DialogRepository
        ''' Endpoint: POST /api/runtime/dialog/save
        ''' </summary>
        Public Async Function HandleSaveDialog(context As HttpContext) As Task(Of IResult)
            Console.WriteLine("📥 [HandleSaveDialog] Received dialog save request")
            System.Diagnostics.Debug.WriteLine("📥 [HandleSaveDialog] Received dialog save request")

            Try
                ' Enable buffering
                Try
                    context.Request.EnableBuffering()
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [HandleSaveDialog] EnableBuffering failed: {ex.Message}")
                End Try

                ' Reset stream position
                Try
                    context.Request.Body.Position = 0
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [HandleSaveDialog] Cannot reset stream position: {ex.Message}")
                End Try

                ' Read request body
                Dim body As String = Nothing
                Try
                    Dim reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                    Console.WriteLine($"📦 [HandleSaveDialog] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
                Catch readEx As Exception
                    Console.WriteLine($"❌ [HandleSaveDialog] Error reading request body: {readEx.Message}")
                    Return Results.BadRequest(New With {.error = "Failed to read request body", .message = readEx.Message})
                End Try

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine("❌ [HandleSaveDialog] Empty request body")
                    Return Results.BadRequest(New With {.error = "Empty request body"})
                End If

                ' Deserialize request
                Dim requestObj As Newtonsoft.Json.Linq.JObject = Nothing
                Try
                    Console.WriteLine("🔄 [HandleSaveDialog] Starting JSON deserialization...")
                    requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                    Console.WriteLine($"✅ [HandleSaveDialog] JSON deserialization completed")
                Catch deserializeEx As Exception
                    Console.WriteLine($"❌ [HandleSaveDialog] Deserialization error: {deserializeEx.Message}")
                    Return Results.BadRequest(New With {.error = "Failed to deserialize request", .message = deserializeEx.Message})
                End Try

                ' Extract required fields
                Dim projectId As String = Nothing
                Dim dialogVersion As String = Nothing
                Dim runtimeTaskJson As String = Nothing

                If requestObj("projectId") IsNot Nothing Then
                    projectId = requestObj("projectId").ToString()
                End If
                If requestObj("dialogVersion") IsNot Nothing Then
                    dialogVersion = requestObj("dialogVersion").ToString()
                End If
                If requestObj("runtimeTask") IsNot Nothing Then
                    runtimeTaskJson = requestObj("runtimeTask").ToString()
                End If

                ' Validate required fields
                If String.IsNullOrWhiteSpace(projectId) Then
                    Console.WriteLine("❌ [HandleSaveDialog] Missing projectId")
                    Return Results.BadRequest(New With {.error = "projectId is required"})
                End If
                If String.IsNullOrWhiteSpace(dialogVersion) Then
                    Console.WriteLine("❌ [HandleSaveDialog] Missing dialogVersion")
                    Return Results.BadRequest(New With {.error = "dialogVersion is required"})
                End If
                If String.IsNullOrWhiteSpace(runtimeTaskJson) Then
                    Console.WriteLine("❌ [HandleSaveDialog] Missing runtimeTask")
                    Return Results.BadRequest(New With {.error = "runtimeTask is required"})
                End If

                ' ✅ NORMALIZZAZIONE: Sostituisci "violation" con "invalid" nel JSON prima della deserializzazione
                ' Gestisce sia "type": "violation" che "type":"violation" (con/senza spazi)
                If Not String.IsNullOrWhiteSpace(runtimeTaskJson) Then
                    runtimeTaskJson = System.Text.RegularExpressions.Regex.Replace(
                        runtimeTaskJson,
                        """type""\s*:\s*""violation""",
                        """type"": ""invalid""",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase
                    )
                End If

                ' Deserialize RuntimeTask
                Dim runtimeTask As Compiler.RuntimeTask = Nothing
                Try
                    Dim settings As New JsonSerializerSettings With {
                        .TypeNameHandling = TypeNameHandling.Auto,
                        .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                        .NullValueHandling = NullValueHandling.Ignore,
                        .Converters = New List(Of JsonConverter) From {New ITaskConverter()}
                    }
                    runtimeTask = JsonConvert.DeserializeObject(Of Compiler.RuntimeTask)(runtimeTaskJson, settings)
                Catch ex As Exception
                    Console.WriteLine($"❌ [HandleSaveDialog] Error deserializing RuntimeTask: {ex.Message}")
                    Return Results.BadRequest(New With {.error = "Failed to deserialize runtimeTask", .message = ex.Message})
                End Try

                If runtimeTask Is Nothing Then
                    Console.WriteLine("❌ [HandleSaveDialog] RuntimeTask is Nothing after deserialization")
                    Return Results.BadRequest(New With {.error = "RuntimeTask is null"})
                End If

                ' Save to DialogRepository
                Try
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [HandleSaveDialog] ✅ Saving dialog to repository...")
                    Console.WriteLine($"   ProjectId: {projectId}")
                    Console.WriteLine($"   DialogVersion: {dialogVersion}")
                    Console.WriteLine($"   RuntimeTask.Id: {runtimeTask.Id}")
                    Console.WriteLine($"   RuntimeTask.HasSubTasks: {runtimeTask.HasSubTasks()}")
                    If runtimeTask.HasSubTasks() Then
                        Console.WriteLine($"   RuntimeTask.SubTasks.Count: {runtimeTask.SubTasks.Count}")
                    End If
                    Console.Out.Flush()

                    Dim dialogRepository = New ApiServer.Repositories.RedisDialogRepository(
                        Program.GetRedisConnectionString(),
                        Program.GetRedisKeyPrefix()
                    )
                    Console.WriteLine($"🔵 [HandleSaveDialog] ✅ DialogRepository created, calling SaveDialog...")
                    Console.Out.Flush()

                    dialogRepository.SaveDialog(projectId, dialogVersion, runtimeTask)

                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [HandleSaveDialog] ✅ Dialog saved successfully to repository!")
                    Console.WriteLine($"   ProjectId: {projectId}")
                    Console.WriteLine($"   DialogVersion: {dialogVersion}")
                    Console.WriteLine($"   Redis Key: omnia:dialog:{projectId}:{dialogVersion}")
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [HandleSaveDialog] ❌ Error saving dialog to repository!")
                    Console.WriteLine($"   ProjectId: {projectId}")
                    Console.WriteLine($"   DialogVersion: {dialogVersion}")
                    Console.WriteLine($"   Error: {ex.Message}")
                    Console.WriteLine($"   StackTrace: {ex.StackTrace}")
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                    Return Results.Problem(
                        title:="Failed to save dialog",
                        detail:=ex.Message,
                        statusCode:=500
                    )
                End Try

                ' Return success
                Dim responseObj = New With {
                    .success = True,
                    .projectId = projectId,
                    .dialogVersion = dialogVersion,
                    .message = "Dialog saved successfully",
                    .timestamp = DateTime.UtcNow.ToString("O")
                }

                Console.WriteLine($"✅ [HandleSaveDialog] Dialog save completed successfully")
                Return Results.Ok(responseObj)

            Catch ex As Exception
                Console.WriteLine($"❌ [HandleSaveDialog] Exception: {ex.Message}")
                Console.WriteLine($"Stack trace: {ex.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [HandleSaveDialog] Exception: {ex.Message}")
                Return Results.Problem(
                    title:="Dialog save failed",
                    detail:=ex.Message,
                    statusCode:=500
                )
            End Try
        End Function
    End Module
End Namespace
