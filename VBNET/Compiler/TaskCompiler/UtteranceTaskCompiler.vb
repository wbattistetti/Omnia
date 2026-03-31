Option Strict On
Option Explicit On
Imports System.Linq
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler.DTO.IDE
Imports TaskEngine

''' <summary>
''' Compiler per task di tipo UtteranceInterpretation
''' Gestisce la logica complessa di caricamento e compilazione DDT
'''
''' LOGICA CONCETTUALE DEI DATI:
''' - Template: contiene struttura condivisa (constraints, examples, nlpContract)
''' - Istanza (template-bound): contiene steps; contract da template via templateId + allTemplates
''' - Istanza standalone (kind/subTasks o dataContract senza templateId): grafo già materializzato → BuildTaskTreeExpandedFromStandaloneInstance (stesso output di TaskTreeExpanded del merge)
''' - Con templateId non vuoto: sempre merge da template (anche se kind=standalone, il template vince)
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

    Public Overrides Function Compile(task As TaskDefinition, taskId As String, allTemplates As List(Of TaskDefinition)) As CompiledTask
        ' ✅ Cast a UtteranceTaskDefinition per accedere ai campi specifici
        Dim utteranceTask = TryCast(task, UtteranceTaskDefinition)
        If utteranceTask Is Nothing Then
            Throw New InvalidOperationException($"Task '{taskId}' must be of type UtteranceTaskDefinition for UtteranceInterpretation tasks. Found type: {task.GetType().Name}")
        End If

        Dim compiledTask As New CompiledUtteranceTask()

        ' ✅ NUOVO MODELLO: Costruisci TaskTreeExpanded dal template usando task.templateId e subTasksIds
        ' LOGICA:
        ' 1. Se task.templateId esiste → carica template e costruisci struttura da subTasksIds
        ' 2. Se istanza standalone (kind / subTasks / dataContract senza templateId) → TaskTreeExpanded da sola istanza
        ' 3. Applica task.steps come override (entrambi i rami)
        Dim taskTreeExpanded As TaskTreeExpanded = Nothing

        If Not String.IsNullOrEmpty(utteranceTask.TemplateId) Then
            Dim matchingTemplates = allTemplates.Where(Function(t As TaskDefinition) t.Id = utteranceTask.TemplateId).ToList()
            If matchingTemplates.Count = 0 Then
                Throw New InvalidOperationException($"Template with ID '{utteranceTask.TemplateId}' not found in allTemplates for task '{taskId}'. Every task must reference a valid template.")
            ElseIf matchingTemplates.Count > 1 Then
                Throw New InvalidOperationException($"Template with ID '{utteranceTask.TemplateId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
            End If
            Dim templateBase = matchingTemplates.Single()
            Dim template = TryCast(templateBase, UtteranceTaskDefinition)
            If template Is Nothing Then
                Throw New InvalidOperationException($"Template '{templateBase.Id}' must be of type UtteranceTaskDefinition. Found type: {templateBase.GetType().Name}")
            End If
            Try
                taskTreeExpanded = BuildTaskTreeExpanded(template, utteranceTask, allTemplates)
            Catch ex As Exception
                Console.WriteLine($"[COMPILER] ERROR: Failed to build TaskTreeExpanded from template {utteranceTask.TemplateId}: {ex.Message}")
                Throw New InvalidOperationException($"Failed to build TaskTreeExpanded from template {utteranceTask.TemplateId}: {ex.Message}", ex)
            End Try
        ElseIf IsStandaloneUtterancePayload(utteranceTask) Then
            Try
                taskTreeExpanded = BuildTaskTreeExpandedFromStandaloneInstance(utteranceTask, taskId)
            Catch ex As Exception
                Console.WriteLine($"[COMPILER] ERROR: standalone task {taskId}: {ex.Message}")
                Throw New InvalidOperationException(ex.Message, ex)
            End Try
        Else
            Throw New InvalidOperationException(
                $"Task '{taskId}' must either reference a template (templateId) or be a standalone Utterance task " &
                "with kind 'standalone' and non-empty subTasks, or root-level dataContract. Legacy task.Data is not supported.")
        End If

        If taskTreeExpanded IsNot Nothing Then
            Try
                Dim taskCompiler As New TaskCompiler()
                Dim taskJson = JsonConvert.SerializeObject(taskTreeExpanded)

                Dim compileResult = taskCompiler.Compile(taskJson)
                If compileResult IsNot Nothing AndAlso compileResult.Task IsNot Nothing Then
                    Dim compiledRootTask = compileResult.Task

                    ' ✅ Usa direttamente il risultato compilato (non serve più conversione)
                    compiledTask.Steps = compiledRootTask.Steps
                    compiledTask.Constraints = compiledRootTask.Constraints
                    compiledTask.NlpContract = compiledRootTask.NlpContract
                    compiledTask.SubTasks = compiledRootTask.SubTasks
                    compiledTask.NodeId = compiledRootTask.NodeId ' ✅ FIX: Propaga NodeId (templateId) — era la riga mancante che causava "Variable not found"
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
    ''' True se il task non ha templateId e porta un payload già materializzato (standalone).
    ''' </summary>
    Private Shared Function IsStandaloneUtterancePayload(ut As UtteranceTaskDefinition) As Boolean
        If ut Is Nothing Then
            Return False
        End If
        If Not String.IsNullOrEmpty(ut.TemplateId) Then
            Return False
        End If
        If String.Equals(ut.Kind, "standalone", StringComparison.OrdinalIgnoreCase) Then
            Return True
        End If
        If ut.PersistedSubTasks IsNot Nothing AndAlso ut.PersistedSubTasks.Count > 0 Then
            Return True
        End If
        If ut.DataContract IsNot Nothing Then
            Return True
        End If
        Return False
    End Function

    ''' <summary>
    ''' Costruisce TaskTreeExpanded da un'istanza standalone già materializzata (stesso ruolo del merge template+istanza).
    ''' </summary>
    Private Function BuildTaskTreeExpandedFromStandaloneInstance(
        instance As UtteranceTaskDefinition,
        taskId As String
    ) As TaskTreeExpanded
        If instance Is Nothing Then
            Throw New ArgumentNullException(NameOf(instance))
        End If

        Dim nodes As New List(Of TaskNode)()

        If instance.PersistedSubTasks IsNot Nothing AndAlso instance.PersistedSubTasks.Count > 0 Then
            For Each item In instance.PersistedSubTasks
                If item.Type = JTokenType.Object Then
                    Dim tn = TaskNodeFromJObject(CType(item, JObject))
                    If tn IsNot Nothing Then
                        nodes.Add(tn)
                    End If
                End If
            Next
        ElseIf instance.DataContract IsNot Nothing Then
            Dim rootId = If(String.IsNullOrEmpty(instance.Id), taskId, instance.Id)
            Dim root As New TaskNode() With {
                .Id = rootId,
                .TemplateId = rootId,
                .DataContract = instance.DataContract,
                .Constraints = If(instance.Constraints IsNot Nothing AndAlso instance.Constraints.Count > 0,
                    instance.Constraints,
                    New List(Of Object)()),
                .Condition = instance.Condition,
                .Steps = New List(Of DialogueStep)(),
                .SubTasks = New List(Of TaskNode)()
            }
            nodes.Add(root)
        Else
            Throw New InvalidOperationException(
                "Standalone task must include subTasks or root-level dataContract.")
        End If

        If nodes.Count = 0 Then
            Throw New InvalidOperationException("Standalone task produced no task nodes.")
        End If

        ValidateStandaloneNodesHaveContracts(nodes)

        Dim expanded As New TaskTreeExpanded() With {
            .TaskInstanceId = If(String.IsNullOrEmpty(instance.Id), taskId, instance.Id),
            .Label = instance.Label,
            .Translations = New Dictionary(Of String, String)(),
            .Nodes = nodes
        }

        If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
            If nodes.Count = 1 Then
                Dim rootNode = nodes(0)
                Dim key = If(Not String.IsNullOrEmpty(rootNode.TemplateId), rootNode.TemplateId, rootNode.Id)
                If instance.Steps.ContainsKey(key) Then
                    ApplyStepsToNode(rootNode, instance.Steps(key))
                ElseIf instance.Steps.ContainsKey(rootNode.Id) Then
                    ApplyStepsToNode(rootNode, instance.Steps(rootNode.Id))
                End If
                If rootNode.SubTasks IsNot Nothing AndAlso rootNode.SubTasks.Count > 0 Then
                    ApplyStepsOverrides(rootNode.SubTasks, instance.Steps)
                End If
            Else
                ApplyStepsOverrides(nodes, instance.Steps)
            End If
        End If

        Return expanded
    End Function

    ''' <summary>
    ''' Ogni nodo foglia del grafo standalone deve avere dataContract (come dopo merge da template).
    ''' </summary>
    Private Shared Sub ValidateStandaloneNodesHaveContracts(nodes As List(Of TaskNode))
        If nodes Is Nothing Then
            Return
        End If
        For Each n In nodes
            If n Is Nothing Then
                Continue For
            End If
            Dim hasChildren = n.SubTasks IsNot Nothing AndAlso n.SubTasks.Count > 0
            If Not hasChildren AndAlso n.DataContract Is Nothing Then
                Throw New InvalidOperationException("Missing data contract (leaf node).")
            End If
            If hasChildren Then
                ValidateStandaloneNodesHaveContracts(n.SubTasks)
            End If
        Next
    End Sub

    ''' <summary>
    ''' Deserializza un nodo TaskTree TS (subNodes o subTasks) in TaskNode IDE.
    ''' </summary>
    Private Shared Function TaskNodeFromJObject(jo As JObject) As TaskNode
        If jo Is Nothing Then
            Return Nothing
        End If
        Dim node As New TaskNode()
        If jo("id") IsNot Nothing AndAlso jo("id").Type <> JTokenType.Null Then
            node.Id = jo("id").ToString()
        End If
        If jo("label") IsNot Nothing AndAlso jo("label").Type <> JTokenType.Null Then
            node.Label = jo("label").ToString()
        End If
        If jo("name") IsNot Nothing AndAlso jo("name").Type <> JTokenType.Null Then
            node.Name = jo("name").ToString()
        End If
        If jo("type") IsNot Nothing AndAlso jo("type").Type <> JTokenType.Null Then
            node.Type = jo("type").ToString()
        End If
        If jo("templateId") IsNot Nothing AndAlso jo("templateId").Type <> JTokenType.Null Then
            node.TemplateId = jo("templateId").ToString()
        End If
        If jo("condition") IsNot Nothing AndAlso jo("condition").Type <> JTokenType.Null Then
            node.Condition = jo("condition").ToString()
        End If
        If jo("required") IsNot Nothing AndAlso jo("required").Type = JTokenType.Boolean Then
            node.Required = CBool(jo("required"))
        End If
        If jo("dataContract") IsNot Nothing AndAlso jo("dataContract").Type <> JTokenType.Null Then
            node.DataContract = jo("dataContract").ToObject(Of NLPContract)()
        End If
        If jo("constraints") IsNot Nothing AndAlso jo("constraints").Type = JTokenType.Array Then
            node.Constraints = jo("constraints").ToObject(Of List(Of Object))()
        Else
            node.Constraints = New List(Of Object)()
        End If
        If jo("steps") IsNot Nothing AndAlso jo("steps").Type <> JTokenType.Null Then
            Dim settings As New JsonSerializerSettings()
            settings.Converters.Add(New DialogueStepListConverter())
            Dim stepsJson = jo("steps").ToString()
            node.Steps = JsonConvert.DeserializeObject(Of List(Of DialogueStep))(stepsJson, settings)
        End If
        If node.Steps Is Nothing Then
            node.Steps = New List(Of DialogueStep)()
        End If

        Dim children As JToken = jo("subNodes")
        If children Is Nothing OrElse children.Type = JTokenType.Null Then
            children = jo("subTasks")
        End If
        If children IsNot Nothing AndAlso children.Type = JTokenType.Array Then
            For Each ch In CType(children, JArray)
                If ch.Type = JTokenType.Object Then
                    node.SubTasks.Add(TaskNodeFromJObject(CType(ch, JObject)))
                End If
            Next
        End If

        Return node
    End Function

    ''' <summary>
    ''' Espande ricorsivamente l'albero dei dati dereferenziando tutti i templateId
    ''' Il compilatore deve produrre un albero completamente espanso per il runtime
    ''' Supporta profondità arbitraria (ricorsione completa)
    ''' </summary>
    Private Function ExpandDataTreeRecursively(
        nodes As List(Of TaskNode),
        allTemplates As List(Of TaskDefinition),
        visitedTemplates As HashSet(Of String)
    ) As List(Of TaskNode)
        If nodes Is Nothing OrElse nodes.Count = 0 Then
            Return nodes
        End If

        Dim expandedNodes As New List(Of TaskNode)()

        For Each node As TaskNode In nodes
            ' ✅ Se il nodo ha templateId, dereferenzia il template
            If Not String.IsNullOrEmpty(node.TemplateId) Then
                If visitedTemplates.Contains(node.TemplateId) Then
                    expandedNodes.Add(node)
                    Continue For
                End If

                visitedTemplates.Add(node.TemplateId)

                ' ✅ NUOVO MODELLO: Cerca il template referenziato e usa subTasksIds
                Dim matchingTemplates = allTemplates.Where(Function(t As TaskDefinition) t.Id = node.TemplateId).ToList()
                If matchingTemplates.Count = 0 Then
                    Throw New InvalidOperationException($"Template with ID '{node.TemplateId}' not found in allTemplates for node '{node.Id}'. Every node must reference a valid template.")
                ElseIf matchingTemplates.Count > 1 Then
                    Throw New InvalidOperationException($"Template with ID '{node.TemplateId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
                End If
                Dim referencedTemplateBase = matchingTemplates.Single()
                Dim referencedTemplate = TryCast(referencedTemplateBase, UtteranceTaskDefinition)
                If referencedTemplate Is Nothing Then
                    Throw New InvalidOperationException($"Template '{referencedTemplateBase.Id}' must be of type UtteranceTaskDefinition. Found type: {referencedTemplateBase.GetType().Name}")
                End If

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
    Private Function CloneTaskNode(source As TaskNode) As TaskNode
        Dim cloned As New TaskNode() With {
            .Id = source.Id,
            .Label = source.Label,
            .Type = source.Type,
            .Required = source.Required,
            .Condition = source.Condition,
            .TemplateId = source.TemplateId,
            .Steps = If(source.Steps IsNot Nothing, New List(Of DialogueStep)(source.Steps), New List(Of DialogueStep)()),
            .SubTasks = If(source.SubTasks IsNot Nothing, New List(Of TaskNode)(source.SubTasks), New List(Of TaskNode)()),
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
        template As UtteranceTaskDefinition,
        instance As UtteranceTaskDefinition,
        allTemplates As List(Of TaskDefinition)
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
            Dim rootNode As New TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Steps = New List(Of DialogueStep)(),
                .SubTasks = subNodes,  ' ✅ Sub-nodi dentro SubTasks
                .Constraints = If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                 template.Constraints,
                                 New List(Of Object)()), ' ✅ Solo Constraints, non DataContracts
                .DataContract = template.DataContract, ' ✅ Usa DataContract (singolare) direttamente
                .Condition = template.Condition
            }

            ' ✅ Applica steps override al nodo radice se presente
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                Console.WriteLine($"[BuildTaskTreeExpanded] 🔍 Looking for steps in instance.Steps...")
                Console.WriteLine($"   Template.Id: {template.Id}")
                Console.WriteLine($"   Instance.Steps.Keys: {String.Join(", ", instance.Steps.Keys)}")
                Console.WriteLine($"   ContainsKey(template.Id): {instance.Steps.ContainsKey(template.Id)}")

                If instance.Steps.ContainsKey(template.Id) Then
                    Console.WriteLine($"   ✅ FOUND: Applying steps to root node from instance.Steps[{template.Id}]")
                    ' Applica steps al nodo radice
                    ApplyStepsToNode(rootNode, instance.Steps(template.Id))
                    Console.WriteLine($"   ✅ Applied: RootNode.Steps.Count = {If(rootNode.Steps IsNot Nothing, rootNode.Steps.Count, 0)}")
                Else
                    Console.WriteLine($"   ⚠️ NOT FOUND: Template.Id '{template.Id}' not in instance.Steps.Keys")
                    Console.WriteLine($"   Available keys: {String.Join(", ", instance.Steps.Keys)}")
                End If

                ' Applica steps ai sub-nodi
                Console.WriteLine($"[BuildTaskTreeExpanded] 🔍 Applying steps to sub-nodes...")
                Console.WriteLine($"   RootNode.SubTasks.Count: {If(rootNode.SubTasks IsNot Nothing, rootNode.SubTasks.Count, 0)}")
                ApplyStepsOverrides(rootNode.SubTasks, instance.Steps)
            Else
                Console.WriteLine($"[BuildTaskTreeExpanded] ⚠️ WARNING: instance.Steps is Nothing or empty!")
            End If

            ' ✅ TaskTreeExpanded.Nodes contiene il nodo radice
            taskTreeExpanded.Nodes = New List(Of TaskNode) From {rootNode}
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

            Dim rootNode As New TaskNode() With {
                .Id = template.Id,
                .TemplateId = template.Id,
                .Steps = New List(Of DialogueStep)(),
                .SubTasks = New List(Of TaskNode)(), ' ✅ Vuoto per template atomico
                .Constraints = If(template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0,
                                 template.Constraints,
                                 New List(Of Object)()), ' ✅ Solo Constraints, non DataContracts
                .DataContract = template.DataContract, ' ✅ Usa DataContract (singolare) direttamente
                .Condition = template.Condition
            }

            ' ✅ Applica steps dall'istanza al nodo root (OBBLIGATORIO per task atomico)
            If instance.Steps IsNot Nothing AndAlso instance.Steps.Count > 0 Then
                Console.WriteLine($"[BuildTaskTreeExpanded] 🔍 Looking for steps in instance.Steps (atomic template)...")
                Console.WriteLine($"   Template.Id: {template.Id}")
                Console.WriteLine($"   Instance.Steps.Keys: {String.Join(", ", instance.Steps.Keys)}")
                Console.WriteLine($"   ContainsKey(template.Id): {instance.Steps.ContainsKey(template.Id)}")

                If instance.Steps.ContainsKey(template.Id) Then
                    Console.WriteLine($"   ✅ FOUND: Applying steps to root node from instance.Steps[{template.Id}]")
                    ApplyStepsToNode(rootNode, instance.Steps(template.Id))
                    Console.WriteLine($"   ✅ Applied: RootNode.Steps.Count = {If(rootNode.Steps IsNot Nothing, rootNode.Steps.Count, 0)}")
                Else
                    Console.WriteLine($"   ⚠️ NOT FOUND: Template.Id '{template.Id}' not in instance.Steps.Keys")
                    Console.WriteLine($"   Available keys: {String.Join(", ", instance.Steps.Keys)}")
                End If
            Else
                Console.WriteLine($"[BuildTaskTreeExpanded] ⚠️ WARNING: instance.Steps is Nothing or empty (atomic template)!")
            End If

            taskTreeExpanded.Nodes = New List(Of TaskNode) From {rootNode}
        End If

        Return taskTreeExpanded
    End Function

    ''' <summary>
    ''' ✅ NUOVO MODELLO: Costruisce TaskNode[] da subTasksIds (grafo di template)
    ''' Dereferenzia ricorsivamente ogni templateId in subTasksIds
    ''' </summary>
    Private Function BuildTaskTreeFromSubTasksIds(
        subTasksIds As List(Of String),
        allTemplates As List(Of TaskDefinition),
        visitedTemplates As HashSet(Of String)
    ) As List(Of TaskNode)
        Dim nodes As New List(Of TaskNode)()

        For Each subTaskId In subTasksIds
            If visitedTemplates.Contains(subTaskId) Then
                Continue For
            End If

            visitedTemplates.Add(subTaskId)

            ' Cerca il template referenziato
            Dim matchingTemplates = allTemplates.Where(Function(t As TaskDefinition) t.Id = subTaskId).ToList()
            If matchingTemplates.Count = 0 Then
                Throw New InvalidOperationException($"SubTemplate with ID '{subTaskId}' not found in allTemplates. Every subtask must reference a valid template.")
            ElseIf matchingTemplates.Count > 1 Then
                Throw New InvalidOperationException($"SubTemplate with ID '{subTaskId}' appears {matchingTemplates.Count} times in allTemplates. Each template ID must be unique.")
            End If
            Dim subTemplateBase = matchingTemplates.Single()
            Dim subTemplate = TryCast(subTemplateBase, UtteranceTaskDefinition)
            If subTemplate Is Nothing Then
                Throw New InvalidOperationException($"Template '{subTemplateBase.Id}' must be of type UtteranceTaskDefinition. Found type: {subTemplateBase.GetType().Name}")
            End If

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

            ' ✅ TEMPORARY DEBUG: Log DataContract content per diagnosticare contracts mancanti
            Console.WriteLine($"[BuildTaskTreeFromSubTasksIds] 🔍 subTemplate {subTemplate.Id} DataContract:")
            If subTemplate.DataContract IsNot Nothing Then
                Try
                    Dim dcJson = JsonConvert.SerializeObject(subTemplate.DataContract)
                    Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   DataContract JSON length: {dcJson.Length}")
                    Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   DataContract JSON (first 800 chars): {If(dcJson.Length > 800, dcJson.Substring(0, 800) & "...", dcJson)}")

                    ' Verifica se parsers è presente
                    ' DataContract è NLPContract (tipizzato), non JObject
                    If subTemplate.DataContract IsNot Nothing Then
                        If subTemplate.DataContract.Engines IsNot Nothing Then
                            Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   ✅ engines found: count={subTemplate.DataContract.Engines.Count}")
                        Else
                            Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   ⚠️ parsers NOT found in DataContract")
                        End If
                    End If
                Catch ex As Exception
                    Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   ❌ Error serializing DataContract: {ex.Message}")
                End Try
            Else
                Console.WriteLine($"[BuildTaskTreeFromSubTasksIds]   DataContract is Nothing")
            End If

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
            Dim node As New TaskNode() With {
                .Id = subTemplate.Id,
                .TemplateId = subTemplate.Id,
                .Steps = New List(Of DialogueStep)(),
                .SubTasks = New List(Of TaskNode)(),
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
        nodes As List(Of TaskNode),
        stepsOverrides As Dictionary(Of String, Object)
    )
        Console.WriteLine($"[ApplyStepsOverrides] 🔍 Processing {nodes.Count} nodes...")
        Console.WriteLine($"   StepsOverrides.Keys: {String.Join(", ", stepsOverrides.Keys)}")

        For Each node In nodes
            Console.WriteLine($"[ApplyStepsOverrides] 🔍 Processing node: Id={node.Id}, TemplateId={node.TemplateId}")

            ' ✅ Applica steps se presente override per questo templateId
            If Not String.IsNullOrEmpty(node.TemplateId) Then
                Dim hasKey = stepsOverrides.ContainsKey(node.TemplateId)
                Console.WriteLine($"   ContainsKey(node.TemplateId): {hasKey}")

                If hasKey Then
                    Console.WriteLine($"   ✅ FOUND: Applying steps from instance.Steps[{node.TemplateId}]")
                    Try
                        ' ✅ Option Strict On: cast esplicito da Object
                        Dim overrideValue As Object = stepsOverrides(node.TemplateId)
                        Console.WriteLine($"   OverrideValue Type: {If(overrideValue IsNot Nothing, overrideValue.GetType().Name, "NULL")}")

                        If overrideValue IsNot Nothing Then
                            ' ✅ Usa DialogueStepListConverter per convertire oggetto → List(Of DialogueStep)
                            ' overrideValue è un oggetto: { "start": { escalations: [...] }, "noMatch": {...} }
                            Dim overrideJson = JsonConvert.SerializeObject(overrideValue)
                            Console.WriteLine($"   OverrideValue JSON length: {overrideJson.Length}")

                            Dim settings As New JsonSerializerSettings()
                            settings.Converters.Add(New DialogueStepListConverter())
                            Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of DialogueStep))(overrideJson, settings)

                            If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                                Console.WriteLine($"   ✅ Deserialized {overrideSteps.Count} steps")

                                ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
                                Dim seenTypes As New HashSet(Of String)()
                                For Each stepItem As DialogueStep In overrideSteps
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
                                Console.WriteLine($"   ✅ Applied: Node.Steps.Count = {node.Steps.Count}")
                            Else
                                Console.WriteLine($"   ⚠️ WARNING: Deserialized steps is Nothing or empty")
                            End If
                        Else
                            Console.WriteLine($"   ⚠️ WARNING: OverrideValue is Nothing")
                        End If
                    Catch ex As Exception
                        Console.WriteLine($"[COMPILER] ❌ ERROR: Failed to apply steps override for templateId={node.TemplateId}: {ex.Message}")
                        Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    End Try
                Else
                    Console.WriteLine($"   ⚠️ NOT FOUND: node.TemplateId '{node.TemplateId}' not in stepsOverrides.Keys")
                    Console.WriteLine($"   Available keys: {String.Join(", ", stepsOverrides.Keys)}")
                End If
            Else
                Console.WriteLine($"   ⚠️ SKIPPED: node.TemplateId is null or empty")
            End If

            ' ✅ Ricorsione per subTasks
            If node.SubTasks IsNot Nothing AndAlso node.SubTasks.Count > 0 Then
                Console.WriteLine($"   Recursing into {node.SubTasks.Count} subTasks...")
                ApplyStepsOverrides(node.SubTasks, stepsOverrides)
            End If
        Next

        Console.WriteLine($"[ApplyStepsOverrides] ✅ Completed processing all nodes")
    End Sub

    ' ✅ REMOVED: ConvertRuntimeTaskToCompiled - non più necessario
    ' TaskAssembler ora produce direttamente CompiledUtteranceTask

    ''' <summary>
    ''' Applica steps override a un singolo nodo
    ''' </summary>
    Private Sub ApplyStepsToNode(
        node As TaskNode,
        stepsOverride As Object
    )
        If node Is Nothing OrElse stepsOverride Is Nothing Then
            Return
        End If

        Try
            Dim overrideJson = JsonConvert.SerializeObject(stepsOverride)
            Dim settings As New JsonSerializerSettings()
            settings.Converters.Add(New DialogueStepListConverter())
            Dim overrideSteps = JsonConvert.DeserializeObject(Of List(Of DialogueStep))(overrideJson, settings)

            If overrideSteps IsNot Nothing AndAlso overrideSteps.Count > 0 Then
                ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
                Dim seenTypes As New HashSet(Of String)()
                For Each stepItem As DialogueStep In overrideSteps
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

