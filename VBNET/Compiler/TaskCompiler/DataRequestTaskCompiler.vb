Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports DDTEngine

''' <summary>
''' Compiler per task di tipo DataRequest
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
Public Class DataRequestTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As Task, row As RowData, node As FlowNode, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Compile called for task {taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Compile called for task {taskId}")
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data IsNot Nothing={task.Data IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data IsNot Nothing={task.Data IsNot Nothing}")
        If task.Data IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data.Count={task.Data.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data.Count={task.Data.Count}")
        End If

        Dim dataRequestTask As New CompiledTaskGetData()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeRuntime dal template usando task.templateId
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura
        ' 2. Applica task.steps come override
        ' 3. Se task.templateId è null → fallback legacy a task.Data
        Dim taskTreeRuntime As Compiler.TaskTreeRuntime = Nothing

        ' ✅ PRIORITY 1: Costruisci da template (nuovo modello)
        If Not String.IsNullOrEmpty(task.TemplateId) Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Building DDT from template {task.TemplateId}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Building DDT from template {task.TemplateId}")

            Dim template = flow.Tasks.FirstOrDefault(Function(t) t.Id = task.TemplateId)
            If template IsNot Nothing Then
                Try
                    taskTreeRuntime = BuildTaskTreeRuntimeFromTemplate(template, task, flow)
                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime built from template {task.TemplateId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime built from template {task.TemplateId}")
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to build DDT from template: {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
                End Try
            Else
                Console.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found in flow.Tasks")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found")
            End If
        End If

        ' ✅ FALLBACK LEGACY: Se no templateId o costruzione fallita, usa task.Data (backward compatibility)
        If taskTreeRuntime Is Nothing AndAlso task.Data IsNot Nothing AndAlso task.Data.Count > 0 Then
            Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No templateId or template build failed, using legacy task.Data")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Using legacy task.Data")
            Try
                ' Serializza task a JSON e deserializza come TaskTreeRuntime
                Dim taskJson = JsonConvert.SerializeObject(task)
                Dim settings As New JsonSerializerSettings()
                settings.Converters.Add(New MainDataNodeListConverter())
                taskTreeRuntime = JsonConvert.DeserializeObject(Of Compiler.TaskTreeRuntime)(taskJson, settings)

                If taskTreeRuntime IsNot Nothing Then
                    taskTreeRuntime.Id = task.Id
                    If String.IsNullOrEmpty(taskTreeRuntime.Label) Then
                        taskTreeRuntime.Label = task.Label
                    End If
                    If taskTreeRuntime.Translations Is Nothing Then
                        taskTreeRuntime.Translations = New Dictionary(Of String, String)()
                    End If

                    ' ✅ Espandi ricorsivamente
                    If taskTreeRuntime.Data IsNot Nothing AndAlso taskTreeRuntime.Data.Count > 0 Then
                        taskTreeRuntime.Data = ExpandDataTreeRecursively(taskTreeRuntime.Data, flow.Tasks, New HashSet(Of String)())
                    End If
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to build TaskTreeRuntime from legacy task.Data: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        End If

        ' Compila TaskTreeRuntime se trovato
        If taskTreeRuntime IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime found! Starting compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime found! Starting compilation...")
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime.Id={taskTreeRuntime.Id}, Data IsNot Nothing={taskTreeRuntime.Data IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime.Id={taskTreeRuntime.Id}, Data IsNot Nothing={taskTreeRuntime.Data IsNot Nothing}")
            If taskTreeRuntime.Data IsNot Nothing Then
                Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime.Data.Count={taskTreeRuntime.Data.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] TaskTreeRuntime.Data.Count={taskTreeRuntime.Data.Count}")
            End If
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza TaskTreeRuntime a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(taskTreeRuntime)
                Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                Dim ddtResult = ddtCompiler.Compile(ddtJson)
                If ddtResult IsNot Nothing AndAlso ddtResult.Instance IsNot Nothing Then
                    dataRequestTask.DDT = ddtResult.Instance
                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        Else
            Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No TaskTreeRuntime found for DataRequest task {taskId} - DDT will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No TaskTreeRuntime found for DataRequest task {taskId} - DDT will be Nothing")
        End If

        ' Popola campi comuni
        PopulateCommonFields(dataRequestTask, row, node, taskId)

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
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Circular reference detected for templateId={node.TemplateId}, skipping dereferencing")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Circular reference detected for templateId={node.TemplateId}")
                    expandedNodes.Add(node)
                    Continue For
                End If

                visitedTemplates.Add(node.TemplateId)
                Console.WriteLine($"🔄 [COMPILER][DataRequestTaskCompiler] Dereferencing templateId={node.TemplateId} for node Id={node.Id}")
                System.Diagnostics.Debug.WriteLine($"🔄 [COMPILER][DataRequestTaskCompiler] Dereferencing templateId={node.TemplateId} for node Id={node.Id}")

                ' Cerca il template referenziato
                Dim referencedTemplate = allTemplates.FirstOrDefault(Function(t) t.Id = node.TemplateId)
                If referencedTemplate IsNot Nothing AndAlso referencedTemplate.Data IsNot Nothing AndAlso referencedTemplate.Data.Count > 0 Then
                    ' ✅ Template trovato: materializza constraints/examples/nlpContract
                    ' Per template atomico/composito: usa il primo nodo data
                    Dim templateNode = referencedTemplate.Data(0)

                    ' ✅ Copia constraints dal template referenziato
                    If templateNode.Constraints IsNot Nothing AndAlso templateNode.Constraints.Count > 0 Then
                        node.Constraints = templateNode.Constraints
                        Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Materialized constraints from template {node.TemplateId} (count={templateNode.Constraints.Count})")
                        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Materialized constraints from template {node.TemplateId}")
                    End If

                    ' ✅ Copia anche Name, Label, Type se mancanti (per completezza)
                    If String.IsNullOrEmpty(node.Name) AndAlso Not String.IsNullOrEmpty(templateNode.Name) Then
                        node.Name = templateNode.Name
                    End If
                    If String.IsNullOrEmpty(node.Label) AndAlso Not String.IsNullOrEmpty(templateNode.Label) Then
                        node.Label = templateNode.Label
                    End If
                    If String.IsNullOrEmpty(node.Type) AndAlso Not String.IsNullOrEmpty(templateNode.Type) Then
                        node.Type = templateNode.Type
                    End If

                    ' ✅ Espandi ricorsivamente i subData del template referenziato
                    If templateNode.SubTasks IsNot Nothing AndAlso templateNode.SubTasks.Count > 0 Then
                        ' Se il nodo corrente non ha subData, copia quelli del template
                        If node.SubTasks Is Nothing OrElse node.SubTasks.Count = 0 Then
                            node.SubTasks = New List(Of Compiler.MainDataNode)()
                            For Each templateSubNode In templateNode.SubTasks
                                ' Crea una copia del subNode del template con constraints materializzati
                                Dim clonedSubNode = CloneMainDataNode(templateSubNode)
                                ' ✅ IMPORTANTE: Mantieni il templateId per permettere ulteriore dereferenziazione
                                clonedSubNode.TemplateId = templateSubNode.TemplateId
                                node.SubTasks.Add(clonedSubNode)
                            Next
                            Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Copied {node.SubTasks.Count} subTasks from template {node.TemplateId}")
                            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Copied {node.SubTasks.Count} subTasks from template {node.TemplateId}")
                        End If
                    End If

                    visitedTemplates.Remove(node.TemplateId)
                Else
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Template {node.TemplateId} not found or has no data - cannot dereference")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Template {node.TemplateId} not found or has no data")
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

        ' ✅ Costruisci struttura dal template (ricorsivamente usando templateId di ogni nodo)
        If template.Data IsNot Nothing AndAlso template.Data.Count > 0 Then
            ' ✅ Espandi ricorsivamente usando templateId di ogni nodo
            taskTreeRuntime.Data = ExpandDataTreeFromTemplate(template.Data, flow.Tasks, New HashSet(Of String)())

            ' ✅ Applica steps override dall'istanza
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                ApplyStepsOverrides(taskTreeRuntime.Data, instance.Steps)
            End If
        End If

        ' ✅ Constraints sempre dal template
        If template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0 Then
            taskTreeRuntime.Constraints = template.Constraints
        End If

        Return taskTreeRuntime
    End Function

    ''' <summary>
    ''' Espande ricorsivamente l'albero dal template dereferenziando templateId
    ''' </summary>
    Private Function ExpandDataTreeFromTemplate(
        nodes As List(Of MainDataNode),
        allTemplates As List(Of Task),
        visitedTemplates As HashSet(Of String)
    ) As List(Of MainDataNode)
        ' ✅ Usa la stessa logica di ExpandDataTreeRecursively ma parte dai nodi del template
        Return ExpandDataTreeRecursively(nodes, allTemplates, visitedTemplates)
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
                    Dim overrideValue = stepsOverrides(node.TemplateId)
                    If overrideValue IsNot Nothing Then
                        ' ✅ Usa DialogueStepListConverter per convertire oggetto → List(Of DialogueStep)
                        ' overrideValue è un oggetto: { "start": { escalations: [...] }, "noMatch": {...} }
                        Dim overrideJson = JsonConvert.SerializeObject(overrideValue)
                        Dim settings As New JsonSerializerSettings()
                        settings.Converters.Add(New DialogueStepListConverter())
                        Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of Compiler.DialogueStep))(overrideJson, settings)

                        If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                            node.Steps = overrideSteps
                            Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Applied {overrideSteps.Count} steps override for templateId={node.TemplateId}")
                            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Applied steps override for templateId={node.TemplateId}")
                        End If
                    End If
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to apply steps override for templateId={node.TemplateId}: {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
                End Try
            End If

            ' ✅ Ricorsione per subTasks
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                ApplyStepsOverrides(node.SubTasks, stepsOverrides)
            End If
        Next
    End Sub
End Class

