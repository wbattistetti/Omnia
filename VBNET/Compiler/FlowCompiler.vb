Option Strict On
Option Explicit On
Imports TaskEngine

''' <summary>
''' Flow Compiler: Trasforma struttura IDE (FlowNode, FlowEdge)
''' in struttura Runtime (TaskGroup, CompiledTask)
''' </summary>
Public Class FlowCompiler
    ''' <summary>
    ''' Crea un CompiledTask type-safe in base al TaskType usando il factory pattern
    ''' </summary>
    Private Function CreateTypedCompiledTask(taskType As TaskTypes, task As Task, row As TaskRow, node As FlowNode, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        ' Usa il factory per ottenere il compiler appropriato
        Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        Console.WriteLine($"🔍 [COMPILER][FlowCompiler] Calling compiler.Compile for task {taskId}...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][FlowCompiler] Calling compiler.Compile for task {taskId}...")

        ' Compila il task (senza metadata flowchart)
        Dim result = compiler.Compile(task, taskId, flow)

        ' Aggiungi metadata del flowchart dopo la compilazione
        result.Id = row.Id
        result.Debug = New TaskDebugInfo() With {
            .SourceType = TaskSourceType.Flowchart,
            .NodeId = node.Id,
            .RowId = row.Id,
            .OriginalTaskId = taskId
        }

        Console.WriteLine($"✅ [COMPILER][FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")
        Return result
    End Function

    Private ReadOnly _conditionBuilder As ConditionBuilder

    Public Sub New()
        _conditionBuilder = New ConditionBuilder()
    End Sub

    ''' <summary>
    ''' Compiles flowchart into TaskGroups (uno per nodo)
    ''' Trasforma IDE.* → Runtime.*
    ''' </summary>
    Public Function CompileFlow(flow As Flow) As FlowCompilationResult
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

        ' NOTE: flow.Tasks should contain ONLY tasks referenced in node rows
        ' (not all tasks from repository). Frontend filters before sending.

        ' Find entry nodes (nodes without external incoming edges, only back edges from descendants)
        ' Un nodo è entry se:
        ' - Non ha link in entrata, OPPURE
        ' - Tutti i link in entrata arrivano solo da discendenti (cicli/back edges)
        Dim entryNodes = flow.Nodes.Where(Function(n) flow.IsEntryNode(n.Id)).ToList()
        Console.WriteLine($"   Entry nodes found: {entryNodes.Count}")
        System.Diagnostics.Debug.WriteLine($"   Entry nodes found: {entryNodes.Count}")

        ' Topologicamente impossibile avere 0 entry nodes in un grafo connesso
        ' Se 0, significa grafo vuoto o non connesso
        If entryNodes.Count = 0 Then
            Console.WriteLine($"❌ [COMPILER][FlowCompiler] No entry nodes found!")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] No entry nodes found!")
            Throw New Exception("No entry nodes found. Graph may be empty or disconnected. At least one entry node is required.")
        End If

        ' Gestisci ambiguità: più entry nodes (es. ciclo A → B → A)
        ' In questo caso, tutti i nodi nel ciclo sono entry (tutti hanno solo back edges)
        ' La compilazione viene bloccata: bisogna definire/marcare quale nodo è di start
        If entryNodes.Count > 1 Then
            Dim entryNodeIds = String.Join(", ", entryNodes.Select(Function(n) $"'{n.Id}'"))
            Console.WriteLine($"❌ [COMPILER][FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
            Throw New Exception($"Multiple entry nodes found ({entryNodes.Count}): {entryNodeIds}. " &
                                "Please mark one node as the start/entry point. " &
                                "All nodes in a cycle cannot be entry points simultaneously.")
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
                ' ❌ ERRORE BLOCCANTE: row.TaskId OBBLIGATORIO, nessun fallback a row.Id
                If String.IsNullOrEmpty(row.TaskId) Then
                    Throw New InvalidOperationException($"Row '{row.Id}' has no TaskId. TaskId is mandatory and cannot be empty. The frontend must provide a valid TaskId for each row.")
                End If
                Dim taskId As String = row.TaskId

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

                ' Risolvi task direttamente da flow.Tasks
                Dim task = flow.GetTaskById(taskId)
                If task Is Nothing Then
                    Console.WriteLine($"     ❌ [COMPILER][FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    System.Diagnostics.Debug.WriteLine($"     ❌ [COMPILER][FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    Throw New Exception($"Task not found: {taskId} in node {node.Id}, row {row.Id}. Task must exist.")
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
                    Throw New Exception($"Task {taskId} (node {node.Id}, row {row.Id}) has no Type. Type is required.")
                End If

                Dim typeValue = task.Type.Value
                If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has invalid Type: {typeValue}")
                    Console.WriteLine($"❌ [COMPILER][FlowCompiler] Task structure:")
                    Console.WriteLine($"   - Id: {task.Id}")
                    Console.WriteLine($"   - Type: {typeValue} (INVALID)")
                    Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(task.TemplateId), "EMPTY", task.TemplateId)}")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][FlowCompiler] Task {taskId} has invalid Type: {typeValue}")
                    Throw New Exception($"Task {taskId} (node {node.Id}, row {row.Id}) has invalid Type: {typeValue}")
                End If

                Dim taskType = CType(typeValue, TaskTypes)
                Console.WriteLine($"✅ [COMPILER][FlowCompiler] Using task.Type: {taskType} (value={typeValue})")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] Using task.Type: {taskType} (value={typeValue})")

                Dim compiledTask As CompiledTask = CreateTypedCompiledTask(taskType, task, row, node, taskId, flow)

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

        ' Trova entry TaskGroup (primo nodo entry)
        ' entryNodes.Count > 0 è garantito dal check precedente (altrimenti avremmo lanciato un'eccezione)
        Dim entryTaskGroupId As String = entryNodes(0).Id
        Console.WriteLine($"   Entry TaskGroup ID: {entryTaskGroupId}")
        System.Diagnostics.Debug.WriteLine($"   Entry TaskGroup ID: {entryTaskGroupId}")

        Dim result = New FlowCompilationResult() With {
            .TaskGroups = taskGroups,
            .EntryTaskGroupId = entryTaskGroupId,
            .Tasks = allTasks,
            .Edges = If(flow.Edges, New List(Of FlowEdge)()) ' ✅ FASE 2.4: Topologia separata
        }

        Console.WriteLine($"✅ [COMPILER][FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")

        Return result
    End Function
End Class

