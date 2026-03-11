Option Strict On
Option Explicit On
Imports System.IO
Imports ApiServer.Models
Imports ApiServer.Services
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Http.Features
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Serialization
Imports TaskEngine
Imports Engine

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles compilation-related API endpoints
    ''' </summary>
    Public Module CompilationHandlers

        ''' <summary>
        ''' Helper: Deserializes a task JSON string to the correct type (UtteranceTaskDefinition or TaskDefinition)
        ''' </summary>
        Private Function DeserializeTaskFromJson(jsonString As String, settings As JsonSerializerSettings) As Compiler.TaskDefinition
            Dim taskObj = Newtonsoft.Json.Linq.JObject.Parse(jsonString)
            Dim typeToken = taskObj("type")
            Dim taskType As TaskEngine.TaskTypes? = Nothing

            If typeToken IsNot Nothing AndAlso typeToken.Type = Newtonsoft.Json.Linq.JTokenType.Integer Then
                Dim typeValue = CInt(typeToken)
                If [Enum].IsDefined(GetType(TaskEngine.TaskTypes), typeValue) Then
                    taskType = CType(typeValue, TaskEngine.TaskTypes)
                End If
            End If

            If taskType.HasValue AndAlso taskType.Value = TaskEngine.TaskTypes.UtteranceInterpretation Then
                ' ✅ Deserialize as UtteranceTaskDefinition for UtteranceInterpretation tasks
                Return JsonConvert.DeserializeObject(Of Compiler.UtteranceTaskDefinition)(jsonString, settings)
            Else
                ' ✅ Deserialize as base TaskDefinition for other types
                Return JsonConvert.DeserializeObject(Of Compiler.TaskDefinition)(jsonString, settings)
            End If
        End Function

        ''' <summary>
        ''' Helper: Deserializes a list of task JSON strings to the correct types
        ''' </summary>
        Private Function DeserializeTaskListFromJson(jsonString As String, settings As JsonSerializerSettings) As List(Of Compiler.TaskDefinition)
            Dim taskArray = Newtonsoft.Json.Linq.JArray.Parse(jsonString)
            Dim result As New List(Of Compiler.TaskDefinition)()

            For Each taskToken In taskArray
                Dim taskJson = taskToken.ToString()
                Dim task = DeserializeTaskFromJson(taskJson, settings)
                If task IsNot Nothing Then
                    result.Add(task)
                End If
            Next

            Return result
        End Function
        ''' <summary>
        ''' Handles POST /api/runtime/compile
        ''' </summary>
        Public Async Function HandleCompileFlow(context As HttpContext) As System.Threading.Tasks.Task
            Try
                ' ✅ FIX: Increase request body size limit for this endpoint to handle large flows with conditions
                Try
                    Dim maxRequestBodySizeFeature = context.Features.Get(Of Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature)()
                    If maxRequestBodySizeFeature IsNot Nothing Then
                        maxRequestBodySizeFeature.MaxRequestBodySize = 100 * 1024 * 1024 ' 100MB
                    End If
                Catch
                    ' Ignore if feature is not available
                End Try

                ' Enable buffering to allow reading the body multiple times if needed
                Try
                    context.Request.EnableBuffering()
                Catch
                    ' Ignore if already enabled
                End Try

                ' Reset stream position to beginning
                Try
                    context.Request.Body.Position = 0
                Catch
                    ' Ignore if cannot reset
                End Try

                Dim body As String = Nothing
                Try
                    Dim reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                Catch readEx As Exception
                    Dim errorJson = "{""status"":""error"",""message"":""Failed to read request body"",""error"":""" & readEx.Message.Replace("""", "\""") & """}"
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End Try

                If String.IsNullOrEmpty(body) Then
                    Dim errorJson = "{""status"":""error"",""message"":""Empty request body""}"
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    Await context.Response.WriteAsync(errorJson)
                    Return
                End If

                Dim request As CompileFlowRequest = Nothing
                ' ✅ DEBUG: Check if conditions are in JSON before deserialization
                Dim hasConditionsInBody = body.Contains("""" & "conditions" & """")
                Console.WriteLine($"🔍 [HandleCompileFlow] Checking body for 'conditions' key: {hasConditionsInBody}")
                Console.WriteLine($"   Body length: {body.Length}")

                ' ✅ DEBUG: Try multiple search patterns
                Dim hasConditionsPattern1 = body.Contains("""" & "conditions" & """")
                Dim hasConditionsPattern2 = body.Contains("conditions")
                Dim hasConditionsPattern3 = body.IndexOf("""" & "conditions" & """") >= 0
                Console.WriteLine($"   Search results: Pattern1={hasConditionsPattern1}, Pattern2={hasConditionsPattern2}, Pattern3={hasConditionsPattern3}")

                If hasConditionsInBody OrElse hasConditionsPattern2 Then
                    Console.WriteLine($"🔍 [HandleCompileFlow] 'conditions' key found in JSON body (before deserialization)")
                    Dim conditionsIndex = If(body.IndexOf("""" & "conditions" & """") >= 0, body.IndexOf("""" & "conditions" & """"), body.IndexOf("conditions"))
                    Dim conditionsPreview = If(conditionsIndex >= 0 AndAlso body.Length > conditionsIndex + 50, body.Substring(conditionsIndex, Math.Min(500, body.Length - conditionsIndex)), "NOT FOUND")
                    Console.WriteLine($"   Conditions JSON preview: {conditionsPreview}")

                    ' ✅ DEBUG: Try to parse conditions directly from JSON
                    Try
                        Dim requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                        Dim conditionsToken = requestObj("conditions")
                        If conditionsToken IsNot Nothing Then
                            Console.WriteLine($"   ✅ Conditions token found in JObject: Type={conditionsToken.GetType().Name}, Count={If(conditionsToken.Type = Newtonsoft.Json.Linq.JTokenType.Array, DirectCast(conditionsToken, Newtonsoft.Json.Linq.JArray).Count, 0)}")
                        Else
                            Console.WriteLine($"   ⚠️ Conditions token NOT found in JObject")
                            ' ✅ DEBUG: List all keys in JObject
                            Console.WriteLine($"   JObject keys: {String.Join(", ", requestObj.Properties().Select(Function(p) p.Name))}")
                        End If
                    Catch parseEx As Exception
                        Console.WriteLine($"   ❌ Error parsing body as JObject: {parseEx.Message}")
                    End Try
                Else
                    Console.WriteLine($"⚠️ [HandleCompileFlow] 'conditions' key NOT found in JSON body (before deserialization)")
                    ' ✅ DEBUG: Check if body contains other keys
                    Dim hasNodes = body.Contains("""" & "nodes" & """")
                    Dim hasEdges = body.Contains("""" & "edges" & """")
                    Dim hasTasks = body.Contains("""" & "tasks" & """")
                    Console.WriteLine($"   Body contains keys: nodes={hasNodes}, edges={hasEdges}, tasks={hasTasks}")

                    ' ✅ DEBUG: Show first and last 500 chars of body
                    Console.WriteLine($"   Body first 500 chars: {If(body.Length > 500, body.Substring(0, 500), body)}")
                    Console.WriteLine($"   Body last 500 chars: {If(body.Length > 500, body.Substring(body.Length - 500), body)}")
                End If

                Try
                    request = JsonConvert.DeserializeObject(Of CompileFlowRequest)(body, New JsonSerializerSettings() With {
                        .Error = Sub(sender, args)
                                     args.ErrorContext.Handled = True
                                 End Sub
                    })
                Catch jsonEx As JsonReaderException
                    Dim errorJson = "{""status"":""error"",""message"":""Invalid JSON format"",""error"":""" & jsonEx.Message.Replace("""", "\""") & """,""line"":" & jsonEx.LineNumber & ",""position"":" & jsonEx.LinePosition & "}"
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                Catch deserializeEx As Exception
                    Dim errorJson = "{""status"":""error"",""message"":""Failed to deserialize request"",""error"":""" & deserializeEx.Message.Replace("""", "\""") & """}"
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End Try

                If request Is Nothing Then

                    Dim errorJson = "{""status"":""error"",""message"":""Invalid request format""}"
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End If

                ' ✅ UNIFICAZIONE: Deserializza correttamente i task usando la stessa logica di HandleCompileTask
                ' Questo risolve il problema dove UtteranceInterpretation tasks vengono deserializzati come TaskDefinition base
                ' La "presa diretta" del ResponseEditor funziona perché usa DeserializeTaskFromJson - unifichiamo qui
                ' ✅ FIX: Deserializza Tasks direttamente dal JSON originale invece di ri-serializzare/ri-deserializzare
                ' Il problema è che request.Tasks è già stato deserializzato come List(Of TaskDefinition) base,
                ' quindi ha perso dataContract. Dobbiamo deserializzare direttamente dal JSON string originale.
                If request.Tasks IsNot Nothing AndAlso request.Tasks.Count > 0 Then
                    Try
                        ' Estrai tasks direttamente dal JSON originale
                        Dim requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                        Dim tasksToken = requestObj("tasks")

                        ' ✅ DEBUG: Verifica cosa contiene tasksToken
                        If tasksToken IsNot Nothing Then
                            Console.WriteLine($"🔍 [HandleCompileFlow] tasksToken type: {tasksToken.GetType().Name}")
                            Dim tasksTokenPreview = tasksToken.ToString()
                            Console.WriteLine($"🔍 [HandleCompileFlow] tasksToken preview (first 500 chars): {tasksTokenPreview.Substring(0, Math.Min(500, tasksTokenPreview.Length))}")
                            System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] tasksToken type: {tasksToken.GetType().Name}")
                        Else
                            Console.WriteLine("❌ [HandleCompileFlow] tasksToken is Nothing!")
                            System.Diagnostics.Debug.WriteLine("❌ [HandleCompileFlow] tasksToken is Nothing!")
                        End If

                        Dim tasksJson As String = "[]"
                        If tasksToken IsNot Nothing Then
                            tasksJson = tasksToken.ToString()
                            Console.WriteLine($"🔍 [HandleCompileFlow] tasksJson length: {tasksJson.Length}")
                            System.Diagnostics.Debug.WriteLine($"🔍 [HandleCompileFlow] tasksJson length: {tasksJson.Length}")
                        Else
                            Console.WriteLine("❌ [HandleCompileFlow] tasksToken is Nothing, using empty array")
                            System.Diagnostics.Debug.WriteLine("❌ [HandleCompileFlow] tasksToken is Nothing, using empty array")
                        End If

                        Dim settings = New JsonSerializerSettings() With {
                            .NullValueHandling = NullValueHandling.Ignore,
                            .MissingMemberHandling = MissingMemberHandling.Ignore
                        }

                        ' Deserializza usando DeserializeTaskListFromJson (stessa logica di HandleCompileTask)
                        Dim correctlyDeserializedTasks = DeserializeTaskListFromJson(tasksJson, settings)

                        ' ✅ DEBUG: Verifica che il template problematico sia stato deserializzato correttamente
                        Dim problematicTemplateId = "1fa9cc7c-755d-40c9-9041-3bdfe4fe29b3"
                        Dim problematicTemplate = correctlyDeserializedTasks.FirstOrDefault(Function(t) t.Id = problematicTemplateId AndAlso String.IsNullOrEmpty(t.TemplateId))
                        If problematicTemplate IsNot Nothing Then
                            Dim utteranceTemplate = TryCast(problematicTemplate, Compiler.UtteranceTaskDefinition)
                            If utteranceTemplate IsNot Nothing Then
                                Console.WriteLine($"✅ [HandleCompileFlow] Template problematico deserializzato come UtteranceTaskDefinition: Id={utteranceTemplate.Id}, HasDataContract={utteranceTemplate.DataContract IsNot Nothing}")
                                System.Diagnostics.Debug.WriteLine($"✅ [HandleCompileFlow] Template problematico: HasDataContract={utteranceTemplate.DataContract IsNot Nothing}")
                            Else
                                Console.WriteLine($"❌ [HandleCompileFlow] Template problematico NON deserializzato come UtteranceTaskDefinition: Type={problematicTemplate.GetType().Name}")
                                System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileFlow] Template problematico: Type={problematicTemplate.GetType().Name}")
                            End If
                        Else
                            Console.WriteLine($"❌ [HandleCompileFlow] Template problematico NON trovato in correctlyDeserializedTasks")
                            System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileFlow] Template problematico NON trovato")
                        End If

                        ' Sostituisci la lista con quella correttamente deserializzata
                        request.Tasks = correctlyDeserializedTasks

                        Console.WriteLine($"✅ [HandleCompileFlow] Correctly deserialized {correctlyDeserializedTasks.Count} tasks (UtteranceInterpretation tasks are now UtteranceTaskDefinition)")
                        System.Diagnostics.Debug.WriteLine($"✅ [HandleCompileFlow] Correctly deserialized {correctlyDeserializedTasks.Count} tasks")
                    Catch ex As Exception
                        ' ✅ CRITICAL: Loggare l'errore completo invece di nasconderlo
                        Console.WriteLine($"❌ [HandleCompileFlow] ERROR in DeserializeTaskListFromJson: {ex.GetType().Name}: {ex.Message}")
                        Console.WriteLine($"❌ [HandleCompileFlow] Stack trace: {ex.StackTrace}")
                        If ex.InnerException IsNot Nothing Then
                            Console.WriteLine($"❌ [HandleCompileFlow] Inner exception: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}")
                        End If
                        System.Diagnostics.Debug.WriteLine($"❌ [HandleCompileFlow] ERROR: {ex.ToString()}")

                        ' ✅ Rilanciare l'eccezione invece di usare fallback
                        ' Questo permette di vedere l'errore reale e capire cosa non funziona
                        Throw
                    End Try
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
                    request.Tasks = New List(Of Compiler.TaskDefinition)()
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

                ' ✅ SINGLE POINT OF TRUTH: Materializza tutti i task PRIMA di creare Flow
                ' request.Tasks contiene sia istanze (incomplete) che template (completi)
                ' Il materializer unisce istanze + template e produce TaskDefinition completi
                Dim materializer = New ApiServer.Services.TaskDefinitionMaterializer()
                Dim materializedTasks = materializer.MaterializeFlowTasks(
                    If(request.Tasks, New List(Of Compiler.TaskDefinition)()),
                    If(request.Tasks, New List(Of Compiler.TaskDefinition)())  ' allTemplates = request.Tasks (contiene sia istanze che template)
                )

                ' ✅ DEBUG: Log conditions deserialization
                Console.WriteLine($"🔍 [HandleCompileFlow] Conditions deserialized: {If(request.Conditions IsNot Nothing, request.Conditions.Count, 0)}")
                If request.Conditions IsNot Nothing AndAlso request.Conditions.Count > 0 Then
                    For Each cond In request.Conditions
                        Console.WriteLine($"   Condition[{cond.Id}]: Name={cond.Name}, HasExecutableCode={Not String.IsNullOrWhiteSpace(If(cond.Expression?.ExecutableCode, ""))}, HasCompiledCode={Not String.IsNullOrWhiteSpace(If(cond.Expression?.CompiledCode, ""))}")
                    Next
                Else
                    ' ✅ DEBUG: Check if conditions key exists in raw JSON (body already read as string)
                    If body.Contains("""" & "conditions" & """") Then
                        Console.WriteLine($"⚠️ [HandleCompileFlow] 'conditions' key found in JSON body but deserialized as Nothing/Empty")
                        Dim conditionsIndex = body.IndexOf("""" & "conditions" & """")
                        Dim conditionsPreview = If(conditionsIndex >= 0 AndAlso body.Length > conditionsIndex + 50, body.Substring(conditionsIndex, Math.Min(500, body.Length - conditionsIndex)), "NOT FOUND")
                        Console.WriteLine($"   Conditions JSON preview: {conditionsPreview}")
                    Else
                        Console.WriteLine($"⚠️ [HandleCompileFlow] 'conditions' key NOT found in JSON body")
                    End If
                End If

                ' Create Flow structure con task materializzati
                Dim flow As New Compiler.Flow() With {
                    .Nodes = If(request.Nodes, New List(Of Compiler.FlowNode)()),
                    .Edges = If(request.Edges, New List(Of Compiler.FlowEdge)()),
                    .Tasks = materializedTasks,  ' ✅ Task materializzati con dataContract
                    .Conditions = If(request.Conditions, New List(Of Compiler.ConditionDefinition)())  ' ✅ NEW: Conditions per validazione
                }

                ' ✅ DEBUG: Log Flow.Conditions after creation
                Console.WriteLine($"🔍 [HandleCompileFlow] Flow.Conditions count: {If(flow.Conditions IsNot Nothing, flow.Conditions.Count, 0)}")
                If flow.Conditions IsNot Nothing AndAlso flow.Conditions.Count > 0 Then
                    Console.WriteLine($"   Flow.Conditions IDs: {String.Join(", ", flow.Conditions.Select(Function(c) c.Id))}")
                End If

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
            ' ✅ LOG RIDOTTI: Solo errori e dump
            ' Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
            ' Console.WriteLine("📥 [HandleCompileTask] Received single task compilation request")

            Try
                ' Enable buffering
                Try
                    context.Request.EnableBuffering()
                Catch ex As Exception
                    ' Console.WriteLine($"⚠️ [HandleCompileTask] EnableBuffering failed: {ex.Message}")
                End Try

                ' Reset stream position
                Try
                    context.Request.Body.Position = 0
                Catch ex As Exception
                    ' Console.WriteLine($"⚠️ [HandleCompileTask] Cannot reset stream position: {ex.Message}")
                End Try

                ' Read request body
                Dim body As String = Nothing
                Try
                    Dim reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                    ' Console.WriteLine($"📦 [HandleCompileTask] Body read successfully: {If(body IsNot Nothing, body.Length, 0)} characters")
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
                    ' Console.WriteLine("🔄 [HandleCompileTask] Starting JSON deserialization...")
                    requestObj = Newtonsoft.Json.Linq.JObject.Parse(body)
                    ' Console.WriteLine($"✅ [HandleCompileTask] JSON deserialization completed")
                Catch deserializeEx As Exception
                    Console.WriteLine($"❌ [HandleCompileTask] Deserialization error: {deserializeEx.Message}")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Failed to deserialize request", .message = deserializeEx.Message})
                    context.Response.ContentType = "application/json"
                    context.Response.StatusCode = 400
                    context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
                    Return
                End Try

                ' ✅ NUOVO: Riconosci input.TaskInstance
                Dim taskInstance As Compiler.TaskDefinition = Nothing
                Dim allTemplates As List(Of Compiler.TaskDefinition) = Nothing

                If requestObj("taskInstance") IsNot Nothing Then
                    ' ✅ NUOVO FORMATO: { taskInstance: {...}, allTemplates: [...] }
                    ' Console.WriteLine("✅ [HandleCompileTask] Detected TaskInstance input format")

                    ' Deserialize taskInstance
                    Try
                        Dim taskInstanceJson = requestObj("taskInstance").ToString()
                        Dim settings = New JsonSerializerSettings() With {
                            .NullValueHandling = NullValueHandling.Ignore,
                            .MissingMemberHandling = MissingMemberHandling.Ignore
                        }
                        taskInstance = DeserializeTaskFromJson(taskInstanceJson, settings)
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
                            Dim settings = New JsonSerializerSettings() With {
                                .NullValueHandling = NullValueHandling.Ignore,
                                .MissingMemberHandling = MissingMemberHandling.Ignore
                            }
                            allTemplates = DeserializeTaskListFromJson(allTemplatesJson, settings)
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
                        allTemplates = New List(Of Compiler.TaskDefinition) From {taskInstance}
                    End If
                Else
                    Console.WriteLine("❌ [HandleCompileTask] Missing taskInstance in request")
                    Dim errorJson = JsonConvert.SerializeObject(New With {.error = "Missing taskInstance in request. The request must contain a 'taskInstance' field."})
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

                ' Console.WriteLine($"🔍 [HandleCompileTask] TaskInstance received: Id={taskInstance.Id}, Type={If(taskInstance.Type.HasValue, taskInstance.Type.Value.ToString(), "NULL")}, AllTemplates count={If(allTemplates IsNot Nothing, allTemplates.Count, 0)}")

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
                ' Console.WriteLine($"✅ [HandleCompileTask] TaskType: {taskType} (value={typeValue})")

                ' ✅ SINGLE POINT OF TRUTH: Materializza TaskDefinition completo PRIMA della compilazione
                Dim materializer = New ApiServer.Services.TaskDefinitionMaterializer()
                Dim materializedTask = materializer.MaterializeTaskDefinition(taskInstance, allTemplates)

                ' ✅ Raccogli template referenziati per sub-template
                Dim allTemplatesWithReferenced = New List(Of Compiler.TaskDefinition)(allTemplates)
                Dim utteranceTask = TryCast(materializedTask, UtteranceTaskDefinition)
                If utteranceTask IsNot Nothing AndAlso utteranceTask.SubTasksIds IsNot Nothing Then
                    For Each subTaskId In utteranceTask.SubTasksIds
                        If Not String.IsNullOrEmpty(subTaskId) AndAlso Not allTemplatesWithReferenced.Any(Function(t) t.Id = subTaskId) Then
                            Dim subTemplate = allTemplates.FirstOrDefault(Function(t) t.Id = subTaskId)
                            If subTemplate IsNot Nothing Then
                                allTemplatesWithReferenced.Add(subTemplate)
                            End If
                        End If
                    Next
                End If

                ' Get appropriate compiler based on task type
                Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
                ' Console.WriteLine($"✅ [HandleCompileTask] Using compiler: {compiler.GetType().Name}")

                ' ✅ Pipeline pulita: compila TaskDefinition materializzato con allTemplates
                ' Console.WriteLine($"🔄 [HandleCompileTask] Calling compiler.Compile for materialized task {materializedTask.Id}...")
                ' Console.WriteLine($"   AllTemplates count: {If(allTemplatesWithReferenced IsNot Nothing, allTemplatesWithReferenced.Count, 0)}")

                Dim compiledTask = compiler.Compile(materializedTask, materializedTask.Id, allTemplatesWithReferenced)
                ' Console.WriteLine($"✅ [HandleCompileTask] TaskInstance compiled successfully: {compiledTask.GetType().Name}")

                ' ✅ DIAG: Verifica steps nel CompiledTask prima di validare ID - COMMENTATO PER RIDURRE LOG
                ' Console.WriteLine("=================================================================================")
                ' Console.WriteLine("[DIAG] HandleCompileTask: CompiledTask steps verification...")
                ' Console.WriteLine($"   TaskInstance.Id: {taskInstance.Id}")
                ' Console.WriteLine($"   TaskInstance.Steps IsNothing: {taskInstance.Steps Is Nothing}")
                ' If taskInstance.Steps IsNot Nothing Then
                '     Console.WriteLine($"   TaskInstance.Steps.Count: {taskInstance.Steps.Count}")
                '     Console.WriteLine($"   TaskInstance.Steps.Keys: {String.Join(", ", taskInstance.Steps.Keys)}")
                ' End If
                ' ✅ Riutilizza compiledUtteranceTask già dichiarata sopra
                ' If compiledUtteranceTask IsNot Nothing Then
                '     Console.WriteLine($"   CompiledUtteranceTask.Steps IsNothing: {compiledUtteranceTask.Steps Is Nothing}")
                '     If compiledUtteranceTask.Steps IsNot Nothing Then
                '         Console.WriteLine($"   CompiledUtteranceTask.Steps.Count: {compiledUtteranceTask.Steps.Count}")
                '         For Each dstep As TaskEngine.CompiledDialogueStep In compiledUtteranceTask.Steps
                '             Dim escalationsCount As Integer = If(dstep.Escalations IsNot Nothing, dstep.Escalations.Count, 0)
                '             Dim stepInfo As String = "     Step Type: " & dstep.Type & ", Escalations: " & escalationsCount.ToString()
                '             Console.WriteLine(stepInfo)
                '         Next
                '     End If
                '     Console.WriteLine($"   CompiledUtteranceTask.SubTasks IsNothing: {compiledUtteranceTask.SubTasks Is Nothing}")
                '     If compiledUtteranceTask.SubTasks IsNot Nothing Then
                '         Console.WriteLine($"   CompiledUtteranceTask.SubTasks.Count: {compiledUtteranceTask.SubTasks.Count}")
                '     End If
                ' End If
                ' Console.WriteLine("=================================================================================")

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

                ' Console.WriteLine($"✅ [HandleCompileTask] CompiledTask.Id verified: {compiledTask.Id} = {taskInstance.Id}")

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

                ' Console.WriteLine($"✅ [HandleCompileTask] Compilation completed successfully")
                ' Console.WriteLine($"   Response: success={responseObj.success}, taskId={responseObj.taskId}, compiledTask.Id={compiledTask.Id}")
                ' Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")

                ' ✅ Serializza manualmente usando Newtonsoft.Json (come in HandleCompileFlow)
                ' ✅ Usa stesso ContractResolver globale per coerenza camelCase
                ' Console.WriteLine("📤 [HandleCompileTask] Serializing response manually...")
                Dim jsonResponse = JsonConvert.SerializeObject(responseObj, New JsonSerializerSettings() With {
                    .ContractResolver = New CamelCasePropertyNamesContractResolver(),
                    .NullValueHandling = NullValueHandling.Ignore
                })
                ' Console.WriteLine($"📤 [HandleCompileTask] Serialized response JSON length: {jsonResponse.Length}")
                ' Console.WriteLine($"📤 [HandleCompileTask] Serialized response preview: {If(jsonResponse.Length > 200, jsonResponse.Substring(0, 200) & "...", jsonResponse)}")

                ' ✅ VERIFICA: Verifica che compiledTask.id sia in camelCase e che rowId non sia presente - COMMENTATO
                ' Try
                '     Dim responseObjParsed = Newtonsoft.Json.Linq.JObject.Parse(jsonResponse)
                '     Dim compiledTaskObj = responseObjParsed("compiledTask")
                '     If compiledTaskObj IsNot Nothing Then
                '         Dim compiledTaskId = compiledTaskObj("id")
                '         Dim debugObj = compiledTaskObj("debug")
                '         Dim rowId = If(debugObj IsNot Nothing, debugObj("rowId"), Nothing)
                '
                '         Console.WriteLine($"✅ [HandleCompileTask] JSON VERIFICATION:")
                '         Console.WriteLine($"   - compiledTask.id present: {compiledTaskId IsNot Nothing}")
                '         If compiledTaskId IsNot Nothing Then
                '             Console.WriteLine($"   - compiledTask.id value: {compiledTaskId.ToString()}")
                '         End If
                '         Console.WriteLine($"   - debug.rowId present: {rowId IsNot Nothing}")
                '         If rowId IsNot Nothing Then
                '             Console.WriteLine($"   ⚠️  WARNING: rowId should NOT be present for TaskInstance compilation!")
                '         Else
                '             Console.WriteLine($"   ✅ OK: rowId correctly excluded from JSON (NullValueHandling.Ignore working)")
                '         End If
                '     End If
                ' Catch ex As Exception
                '     Console.WriteLine($"⚠️  [HandleCompileTask] Error verifying JSON structure: {ex.Message}")
                ' End Try

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
                Dim innerMsg = If(ex.InnerException IsNot Nothing, " → " & ex.InnerException.Message, "")
                Dim errorJson = JsonConvert.SerializeObject(New With {
                    .status = "error",
                    .error = ex.Message & innerMsg,
                    .message = ex.Message & innerMsg,
                    .detail = ex.Message & innerMsg,
                    .exceptionType = ex.GetType().Name,
                    .timestamp = DateTime.UtcNow.ToString("O")
                })
                context.Response.ContentType = "application/json"
                context.Response.StatusCode = 500
                context.Response.WriteAsync(errorJson).GetAwaiter().GetResult()
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

                ' Deserialize CompiledUtteranceTask
                Dim compiledTask As Compiler.CompiledUtteranceTask = Nothing
                Try
                    Dim settings As New JsonSerializerSettings With {
                        .TypeNameHandling = TypeNameHandling.Auto,
                        .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                        .NullValueHandling = NullValueHandling.Ignore,
                        .Converters = New List(Of JsonConverter) From {New ITaskConverter()}
                    }
                    compiledTask = JsonConvert.DeserializeObject(Of Compiler.CompiledUtteranceTask)(runtimeTaskJson, settings)
                Catch ex As Exception
                    Console.WriteLine($"❌ [HandleSaveDialog] Error deserializing CompiledUtteranceTask: {ex.Message}")
                    Return Results.BadRequest(New With {.error = "Failed to deserialize CompiledUtteranceTask", .message = ex.Message})
                End Try

                If compiledTask Is Nothing Then
                    Console.WriteLine("❌ [HandleSaveDialog] CompiledUtteranceTask is Nothing after deserialization")
                    Return Results.BadRequest(New With {.error = "CompiledUtteranceTask is null"})
                End If

                ' Save to DialogRepository
                Try
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [HandleSaveDialog] ✅ Saving dialog to repository...")
                    Console.WriteLine($"   ProjectId: {projectId}")
                    Console.WriteLine($"   DialogVersion: {dialogVersion}")
                    Console.WriteLine($"   CompiledUtteranceTask.Id: {compiledTask.Id}")
                    Console.WriteLine($"   CompiledUtteranceTask.HasSubTasks: {compiledTask.HasSubTasks()}")
                    If compiledTask.HasSubTasks() Then
                        Console.WriteLine($"   CompiledUtteranceTask.SubTasks.Count: {compiledTask.SubTasks.Count}")
                    End If
                    Console.Out.Flush()

                    Dim dialogRepository = New ApiServer.Repositories.RedisDialogRepository(
                        Program.GetRedisConnectionString(),
                        Program.GetRedisKeyPrefix()
                    )
                    Console.WriteLine($"🔵 [HandleSaveDialog] ✅ DialogRepository created, calling SaveDialog...")
                    Console.Out.Flush()

                    dialogRepository.SaveDialog(projectId, dialogVersion, compiledTask)

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
