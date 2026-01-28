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

        ' ✅ PRIORITY 1: Campi diretti sul task (nuovo modello)
        ' L'istanza contiene solo override (modifiche rispetto al template)
        ' Se constraints/examples/nlpContract mancano → risoluzione lazy dal template
        Dim assembledDDT As Compiler.AssembledDDT = Nothing

        If task.Data IsNot Nothing AndAlso task.Data.Count > 0 Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Trying to load DDT from task.Data (PRIORITY 1)")
            Try
                ' Serializza task a JSON e deserializza come AssembledDDT
                ' Questo gestisce automaticamente la conversione di MainData usando i converter
                Dim taskJson = JsonConvert.SerializeObject(task)
                Dim settings As New JsonSerializerSettings()
                settings.Converters.Add(New MainDataNodeListConverter())
                assembledDDT = JsonConvert.DeserializeObject(Of Compiler.AssembledDDT)(taskJson, settings)

                ' Assicurati che Id e Label siano impostati
                If assembledDDT IsNot Nothing Then
                    assembledDDT.Id = task.Id
                    If String.IsNullOrEmpty(assembledDDT.Label) Then
                        assembledDDT.Label = task.Label
                    End If
                    If assembledDDT.Translations Is Nothing Then
                        assembledDDT.Translations = New Dictionary(Of String, String)()
                    End If

                    ' ✅ ESPANSIONE ALBERO: Dereferenzia ricorsivamente tutti i templateId
                    ' Il compilatore deve produrre un albero completamente espanso per il runtime
                    ' Il runtime naviga MainDataList → SubData senza dereferenziare template
                    If assembledDDT.Data IsNot Nothing AndAlso assembledDDT.Data.Count > 0 Then
                        Console.WriteLine($"🔄 [COMPILER][DataRequestTaskCompiler] Expanding data tree recursively...")
                        System.Diagnostics.Debug.WriteLine($"🔄 [COMPILER][DataRequestTaskCompiler] Expanding data tree recursively...")
                        assembledDDT.Data = ExpandDataTreeRecursively(assembledDDT.Data, flow.Tasks, New HashSet(Of String)())
                        Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Data tree expanded successfully")
                        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Data tree expanded successfully")
                    End If

                    ' ✅ RISOLUZIONE: Constraints/examples/nlpContract a livello root dal template principale
                    ' LOGICA: L'istanza contiene solo steps clonati, constraints/examples vengono sempre dal template
                    If Not String.IsNullOrEmpty(task.TemplateId) Then
                        Dim template = flow.Tasks.FirstOrDefault(Function(t) t.Id = task.TemplateId)
                        If template IsNot Nothing Then
                            ' ✅ Risolvi constraints/examples/nlpContract a livello root SEMPRE dal template
                            If template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0 Then
                                assembledDDT.Constraints = template.Constraints
                                Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved root constraints from template {task.TemplateId}")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved root constraints from template {task.TemplateId}")
                            End If

                            If template.Examples IsNot Nothing AndAlso template.Examples.Count > 0 Then
                                assembledDDT.Examples = template.Examples
                                Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved root examples from template {task.TemplateId}")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved root examples from template {task.TemplateId}")
                            End If
                        Else
                            ' ❌ NO FALLBACK: Se template non trovato → errore esplicito
                            Console.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found in flow.Tasks - cannot resolve missing constraints/examples")
                            Console.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] This indicates a data inconsistency: task references template that doesn't exist")
                            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found in flow.Tasks")
                        End If
                    End If

                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT loaded from task direct fields for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to build AssembledDDT from task fields: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        End If

        ' ❌ RIMOSSO: PRIORITY 2 (flow.DDTs) e PRIORITY 3 (task.Value("ddt"))
        ' LOGICA: Ogni task contiene già tutto quello che serve (con risoluzione lazy da template)
        ' flow.DDTs e task.Value("ddt") sono ridondanti/legacy e non servono più

        ' Compila DDT se trovato
        If assembledDDT IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, Data IsNot Nothing={assembledDDT.Data IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, Data IsNot Nothing={assembledDDT.Data IsNot Nothing}")
            If assembledDDT.Data IsNot Nothing Then
                Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Data.Count={assembledDDT.Data.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Data.Count={assembledDDT.Data.Count}")
            End If
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza AssembledDDT a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(assembledDDT)
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
            Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
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
End Class

