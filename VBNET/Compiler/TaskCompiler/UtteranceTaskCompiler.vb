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

    Public Overrides Function Compile(task As Task, taskId As String, flow As Flow) As CompiledTask
        Dim compiledTask As New CompiledUtteranceTask()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeExpanded dal template usando task.templateId e subTasksIds
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura da subTasksIds
        ' 2. Applica task.steps come override
        Dim taskTreeExpanded As Compiler.TaskTreeExpanded = Nothing

        If Not String.IsNullOrEmpty(task.TemplateId) Then
            Dim template As Compiler.Task = flow.Tasks.FirstOrDefault(Function(t As Compiler.Task) t.Id = task.TemplateId)
            If template IsNot Nothing Then
                Try
                    taskTreeExpanded = BuildTaskTreeExpanded(template, task, flow)
                Catch ex As Exception
                    Console.WriteLine($"[COMPILER] ERROR: Failed to build TaskTreeExpanded from template {task.TemplateId}: {ex.Message}")
                    Throw New InvalidOperationException($"Failed to build TaskTreeExpanded from template {task.TemplateId}: {ex.Message}", ex)
                End Try
            Else
                Console.WriteLine($"[COMPILER] ERROR: Template {task.TemplateId} not found for task {taskId}")
                Throw New InvalidOperationException($"Template {task.TemplateId} not found. Every task must have a valid templateId.")
            End If
        Else
            Console.WriteLine($"[COMPILER] ERROR: Task {taskId} has no templateId")
            Throw New InvalidOperationException($"Task {taskId} must have a templateId. Legacy task.Data is not supported.")
        End If

        If taskTreeExpanded IsNot Nothing Then
            Try
                Dim taskCompiler As New TaskCompiler()
                Dim taskJson = JsonConvert.SerializeObject(taskTreeExpanded)
                Dim compileResult = taskCompiler.Compile(taskJson)
                If compileResult IsNot Nothing AndAlso compileResult.Task IsNot Nothing Then
                    Dim runtimeTask = compileResult.Task
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
                Dim referencedTemplate As Compiler.Task = allTemplates.FirstOrDefault(Function(t As Compiler.Task) t.Id = node.TemplateId)
                If referencedTemplate IsNot Nothing Then
                    If referencedTemplate.SubTasksIds IsNot Nothing AndAlso referencedTemplate.SubTasksIds.Count > 0 Then
                        If node.SubTasks Is Nothing OrElse node.SubTasks.Count = 0 Then
                            node.SubTasks = BuildTaskTreeFromSubTasksIds(referencedTemplate.SubTasksIds, allTemplates, visitedTemplates)
                        End If
                    End If

                    If String.IsNullOrEmpty(node.Label) AndAlso Not String.IsNullOrEmpty(referencedTemplate.Label) Then
                        node.Label = referencedTemplate.Label
                    End If

                    visitedTemplates.Remove(node.TemplateId)
                Else
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

