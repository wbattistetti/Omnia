Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' TaskGroupExecutor: Esegue tutti i task di un TaskGroup in sequenza
'''
''' Responsabilità:
''' - Gestisce CurrentRowIndex durante esecuzione
''' - Esegue task in sequenza tramite TaskExecutor
''' - Gestisce sospensione/ripresa quando task richiede input asincrono
'''
''' NON fa:
''' - NON trova TaskGroup (compito di FlowOrchestrator)
''' - NON naviga Edges o topologia
''' - NON valuta ExecCondition (già valutata da FlowOrchestrator)
''' </summary>
Public Class TaskGroupExecutor
    Private ReadOnly _taskExecutor As TaskExecutor

    Public Sub New(taskExecutor As TaskExecutor)
        _taskExecutor = taskExecutor
    End Sub

    ''' <summary>
    ''' Esegue tutti i task di un TaskGroup in sequenza
    ''' </summary>
    ''' <param name="taskGroup">TaskGroup da eseguire</param>
    ''' <param name="executionState">Stato esecuzione (modificato durante esecuzione)</param>
    ''' <returns>Risultato esecuzione (Success, RequiresInput, Error)</returns>
    Public Async Function ExecuteTaskGroup(
        taskGroup As TaskGroup,
        executionState As ExecutionState
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        If taskGroup Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "TaskGroup is Nothing"
            }
        End If

        If taskGroup.Tasks Is Nothing OrElse taskGroup.Tasks.Count = 0 Then
            Console.WriteLine($"[TaskGroupExecutor] ⚠️ TaskGroup {taskGroup.NodeId} has no tasks")
            Return New TaskExecutionResult() With {
                .Success = True,
                .RequiresInput = False
            }
        End If

        ' ✅ Inizializza CurrentRowIndex se necessario
        If executionState.CurrentRowIndex < taskGroup.StartTaskIndex Then
            executionState.CurrentRowIndex = taskGroup.StartTaskIndex
            Console.WriteLine($"[TaskGroupExecutor] Initialized CurrentRowIndex to {taskGroup.StartTaskIndex} for TaskGroup {taskGroup.NodeId}")
        End If

        ' ✅ Esegui task in sequenza
        For i = executionState.CurrentRowIndex To taskGroup.Tasks.Count - 1
            Dim task = taskGroup.Tasks(i)

            Console.WriteLine($"[TaskGroupExecutor] Executing task {i + 1}/{taskGroup.Tasks.Count} in TaskGroup {taskGroup.NodeId}: {task.Id}")

            ' ✅ Valuta condizione del task (se presente)
            Dim canExecute As Boolean = True
            If task.Condition IsNot Nothing Then
                canExecute = ConditionEvaluator.EvaluateCondition(task.Condition, executionState)
            End If

            If Not canExecute Then
                Console.WriteLine($"[TaskGroupExecutor] Task {task.Id} skipped (condition not satisfied)")
                executionState.CurrentRowIndex = i + 1
                Continue For
            End If

            ' ✅ Esegui task tramite TaskExecutor
            Dim result = Await _taskExecutor.ExecuteTask(task, executionState)

            If Not result.Success Then
                Console.WriteLine($"[TaskGroupExecutor] ❌ Task {task.Id} execution failed: {result.Err}")
                Return result
            End If

            ' ✅ Se task richiede input asincrono, sospendi esecuzione
            If result.RequiresInput Then
                Console.WriteLine($"[TaskGroupExecutor] ⏸️ Task {task.Id} requires input, suspending TaskGroup execution")
                executionState.CurrentRowIndex = i  ' Mantieni indice corrente per ripresa
                Return New TaskExecutionResult() With {
                    .Success = True,
                    .RequiresInput = True,
                    .WaitingTaskId = task.Id
                }
            End If

            ' ✅ Task completato, passa al successivo
            executionState.CurrentRowIndex = i + 1
            Console.WriteLine($"[TaskGroupExecutor] ✅ Task {task.Id} completed, moving to next task")
        Next

        ' ✅ Tutti i task eseguiti
        Console.WriteLine($"[TaskGroupExecutor] ✅ All tasks in TaskGroup {taskGroup.NodeId} completed")
        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = False
        }
    End Function
End Class
