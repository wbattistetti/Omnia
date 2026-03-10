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
    ' ✅ REMOVED: _taskExecutor (ora TaskExecutor è statico)

    Public Sub New()
        ' ✅ REMOVED: taskExecutor parameter (ora TaskExecutor è statico)
    End Sub

    ''' <summary>
    ''' Esegue tutti i task di un TaskGroup in sequenza
    ''' </summary>
    ''' <param name="taskGroup">TaskGroup da eseguire</param>
    ''' <param name="executionState">Stato esecuzione (modificato durante esecuzione)</param>
    ''' <param name="messageCallback">Callback per messaggi</param>
    ''' <returns>Risultato esecuzione (Success, RequiresInput, Error)</returns>
    Public Async Function ExecuteTaskGroup(
        taskGroup As TaskGroup,
        executionState As ExecutionState,
        messageCallback As Action(Of String, String, Integer)
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        If taskGroup Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "TaskGroup is Nothing",
                .IsCompleted = False
            }
        End If

        If taskGroup.Tasks Is Nothing OrElse taskGroup.Tasks.Count = 0 Then
            Console.WriteLine($"[TaskGroupExecutor] ⚠️ TaskGroup {taskGroup.NodeId} has no tasks")
            ' ✅ TaskGroup vuoto = completato (nessun task da eseguire)
            Return New TaskExecutionResult() With {
                .Success = True,
                .RequiresInput = False,
                .IsCompleted = True
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

            ' ✅ Esegui task tramite TaskExecutor (statico)
            Dim result = Await TaskExecutor.ExecuteTask(task, executionState, messageCallback)

            If Not result.Success Then
                Console.WriteLine($"[TaskGroupExecutor] ❌ Task {task.Id} execution failed: {result.Err}")
                ' ✅ PROPAGA: ritorna esattamente quello che TaskExecutor ha deciso (incluso IsCompleted)
                Return result
            End If

            ' ✅ ARCHITECTURAL: TaskGroupExecutor PROPAGA, non decide
            ' Se TaskExecutor dice RequiresInput, propaga immediatamente (STOP)
            If result.RequiresInput Then
                Console.WriteLine($"[TaskGroupExecutor] ⏸️ Task {task.Id} requires input, suspending TaskGroup execution")
                executionState.CurrentRowIndex = i  ' Mantieni indice corrente per ripresa
                ' ✅ PROPAGA: ritorna esattamente quello che TaskExecutor ha deciso
                Return New TaskExecutionResult() With {
                    .Success = True,
                    .RequiresInput = True,
                    .WaitingTaskId = result.WaitingTaskId,
                    .IsCompleted = result.IsCompleted  ' ✅ PROPAGA: non modifica
                }
            End If

            ' ✅ ARCHITECTURAL: Se TaskExecutor dice IsCompleted, passa al prossimo task
            ' TaskGroupExecutor NON decide, solo propaga e gestisce sequenza
            If result.IsCompleted Then
                executionState.CurrentRowIndex = i + 1
                Console.WriteLine($"[TaskGroupExecutor] ✅ Task {task.Id} completed (IsCompleted=True), moving to next task")
            Else
                ' Task non completato ma non richiede input (caso raro, ma gestito)
                executionState.CurrentRowIndex = i + 1
                Console.WriteLine($"[TaskGroupExecutor] ⚠️ Task {task.Id} not completed but not requiring input, moving to next task")
            End If
        Next

        ' ✅ ARCHITECTURAL: Tutti i task eseguiti
        ' TaskGroupExecutor NON decide se il TaskGroup è completato
        ' Assume che se tutti i task sono stati eseguiti, il TaskGroup è completato
        Console.WriteLine($"[TaskGroupExecutor] ✅ All tasks in TaskGroup {taskGroup.NodeId} completed")
        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = False,
            .IsCompleted = True  ' ✅ Tutti i task eseguiti = TaskGroup completato
        }
    End Function
End Class
