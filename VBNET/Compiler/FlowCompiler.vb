Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.IO
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports DDTEngine

''' <summary>
''' Flow Compiler: Trasforma struttura IDE (FlowNode, FlowEdge)
''' in struttura Runtime (TaskGroup, CompiledTask)
''' </summary>
Public Class FlowCompiler
    ''' <summary>
    ''' Crea un CompiledTask type-safe in base al TaskType usando il factory pattern
    ''' </summary>
    Private Function CreateTypedCompiledTask(taskType As TaskTypes, task As Task, row As RowData, node As FlowNode, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] CreateTypedCompiledTask called: taskType={taskType}, taskId={taskId}")
        ' Usa il factory per ottenere il compiler appropriato
        Dim compiler = TaskCompilerFactory.GetCompiler(taskType)
        Console.WriteLine($"🔍 [FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] Compiler obtained: type={compiler.GetType().Name}")
        Console.WriteLine($"🔍 [FlowCompiler] Calling compiler.Compile for task {taskId}...")
        System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] Calling compiler.Compile for task {taskId}...")
        Dim result = compiler.Compile(task, row, node, taskId, flow)
        Console.WriteLine($"✅ [FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")
        System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] compiler.Compile completed for task {taskId}, result type={result.GetType().Name}")
        Return result
    End Function

    ''' <summary>
    ''' Converte templateId string (es. "SayMessage", "DataRequest") in TaskTypes enum
    ''' </summary>
    Private Function ConvertTemplateIdToEnum(templateId As String) As TaskTypes
        Console.WriteLine($"🔍 [FlowCompiler] ConvertTemplateIdToEnum called: templateId='{templateId}'")
        System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] ConvertTemplateIdToEnum called: templateId='{templateId}'")
        If String.IsNullOrEmpty(templateId) Then
            Console.WriteLine($"⚠️ [FlowCompiler] templateId is empty, defaulting to SayMessage")
            System.Diagnostics.Debug.WriteLine($"⚠️ [FlowCompiler] templateId is empty, defaulting to SayMessage")
            Return TaskTypes.SayMessage ' Default
        End If

        Dim normalized = templateId.Trim().ToLower()
        Console.WriteLine($"🔍 [FlowCompiler] Normalized templateId: '{templateId}' → '{normalized}'")
        System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] Normalized templateId: '{templateId}' → '{normalized}'")

        Select Case normalized
            Case "saymessage", "message"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.SayMessage")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.SayMessage")
                Return TaskTypes.SayMessage
            Case "closesession", "closesessionaction"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.CloseSession")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.CloseSession")
                Return TaskTypes.CloseSession
            Case "transfer"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.Transfer")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.Transfer")
                Return TaskTypes.Transfer
            Case "getdata", "datarequest", "askquestion"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.DataRequest")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.DataRequest")
                Return TaskTypes.DataRequest  ' ✅ Rinominato da GetData (backward compatibility: 'getdata' → DataRequest)
            Case "backendcall", "callbackend", "readfrombackend", "writetobackend"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.BackendCall")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.BackendCall")
                Return TaskTypes.BackendCall
            Case "classifyproblem", "problemclassification"
                Console.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.ClassifyProblem")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Matched: '{normalized}' → TaskTypes.ClassifyProblem")
                Return TaskTypes.ClassifyProblem
            Case Else
                Console.WriteLine($"⚠️ [FlowCompiler] Unknown templateId: '{templateId}' (normalized: '{normalized}'), defaulting to SayMessage")
                System.Diagnostics.Debug.WriteLine($"⚠️ [FlowCompiler] Unknown templateId: '{templateId}' (normalized: '{normalized}'), defaulting to SayMessage")
                Return TaskTypes.SayMessage
        End Select
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
        Console.WriteLine($"🔧 [FlowCompiler] Starting compilation...")
        System.Diagnostics.Debug.WriteLine($"🔧 [FlowCompiler] Starting compilation...")
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
            Console.WriteLine($"❌ [FlowCompiler] No entry nodes found!")
            System.Diagnostics.Debug.WriteLine($"❌ [FlowCompiler] No entry nodes found!")
            Throw New Exception("No entry nodes found. Graph may be empty or disconnected. At least one entry node is required.")
        End If

        ' Gestisci ambiguità: più entry nodes (es. ciclo A → B → A)
        ' In questo caso, tutti i nodi nel ciclo sono entry (tutti hanno solo back edges)
        ' La compilazione viene bloccata: bisogna definire/marcare quale nodo è di start
        If entryNodes.Count > 1 Then
            Dim entryNodeIds = String.Join(", ", entryNodes.Select(Function(n) $"'{n.Id}'"))
            Console.WriteLine($"❌ [FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
            System.Diagnostics.Debug.WriteLine($"❌ [FlowCompiler] Multiple entry nodes found: {entryNodeIds}")
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
            Dim rows = If(node.Rows, New List(Of RowData)())
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
                ' ✅ FIX: Use row.TaskId if present, otherwise fallback to row.Id
                ' Frontend may send taskId separately from row.Id
                Dim taskId As String = Nothing
                If Not String.IsNullOrEmpty(row.TaskId) Then
                    taskId = row.TaskId
                    Console.WriteLine($"     ✅ [FlowCompiler] Using row.TaskId: {taskId}")
                    System.Diagnostics.Debug.WriteLine($"     ✅ [FlowCompiler] Using row.TaskId: {taskId}")
                Else
                    taskId = row.Id
                    Console.WriteLine($"     ⚠️ [FlowCompiler] row.TaskId not found, using row.Id: {taskId}")
                    System.Diagnostics.Debug.WriteLine($"     ⚠️ [FlowCompiler] row.TaskId not found, using row.Id: {taskId}")
                End If

                ' ✅ DEBUG: Log available task IDs before lookup
                Console.WriteLine($"     🔍 [FlowCompiler] Looking for task: taskId={taskId}, row.Id={row.Id}")
                System.Diagnostics.Debug.WriteLine($"     🔍 [FlowCompiler] Looking for task: taskId={taskId}, row.Id={row.Id}")
                If flow.Tasks IsNot Nothing Then
                    Console.WriteLine($"     🔍 [FlowCompiler] Available tasks in flow.Tasks ({flow.Tasks.Count}): {String.Join(", ", flow.Tasks.Select(Function(t) $"{t.Id}(templateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL", t.TemplateId)})"))}")
                    System.Diagnostics.Debug.WriteLine($"     🔍 [FlowCompiler] Available tasks in flow.Tasks ({flow.Tasks.Count}): {String.Join(", ", flow.Tasks.Select(Function(t) $"{t.Id}(templateId={If(String.IsNullOrEmpty(t.TemplateId), "NULL", t.TemplateId)})"))}")
                Else
                    Console.WriteLine($"     ⚠️ [FlowCompiler] flow.Tasks is Nothing!")
                    System.Diagnostics.Debug.WriteLine($"     ⚠️ [FlowCompiler] flow.Tasks is Nothing!")
                End If

                ' Risolvi task direttamente da flow.Tasks
                Dim task = flow.GetTaskById(taskId)
                If task Is Nothing Then
                    Console.WriteLine($"     ❌ [FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    System.Diagnostics.Debug.WriteLine($"     ❌ [FlowCompiler] Task not found: taskId={taskId}, row.Id={row.Id}, node.Id={node.Id}")
                    Throw New Exception($"Task not found: {taskId} in node {node.Id}, row {row.Id}. Task must exist.")
                End If

                ' ✅ SIMPLIFIED: Usa templateId (string) direttamente, nessuna conversione
                Console.WriteLine($"🔍 [FlowCompiler] Processing task: Id={task.Id}, TemplateId={If(String.IsNullOrEmpty(task.TemplateId), "NULL/EMPTY", task.TemplateId)}, Node={node.Id}, Row={row.Id}")

                If String.IsNullOrEmpty(task.TemplateId) Then
                    Console.WriteLine($"❌ [FlowCompiler] Task {taskId} has no templateId!")
                    Throw New Exception($"Task {taskId} (node {node.Id}, row {row.Id}) has no templateId. TemplateId is required.")
                End If

                Console.WriteLine($"✅ [FlowCompiler] Task {taskId} has valid templateId: {task.TemplateId}")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Task {taskId} has valid templateId: {task.TemplateId}")

                ' ✅ REFACTORED: Crea task type-safe in base al tipo
                Dim taskType = ConvertTemplateIdToEnum(task.TemplateId)
                Console.WriteLine($"🔍 [FlowCompiler] Converted templateId '{task.TemplateId}' to taskType={taskType}")
                System.Diagnostics.Debug.WriteLine($"🔍 [FlowCompiler] Converted templateId '{task.TemplateId}' to taskType={taskType}")
                Dim compiledTask As CompiledTask = CreateTypedCompiledTask(taskType, task, row, node, taskId, flow)

                Console.WriteLine($"✅ [FlowCompiler] Created CompiledTask: Id={compiledTask.Id}, TaskType={compiledTask.TaskType}")
                System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Created CompiledTask: Id={compiledTask.Id}, TaskType={compiledTask.TaskType}")

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
            .Tasks = allTasks
        }

        Console.WriteLine($"✅ [FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"✅ [FlowCompiler] Compilation completed: {taskGroups.Count} task groups, {allTasks.Count} tasks")

        Return result
    End Function
End Class

