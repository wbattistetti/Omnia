Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports TaskEngine

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
Public Class UtteranceInterpretationTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As Task, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] ========== COMPILE START ==========")
        Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Compile called for task {taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Compile called for task {taskId}")
        Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] flow.Tasks count: {If(flow IsNot Nothing AndAlso flow.Tasks IsNot Nothing, flow.Tasks.Count, 0)}")
        If flow IsNot Nothing AndAlso flow.Tasks IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Available template IDs in flow: {String.Join(", ", flow.Tasks.Select(Function(t) t.Id).Take(10))}")
        End If

        Dim compiledTask As New CompiledTaskUtteranceInterpretation()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeExpanded dal template usando task.templateId e subTasksIds
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura da subTasksIds
        ' 2. Applica task.steps come override
        Dim taskTreeExpanded As Compiler.TaskTreeExpanded = Nothing

        ' ✅ NUOVO MODELLO: Costruisci SEMPRE da template usando subTasksIds
        If Not String.IsNullOrEmpty(task.TemplateId) Then
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeExpanded from template {task.TemplateId}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeExpanded from template {task.TemplateId}")

            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Searching for template {task.TemplateId} in flow.Tasks...")
            Dim template As Compiler.Task = flow.Tasks.FirstOrDefault(Function(t As Compiler.Task) t.Id = task.TemplateId)
            If template IsNot Nothing Then
                Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Template {task.TemplateId} found: Label={template.Label}, SubTasksIds count={If(template.SubTasksIds IsNot Nothing, template.SubTasksIds.Count, 0)}")
                Try
                    Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeExpanded from template {task.TemplateId}...")
                    taskTreeExpanded = BuildTaskTreeExpanded(template, task, flow)
                    Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded built successfully")
                    Console.WriteLine($"   TaskTreeExpanded.Id={taskTreeExpanded.Id}")
                    Console.WriteLine($"   TaskTreeExpanded.Label={taskTreeExpanded.Label}")
                    Console.WriteLine($"   TaskTreeExpanded.Nodes count={If(taskTreeExpanded.Nodes IsNot Nothing, taskTreeExpanded.Nodes.Count, 0)}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded built from template {task.TemplateId}")
                Catch ex As Exception
                    Console.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to build TaskTreeExpanded from template: {ex.Message}")
                    Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                    End If
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Exception details: {ex.ToString()}")
                    Throw New InvalidOperationException($"Failed to build TaskTreeExpanded from template {task.TemplateId}: {ex.Message}", ex)
                End Try
            Else
                Console.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Template {task.TemplateId} NOT FOUND in flow.Tasks")
                Console.WriteLine($"   Available template IDs: {String.Join(", ", flow.Tasks.Select(Function(t) t.Id))}")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Template {task.TemplateId} not found")
                Throw New InvalidOperationException($"Template {task.TemplateId} not found. Every task must have a valid templateId.")
            End If
        Else
            ' ❌ RIMOSSO: Fallback legacy a task.Data
            ' Ogni task DEVE avere templateId (viene creato automaticamente se mancante)
            Console.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Task {taskId} has no templateId. This is not supported.")
            Throw New InvalidOperationException($"Task {taskId} must have a templateId. Legacy task.Data is not supported.")
        End If

        ' Compila TaskTreeExpanded se trovato
        If taskTreeExpanded IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded found! Starting compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded found! Starting compilation...")
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded.Id={taskTreeExpanded.Id}, Nodes IsNot Nothing={taskTreeExpanded.Nodes IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded.Id={taskTreeExpanded.Id}, Nodes IsNot Nothing={taskTreeExpanded.Nodes IsNot Nothing}")
            If taskTreeExpanded.Nodes IsNot Nothing Then
                Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded.Nodes.Count={taskTreeExpanded.Nodes.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeExpanded.Nodes.Count={taskTreeExpanded.Nodes.Count}")
            End If
            Try
                Dim taskCompiler As New TaskCompiler()
                ' Serializza TaskTreeExpanded a JSON per TaskCompiler.Compile
                Dim taskJson = JsonConvert.SerializeObject(taskTreeExpanded)
                Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Calling TaskCompiler.Compile with JSON length={taskJson.Length}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Calling TaskCompiler.Compile with JSON length={taskJson.Length}")
                Dim compileResult = taskCompiler.Compile(taskJson)
                If compileResult IsNot Nothing AndAlso compileResult.Task IsNot Nothing Then
                    ' ✅ Copia le proprietà direttamente da RuntimeTask a CompiledTaskUtteranceInterpretation
                    Dim runtimeTask = compileResult.Task
                    compiledTask.Steps = runtimeTask.Steps
                    compiledTask.Constraints = runtimeTask.Constraints
                    compiledTask.NlpContract = runtimeTask.NlpContract

                    ' ✅ Copia SubTasks ricorsivamente (solo se presenti E non vuoti)
                    If runtimeTask.HasSubTasks() Then
                        compiledTask.SubTasks = New List(Of CompiledTaskUtteranceInterpretation)()
                        For Each subTask As RuntimeTask In runtimeTask.SubTasks
                            Dim subCompiled = ConvertRuntimeTaskToCompiled(subTask)
                            compiledTask.SubTasks.Add(subCompiled)
                        Next
                    Else
                        ' ✅ Assicura che SubTasks sia Nothing per task atomici
                        compiledTask.SubTasks = Nothing
                    End If

                    Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Task compiled successfully for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Task compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Task compilation returned no task for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Task compilation returned no task for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to compile Task for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to compile Task for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        Else
            Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] No TaskTreeExpanded found for DataRequest task {taskId} - Task will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] No TaskTreeExpanded found for DataRequest task {taskId} - Task will be Nothing")
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
                ' Protezione contro riferimenti circolari
                If visitedTemplates.Contains(node.TemplateId) Then
                    Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Circular reference detected for templateId={node.TemplateId}, skipping dereferencing")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Circular reference detected for templateId={node.TemplateId}")
                    expandedNodes.Add(node)
                    Continue For
                End If

                visitedTemplates.Add(node.TemplateId)
                Console.WriteLine($"🔄 [COMPILER][UtteranceInterpretationTaskCompiler] Dereferencing templateId={node.TemplateId} for node Id={node.Id}")
                System.Diagnostics.Debug.WriteLine($"🔄 [COMPILER][UtteranceInterpretationTaskCompiler] Dereferencing templateId={node.TemplateId} for node Id={node.Id}")

                ' ✅ NUOVO MODELLO: Cerca il template referenziato e usa subTasksIds
                Dim referencedTemplate As Compiler.Task = allTemplates.FirstOrDefault(Function(t As Compiler.Task) t.Id = node.TemplateId)
                If referencedTemplate IsNot Nothing Then
                    ' ✅ Se il template ha subTasksIds, costruisci i subTasks
                    If referencedTemplate.SubTasksIds IsNot Nothing AndAlso referencedTemplate.SubTasksIds.Count > 0 Then
                        ' Se il nodo corrente non ha subTasks, costruiscili da subTasksIds
                        If node.SubTasks Is Nothing OrElse node.SubTasks.Count = 0 Then
                            node.SubTasks = BuildTaskTreeFromSubTasksIds(referencedTemplate.SubTasksIds, allTemplates, visitedTemplates)
                            Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Built {node.SubTasks.Count} subTasks from template {node.TemplateId} using subTasksIds")
                            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Built subTasks from template {node.TemplateId}")
                        End If
                    End If

                    ' ✅ Copia Label se mancante (per completezza)
                    If String.IsNullOrEmpty(node.Label) AndAlso Not String.IsNullOrEmpty(referencedTemplate.Label) Then
                        node.Label = referencedTemplate.Label
                    End If

                    visitedTemplates.Remove(node.TemplateId)
                Else
                    Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Template {node.TemplateId} not found - cannot dereference")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Template {node.TemplateId} not found")
                    visitedTemplates.Remove(node.TemplateId)
                End If
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
            .Name = source.Name,
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
        flow As Flow
    ) As TaskTreeExpanded
        Dim taskTreeExpanded As New TaskTreeExpanded() With {
            .Id = instance.Id,
            .Label = If(String.IsNullOrEmpty(instance.Label), template.Label, instance.Label),
            .Translations = New Dictionary(Of String, String)()
        }

        ' ✅ NUOVO MODELLO: Costruisci struttura da subTasksIds (grafo di template)
        If template.SubTasksIds IsNot Nothing AndAlso template.SubTasksIds.Count > 0 Then
            ' ✅ FIX: Costruisci sub-nodi
            Dim subNodes = BuildTaskTreeFromSubTasksIds(template.SubTasksIds, flow.Tasks, New HashSet(Of String)())

            ' ✅ FIX: Crea nodo radice con sub-nodi come SubTasks
            Dim rootNode As New Compiler.TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Name = If(String.IsNullOrEmpty(template.Label), template.Id, template.Label),
                .Steps = New List(Of Compiler.DialogueStep)(),
                .SubTasks = subNodes,  ' ✅ Sub-nodi dentro SubTasks
                .Constraints = If(template.DataContracts IsNot Nothing AndAlso template.DataContracts.Count > 0,
                                 template.DataContracts,
                                 If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                    template.Constraints,
                                    New List(Of Object)())),
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
            Dim rootNode As New Compiler.TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Name = If(String.IsNullOrEmpty(template.Label), template.Id, template.Label),
                .Steps = New List(Of Compiler.DialogueStep)(),
                .SubTasks = New List(Of Compiler.TaskNode)(), ' ✅ Vuoto per template atomico
                .Constraints = If(template.DataContracts IsNot Nothing AndAlso template.DataContracts.Count > 0,
                                 template.DataContracts,
                                 If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                    template.Constraints,
                                    New List(Of Object)())),
                .Condition = template.Condition
            }

            ' ✅ Applica steps dall'istanza al nodo root (OBBLIGATORIO per task atomico)
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                If instance.Steps.ContainsKey(template.Id) Then
                    ApplyStepsToNode(rootNode, instance.Steps(template.Id))
                End If
            End If

            taskTreeExpanded.Nodes = New List(Of Compiler.TaskNode) From {rootNode}
            Console.WriteLine($"ℹ️ [COMPILER][UtteranceInterpretationTaskCompiler] Template {template.Id} is atomic, created root node with steps")
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
            ' Protezione contro riferimenti circolari
            If visitedTemplates.Contains(subTaskId) Then
                Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Circular reference detected for subTaskId={subTaskId}, skipping")
                Continue For
            End If

            visitedTemplates.Add(subTaskId)
            Console.WriteLine($"🔄 [COMPILER][UtteranceInterpretationTaskCompiler] Dereferencing subTaskId={subTaskId}")

            ' Cerca il template referenziato
            Dim subTemplate As Compiler.Task = allTemplates.FirstOrDefault(Function(t As Compiler.Task) t.Id = subTaskId)
            If subTemplate IsNot Nothing Then
                ' ✅ Crea MainDataNode dal template
                ' NOTA: Steps vengono SOLO dall'istanza, non dal template
                ' Template fornisce: struttura (subTasksIds), constraints, condition, metadata

                ' ✅ Carica constraints dal template (priorità: dataContracts > constraints)
                Dim templateConstraints As List(Of Object) = Nothing
                If subTemplate.DataContracts IsNot Nothing AndAlso subTemplate.DataContracts.Count > 0 Then
                    templateConstraints = subTemplate.DataContracts
                ElseIf subTemplate.Constraints IsNot Nothing AndAlso subTemplate.Constraints.Count > 0 Then
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
                    .Name = If(String.IsNullOrEmpty(subTemplate.Label), subTemplate.Id, subTemplate.Label),
                    .Steps = New List(Of Compiler.DialogueStep)(),
                    .SubTasks = New List(Of Compiler.TaskNode)(),
                    .Constraints = templateConstraints,
                    .Condition = subTemplate.Condition
                }

                ' ✅ Se il sub-template ha a sua volta subTasksIds, dereferenzia ricorsivamente
                If subTemplate.SubTasksIds IsNot Nothing AndAlso subTemplate.SubTasksIds.Count > 0 Then
                    node.SubTasks = BuildTaskTreeFromSubTasksIds(subTemplate.SubTasksIds, allTemplates, visitedTemplates)
                End If

                nodes.Add(node)
                Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Created node from subTemplate {subTaskId}, subTasksCount={node.SubTasks.Count}")
            Else
                Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] SubTemplate {subTaskId} not found")
            End If

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
                            node.Steps = overrideSteps
                            Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Applied {overrideSteps.Count} steps override for templateId={node.TemplateId}")
                            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Applied steps override for templateId={node.TemplateId}")
                        End If
                    End If
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to apply steps override for templateId={node.TemplateId}: {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Exception details: {ex.ToString()}")
                End Try
            End If

            ' ✅ Ricorsione per subTasks
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                ApplyStepsOverrides(node.SubTasks, stepsOverrides)
            End If
        Next
    End Sub

    ''' <summary>
    ''' Converte RuntimeTask in CompiledTaskUtteranceInterpretation (ricorsivo)
    ''' </summary>
    Private Function ConvertRuntimeTaskToCompiled(runtimeTask As RuntimeTask) As CompiledTaskUtteranceInterpretation
        Dim compiled As New CompiledTaskUtteranceInterpretation() With {
            .Id = runtimeTask.Id,
            .Condition = runtimeTask.Condition,
            .Steps = runtimeTask.Steps,
            .Constraints = runtimeTask.Constraints,
            .NlpContract = runtimeTask.NlpContract
        }

        ' ✅ Copia SubTasks ricorsivamente (solo se presenti E non vuoti)
        If runtimeTask.HasSubTasks() Then
            compiled.SubTasks = New List(Of CompiledTaskUtteranceInterpretation)()
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
                node.Steps = overrideSteps
                Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Applied {overrideSteps.Count} steps to root node {node.Id}")
            End If
        Catch ex As Exception
            Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to apply steps to node {node.Id}: {ex.Message}")
        End Try
    End Sub
End Class

