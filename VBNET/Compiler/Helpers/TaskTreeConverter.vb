Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler.DTO.IDE

''' <summary>
''' ✅ Helper: Converte TaskTree (JSON) in TaskTreeExpanded (AST montato) per il compilatore
''' Spostato da ApiServer/Converters a Compiler/Helpers per coerenza architetturale
''' </summary>
Namespace Helpers

    ''' <summary>
    ''' Converter utilities for TaskTree transformations
    ''' </summary>
    Public Module TaskTreeConverter

        ''' <summary>
        ''' ✅ Helper: Converte TaskTree (JSON) in TaskTreeExpanded (AST montato) per il compilatore
        ''' </summary>
        ''' <param name="taskTreeJson">Il TaskTree come JObject dal frontend</param>
        ''' <param name="taskId">L'ID del task (per identificazione)</param>
        ''' <returns>TaskTreeExpanded pronto per la compilazione</returns>
        Public Function ConvertTaskTreeToTaskTreeExpanded(taskTreeJson As JObject, taskId As String) As TaskTreeExpanded
            Try
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] START - Converting TaskTree to TaskTreeExpanded (taskId={taskId})")
                System.Diagnostics.Debug.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] START - Converting TaskTree to TaskTreeExpanded")

                ' ✅ Verifica che taskTreeJson non sia null
                If taskTreeJson Is Nothing Then
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] taskTreeJson is Nothing")
                    Return Nothing
                End If

                ' ✅ Log struttura JSON
                Dim jsonKeysList As New List(Of String)()
                For Each prop In taskTreeJson.Properties()
                    jsonKeysList.Add(prop.Name)
                Next
                Dim jsonKeys = String.Join(", ", jsonKeysList)
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] TaskTree JSON keys: {jsonKeys}")

                Dim jsonString = taskTreeJson.ToString()
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] JSON length: {jsonString.Length}")
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] JSON preview (first 1000 chars): {jsonString.Substring(0, Math.Min(1000, jsonString.Length))}")

                ' ✅ Estrai steps dal TaskTree (keyed by templateId)
                ' ✅ CORRETTO: Il frontend ora invia sempre steps come dictionary organizzato per templateId
                Dim stepsDict As Dictionary(Of String, Object) = Nothing
                If taskTreeJson("steps") IsNot Nothing Then
                    Try
                        Dim stepsToken = taskTreeJson("steps")
                        Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Steps found, type: {If(stepsToken IsNot Nothing, stepsToken.Type.ToString(), "Nothing")}")

                        ' ✅ Steps deve essere un dictionary (formato corretto dal frontend)
                        If stepsToken.Type = JTokenType.Object Then
                            Dim stepsJson = stepsToken.ToString()
                            stepsDict = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(stepsJson)
                            Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Found {If(stepsDict IsNot Nothing, stepsDict.Count, 0)} step overrides")
                            If stepsDict IsNot Nothing Then
                                For Each kvp In stepsDict
                                    Console.WriteLine($"   - templateId: {kvp.Key}, value type: {If(kvp.Value IsNot Nothing, kvp.Value.GetType().Name, "Nothing")}")
                                Next
                            End If
                        Else
                            Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Steps has unexpected type: {stepsToken.Type} (expected Object/dictionary)")
                            Console.WriteLine($"   Steps value: {stepsToken.ToString().Substring(0, Math.Min(200, stepsToken.ToString().Length))}")
                        End If
                    Catch ex As Exception
                        Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Failed to parse steps: {ex.Message}")
                        Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                        ' ✅ Non bloccare l'esecuzione se steps non può essere parsato
                    End Try
                Else
                    Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeExpanded] No 'steps' property found in TaskTree")
                End If

                ' Deserializza TaskTree JSON in TaskTreeExpanded (senza steps, che verranno applicati dopo)
                Dim settings As New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                }

                ' ✅ TaskTree dal frontend ha: { label, nodes, steps, constraints, introduction }
                ' ✅ TaskTreeExpanded ha: { id, label, nodes, translations, introduction, constraints }
                ' La conversione è diretta, ma dobbiamo aggiungere l'id e applicare gli steps
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Attempting deserialization...")

                ' ✅ LOGGING DETTAGLIATO: JSON che verrà deserializzato
                Dim jsonToDeserialize = taskTreeJson.ToString()
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] JSON to deserialize length: {jsonToDeserialize.Length}")
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] JSON preview (first 2000 chars): {jsonToDeserialize.Substring(0, Math.Min(2000, jsonToDeserialize.Length))}")

                ' ✅ Rimuovi steps dal JSON prima di deserializzare (verranno applicati dopo)
                Dim jsonWithoutSteps As String = jsonToDeserialize
                Try
                    Dim jsonObj = JObject.Parse(jsonToDeserialize)
                    If jsonObj("steps") IsNot Nothing Then
                        jsonObj.Remove("steps")
                        jsonWithoutSteps = jsonObj.ToString()
                        Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Removed 'steps' property before deserialization")
                    End If
                Catch parseEx As Exception
                    Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeExpanded] Failed to parse JSON to remove steps: {parseEx.Message}")
                    ' Continua con JSON originale
                End Try

                Dim taskTreeExpanded As TaskTreeExpanded = Nothing
                Try
                    taskTreeExpanded = JsonConvert.DeserializeObject(Of TaskTreeExpanded)(jsonWithoutSteps, settings)
                Catch deserializeEx As JsonSerializationException
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] JsonSerializationException during TaskTreeExpanded deserialization:")
                    Console.WriteLine($"   Message: {deserializeEx.Message}")
                    Console.WriteLine($"   Path: {deserializeEx.Path}")
                    Console.WriteLine($"   LineNumber: {deserializeEx.LineNumber}")
                    Console.WriteLine($"   LinePosition: {deserializeEx.LinePosition}")
                    Console.WriteLine($"   Stack trace: {deserializeEx.StackTrace}")
                    If deserializeEx.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {deserializeEx.InnerException.Message}")
                        Console.WriteLine($"   Inner stack trace: {deserializeEx.InnerException.StackTrace}")
                    End If
                    Console.WriteLine($"   JSON that failed (first 2000 chars): {jsonWithoutSteps.Substring(0, Math.Min(2000, jsonWithoutSteps.Length))}")
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Throw
                Catch ex As Exception
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] General exception during deserialization: {ex.Message}")
                    Console.WriteLine($"   Type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    Throw
                End Try

                If taskTreeExpanded Is Nothing Then
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Failed to deserialize TaskTree - returned Nothing")
                    Return Nothing
                End If
                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Deserialization successful")

                ' ✅ RETROCOMPATIBILITÀ: Se TaskInstanceId è vuoto, prova a leggere "id" dal JSON originale
                If String.IsNullOrEmpty(taskTreeExpanded.TaskInstanceId) Then
                    Dim idFromJson = taskTreeJson("id")
                    If idFromJson IsNot Nothing AndAlso idFromJson.Type = JTokenType.String Then
                        taskTreeExpanded.TaskInstanceId = idFromJson.ToString()
                        Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] TaskInstanceId not found, using 'id' from JSON: {taskTreeExpanded.TaskInstanceId}")
                    End If
                End If

                ' ✅ ASSEGNA taskInstanceId se ancora vuoto (fallback da taskId parametro)
                If String.IsNullOrEmpty(taskTreeExpanded.TaskInstanceId) Then
                    taskTreeExpanded.TaskInstanceId = taskId
                    Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] TaskInstanceId not in JSON, using taskId parameter as fallback: {taskId}")
                End If

                ' ❌ ERRORE BLOCCANTE: TaskInstanceId OBBLIGATORIO, nessun fallback
                If String.IsNullOrEmpty(taskTreeExpanded.TaskInstanceId) Then
                    Throw New InvalidOperationException($"TaskTreeExpanded.TaskInstanceId is required and cannot be empty. The request must include a valid taskInstanceId.")
                End If
                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] TaskInstanceId validated: {taskTreeExpanded.TaskInstanceId}")

                ' ❌ ERRORE BLOCCANTE: Nodes OBBLIGATORIO, nessun fallback
                If taskTreeExpanded.Nodes Is Nothing Then
                    Throw New InvalidOperationException($"TaskTreeExpanded.Nodes is required and cannot be Nothing. The TaskTree must have a valid Nodes list (even if empty).")
                End If

                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Nodes count: {taskTreeExpanded.Nodes.Count}")
                For i = 0 To taskTreeExpanded.Nodes.Count - 1
                    Dim node = taskTreeExpanded.Nodes(i)
                    Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}, SubTasks.Count={If(node.SubTasks IsNot Nothing, node.SubTasks.Count, 0)}")

                    ' ✅ DIAG: Verifica dataContract dopo deserializzazione
                    Console.WriteLine($"   [DIAG] Node[{i}] DataContract: IsNothing={node.DataContract Is Nothing}")
                    If node.DataContract IsNot Nothing Then
                        Console.WriteLine($"   [DIAG] Node[{i}] DataContract type: {node.DataContract.GetType().Name}")
                        Try
                            Dim dataContractJson = JsonConvert.SerializeObject(node.DataContract)
                            Console.WriteLine($"   [DIAG] Node[{i}] DataContract JSON (first 200 chars): {dataContractJson.Substring(0, Math.Min(200, dataContractJson.Length))}")
                        Catch ex As Exception
                            Console.WriteLine($"   [DIAG] Node[{i}] DataContract JSON serialization failed: {ex.Message}")
                        End Try
                    End If
                Next
                If taskTreeExpanded.Translations Is Nothing Then
                    taskTreeExpanded.Translations = New Dictionary(Of String, String)()
                End If
                If taskTreeExpanded.Constraints Is Nothing Then
                    taskTreeExpanded.Constraints = New List(Of Object)()
                End If

                ' ✅ Applica steps ai nodi (se presenti)
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Checking if steps should be applied...")
                Console.WriteLine($"   stepsDict IsNot Nothing: {stepsDict IsNot Nothing}")
                Console.WriteLine($"   stepsDict.Count: {If(stepsDict IsNot Nothing, stepsDict.Count, 0)}")
                Console.WriteLine($"   taskTreeExpanded.Nodes.Count: {taskTreeExpanded.Nodes.Count}")

                If stepsDict IsNot Nothing AndAlso stepsDict.Count > 0 AndAlso taskTreeExpanded.Nodes.Count > 0 Then
                    Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Applying steps to nodes...")
                    ApplyStepsToTaskNodes(taskTreeExpanded.Nodes, stepsDict)
                Else
                    Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeExpanded] Steps NOT applied - conditions not met")
                End If

                ' ✅ Log finale stato dei nodi dopo applicazione steps
                Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Final node states after steps application:")
                For i = 0 To taskTreeExpanded.Nodes.Count - 1
                    Dim node = taskTreeExpanded.Nodes(i)
                    Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}")
                    If node.Steps IsNot Nothing AndAlso node.Steps.Count > 0 Then
                        For j = 0 To node.Steps.Count - 1
                            Dim stepItem = node.Steps(j)
                            Console.WriteLine($"      Step[{j}]: Type={stepItem.Type}, Escalations.Count={If(stepItem.Escalations IsNot Nothing, stepItem.Escalations.Count, 0)}")
                        Next
                    End If
                Next

                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Converted successfully: {taskTreeExpanded.Nodes.Count} nodes, {If(stepsDict IsNot Nothing, stepsDict.Count, 0)} step overrides applied")
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                System.Diagnostics.Debug.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Converted successfully")

                Return taskTreeExpanded
            Catch ex As Exception
                Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Error: {ex.Message}")
                Console.WriteLine($"Stack trace: {ex.StackTrace}")
                System.Diagnostics.Debug.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Error: {ex.ToString()}")
                Return Nothing
            End Try
        End Function

        ''' <summary>
        ''' ✅ Helper: Applica steps override ai TaskNode (ricorsivo)
        ''' Usa la stessa logica di UtteranceTaskCompiler.ApplyStepsOverrides
        ''' </summary>
        Public Sub ApplyStepsToTaskNodes(nodes As List(Of TaskNode), stepsDict As Dictionary(Of String, Object))
            Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] START - Processing {nodes.Count} nodes, {stepsDict.Count} step overrides available")
            For Each node As TaskNode In nodes
                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Processing node: Id={node.Id}, TemplateId={node.TemplateId}, CurrentSteps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}")

                ' ❌ ERRORE BLOCCANTE: node deve avere templateId, nessun fallback
                If String.IsNullOrEmpty(node.TemplateId) Then
                    Throw New InvalidOperationException($"Node '{node.Id}' has empty TemplateId. TemplateId is mandatory and cannot be empty. The node must reference a valid template.")
                End If

                ' ✅ Applica steps se presente override per questo templateId
                If Not stepsDict.ContainsKey(node.TemplateId) Then
                    Console.WriteLine($"⚠️ [ApplyStepsToTaskNodes] Node {node.Id} (templateId={node.TemplateId}) not found in stepsDict")
                    Console.WriteLine($"   Available templateIds in stepsDict: {String.Join(", ", stepsDict.Keys)}")
                Else
                    Console.WriteLine($"✅ [ApplyStepsToTaskNodes] Found override for node {node.Id} (templateId={node.TemplateId})")
                    Try
                        Dim overrideValue As Object = stepsDict(node.TemplateId)

                        ' ✅ LOGGING DETTAGLIATO: Ispeziona tipo e struttura reale
                        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                        Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] CRITICAL INSPECTION - Node: {node.Id}, TemplateId: {node.TemplateId}")
                        Console.WriteLine($"   overrideValue IsNot Nothing: {overrideValue IsNot Nothing}")
                        If overrideValue IsNot Nothing Then
                            Console.WriteLine($"   overrideValue.GetType().Name: {overrideValue.GetType().Name}")
                            Console.WriteLine($"   overrideValue.GetType().FullName: {overrideValue.GetType().FullName}")

                            ' ✅ Prova a vedere se è un JObject o Dictionary
                            Dim asJObject = TryCast(overrideValue, JObject)
                            If asJObject IsNot Nothing Then
                                Console.WriteLine($"   ✅ overrideValue IS JObject")
                                Dim propNames = asJObject.Properties().Select(Function(p) p.Name).ToArray()
                                Console.WriteLine($"   JObject keys: {String.Join(", ", propNames)}")
                                Console.WriteLine($"   JObject full JSON: {asJObject.ToString(Formatting.Indented)}")
                            Else
                                Dim asDict = TryCast(overrideValue, Dictionary(Of String, Object))
                                If asDict IsNot Nothing Then
                                    Console.WriteLine($"   ✅ overrideValue IS Dictionary(Of String, Object)")
                                    Console.WriteLine($"   Dictionary keys: {String.Join(", ", asDict.Keys)}")
                                    For Each kvp In asDict
                                        Console.WriteLine($"     Key: {kvp.Key}, Value type: {If(kvp.Value IsNot Nothing, kvp.Value.GetType().Name, "Nothing")}")
                                        If kvp.Value IsNot Nothing Then
                                            Try
                                                Dim valueAsJObject = TryCast(kvp.Value, JObject)
                                                If valueAsJObject IsNot Nothing Then
                                                    Console.WriteLine($"       Value JSON preview: {valueAsJObject.ToString(Formatting.None).Substring(0, Math.Min(200, valueAsJObject.ToString().Length))}")
                                                End If
                                            Catch
                                            End Try
                                        End If
                                    Next
                                Else
                                    Console.WriteLine($"   ⚠️ overrideValue is NOT JObject or Dictionary - actual type: {overrideValue.GetType().Name}")
                                End If
                            End If
                        End If
                        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                        If overrideValue IsNot Nothing Then
                            Dim overrideSteps As List(Of DialogueStep) = Nothing

                            ' ✅ Verifica se è già JObject (evita doppia serializzazione)
                            Dim asJObject = TryCast(overrideValue, JObject)
                            If asJObject IsNot Nothing Then
                                ' ✅ Usa direttamente JObject senza serializzare
                                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Using JObject directly (avoiding double serialization)")
                                Dim settings As New JsonSerializerSettings()
                                settings.Converters.Add(New DialogueStepListConverter())
                                overrideSteps = asJObject.ToObject(Of List(Of DialogueStep))(JsonSerializer.Create(settings))
                                Console.WriteLine($"✅ [ApplyStepsToTaskNodes] Deserialized {If(overrideSteps IsNot Nothing, overrideSteps.Count, 0)} steps from JObject")
                            Else
                                ' ✅ Fallback: serializza e deserializza
                                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Serializing overrideValue to JSON...")
                                Dim overrideJson = JsonConvert.SerializeObject(overrideValue)

                                ' ✅ LOGGING DETTAGLIATO: JSON serializzato
                                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] Serialized JSON:")
                                Console.WriteLine($"   Length: {overrideJson.Length}")
                                Console.WriteLine($"   Full JSON: {overrideJson}")

                                ' ✅ Prova a parsare come JObject per vedere la struttura
                                Try
                                    Dim parsedJson = JObject.Parse(overrideJson)
                                    Dim propNames = parsedJson.Properties().Select(Function(p) p.Name).ToArray()
                                    Console.WriteLine($"   ✅ Parsed as JObject - keys: {String.Join(", ", propNames)}")
                                    For Each prop In parsedJson.Properties()
                                        Console.WriteLine($"     Property: {prop.Name}")
                                        If prop.Value.Type = JTokenType.Object Then
                                            Dim stepObj = CType(prop.Value, JObject)
                                            Dim stepPropNames = stepObj.Properties().Select(Function(p) p.Name).ToArray()
                                            Console.WriteLine($"       Step object keys: {String.Join(", ", stepPropNames)}")
                                            Console.WriteLine($"       Step object preview: {stepObj.ToString(Formatting.None).Substring(0, Math.Min(300, stepObj.ToString().Length))}")
                                        End If
                                    Next
                                Catch parseEx As Exception
                                    Console.WriteLine($"   ❌ Failed to parse as JObject: {parseEx.Message}")
                                End Try

                                Dim settings As New JsonSerializerSettings()
                                settings.Converters.Add(New DialogueStepListConverter())

                                ' ✅ LOGGING DETTAGLIATO: Prima della deserializzazione
                                Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] About to deserialize with DialogueStepListConverter...")
                                Console.WriteLine($"   Target type: List(Of DialogueStep)")

                                Try
                                    overrideSteps = JsonConvert.DeserializeObject(Of List(Of DialogueStep))(overrideJson, settings)
                                Catch deserializeEx As JsonSerializationException
                                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                    Console.WriteLine($"❌ [ApplyStepsToTaskNodes] JsonSerializationException DETAILS:")
                                    Console.WriteLine($"   Message: {deserializeEx.Message}")
                                    Console.WriteLine($"   Path: {deserializeEx.Path}")
                                    Console.WriteLine($"   LineNumber: {deserializeEx.LineNumber}")
                                    Console.WriteLine($"   LinePosition: {deserializeEx.LinePosition}")
                                    Console.WriteLine($"   Stack trace: {deserializeEx.StackTrace}")
                                    If deserializeEx.InnerException IsNot Nothing Then
                                        Console.WriteLine($"   Inner exception: {deserializeEx.InnerException.Message}")
                                        Console.WriteLine($"   Inner stack trace: {deserializeEx.InnerException.StackTrace}")
                                    End If
                                    Console.WriteLine($"   JSON that failed: {overrideJson}")
                                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                    Throw
                                Catch ex As Exception
                                    Console.WriteLine($"❌ [ApplyStepsToTaskNodes] General exception during deserialization: {ex.Message}")
                                    Console.WriteLine($"   Type: {ex.GetType().Name}")
                                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                                    Throw
                                End Try
                            End If

                            If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                                ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
                                Dim seenTypes As New HashSet(Of String)()
                                For Each stepItem As DialogueStep In overrideSteps
                                    If stepItem IsNot Nothing AndAlso Not String.IsNullOrEmpty(stepItem.Type) Then
                                        If seenTypes.Contains(stepItem.Type) Then
                                            Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                                            Console.WriteLine($"❌ [TaskTreeConverter.ApplyStepsToTaskNodes] DUPLICATE STEP DETECTED")
                                            Console.WriteLine($"   Node.Id: {node.Id}")
                                            Console.WriteLine($"   Node.TemplateId: {node.TemplateId}")
                                            Console.WriteLine($"   Duplicate Type: {stepItem.Type}")
                                            Dim allStepTypes = overrideSteps.Where(Function(s) s IsNot Nothing AndAlso Not String.IsNullOrEmpty(s.Type)).Select(Function(s) s.Type).ToList()
                                            Console.WriteLine($"   All step types: {String.Join(", ", allStepTypes)}")
                                            Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                                            Console.Out.Flush()
                                            System.Diagnostics.Debug.WriteLine($"❌ [TaskTreeConverter] DUPLICATE STEP: Node.Id={node.Id}, Type={stepItem.Type}")
                                            Throw New InvalidOperationException($"Invalid task model: Node {node.Id} (templateId={node.TemplateId}) has duplicate steps with Type={stepItem.Type}. Each Type must appear exactly once.")
                                        End If
                                        seenTypes.Add(stepItem.Type)
                                    End If
                                Next

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
                        Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                        Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                        If ex.InnerException IsNot Nothing Then
                            Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                            Console.WriteLine($"   Inner stack trace: {ex.InnerException.StackTrace}")
                        End If
                        ' ✅ Non bloccare l'esecuzione, continua con altri nodi
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
        ''' Estrae templateId dal primo nodo di TaskTreeExpanded
        ''' </summary>
        Public Function ExtractTemplateIdFromTaskTreeExpanded(taskTreeExpanded As TaskTreeExpanded, taskId As String) As String
            If taskTreeExpanded Is Nothing OrElse taskTreeExpanded.Nodes Is Nothing OrElse taskTreeExpanded.Nodes.Count = 0 Then
                Console.WriteLine($"⚠️ [ExtractTemplateIdFromTaskTreeExpanded] No nodes found, using taskId as templateId: {taskId}")
                Return taskId
            End If

            Dim firstNode = taskTreeExpanded.Nodes(0)
            If Not String.IsNullOrEmpty(firstNode.TemplateId) Then
                Console.WriteLine($"✅ [ExtractTemplateIdFromTaskTreeExpanded] Found templateId in first node: {firstNode.TemplateId}")
                Return firstNode.TemplateId
            End If

            Console.WriteLine($"⚠️ [ExtractTemplateIdFromTaskTreeExpanded] First node has no templateId, using taskId as templateId: {taskId}")
            Return taskId
        End Function

        ''' <summary>
        ''' Costruisce steps override da TaskTreeExpanded per l'istanza
        ''' Formato: { "templateId": { "start": {...}, "noMatch": {...} } }
        ''' UtteranceTaskCompiler serializza e deserializza usando DialogueStepListConverter
        ''' </summary>
        Public Function BuildStepsOverrideFromTaskTreeExpanded(taskTreeExpanded As TaskTreeExpanded) As Dictionary(Of String, Object)
            Dim stepsOverride As New Dictionary(Of String, Object)()

            If taskTreeExpanded Is Nothing OrElse taskTreeExpanded.Nodes Is Nothing Then
                Return stepsOverride
            End If

            ' Processa tutti i nodi root (ricorsivo)
            For Each node As TaskNode In taskTreeExpanded.Nodes
                ProcessNodeForStepsOverride(node, stepsOverride)
            Next

            Return stepsOverride
        End Function

        ''' <summary>
        ''' Helper ricorsivo per processare nodi e costruire steps override
        ''' </summary>
        Private Sub ProcessNodeForStepsOverride(node As TaskNode, ByRef stepsOverride As Dictionary(Of String, Object))
            If node Is Nothing Then
                Return
            End If

            ' Se il nodo ha templateId e steps, aggiungi all'override
            If Not String.IsNullOrEmpty(node.TemplateId) AndAlso node.Steps IsNot Nothing AndAlso node.Steps.Count > 0 Then
                ' Costruisci Dictionary con chiavi tipo step (start, noMatch, ecc.)
                Dim stepsDict As New Dictionary(Of String, Object)()
                For Each dlgStep As DialogueStep In node.Steps
                    If dlgStep IsNot Nothing Then
                        Dim stepType As String
                        Dim stepTypeValue As String = Nothing
                        If dlgStep.Type IsNot Nothing Then
                            stepTypeValue = dlgStep.Type
                        End If
                        If stepTypeValue IsNot Nothing AndAlso Not String.IsNullOrEmpty(stepTypeValue) Then
                            stepType = stepTypeValue
                        Else
                            stepType = "start"
                        End If
                        ' Serializza step in oggetto JSON-compatibile
                        stepsDict(stepType) = dlgStep
                    End If
                Next
                stepsOverride(node.TemplateId) = stepsDict
                Console.WriteLine($"🔍 [BuildStepsOverrideFromTaskTreeExpanded] Added steps override for templateId: {node.TemplateId}, steps count: {node.Steps.Count}")
            End If

            ' Processa ricorsivamente subTasks
            If node.SubTasks IsNot Nothing Then
                For Each subTask As TaskNode In node.SubTasks
                    ProcessNodeForStepsOverride(subTask, stepsOverride)
                Next
            End If
        End Sub

    End Module

End Namespace
