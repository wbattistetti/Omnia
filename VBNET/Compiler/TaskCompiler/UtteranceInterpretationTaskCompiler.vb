Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports DDTEngine

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

        Dim dataRequestTask As New CompiledTaskGetData()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeRuntime dal template usando task.templateId e subTasksIds
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura da subTasksIds
        ' 2. Applica task.steps come override
        Dim taskTreeRuntime As Compiler.TaskTreeRuntime = Nothing

        ' ✅ NUOVO MODELLO: Costruisci SEMPRE da template usando subTasksIds
        If Not String.IsNullOrEmpty(task.TemplateId) Then
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeRuntime from template {task.TemplateId}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeRuntime from template {task.TemplateId}")

            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Searching for template {task.TemplateId} in flow.Tasks...")
            Dim template = flow.Tasks.FirstOrDefault(Function(t) t.Id = task.TemplateId)
            If template IsNot Nothing Then
                Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] Template {task.TemplateId} found: Label={template.Label}, SubTasksIds count={If(template.SubTasksIds IsNot Nothing, template.SubTasksIds.Count, 0)}")
                Try
                    Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Building TaskTreeRuntime from template {task.TemplateId}...")
                    taskTreeRuntime = BuildTaskTreeRuntimeFromTemplate(template, task, flow)
                    Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime built successfully")
                    Console.WriteLine($"   TaskTreeRuntime.Id={taskTreeRuntime.Id}")
                    Console.WriteLine($"   TaskTreeRuntime.Label={taskTreeRuntime.Label}")
                    Console.WriteLine($"   TaskTreeRuntime.Data count={If(taskTreeRuntime.Data IsNot Nothing, taskTreeRuntime.Data.Count, 0)}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime built from template {task.TemplateId}")
                Catch ex As Exception
                    Console.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to build TaskTreeRuntime from template: {ex.Message}")
                    Console.WriteLine($"   Exception type: {ex.GetType().Name}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                    End If
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][UtteranceInterpretationTaskCompiler] Exception details: {ex.ToString()}")
                    Throw New InvalidOperationException($"Failed to build TaskTreeRuntime from template {task.TemplateId}: {ex.Message}", ex)
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

        ' Compila TaskTreeRuntime se trovato
        If taskTreeRuntime IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime found! Starting compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime found! Starting compilation...")
            Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime.Id={taskTreeRuntime.Id}, Data IsNot Nothing={taskTreeRuntime.Data IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime.Id={taskTreeRuntime.Id}, Data IsNot Nothing={taskTreeRuntime.Data IsNot Nothing}")
            If taskTreeRuntime.Data IsNot Nothing Then
                Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime.Data.Count={taskTreeRuntime.Data.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] TaskTreeRuntime.Data.Count={taskTreeRuntime.Data.Count}")
            End If
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza TaskTreeRuntime a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(taskTreeRuntime)
                Console.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][UtteranceInterpretationTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                Dim ddtResult = ddtCompiler.Compile(ddtJson)
                If ddtResult IsNot Nothing AndAlso ddtResult.Instance IsNot Nothing Then
                    dataRequestTask.DDT = ddtResult.Instance
                    Console.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] DDT compiled successfully for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][UtteranceInterpretationTaskCompiler] DDT compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] DDT compilation returned no instance for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] DDT compilation returned no instance for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        Else
            Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] No TaskTreeRuntime found for DataRequest task {taskId} - DDT will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] No TaskTreeRuntime found for DataRequest task {taskId} - DDT will be Nothing")
        End If

        ' Popola campi comuni
        PopulateCommonFields(dataRequestTask, taskId)

        Return dataRequestTask
    End Function

    ''' <summary>
    ''' Espande ricorsivamente l'albero dei dati dereferenziando tutti i templateId
    ''' Il compilatore deve produrre un albero completamente espanso per il runtime
    ''' Supporta profondità arbitraria (ricorsione completa)
    ''' </summary>
    Private Function ExpandDataTreeRecursively(
        nodes As List(Of Compiler.MainDataNode),
        allTemplates As List(Of Compiler.Task),
        visitedTemplates As HashSet(Of String)
    ) As List(Of Compiler.MainDataNode)
        If nodes Is Nothing OrElse nodes.Count = 0 Then
            Return nodes
        End If

        Dim expandedNodes As New List(Of Compiler.MainDataNode)()

        For Each node As Compiler.MainDataNode In nodes
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
                Dim referencedTemplate = allTemplates.FirstOrDefault(Function(t) t.Id = node.TemplateId)
                If referencedTemplate IsNot Nothing Then
                    ' ✅ Se il template ha subTasksIds, costruisci i subTasks
                    If referencedTemplate.SubTasksIds IsNot Nothing AndAlso referencedTemplate.SubTasksIds.Count > 0 Then
                        ' Se il nodo corrente non ha subTasks, costruiscili da subTasksIds
                        If node.SubTasks Is Nothing OrElse node.SubTasks.Count = 0 Then
                            node.SubTasks = BuildDataTreeFromSubTasksIds(referencedTemplate.SubTasksIds, allTemplates, visitedTemplates)
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
    ''' Clona un MainDataNode (copia superficiale)
    ''' </summary>
    Private Function CloneMainDataNode(source As Compiler.MainDataNode) As Compiler.MainDataNode
        Dim cloned As New Compiler.MainDataNode() With {
            .Id = source.Id,
            .Name = source.Name,
            .Label = source.Label,
            .Type = source.Type,
            .Required = source.Required,
            .Condition = source.Condition,
            .TemplateId = source.TemplateId,
            .Steps = If(source.Steps IsNot Nothing, New List(Of Compiler.DialogueStep)(source.Steps), New List(Of Compiler.DialogueStep)()),
            .SubTasks = If(source.SubTasks IsNot Nothing, New List(Of Compiler.MainDataNode)(source.SubTasks), New List(Of Compiler.MainDataNode)()),
            .Synonyms = If(source.Synonyms IsNot Nothing, New List(Of String)(source.Synonyms), New List(Of String)()),
            .Constraints = If(source.Constraints IsNot Nothing, New List(Of Object)(source.Constraints), New List(Of Object)())
        }
        Return cloned
    End Function

    ''' <summary>
    ''' Costruisce TaskTreeRuntime dal template e applica gli override dall'istanza
    ''' ✅ NUOVO MODELLO: Usa subTasksIds invece di Data
    ''' </summary>
    Private Function BuildTaskTreeRuntimeFromTemplate(
        template As Task,
        instance As Task,
        flow As Flow
    ) As TaskTreeRuntime
        Dim taskTreeRuntime As New TaskTreeRuntime() With {
            .Id = instance.Id,
            .Label = If(String.IsNullOrEmpty(instance.Label), template.Label, instance.Label),
            .Translations = New Dictionary(Of String, String)()
        }

        ' ✅ NUOVO MODELLO: Costruisci struttura da subTasksIds (grafo di template)
        If template.SubTasksIds IsNot Nothing AndAlso template.SubTasksIds.Count > 0 Then
            ' ✅ Dereferenzia ricorsivamente subTasksIds per costruire MainDataNode[]
            taskTreeRuntime.Data = BuildDataTreeFromSubTasksIds(template.SubTasksIds, flow.Tasks, New HashSet(Of String)())

            ' ✅ Applica steps override dall'istanza
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                ApplyStepsOverrides(taskTreeRuntime.Data, instance.Steps)
            End If
        Else
            ' ✅ Template atomico (nessun subTask) → struttura vuota
            taskTreeRuntime.Data = New List(Of MainDataNode)()
            Console.WriteLine($"ℹ️ [COMPILER][UtteranceInterpretationTaskCompiler] Template {template.Id} has no subTasksIds (atomic template)")
        End If

        Return taskTreeRuntime
    End Function

    ''' <summary>
    ''' ✅ NUOVO MODELLO: Costruisce MainDataNode[] da subTasksIds (grafo di template)
    ''' Dereferenzia ricorsivamente ogni templateId in subTasksIds
    ''' </summary>
    Private Function BuildDataTreeFromSubTasksIds(
        subTasksIds As List(Of String),
        allTemplates As List(Of Task),
        visitedTemplates As HashSet(Of String)
    ) As List(Of MainDataNode)
        Dim nodes As New List(Of MainDataNode)()

        For Each subTaskId In subTasksIds
            ' Protezione contro riferimenti circolari
            If visitedTemplates.Contains(subTaskId) Then
                Console.WriteLine($"⚠️ [COMPILER][UtteranceInterpretationTaskCompiler] Circular reference detected for subTaskId={subTaskId}, skipping")
                Continue For
            End If

            visitedTemplates.Add(subTaskId)
            Console.WriteLine($"🔄 [COMPILER][UtteranceInterpretationTaskCompiler] Dereferencing subTaskId={subTaskId}")

            ' Cerca il template referenziato
            Dim subTemplate = allTemplates.FirstOrDefault(Function(t) t.Id = subTaskId)
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

                ' ✅ Crea MainDataNode dal template
                ' NOTA: Steps vengono SOLO dall'istanza, non dal template
                ' Template fornisce: struttura (subTasksIds), constraints, condition, metadata
                ' Label, Type, Required, Synonyms non vengono impostati (non servono nel runtime)
                Dim node As New MainDataNode() With {
                    .Id = subTemplate.Id,
                    .TemplateId = subTemplate.Id,
                    .Name = If(String.IsNullOrEmpty(subTemplate.Label), subTemplate.Id, subTemplate.Label),
                    .Steps = New List(Of Compiler.DialogueStep)(),
                    .SubTasks = New List(Of Compiler.MainDataNode)(),
                    .Constraints = templateConstraints,
                    .Condition = subTemplate.Condition
                }

                ' ✅ Se il sub-template ha a sua volta subTasksIds, dereferenzia ricorsivamente
                If subTemplate.SubTasksIds IsNot Nothing AndAlso subTemplate.SubTasksIds.Count > 0 Then
                    node.SubTasks = BuildDataTreeFromSubTasksIds(subTemplate.SubTasksIds, allTemplates, visitedTemplates)
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
        nodes As List(Of MainDataNode),
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
End Class

