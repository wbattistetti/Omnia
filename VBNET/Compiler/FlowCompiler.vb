Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports DDTEngine

''' <summary>
''' Flow Compiler: Trasforma struttura IDE (FlowNode, FlowEdge)
''' in struttura Runtime (TaskGroup, CompiledTask)
''' </summary>
Public Class FlowCompiler
    Private ReadOnly _conditionBuilder As ConditionBuilder

    Public Sub New()
        _conditionBuilder = New ConditionBuilder()
    End Sub

    ''' <summary>
    ''' Compiles flowchart into TaskGroups (uno per nodo)
    ''' Trasforma IDE.* → Runtime.*
    ''' </summary>
    Public Function CompileFlow(flow As Flow) As FlowCompilationResult

        Dim taskGroups As New List(Of TaskGroup)()
        Dim allTasks As New List(Of CompiledTask)()

        ' NOTE: flow.Tasks should contain ONLY tasks referenced in node rows
        ' (not all tasks from repository). Frontend filters before sending.

        ' Find entry nodes (nodes without external incoming edges, only back edges from descendants)
        ' Un nodo è entry se:
        ' - Non ha link in entrata, OPPURE
        ' - Tutti i link in entrata arrivano solo da discendenti (cicli/back edges)
        Dim entryNodes = flow.Nodes.Where(Function(n) flow.IsEntryNode(n.Id)).ToList()

        ' Topologicamente impossibile avere 0 entry nodes in un grafo connesso
        ' Se 0, significa grafo vuoto o non connesso
        If entryNodes.Count = 0 Then
            Throw New Exception("No entry nodes found. Graph may be empty or disconnected. At least one entry node is required.")
        End If

        ' Gestisci ambiguità: più entry nodes (es. ciclo A → B → A)
        ' In questo caso, tutti i nodi nel ciclo sono entry (tutti hanno solo back edges)
        ' La compilazione viene bloccata: bisogna definire/marcare quale nodo è di start
        If entryNodes.Count > 1 Then
            Dim entryNodeIds = String.Join(", ", entryNodes.Select(Function(n) $"'{n.Id}'"))
            Throw New Exception($"Multiple entry nodes found ({entryNodes.Count}): {entryNodeIds}. " &
                                "Please mark one node as the start/entry point. " &
                                "All nodes in a cycle cannot be entry points simultaneously.")
        End If

        ' Process all nodes - crea un TaskGroup per nodo
        For Each node In flow.Nodes
            Dim rows = If(node.Data?.Rows, New List(Of RowData)())
            If rows.Count = 0 Then Continue For

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
                ' Per costruzione: row.Id === task.Id (vedi taskHelpers.ts)
                Dim taskId = row.Id

                ' Risolvi task direttamente da flow.Tasks
                Dim task = flow.GetTaskById(taskId)
                If task Is Nothing Then
                    Throw New Exception($"Task not found: {taskId} in node {node.Id}, row {row.Id}. Task must exist.")
                End If

                ' Converti Action (Integer) in ActionType enum (cast diretto)
                Dim actionType As ActionType
                Try
                    actionType = CType(task.Action, ActionType)
                Catch ex As Exception
                    Throw New Exception($"Invalid action type value '{task.Action}' in task {taskId} (node {node.Id}, row {row.Id}). " &
                                        "Valid values: SayMessage=1, CloseSession=2, Transfer=3, GetData=4, BackendCall=5, ClassifyProblem=6")
                End Try

                ' Crea compiled task (senza condizione - la condizione è sul TaskGroup)
                ' Condition può essere Nothing o avere una condizione a design time
                Dim compiledTask As New CompiledTask() With {
                    .Id = row.Id,
                    .Action = actionType,
                    .Value = task.Value,
                    .Condition = Nothing,  ' La condizione principale è sul TaskGroup, ma può essere aggiunta a design time
                    .State = TaskState.UnExecuted,
                    .Debug = New TaskDebugInfo() With {
                        .SourceType = TaskSourceType.Flowchart,
                        .NodeId = node.Id,
                        .RowId = row.Id,
                        .OriginalTaskId = taskId
                    }
                }

                ' Aggiungi task al TaskGroup
                taskGroup.Tasks.Add(compiledTask)

                ' Aggiungi anche alla lista piatta per compatibilità
                allTasks.Add(compiledTask)

                ' Se task è GetData, manteniamo il DDT nel value (struttura gerarchica)
                ' NON espandiamo il DDT - il DDT Engine gestirà tutto
            Next

            ' Aggiungi TaskGroup al risultato
            taskGroups.Add(taskGroup)
        Next

        ' Trova entry TaskGroup (primo nodo entry)
        ' entryNodes.Count > 0 è garantito dal check precedente (altrimenti avremmo lanciato un'eccezione)
        Dim entryTaskGroupId As String = entryNodes(0).Id

        Return New FlowCompilationResult() With {
            .TaskGroups = taskGroups,
            .EntryTaskGroupId = entryTaskGroupId,
            .Tasks = allTasks
        }
    End Function
End Class

