Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Compiler per task di tipo UtteranceInterpretation
''' Gestisce la logica complessa di caricamento e compilazione DDT
'''
''' LOGICA CONCETTUALE DEI DATI:
''' - Template: contiene struttura condivisa (constraints, examples, nlpContract)
''' - Istanza: contiene SOLO steps clonati (con nuovi GUID), NO constraints/examples
''' - Risoluzione: constraints/examples/nlpContract sono SEMPRE presi dal template usando templateId
''' - NO fallback: se template non trovato → errore esplicito (non maschera problemi)
'''
''' VANTAGGI:
''' - Elimina duplicazione: stesso contract salvato N volte per N istanze
''' - Aggiornamenti centralizzati: cambi template → tutte istanze usano nuovo contract
''' - Performance: meno dati nel database, lookup template in memoria (O(1))
''' - Architettura pulita: istanza contiene solo steps, template contiene contracts
''' </summary>
Public Class UtteranceTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As Task, taskId As String, allTemplates As List(Of Task)) As CompiledTask
        Dim compiledTask As New CompiledUtteranceTask()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeExpanded dal template usando task.templateId e subTasksIds
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura da subTasksIds
        ' 2. Applica task.steps come override
        Dim taskTreeExpanded As Compiler.TaskTreeExpanded = Nothing

        If Not String.IsNullOrEmpty(task.TemplateId) Then
            Dim matchingTemplates = allTemplates.Where(Function(t As Compiler.Task) t.Id = task.TemplateId).ToList()
            If matchingTemplates.Count = 0 Then
                Throw New InvalidOperationException($"Template with ID '{task.TemplateId}' not found in allTemplates for task '{taskId}'. Every task must reference a valid template.")
            ElseIf matchingTemplates.Count > 1 Then
                Throw New InvalidOperationException($"Template with ID '{task.TemplateId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
            End If
            Dim template = matchingTemplates.Single()
            Try
                taskTreeExpanded = BuildTaskTreeExpanded(template, task, allTemplates)
            Catch ex As Exception
                Console.WriteLine($"[COMPILER] ERROR: Failed to build TaskTreeExpanded from template {task.TemplateId}: {ex.Message}")
                Throw New InvalidOperationException($"Failed to build TaskTreeExpanded from template {task.TemplateId}: {ex.Message}", ex)
            End Try
        Else
            Console.WriteLine($"[COMPILER] ERROR: Task {taskId} has no templateId")
            Throw New InvalidOperationException($"Task {taskId} must have a templateId. Legacy task.Data is not supported.")
        End If

        If taskTreeExpanded IsNot Nothing Then
            Try
                ' ✅ DIAG: Verifica steps PRIMA di compilare
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"[DIAG] UtteranceTaskCompiler: Verifying steps before compilation...")
                Console.WriteLine($"   TaskInstance.Id: {taskId}")
                Console.WriteLine($"   TaskInstance.Steps IsNothing: {task.Steps Is Nothing}")
                If task.Steps IsNot Nothing Then
                    Console.WriteLine($"   TaskInstance.Steps.Count: {task.Steps.Count}")
                    Console.WriteLine($"   TaskInstance.Steps.Keys: {String.Join(", ", task.Steps.Keys)}")
                End If
                If taskTreeExpanded.Nodes IsNot Nothing AndAlso taskTreeExpanded.Nodes.Count > 0 Then
                    Dim firstNode = taskTreeExpanded.Nodes(0)
                    Console.WriteLine($"   FirstNode.Id: {firstNode.Id}")
                    Console.WriteLine($"   FirstNode.TemplateId: {firstNode.TemplateId}")
                    Console.WriteLine($"   FirstNode.Steps IsNothing: {firstNode.Steps Is Nothing}")
                    If firstNode.Steps IsNot Nothing Then
                        Console.WriteLine($"   FirstNode.Steps.Count: {firstNode.Steps.Count}")
                        For Each step In firstNode.Steps
                            Console.WriteLine($"     - Step Type: {step.Type}, Escalations: {If(step.Escalations IsNot Nothing, step.Escalations.Count, 0)}")
                        Next
                    End If
                    Console.WriteLine($"   FirstNode.SubTasks IsNothing: {firstNode.SubTasks Is Nothing}")
                    If firstNode.SubTasks IsNot Nothing Then
                        Console.WriteLine($"   FirstNode.SubTasks.Count: {firstNode.SubTasks.Count}")
                    End If
                End If
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                Dim taskCompiler As New TaskCompiler()
                Dim taskJson = JsonConvert.SerializeObject(taskTreeExpanded)

                ' ✅ DIAG: Verifica se dataContract è presente nel JSON serializzato
                Console.WriteLine($"[DIAG] UtteranceTaskCompiler: Serialized JSON length: {taskJson.Length}")
                Dim containsDataContract = taskJson.Contains("dataContract")
                Console.WriteLine($"[DIAG] UtteranceTaskCompiler: Serialized JSON contains 'dataContract': {containsDataContract}")
                If containsDataContract Then
                    Dim dataContractIndex = taskJson.IndexOf("dataContract")
                    Dim preview = taskJson.Substring(dataContractIndex, Math.Min(300, taskJson.Length - dataContractIndex))
                    Console.WriteLine($"[DIAG] UtteranceTaskCompiler: dataContract preview in JSON: {preview}")
                End If

                Dim compileResult = taskCompiler.Compile(taskJson)
                If compileResult IsNot Nothing AndAlso compileResult.Task IsNot Nothing Then
                    Dim runtimeTask = compileResult.Task

                    ' ✅ DIAG: Verifica steps dopo compilazione
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"[DIAG] UtteranceTaskCompiler: Steps after compilation...")
                    Console.WriteLine($"   RuntimeTask.Steps IsNothing: {runtimeTask.Steps Is Nothing}")
                    If runtimeTask.Steps IsNot Nothing Then
                        Console.WriteLine($"   RuntimeTask.Steps.Count: {runtimeTask.Steps.Count}")
                        For Each step In runtimeTask.Steps
                            Console.WriteLine($"     - Step Type: {step.Type}, Escalations: {If(step.Escalations IsNot Nothing, step.Escalations.Count, 0)}")
                        Next
                    End If
                    Console.WriteLine($"   RuntimeTask.HasSubTasks: {runtimeTask.HasSubTasks()}")
                    If runtimeTask.HasSubTasks() Then
                        Console.WriteLine($"   RuntimeTask.SubTasks.Count: {runtimeTask.SubTasks.Count}")
                    End If
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                    compiledTask.Steps = runtimeTask.Steps
                    compiledTask.Constraints = runtimeTask.Constraints
                    compiledTask.NlpContract = runtimeTask.NlpContract

                    If runtimeTask.HasSubTasks() Then
                        compiledTask.SubTasks = New List(Of CompiledUtteranceTask)()
                        For Each subTask As RuntimeTask In runtimeTask.SubTasks
                            Dim subCompiled = ConvertRuntimeTaskToCompiled(subTask)
                            compiledTask.SubTasks.Add(subCompiled)
                        Next
                    Else
                        compiledTask.SubTasks = Nothing
                    End If

                    ' ✅ DIAG: Verifica CompiledTask finale
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"[DIAG] UtteranceTaskCompiler: Final CompiledTask...")
                    Console.WriteLine($"   CompiledTask.Id: {compiledTask.Id}")
                    Console.WriteLine($"   CompiledTask.Steps IsNothing: {compiledTask.Steps Is Nothing}")
                    If compiledTask.Steps IsNot Nothing Then
                        Console.WriteLine($"   CompiledTask.Steps.Count: {compiledTask.Steps.Count}")
                    End If
                    Console.WriteLine($"   CompiledTask.SubTasks IsNothing: {compiledTask.SubTasks Is Nothing}")
                    If compiledTask.SubTasks IsNot Nothing Then
                        Console.WriteLine($"   CompiledTask.SubTasks.Count: {compiledTask.SubTasks.Count}")
                    End If
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                End If
            Catch ex As Exception
                Console.WriteLine($"[COMPILER] ERROR: Exception during compilation for task {taskId}: {ex.GetType().Name} - {ex.Message}")
                Throw
            End Try
        End If

        ' Popola campi comuni
        PopulateCommonFields(compiledTask, taskId)

        Return compiledTask
    End Function

    ''' <summary>
    ''' Espande ricorsivamente l'albero dei dati dereferenziando tutti i templateId
    ''' Il compilatore deve produrre un albero completamente espanso per il runtime
    ''' Supporta profondità arbitraria (ricorsione completa)
    ''' </summary>
    Private Function ExpandDataTreeRecursively(
        nodes As List(Of Compiler.TaskNode),
        allTemplates As List(Of Compiler.Task),
        visitedTemplates As HashSet(Of String)
    ) As List(Of Compiler.TaskNode)
        If nodes Is Nothing OrElse nodes.Count = 0 Then
            Return nodes
        End If

        Dim expandedNodes As New List(Of Compiler.TaskNode)()

        For Each node As Compiler.TaskNode In nodes
            ' ✅ Se il nodo ha templateId, dereferenzia il template
            If Not String.IsNullOrEmpty(node.TemplateId) Then
                If visitedTemplates.Contains(node.TemplateId) Then
                    expandedNodes.Add(node)
                    Continue For
                End If

                visitedTemplates.Add(node.TemplateId)

                ' ✅ NUOVO MODELLO: Cerca il template referenziato e usa subTasksIds
                Dim matchingTemplates = allTemplates.Where(Function(t As Compiler.Task) t.Id = node.TemplateId).ToList()
                If matchingTemplates.Count = 0 Then
                    Throw New InvalidOperationException($"Template with ID '{node.TemplateId}' not found in allTemplates for node '{node.Id}'. Every node must reference a valid template.")
                ElseIf matchingTemplates.Count > 1 Then
                    Throw New InvalidOperationException($"Template with ID '{node.TemplateId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
                End If
                Dim referencedTemplate = matchingTemplates.Single()

                If referencedTemplate.SubTasksIds IsNot Nothing AndAlso referencedTemplate.SubTasksIds.Count > 0 Then
                    If node.SubTasks Is Nothing OrElse node.SubTasks.Count = 0 Then
                        node.SubTasks = BuildTaskTreeFromSubTasksIds(referencedTemplate.SubTasksIds, allTemplates, visitedTemplates)
                    End If
                End If

                If String.IsNullOrEmpty(node.Label) AndAlso Not String.IsNullOrEmpty(referencedTemplate.Label) Then
                    node.Label = referencedTemplate.Label
                End If

                visitedTemplates.Remove(node.TemplateId)
            End If

            ' ✅ Espandi ricorsivamente i subTasks del nodo corrente
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                node.SubTasks = ExpandDataTreeRecursively(node.SubTasks, allTemplates, visitedTemplates)
            End If

            expandedNodes.Add(node)
        Next

        Return expandedNodes
    End Function

    ''' <summary>
    ''' Clona un TaskNode (copia superficiale)
    ''' </summary>
    Private Function CloneTaskNode(source As Compiler.TaskNode) As Compiler.TaskNode
        Dim cloned As New Compiler.TaskNode() With {
            .Id = source.Id,
            .Label = source.Label,
            .Type = source.Type,
            .Required = source.Required,
            .Condition = source.Condition,
            .TemplateId = source.TemplateId,
            .Steps = If(source.Steps IsNot Nothing, New List(Of Compiler.DialogueStep)(source.Steps), New List(Of Compiler.DialogueStep)()),
            .SubTasks = If(source.SubTasks IsNot Nothing, New List(Of Compiler.TaskNode)(source.SubTasks), New List(Of Compiler.TaskNode)()),
            .Synonyms = If(source.Synonyms IsNot Nothing, New List(Of String)(source.Synonyms), New List(Of String)()),
            .Constraints = If(source.Constraints IsNot Nothing, New List(Of Object)(source.Constraints), New List(Of Object)())
        }
        Return cloned
    End Function

    ''' <summary>
    ''' Costruisce TaskTreeExpanded dal template e applica gli override dall'istanza
    ''' ✅ NUOVO MODELLO: Usa subTasksIds invece di Data
    ''' </summary>
    Private Function BuildTaskTreeExpanded(
        template As Task,
        instance As Task,
        allTemplates As List(Of Task)
    ) As TaskTreeExpanded
        Dim taskTreeExpanded As New TaskTreeExpanded() With {
            .TaskInstanceId = instance.Id, ' ✅ Usa TaskInstanceId invece di Id
            .Label = If(String.IsNullOrEmpty(instance.Label), template.Label, instance.Label),
            .Translations = New Dictionary(Of String, String)()
        }

        ' ✅ NUOVO MODELLO: Costruisci struttura da subTasksIds (grafo di template)
        If template.SubTasksIds IsNot Nothing AndAlso template.SubTasksIds.Count > 0 Then
            ' ✅ FIX: Costruisci sub-nodi
            Dim subNodes = BuildTaskTreeFromSubTasksIds(template.SubTasksIds, allTemplates, New HashSet(Of String)())

            ' ✅ OBBLIGATORIO: dataContract (singolare) dal template - nessun fallback
            If template.DataContract Is Nothing Then
                Throw New InvalidOperationException(
                    $"Template '{template.Id}' is missing required 'dataContract' (singolare). " &
                    "The compiler requires this field to materialize the NLP contract. " &
                    "Every template must have a valid dataContract with NLP structure (regex, rules, ner, llm)."
                )
            End If
            Console.WriteLine($"[BuildTaskTreeExpanded] Using dataContract from template {template.Id}, type: {template.DataContract.GetType().Name}")

            ' ✅ FIX: Crea nodo radice con sub-nodi come SubTasks
            Dim rootNode As New Compiler.TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Steps = New List(Of Compiler.DialogueStep)(),
                .SubTasks = subNodes,  ' ✅ Sub-nodi dentro SubTasks
                .Constraints = If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                 template.Constraints,
                                 New List(Of Object)()), ' ✅ Solo Constraints, non DataContracts
                .DataContract = template.DataContract, ' ✅ Usa DataContract (singolare) direttamente
                .Condition = template.Condition
            }

            ' ✅ Applica steps override al nodo radice se presente
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                If instance.Steps.ContainsKey(template.Id) Then
                    ' Applica steps al nodo radice
                    ApplyStepsToNode(rootNode, instance.Steps(template.Id))
                End If
                ' Applica steps ai sub-nodi
                ApplyStepsOverrides(rootNode.SubTasks, instance.Steps)
            End If

            ' ✅ TaskTreeExpanded.Nodes contiene il nodo radice
            taskTreeExpanded.Nodes = New List(Of Compiler.TaskNode) From {rootNode}
        Else
            ' ✅ Template atomico → crea nodo root con steps dall'istanza
            ' Un template atomico è un albero con un solo nodo root, non un albero vuoto

            ' ✅ OBBLIGATORIO: dataContract (singolare) dal template - nessun fallback
            If template.DataContract Is Nothing Then
                Throw New InvalidOperationException(
                    $"Template '{template.Id}' is missing required 'dataContract' (singolare). " &
                    "The compiler requires this field to materialize the NLP contract. " &
                    "Every template must have a valid dataContract with NLP structure (regex, rules, ner, llm)."
                )
            End If
            Console.WriteLine($"[BuildTaskTreeExpanded] Using dataContract from template {template.Id}, type: {template.DataContract.GetType().Name}")

            Dim rootNode As New Compiler.TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Steps = New List(Of Compiler.DialogueStep)(),
                .SubTasks = New List(Of Compiler.TaskNode)(), ' ✅ Vuoto per template atomico
                .Constraints = If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                 template.Constraints,
                                 New List(Of Object)()), ' ✅ Solo Constraints, non DataContracts
                .DataContract = template.DataContract, ' ✅ Usa DataContract (singolare) direttamente
                .Condition = template.Condition
            }

            ' ✅ Applica steps dall'istanza al nodo root (OBBLIGATORIO per task atomico)
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                If instance.Steps.ContainsKey(template.Id) Then
                    ApplyStepsToNode(rootNode, instance.Steps(template.Id))
                End If
            End If

            taskTreeExpanded.Nodes = New List(Of Compiler.TaskNode) From {rootNode}
        End If

        Return taskTreeExpanded
    End Function

    ''' <summary>
    ''' ✅ NUOVO MODELLO: Costruisce TaskNode[] da subTasksIds (grafo di template)
    ''' Dereferenzia ricorsivamente ogni templateId in subTasksIds
    ''' </summary>
    Private Function BuildTaskTreeFromSubTasksIds(
        subTasksIds As List(Of String),
        allTemplates As List(Of Compiler.Task),
        visitedTemplates As HashSet(Of String)
    ) As List(Of Compiler.TaskNode)
        Dim nodes As New List(Of Compiler.TaskNode)()

        For Each subTaskId In subTasksIds
            If visitedTemplates.Contains(subTaskId) Then
                Continue For
            End If

            visitedTemplates.Add(subTaskId)

            ' Cerca il template referenziato
            Dim matchingTemplates = allTemplates.Where(Function(t As Compiler.Task) t.Id = subTaskId).ToList()
            If matchingTemplates.Count = 0 Then
                Throw New InvalidOperationException($"SubTemplate with ID '{subTaskId}' not found in allTemplates. Every subtask must reference a valid template.")
            ElseIf matchingTemplates.Count > 1 Then
                Throw New InvalidOperationException($"SubTemplate with ID '{subTaskId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
            End If
            Dim subTemplate = matchingTemplates.Single()

            ' ✅ Crea MainDataNode dal template
            ' NOTA: Steps vengono SOLO dall'istanza, non dal template
            ' Template fornisce: struttura (subTasksIds), constraints, condition, metadata

            ' ✅ OBBLIGATORIO: dataContract (singolare) dal template - nessun fallback
            If subTemplate.DataContract Is Nothing Then
                Throw New InvalidOperationException(
                    $"SubTemplate '{subTemplate.Id}' is missing required 'dataContract' (singolare). " &
                    "The compiler requires this field to materialize the NLP contract. " &
                    "Every template must have a valid dataContract with NLP structure (regex, rules, ner, llm)."
                )
            End If
            Console.WriteLine($"[BuildTaskTreeFromSubTasksIds] Using dataContract from subTemplate {subTemplate.Id}, type: {subTemplate.DataContract.GetType().Name}")

            ' ✅ Carica constraints dal template (solo Constraints, non DataContracts)
            Dim templateConstraints As List(Of Object) = Nothing
            If subTemplate.Constraints IsNot Nothing AndAlso subTemplate.Constraints.Count > 0 Then
                templateConstraints = subTemplate.Constraints
            Else
                templateConstraints = New List(Of Object)()
            End If

            ' ✅ Crea TaskNode dal template
            ' NOTA: Steps vengono SOLO dall'istanza, non dal template
            ' Template fornisce: struttura (subTasksIds), constraints, condition, metadata
            ' Label, Type, Required, Synonyms non vengono impostati (non servono nel runtime)
            Dim node As New Compiler.TaskNode() With {
                .Id = subTemplate.Id,
                .TemplateId = subTemplate.Id,
                .Steps = New List(Of Compiler.DialogueStep)(),
                .SubTasks = New List(Of Compiler.TaskNode)(),
                .Constraints = templateConstraints, ' ✅ Solo Constraints
                .DataContract = subTemplate.DataContract, ' ✅ Usa DataContract (singolare) direttamente
                .Condition = subTemplate.Condition
            }

            ' ✅ Se il sub-template ha a sua volta subTasksIds, dereferenzia ricorsivamente
            If subTemplate.SubTasksIds IsNot Nothing AndAlso subTemplate.SubTasksIds.Count > 0 Then
                node.SubTasks = BuildTaskTreeFromSubTasksIds(subTemplate.SubTasksIds, allTemplates, visitedTemplates)
            End If

            nodes.Add(node)

            visitedTemplates.Remove(subTaskId)
        Next

        Return nodes
    End Function

    ''' <summary>
    ''' Applica gli steps override dall'istanza ai nodi corrispondenti
    ''' steps è un dizionario: { "templateId": { "start": {...}, "noMatch": {...} } }
    ''' Ogni valore è un oggetto con chiavi tipo step e valori DialogueStep
    ''' DialogueStepListConverter gestisce automaticamente la conversione da oggetto a lista
    ''' </summary>
    Private Sub ApplyStepsOverrides(
        nodes As List(Of Compiler.TaskNode),
        stepsOverrides As Dictionary(Of String, Object)
    )
        For Each node In nodes
            ' ✅ Applica steps se presente override per questo templateId
            If Not String.IsNullOrEmpty(node.TemplateId) AndAlso stepsOverrides.ContainsKey(node.TemplateId) Then
                Try
                    ' ✅ Option Strict On: cast esplicito da Object
                    Dim overrideValue As Object = stepsOverrides(node.TemplateId)
                    If overrideValue IsNot Nothing Then
                        ' ✅ Usa DialogueStepListConverter per convertire oggetto → List(Of DialogueStep)
                        ' overrideValue è un oggetto: { "start": { escalations: [...] }, "noMatch": {...} }
                        Dim overrideJson = JsonConvert.SerializeObject(overrideValue)
                        Dim settings As New JsonSerializerSettings()
                        settings.Converters.Add(New DialogueStepListConverter())
                        Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of Compiler.DialogueStep))(overrideJson, settings)

                        If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                            ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
                            Dim seenTypes As New HashSet(Of String)()
                            For Each stepItem As Compiler.DialogueStep In overrideSteps
                                If stepItem IsNot Nothing AndAlso Not String.IsNullOrEmpty(stepItem.Type) Then
                                    If seenTypes.Contains(stepItem.Type) Then
                                        Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                                        Console.WriteLine($"❌ [UtteranceTaskCompiler.ApplyStepsOverrides] DUPLICATE STEP DETECTED")
                                        Console.WriteLine($"   Node.Id: {node.Id}")
                                        Console.WriteLine($"   Node.TemplateId: {node.TemplateId}")
                                        Console.WriteLine($"   Duplicate Type: {stepItem.Type}")
                                        Dim allStepTypes = overrideSteps.Where(Function(s) s IsNot Nothing AndAlso Not String.IsNullOrEmpty(s.Type)).Select(Function(s) s.Type).ToList()
                                        Console.WriteLine($"   All step types: {String.Join(", ", allStepTypes)}")
                                        Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                                        Console.Out.Flush()
                                        System.Diagnostics.Debug.WriteLine($"❌ [UtteranceTaskCompiler] DUPLICATE STEP: Node.Id={node.Id}, Type={stepItem.Type}")
                                        Throw New InvalidOperationException($"Invalid task model: Node {node.Id} has duplicate steps with Type={stepItem.Type}. Each Type must appear exactly once.")
                                    End If
                                    seenTypes.Add(stepItem.Type)
                                End If
                            Next

                            node.Steps = overrideSteps
                        End If
                    End If
                Catch ex As Exception
                    Console.WriteLine($"[COMPILER] ERROR: Failed to apply steps override for templateId={node.TemplateId}: {ex.Message}")
                End Try
            End If

            ' ✅ Ricorsione per subTasks
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                ApplyStepsOverrides(node.SubTasks, stepsOverrides)
            End If
        Next
    End Sub

    ''' <summary>
    ''' Converte RuntimeTask in CompiledUtteranceTask (ricorsivo)
    ''' </summary>
    Private Function ConvertRuntimeTaskToCompiled(runtimeTask As RuntimeTask) As CompiledUtteranceTask
        Dim compiled As New CompiledUtteranceTask() With {
            .Id = runtimeTask.Id,
            .Condition = runtimeTask.Condition,
            .Steps = runtimeTask.Steps,
            .Constraints = runtimeTask.Constraints,
            .NlpContract = runtimeTask.NlpContract
        }

        ' ✅ Copia SubTasks ricorsivamente (solo se presenti E non vuoti)
        If runtimeTask.HasSubTasks() Then
            compiled.SubTasks = New List(Of CompiledUtteranceTask)()
            For Each subTask As RuntimeTask In runtimeTask.SubTasks
                compiled.SubTasks.Add(ConvertRuntimeTaskToCompiled(subTask))
            Next
        Else
            ' ✅ Assicura che SubTasks sia Nothing per task atomici
            compiled.SubTasks = Nothing
        End If

        Return compiled
    End Function

    ''' <summary>
    ''' Applica steps override a un singolo nodo
    ''' </summary>
    Private Sub ApplyStepsToNode(
        node As Compiler.TaskNode,
        stepsOverride As Object
    )
        If node Is Nothing OrElse stepsOverride Is Nothing Then
            Return
        End If

        Try
            Dim overrideJson = JsonConvert.SerializeObject(stepsOverride)
            Dim settings As New JsonSerializerSettings()
            settings.Converters.Add(New DialogueStepListConverter())
            Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of Compiler.DialogueStep))(overrideJson, settings)

            If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
                Dim seenTypes As New HashSet(Of String)()
                For Each stepItem As Compiler.DialogueStep In overrideSteps
                    If stepItem IsNot Nothing AndAlso Not String.IsNullOrEmpty(stepItem.Type) Then
                        If seenTypes.Contains(stepItem.Type) Then
                            Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                            Console.WriteLine($"❌ [UtteranceTaskCompiler.ApplyStepsToNode] DUPLICATE STEP DETECTED")
                            Console.WriteLine($"   Node.Id: {node.Id}")
                            Console.WriteLine($"   Duplicate Type: {stepItem.Type}")
                            Dim allStepTypes = overrideSteps.Where(Function(s) s IsNot Nothing AndAlso Not String.IsNullOrEmpty(s.Type)).Select(Function(s) s.Type).ToList()
                            Console.WriteLine($"   All step types: {String.Join(", ", allStepTypes)}")
                            Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                            Console.Out.Flush()
                            System.Diagnostics.Debug.WriteLine($"❌ [UtteranceTaskCompiler.ApplyStepsToNode] DUPLICATE STEP: Node.Id={node.Id}, Type={stepItem.Type}")
                            Throw New InvalidOperationException($"Invalid task model: Node {node.Id} has duplicate steps with Type={stepItem.Type}. Each Type must appear exactly once.")
                        End If
                        seenTypes.Add(stepItem.Type)
                    End If
                Next

                node.Steps = overrideSteps
            End If
        Catch ex As Exception
            Console.WriteLine($"[COMPILER] ERROR: Failed to apply steps to node {node.Id}: {ex.Message}")
        End Try
    End Sub
End Class

