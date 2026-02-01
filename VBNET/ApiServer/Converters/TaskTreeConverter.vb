Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler

''' <summary>
''' Converter utilities for TaskTree transformations
''' </summary>
Namespace Converters

    ''' <summary>
    ''' ✅ Helper: Converte TaskTree (JSON) in TaskTreeExpanded (AST montato) per il compilatore
    ''' </summary>
    ''' <param name="taskTreeJson">Il TaskTree come JObject dal frontend</param>
    ''' <param name="taskId">L'ID del task (per identificazione)</param>
    ''' <returns>TaskTreeExpanded pronto per la compilazione</returns>
    Public Module TaskTreeConverter

        Public Function ConvertTaskTreeToTaskTreeExpanded(taskTreeJson As JObject, taskId As String) As Compiler.TaskTreeExpanded
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
                Dim stepsDict As Dictionary(Of String, Object) = Nothing
                If taskTreeJson("steps") IsNot Nothing Then
                    Try
                        Dim stepsJson = taskTreeJson("steps").ToString()
                        Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Steps JSON found, length: {stepsJson.Length}")
                        Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Steps JSON preview: {stepsJson.Substring(0, Math.Min(500, stepsJson.Length))}")

                        stepsDict = JsonConvert.DeserializeObject(Of Dictionary(Of String, Object))(stepsJson)
                        Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Found {If(stepsDict IsNot Nothing, stepsDict.Count, 0)} step overrides")
                        If stepsDict IsNot Nothing Then
                            For Each kvp In stepsDict
                                Console.WriteLine($"   - templateId: {kvp.Key}, value type: {If(kvp.Value IsNot Nothing, kvp.Value.GetType().Name, "Nothing")}")
                            Next
                        End If
                    Catch ex As Exception
                        Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Failed to parse steps: {ex.Message}")
                        Console.WriteLine($"   Stack trace: {ex.StackTrace}")
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
                Dim taskTreeExpanded = JsonConvert.DeserializeObject(Of Compiler.TaskTreeExpanded)(taskTreeJson.ToString(), settings)
                If taskTreeExpanded Is Nothing Then
                    Console.WriteLine($"❌ [ConvertTaskTreeToTaskTreeExpanded] Failed to deserialize TaskTree - returned Nothing")
                    Return Nothing
                End If
                Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Deserialization successful")

                ' ✅ Imposta ID se mancante
                If String.IsNullOrEmpty(taskTreeExpanded.Id) Then
                    taskTreeExpanded.Id = taskId
                    Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Set Id to: {taskId}")
                Else
                    Console.WriteLine($"🔍 [ConvertTaskTreeToTaskTreeExpanded] Id already set: {taskTreeExpanded.Id}")
                End If

                ' ✅ Inizializza collections se mancanti
                If taskTreeExpanded.Nodes Is Nothing Then
                    taskTreeExpanded.Nodes = New List(Of Compiler.TaskNode)()
                    Console.WriteLine($"⚠️ [ConvertTaskTreeToTaskTreeExpanded] Nodes was Nothing, initialized empty list")
                Else
                    Console.WriteLine($"✅ [ConvertTaskTreeToTaskTreeExpanded] Nodes count: {taskTreeExpanded.Nodes.Count}")
                    For i = 0 To taskTreeExpanded.Nodes.Count - 1
                        Dim node = taskTreeExpanded.Nodes(i)
                        Console.WriteLine($"   Node[{i}]: Id={node.Id}, TemplateId={node.TemplateId}, Name={node.Name}, Steps.Count={If(node.Steps IsNot Nothing, node.Steps.Count, 0)}, SubTasks.Count={If(node.SubTasks IsNot Nothing, node.SubTasks.Count, 0)}")
                    Next
                End If
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
        ''' Usa la stessa logica di UtteranceInterpretationTaskCompiler.ApplyStepsOverrides
        ''' </summary>
        Public Sub ApplyStepsToTaskNodes(nodes As List(Of Compiler.TaskNode), stepsDict As Dictionary(Of String, Object))
            Console.WriteLine($"🔍 [ApplyStepsToTaskNodes] START - Processing {nodes.Count} nodes, {stepsDict.Count} step overrides available")
            For Each node As Compiler.TaskNode In nodes
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
        ''' Estrae templateId dal primo nodo di TaskTreeExpanded
        ''' </summary>
        Public Function ExtractTemplateIdFromTaskTreeExpanded(taskTreeExpanded As Compiler.TaskTreeExpanded, taskId As String) As String
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
        ''' UtteranceInterpretationTaskCompiler serializza e deserializza usando DialogueStepListConverter
        ''' </summary>
        Public Function BuildStepsOverrideFromTaskTreeExpanded(taskTreeExpanded As Compiler.TaskTreeExpanded) As Dictionary(Of String, Object)
            Dim stepsOverride As New Dictionary(Of String, Object)()

            If taskTreeExpanded Is Nothing OrElse taskTreeExpanded.Nodes Is Nothing Then
                Return stepsOverride
            End If

            ' Processa tutti i nodi root (ricorsivo)
            For Each node As Compiler.TaskNode In taskTreeExpanded.Nodes
                ProcessNodeForStepsOverride(node, stepsOverride)
            Next

            Return stepsOverride
        End Function

        ''' <summary>
        ''' Helper ricorsivo per processare nodi e costruire steps override
        ''' </summary>
        Private Sub ProcessNodeForStepsOverride(node As Compiler.TaskNode, ByRef stepsOverride As Dictionary(Of String, Object))
            If node Is Nothing Then
                Return
            End If

            ' Se il nodo ha templateId e steps, aggiungi all'override
            If Not String.IsNullOrEmpty(node.TemplateId) AndAlso node.Steps IsNot Nothing AndAlso node.Steps.Count > 0 Then
                ' Costruisci Dictionary con chiavi tipo step (start, noMatch, ecc.)
                Dim stepsDict As New Dictionary(Of String, Object)()
                For Each dlgStep As Compiler.DialogueStep In node.Steps
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
                For Each subTask As Compiler.TaskNode In node.SubTasks
                    ProcessNodeForStepsOverride(subTask, stepsOverride)
                Next
            End If
        End Sub

    End Module

End Namespace
