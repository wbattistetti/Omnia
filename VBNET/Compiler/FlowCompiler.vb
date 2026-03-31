Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports TaskEngine
Imports Compiler.DTO.IDE
Imports DTO.Runtime

''' <summary>
''' Flow Compiler: Trasforma struttura IDE (FlowNode, FlowEdge)
''' in struttura Runtime (TaskGroup, CompiledTask)
''' </summary>
Public Class FlowCompiler
    ''' <summary>
    ''' Crea un CompiledTask type-safe in base al TaskType usando il factory pattern
    ''' </summary>
    Private Function CreateTypedCompiledTask(taskType As TaskTypes, task As TaskDefinition, row As TaskRow, node As FlowNode, taskId As String, flow As Flow, errors As List(Of CompilationError)) As CompiledTask
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        ' Usa il factory per ottenere il compiler appropriato
        Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Calling compiler.Compile for task {taskId}...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] Calling compiler.Compile for task {taskId}...")

        ' Compila il task (senza metadata flowchart)
        ' ✅ Passa flow.Tasks come allTemplates (il compiler non ha bisogno di Nodes/Edges)
        ' ✅ Null-safe: flow.Tasks è sempre inizializzato nel costruttore, ma per sicurezza
        Dim allTemplates = If(flow.Tasks IsNot Nothing, flow.Tasks, New List(Of TaskDefinition)())

        Try
            Dim result = compiler.Compile(task, taskId, allTemplates)

            ' ✅ Aggiungi metadata del flowchart dopo la compilazione
            result.Id = row.Id
            result.Debug = New TaskDebugInfo() With {
                .SourceType = TaskSourceType.Flowchart,
                .NodeId = node.Id,
                .RowId = row.Id,
                .OriginalTaskId = taskId
            }

            Console.WriteLine($"✅ [COMPILER][FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")
            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")

            Dim utteranceResult = TryCast(result, CompiledUtteranceTask)
            If utteranceResult IsNot Nothing Then
                Dim escalationErrors = UtteranceEscalationValidation.AppendEmptyEscalationErrors(utteranceResult, taskId, node, row, errors)
                If escalationErrors > 0 Then
                    Return Nothing
                End If
            End If

            Return result

        Catch ex As Exception
            Dim detail = InferTaskCompilationDetailCode(ex)
            errors.Add(New CompilationError() With {
                .TaskId = taskId,
                .NodeId = node.Id,
                .RowId = row.Id,
                .RowLabel = FormatRowUserLabel(row),
                .Message = "Task compilation failed.",
                .Severity = ErrorSeverity.Error,
                .Category = "TaskCompilationFailed",
                .DetailCode = detail,
                .TechnicalDetail = ex.Message
            })
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' Maps common compiler exceptions to a stable detailCode for tooling (not shown as primary user copy).
    ''' </summary>
    Private Shared Function InferTaskCompilationDetailCode(ex As Exception) As String
        If ex Is Nothing Then
            Return "Unknown"
        End If
        Dim msg = If(ex.Message, "")
        If msg.IndexOf("not found in allTemplates", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            (msg.IndexOf("Template", StringComparison.OrdinalIgnoreCase) >= 0 AndAlso msg.IndexOf("not found", StringComparison.OrdinalIgnoreCase) >= 0) Then
            Return "TemplateNotFound"
        End If
        If msg.IndexOf("dataContract", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            msg.IndexOf("missing dataContract", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
            msg.IndexOf("InvalidContract", StringComparison.OrdinalIgnoreCase) >= 0 Then
            Return "InvalidContract"
        End If
        If TypeOf ex Is Newtonsoft.Json.JsonException Then
            Return "JsonError"
        End If
        Return "Unknown"
    End Function

    Private ReadOnly _conditionBuilder As ConditionBuilder

    Public Sub New()
        _conditionBuilder = New ConditionBuilder()
    End Sub

    ''' <summary>
    ''' User-visible row title for compiler errors (NodeRow.text); avoids exposing raw ids in messages.
    ''' </summary>
    Private Shared Function FormatRowUserLabel(row As TaskRow) As String
        If row Is Nothing Then Return "Unnamed row"
        If Not String.IsNullOrWhiteSpace(row.Text) Then Return row.Text.Trim()
        Return "Unnamed row"
    End Function

    ''' <summary>
    ''' Label for compiler messages: node title, else last non-empty row text, else generic.
    ''' </summary>
    Private Shared Function GetNodeUserDisplayLabel(node As FlowNode) As String
        If node Is Nothing Then Return "Nodo"
        If Not String.IsNullOrWhiteSpace(node.Label) Then Return node.Label.Trim()
        Dim rows = If(node.Rows, New List(Of TaskRow)())
        For i = rows.Count - 1 To 0 Step -1
            Dim r = rows(i)
            If r IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(r.Text) Then Return r.Text.Trim()
        Next
        Return "Nodo"
    End Function

    ''' <summary>
    ''' Validates one edge (condition / label rules) and returns True if the edge has a routing discriminator (Else or valid compiled condition).
    ''' LinkMissingCondition is emitted only when the source node has more than one outgoing edge (multi-exit).
    ''' </summary>
    Private Function ValidateSingleEdgeRouting(
        edge As FlowEdge,
        flow As Flow,
        errors As List(Of CompilationError),
        outgoingCountBySource As Dictionary(Of String, Integer),
        allEdges As List(Of FlowEdge)
    ) As Boolean
        Dim hasLabel As Boolean = Not String.IsNullOrWhiteSpace(edge.Label)
        Dim conditionId = If(edge.ConditionId, "").Trim()
        Dim isElseEdge = edge.IsElse.HasValue AndAlso edge.IsElse.Value
        Dim hasCondition As Boolean = Not String.IsNullOrWhiteSpace(conditionId) OrElse isElseEdge

        If Not String.IsNullOrWhiteSpace(conditionId) AndAlso Not isElseEdge Then
            Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Searching for condition '{conditionId}' in flow.Conditions")
            Dim condition = If(flow.Conditions IsNot Nothing, flow.Conditions.FirstOrDefault(Function(c) c.Id = conditionId), Nothing)

            If condition Is Nothing Then
                Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Edge {edge.Id} references condition '{conditionId}' but condition not found")
                errors.Add(New CompilationError() With {
                        .TaskId = "SYSTEM",
                        .NodeId = edge.Source,
                        .RowId = Nothing,
                        .EdgeId = edge.Id,
                        .ConditionId = conditionId,
                        .Message = "Edge references a condition that was not found.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "ConditionNotFound"
                    })
                hasCondition = False
            ElseIf condition.Expression IsNot Nothing Then
                Dim hasScript = Not String.IsNullOrWhiteSpace(condition.Expression.CompiledCode)
                If Not hasScript Then
                    Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Edge {edge.Id} references condition '{conditionId}' but condition has no script")
                    errors.Add(New CompilationError() With {
                            .TaskId = "SYSTEM",
                            .NodeId = edge.Source,
                            .RowId = Nothing,
                            .EdgeId = edge.Id,
                            .ConditionId = conditionId,
                            .Message = "Condition has no executable rule.",
                            .Severity = ErrorSeverity.Error,
                            .Category = "ConditionMissingScript"
                        })
                    hasCondition = False
                End If
            Else
                Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Edge {edge.Id} references condition '{conditionId}' but condition has no expression block")
                errors.Add(New CompilationError() With {
                        .TaskId = "SYSTEM",
                        .NodeId = edge.Source,
                        .RowId = Nothing,
                        .EdgeId = edge.Id,
                        .ConditionId = conditionId,
                        .Message = "Condition has no expression block.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "ConditionMissingScript"
                    })
                hasCondition = False
            End If
        End If

        If hasLabel AndAlso Not hasCondition Then
            Dim src = If(edge.Source, "")
            Dim multiExit = outgoingCountBySource IsNot Nothing AndAlso outgoingCountBySource.ContainsKey(src) AndAlso outgoingCountBySource(src) > 1
            If multiExit Then
                Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Edge {edge.Id} has label '{edge.Label}' but no routing discriminator (multi-exit)")
                Dim siblings = CollectSiblingEdgeIds(src, If(edge.Id, ""), allEdges)
                errors.Add(New CompilationError() With {
                    .TaskId = "SYSTEM",
                    .NodeId = edge.Source,
                    .RowId = Nothing,
                    .EdgeId = edge.Id,
                    .SiblingEdgeIds = siblings,
                    .Message = "Labeled edge without routing rule on multi-exit node.",
                    .Severity = ErrorSeverity.Error,
                    .Category = "LinkMissingCondition"
                })
            End If
        End If

        Return hasCondition
    End Function

    Private Shared Function CollectSiblingEdgeIds(sourceNodeId As String, excludeEdgeId As String, allEdges As List(Of FlowEdge)) As List(Of String)
        Dim list As New List(Of String)()
        If allEdges Is Nothing OrElse String.IsNullOrEmpty(sourceNodeId) Then
            Return list
        End If
        For Each e In allEdges
            If e Is Nothing Then Continue For
            If e.Source <> sourceNodeId Then Continue For
            Dim eid = If(e.Id, "")
            If eid = excludeEdgeId Then Continue For
            If Not String.IsNullOrEmpty(eid) Then
                list.Add(eid)
            End If
        Next
        Return list
    End Function

    ''' <summary>
    ''' Compiles flowchart into TaskGroups (uno per nodo)
    ''' Trasforma IDE.* → Runtime.*
    ''' </summary>
    Public Function CompileFlow(flow As Flow, Optional variables As List(Of VariableInstance) = Nothing, Optional projectId As String = Nothing) As FlowCompilationResult
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine($"🔧 [COMPILER][FlowCompiler] Starting compilation...")
        System.Diagnostics.Debug.WriteLine($"🔧 [COMPILER][FlowCompiler] Starting compilation...")
        Console.WriteLine($"   Flow.Nodes count: {If(flow.Nodes IsNot Nothing, flow.Nodes.Count, 0)}")
        Console.WriteLine($"   Flow.Tasks count: {If(flow.Tasks IsNot Nothing, flow.Tasks.Count, 0)}")
        Console.WriteLine($"   Flow.Edges count: {If(flow.Edges IsNot Nothing, flow.Edges.Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"   Flow.Nodes count: {If(flow.Nodes IsNot Nothing, flow.Nodes.Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"   Flow.Tasks count: {If(flow.Tasks IsNot Nothing, flow.Tasks.Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"   Flow.Edges count: {If(flow.Edges IsNot Nothing, flow.Edges.Count, 0)}")

        Dim taskGroups As New List(Of TaskGroup)()
        Dim allTasks As New List(Of CompiledTask)()
        Dim errors As New List(Of CompilationError)()

        ' ✅ NOTE: Variables will be built automatically from compiled tasks after compilation
        ' Manual variables (with empty taskInstanceId/nodeId) will be merged later

        ' NOTE: flow.Tasks should contain ONLY tasks referenced in node rows
        ' (not all tasks from repository). Frontend filters before sending.

        ' Find entry nodes (nodes without external incoming edges, only back edges from descendants)
        ' Un nodo è entry se:
        ' - Non ha link in entrata, OPPURE
        ' - Tutti i link in entrata arrivano solo da discendenti (cicli/back edges)
        Dim entryNodes = flow.Nodes.Where(Function(n) flow.IsEntryNode(n.Id)).ToList()
        Console.WriteLine($"   Entry nodes found: {entryNodes.Count}")
        System.Diagnostics.Debug.WriteLine($"   Entry nodes found: {entryNodes.Count}")

        ' ✅ ERROR: No entry nodes - add as Error, don't throw
        If entryNodes.Count = 0 Then
            Console.WriteLine($"❌ [COMPILER][FlowCompiler] No entry nodes found!")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] No entry nodes found!")
            errors.Add(New CompilationError() With {
                .TaskId = "SYSTEM",
                .NodeId = Nothing,
                .RowId = Nothing,
                .Message = "No entry node defined for this flow.",
                .Severity = ErrorSeverity.Error,
                .Category = "NoEntryNodes"
            })
            ' ✅ Return empty but valid result
            Return New FlowCompilationResult() With {
                .TaskGroups = New List(Of TaskGroup)(),
                .Tasks = New List(Of CompiledTask)(),
                .EntryTaskGroupId = Nothing,
                .Edges = If(flow.Edges, New List(Of FlowEdge)()),
                .Variables = New List(Of CompiledVariable)(), ' ✅ Empty variables list for error case
                .Errors = errors
            }
        End If

        ' ✅ WARNING: Multiple entry nodes - add as Warning, continue with first
        If entryNodes.Count > 1 Then
            Dim entryNodeIds = String.Join(", ", entryNodes.Select(Function(n) $"'{n.Id}'"))
            Console.WriteLine($"⚠️ [COMPILER][FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
            errors.Add(New CompilationError() With {
                .TaskId = "SYSTEM",
                .NodeId = Nothing,
                .RowId = Nothing,
                .Message = "Multiple entry nodes found.",
                .Severity = ErrorSeverity.Warning,
                .Category = "MultipleEntryNodes",
                .EntryNodeIds = entryNodes.Select(Function(n) n.Id).Where(Function(id) Not String.IsNullOrEmpty(id)).ToList()
            })
            ' Continue with first entry node
        End If

        ' Process all nodes - crea un TaskGroup per nodo
        Console.WriteLine($"   Processing {flow.Nodes.Count} nodes...")
        System.Diagnostics.Debug.WriteLine($"   Processing {flow.Nodes.Count} nodes...")
        Dim nodesProcessed = 0
        Dim nodesSkipped = 0
        For Each node In flow.Nodes
            Console.WriteLine($"   Processing node: {node.Id}")
            System.Diagnostics.Debug.WriteLine($"   Processing node: {node.Id}")

            ' Get rows directly (no wrapper)
            Dim rows = If(node.Rows, New List(Of TaskRow)())
            Console.WriteLine($"     Node {node.Id} has {rows.Count} rows")
            System.Diagnostics.Debug.WriteLine($"     Node {node.Id} has {rows.Count} rows")
            If rows.Count = 0 Then
                Console.WriteLine($"     ⚠️ Skipping node {node.Id} - no rows")
                System.Diagnostics.Debug.WriteLine($"     ⚠️ Skipping node {node.Id} - no rows")
                nodesSkipped += 1
                Continue For
            End If

            ' Crea TaskGroup per questo nodo
            Dim taskGroup As New TaskGroup() With {
                .NodeId = node.Id,
                .Tasks = New List(Of CompiledTask)(),
                .Executed = False
            }

            ' Costruisci condizione di esecuzione del nodo (UNA volta)
            taskGroup.ExecCondition = _conditionBuilder.BuildTaskGroupCondition(node.Id, flow)

            ' Processa tutte le righe del nodo (task in sequenza)
            For Each row In rows
                ' ✅ ERROR: Missing TaskId - use row.Id as fallback for taskId
                Dim taskId As String
                If String.IsNullOrEmpty(row.TaskId) Then
                    taskId = row.Id ' ✅ Fallback to row.Id
                    errors.Add(New CompilationError() With {
                        .TaskId = taskId,
                        .NodeId = node.Id,
                        .RowId = row.Id,
                        .RowLabel = FormatRowUserLabel(row),
                        .RowTaskRef = "",
                        .MissingTaskRef = True,
                        .ResolvedTaskId = "",
                        .Message = "Row has no task reference.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "MissingOrInvalidTask"
                    })
                Else
                    taskId = row.TaskId
                End If

                ' ✅ DEBUG: Log available task IDs before lookup
                Console.WriteLine($"     🔍 [COMPILER][FlowCompiler] Looking for task: taskId={taskId}, row.Id={row.Id}")
                System.Diagnostics.Debug.WriteLine($"     🔍 [COMPILER][FlowCompiler] Looking for task: taskId={taskId}, row.Id={row.Id}")
                If flow.Tasks IsNot Nothing Then
                    Console.WriteLine($"     🔍 [COMPILER][FlowCompiler] Available tasks in flow.Tasks ({flow.Tasks.Count}): {String.Join(", ", flow.Tasks.Select(Function(t) $"{t.Id}(templateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL", t.TemplateId)})"))}")
                    System.Diagnostics.Debug.WriteLine($"     🔍 [COMPILER][FlowCompiler] Available tasks in flow.Tasks ({flow.Tasks.Count}): {String.Join(", ", flow.Tasks.Select(Function(t) $"{t.Id}(templateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL", t.TemplateId)})"))}")
                Else
                    Console.WriteLine($"     ⚠️ [COMPILER][FlowCompiler] flow.Tasks is Nothing!")
                    System.Diagnostics.Debug.WriteLine($"     ⚠️ [COMPILER][FlowCompiler] flow.Tasks is Nothing!")
                End If

                ' ✅ Risolvi task direttamente da flow.Tasks (NON usare GetTaskById che lancia eccezioni)
                ' Cerca manualmente per poter raccogliere errori invece di lanciare eccezioni
                Dim task As TaskDefinition = Nothing
                If flow.Tasks IsNot Nothing Then
                    task = flow.Tasks.FirstOrDefault(Function(t) t.Id = taskId)
                End If

                If task Is Nothing Then
                    Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    System.Diagnostics.Debug.WriteLine($"     ❌ [COMPILER][FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    errors.Add(New CompilationError() With {
                        .TaskId = taskId,
                        .NodeId = node.Id,
                        .RowId = row.Id,
                        .RowLabel = FormatRowUserLabel(row),
                        .RowTaskRef = taskId,
                        .MissingTaskRef = False,
                        .ResolvedTaskId = "",
                        .Message = "Referenced task does not exist in this flow.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "MissingOrInvalidTask"
                    })
                    Continue For ' Skip this row
                End If

                ' ✅ USA SOLO task.Type (enum numerico) - templateId è SOLO un GUID per riferimenti
                Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Processing task: Id={task.Id}, Type={If(task.Type.HasValue, task.Type.Value.ToString(), "NULL")}, TemplateId={If(String.IsNullOrEmpty(task.TemplateId), "NULL/EMPTY", task.TemplateId)}, Node={node.Id}, Row={row.Id}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] Processing task: Id={task.Id}, Type={If(task.Type.HasValue, task.Type.Value.ToString(), "NULL")}, TemplateId={If(String.IsNullOrEmpty(task.TemplateId), "NULL/EMPTY", task.TemplateId)}, Node={node.Id}, Row={row.Id}")

                If Not task.Type.HasValue Then
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has no Type!")
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task structure:")
                    Console.WriteLine($"   - Id: {task.Id}")
                    Console.WriteLine($"   - Type: NULL (REQUIRED)")
                    Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(task.TemplateId), "EMPTY", task.TemplateId)} (GUID reference, not used for type)")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has no Type!")
                    errors.Add(New CompilationError() With {
                        .TaskId = taskId,
                        .NodeId = node.Id,
                        .RowId = row.Id,
                        .RowLabel = FormatRowUserLabel(row),
                        .RowTaskRef = taskId,
                        .ResolvedTaskId = If(task.Id, ""),
                        .Message = "Task type is not set.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "TaskTypeInvalidOrMissing"
                    })
                    Continue For ' Skip this row
                End If

                Dim typeValue = task.Type.Value
                If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has invalid Type: {typeValue}")
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task structure:")
                    Console.WriteLine($"   - Id: {task.Id}")
                    Console.WriteLine($"   - Type: {typeValue} (INVALID)")
                    Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(task.TemplateId), "EMPTY", task.TemplateId)}")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has invalid Type: {typeValue}")
                    errors.Add(New CompilationError() With {
                        .TaskId = taskId,
                        .NodeId = node.Id,
                        .RowId = row.Id,
                        .RowLabel = FormatRowUserLabel(row),
                        .RowTaskRef = taskId,
                        .ResolvedTaskId = If(task.Id, ""),
                        .InvalidType = typeValue,
                        .Message = "Task type value is invalid.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "TaskTypeInvalidOrMissing"
                    })
                    Continue For ' Skip this row
                End If

                Dim taskType = CType(typeValue, TaskTypes)
                Console.WriteLine($"✅ [COMPILER][FlowCompiler] Using task.Type: {taskType} (value={typeValue})")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] Using task.Type: {taskType} (value={typeValue})")

                Dim compiledTask As CompiledTask = CreateTypedCompiledTask(taskType, task, row, node, taskId, flow, errors)

                ' ✅ Skip if compilation failed (compiledTask is Nothing)
                If compiledTask Is Nothing Then
                    Continue For ' Error already added in CreateTypedCompiledTask
                End If

                Console.WriteLine($"✅ [COMPILER][FlowCompiler] Created CompiledTask: Id={compiledTask.Id}, TaskType={compiledTask.TaskType}")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] Created CompiledTask: Id={compiledTask.Id}, TaskType={compiledTask.TaskType}")

                ' Aggiungi task al TaskGroup
                taskGroup.Tasks.Add(compiledTask)

                ' Aggiungi anche alla lista piatta per compatibilità
                allTasks.Add(compiledTask)

                ' Se task è DataRequest, manteniamo il DDT nel value (struttura gerarchica)
                ' NON espandiamo il DDT - il DDT Engine gestirà tutto
            Next

            ' Aggiungi TaskGroup al risultato
            taskGroups.Add(taskGroup)
            nodesProcessed += 1
            Console.WriteLine($"     ✅ Node {node.Id} processed: {taskGroup.Tasks.Count} tasks added")
            System.Diagnostics.Debug.WriteLine($"     ✅ Node {node.Id} processed: {taskGroup.Tasks.Count} tasks added")
        Next

        Console.WriteLine($"   Nodes processed: {nodesProcessed}, skipped: {nodesSkipped}")
        Console.WriteLine($"   Total TaskGroups created: {taskGroups.Count}")
        Console.WriteLine($"   Total Tasks created: {allTasks.Count}")
        System.Diagnostics.Debug.WriteLine($"   Nodes processed: {nodesProcessed}, skipped: {nodesSkipped}")
        System.Diagnostics.Debug.WriteLine($"   Total TaskGroups created: {taskGroups.Count}")
        System.Diagnostics.Debug.WriteLine($"   Total Tasks created: {allTasks.Count}")

        ' ✅ VALIDATE EDGES: conditions, labels; track routing discriminators for ambiguity check
        Console.WriteLine($"   Validating {If(flow.Edges IsNot Nothing, flow.Edges.Count, 0)} edges...")
        System.Diagnostics.Debug.WriteLine($"   Validating {If(flow.Edges IsNot Nothing, flow.Edges.Count, 0)} edges...")
        Dim edgesList = If(flow.Edges IsNot Nothing, flow.Edges.ToList(), New List(Of FlowEdge)())
        Dim outgoingCountBySource As New Dictionary(Of String, Integer)(StringComparer.OrdinalIgnoreCase)
        For Each e In edgesList
            Dim src = If(e.Source, "")
            If String.IsNullOrEmpty(src) Then Continue For
            If outgoingCountBySource.ContainsKey(src) Then
                outgoingCountBySource(src) += 1
            Else
                outgoingCountBySource(src) = 1
            End If
        Next

        Dim edgeDiscriminators As New List(Of Boolean)()
        For Each edge In edgesList
            edgeDiscriminators.Add(ValidateSingleEdgeRouting(edge, flow, errors, outgoingCountBySource, edgesList))
        Next

        ' ✅ Outgoing ambiguity → unified AmbiguousLink with reason + conflictsWith
        If flow.Nodes IsNot Nothing AndAlso edgesList.Count > 0 Then
            For Each node In flow.Nodes
                Dim outgoingIdx As New List(Of Integer)()
                For ei = 0 To edgesList.Count - 1
                    If edgesList(ei).Source = node.Id Then outgoingIdx.Add(ei)
                Next
                If outgoingIdx.Count < 2 Then Continue For

                Dim unconditioned = outgoingIdx.Where(Function(ei) Not edgeDiscriminators(ei)).ToList()

                If unconditioned.Count >= 1 Then
                    Dim ei0 = unconditioned(0)
                    Dim firstEdge = edgesList(ei0)
                    Dim allIds = outgoingIdx.Select(Function(ei) If(edgesList(ei).Id, "")).Where(Function(s) s <> "").ToList()
                    Dim primaryId = If(firstEdge.Id, "")
                    Dim conflicts = allIds.Where(Function(id) id <> primaryId).ToList()
                    errors.Add(New CompilationError() With {
                        .TaskId = "SYSTEM",
                        .NodeId = node.Id,
                        .EdgeId = primaryId,
                        .Reason = "missingConditionInMultiExit",
                        .ConflictsWith = conflicts,
                        .Message = "Ambiguous outgoing links (missing routing rule on multi-exit).",
                        .Severity = ErrorSeverity.Error,
                        .Category = "AmbiguousLink"
                    })
                End If

                Dim labelGroups = outgoingIdx.
                    Select(Function(ei) edgesList(ei)).
                    Where(Function(e) Not String.IsNullOrWhiteSpace(If(e.Label, "").Trim())).
                    GroupBy(Function(e) If(e.Label, "").Trim().ToLowerInvariant()).
                    Where(Function(g) g.Count() >= 2)
                For Each lg In labelGroups
                    Dim edgesInGroup = lg.ToList()
                    Dim ids = edgesInGroup.Select(Function(ed) If(ed.Id, "")).Where(Function(s) s <> "").ToList()
                    If ids.Count < 2 Then Continue For
                    errors.Add(New CompilationError() With {
                        .TaskId = "SYSTEM",
                        .NodeId = node.Id,
                        .EdgeId = ids(0),
                        .Reason = "sameLabel",
                        .ConflictsWith = ids.Skip(1).ToList(),
                        .Message = "Duplicate outgoing edge labels.",
                        .Severity = ErrorSeverity.Error,
                        .Category = "AmbiguousLink"
                    })
                Next

                Dim outEdges = outgoingIdx.Select(Function(ei) edgesList(ei)).ToList()
                Dim cidGroups = outEdges.
                    Where(Function(e) Not String.IsNullOrWhiteSpace(If(e.ConditionId, "").Trim())).
                    GroupBy(Function(e) If(e.ConditionId, "").Trim()).
                    Where(Function(g) g.Count() >= 2).ToList()

                If cidGroups.Count > 0 Then
                    For Each cg In cidGroups
                        Dim edgesInGroup = cg.ToList()
                        Dim ids = edgesInGroup.Select(Function(ed) If(ed.Id, "")).Where(Function(s) s <> "").ToList()
                        If ids.Count < 2 Then Continue For
                        errors.Add(New CompilationError() With {
                            .TaskId = "SYSTEM",
                            .NodeId = node.Id,
                            .EdgeId = ids(0),
                            .Reason = "sameCondition",
                            .ConflictsWith = ids.Skip(1).ToList(),
                            .Message = "Duplicate condition on multiple outgoing links.",
                            .Severity = ErrorSeverity.Error,
                            .Category = "AmbiguousLink"
                        })
                    Next
                Else
                    Dim scriptToEdgeIds As New Dictionary(Of String, List(Of String))()
                    For Each e In outEdges
                        Dim cid = If(e.ConditionId, "").Trim()
                        If String.IsNullOrWhiteSpace(cid) Then Continue For
                        Dim cond = If(flow.Conditions IsNot Nothing, flow.Conditions.FirstOrDefault(Function(c) c.Id = cid), Nothing)
                        Dim code = If(cond IsNot Nothing AndAlso cond.Expression IsNot Nothing, If(cond.Expression.CompiledCode, "").Trim(), "")
                        If String.IsNullOrWhiteSpace(code) Then Continue For
                        If Not scriptToEdgeIds.ContainsKey(code) Then
                            scriptToEdgeIds(code) = New List(Of String)()
                        End If
                        scriptToEdgeIds(code).Add(If(e.Id, ""))
                    Next
                    For Each kvp In scriptToEdgeIds
                        Dim idList = kvp.Value.Where(Function(s) Not String.IsNullOrEmpty(s)).Distinct().ToList()
                        If idList.Count < 2 Then Continue For
                        errors.Add(New CompilationError() With {
                            .TaskId = "SYSTEM",
                            .NodeId = node.Id,
                            .EdgeId = idList(0),
                            .Reason = "overlappingConditions",
                            .ConflictsWith = idList.Skip(1).ToList(),
                            .Message = "Identical condition script on multiple outgoing links.",
                            .Severity = ErrorSeverity.Error,
                            .Category = "AmbiguousLink"
                        })
                    Next
                End If
            Next
        End If

        ' Trova entry TaskGroup (primo nodo entry)
        ' entryNodes.Count > 0 è garantito (altrimenti avremmo già restituito con Error)
        Dim entryTaskGroupId As String = If(entryNodes.Count > 0, entryNodes(0).Id, Nothing)
        Console.WriteLine($"   Entry TaskGroup ID: {entryTaskGroupId}")
        System.Diagnostics.Debug.WriteLine($"   Entry TaskGroup ID: {entryTaskGroupId}")

        ' ✅ NEW: Build conditions dictionary (keyed by conditionId) for runtime evaluation
        Dim conditionsDict As New Dictionary(Of String, ConditionDefinition)()
        If flow.Conditions IsNot Nothing Then
            For Each condition In flow.Conditions
                If Not String.IsNullOrEmpty(condition.Id) Then
                    conditionsDict(condition.Id) = condition
                End If
            Next
        End If
        Console.WriteLine($"   Conditions available at runtime: {conditionsDict.Count}")

        ' ✅ Variables are created by frontend when tasks are created
        ' Backend only uses variables passed as parameter (from database)
        ' Convert VariableInstance to CompiledVariable
        Dim compiledVariables = ConvertVariablesToCompiled(variables)

        Dim result = New FlowCompilationResult() With {
            .TaskGroups = taskGroups,
            .EntryTaskGroupId = entryTaskGroupId,
            .Tasks = allTasks,
            .Edges = If(flow.Edges, New List(Of FlowEdge)()), ' ✅ FASE 2.4: Topologia separata
            .Conditions = conditionsDict, ' ✅ NEW: Conditions for runtime evaluation
            .Variables = compiledVariables, ' ✅ Variables from frontend/DB (single source of truth)
            .Errors = errors ' ✅ Add errors to result
        }

        Console.WriteLine($"✅ [COMPILER][FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")

        Return result
    End Function

    ''' <summary>
    ''' ✅ Convert VariableInstance (from frontend/DB) to CompiledVariable (for runtime)
    ''' Frontend is the single source of truth for variable creation
    ''' Backend only uses variables passed as parameter
    ''' </summary>
    Private Function ConvertVariablesToCompiled(variables As List(Of VariableInstance)) As List(Of CompiledVariable)
        Dim compiledVariables As New List(Of CompiledVariable)()

        If variables IsNot Nothing Then
            Console.WriteLine($"[FlowCompiler][VARIABLES] 🔍 Converting {variables.Count} variables from frontend/DB...")
            For Each var In variables
                Dim compiledVar As New CompiledVariable() With {
                    .VarId = var.VarId,
                    .TaskInstanceId = If(String.IsNullOrEmpty(var.TaskInstanceId), "", var.TaskInstanceId),
                    .NodeId = If(String.IsNullOrEmpty(var.NodeId), "", var.NodeId),
                    .Values = New List(Of Object)()
                }
                compiledVariables.Add(compiledVar)
                Console.WriteLine($"[FlowCompiler][VARIABLES] ✅ Converted variable: varId={var.VarId}, varName={var.VarName}, taskInstanceId={compiledVar.TaskInstanceId}, nodeId={compiledVar.NodeId}")
            Next
        End If

        Console.WriteLine($"[FlowCompiler][VARIABLES] ✅ Converted {compiledVariables.Count} variables")
        Return compiledVariables
    End Function
End Class

