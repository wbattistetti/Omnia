Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
' Executor specifici sono in Engine/TaskExecutors/ (namespace TaskEngine)

''' <summary>
''' Smistatore unificato: identifica l'executor corretto e lo esegue
''' Classe statica che combina factory + esecuzione
''' Coordina l'esecuzione delegando agli executor specifici in Engine
''' </summary>
Public Class TaskExecutor

    ''' <summary>
    ''' Identifica e crea l'executor appropriato per il tipo di task
    ''' </summary>
    Private Shared Function GetExecutor(taskType As TaskTypes) As TaskExecutorBase
        Select Case taskType
            Case TaskTypes.ClassifyProblem
                Return New ClassifyProblemTaskExecutor()
            Case TaskTypes.BackendCall
                Return New BackendCallTaskExecutor()
            Case TaskTypes.SayMessage
                Return New SayMessageTaskExecutor()
            Case TaskTypes.CloseSession
                Return New CloseSessionTaskExecutor()
            Case TaskTypes.Transfer
                Return New TransferTaskExecutor()
            Case TaskTypes.UtteranceInterpretation
                Return New TaskUtteranceStepExecutor()
            Case Else
                Console.WriteLine($"⚠️ [TaskExecutor] Unknown TaskType {taskType}")
                Return Nothing
        End Select
    End Function

    ''' <summary>
    ''' Esegue un task: identifica l'executor e lo fa eseguire dal motore
    ''' </summary>
    Public Shared Async Function ExecuteTask(
        task As CompiledTask,
        state As ExecutionState,
        messageCallback As Action(Of String, String, Integer),
        Optional userInput As String = ""
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        If task Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is Nothing",
                .IsCompleted = False
            }
        End If

        Try
            ' Identifica l'executor corretto
            Dim executor = GetExecutor(task.TaskType)

            If executor Is Nothing Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = $"No executor found for task type: {task.TaskType}",
                    .IsCompleted = False
                }
            End If

            ' Imposta callback e esegui
            executor.SetMessageCallback(messageCallback)
            ' ✅ PROPAGA: ritorna esattamente quello che l'executor specifico ha deciso (incluso IsCompleted)
            ' ✅ Passa userInput solo se fornito (per TaskUtteranceStepExecutor)
            Return Await executor.Execute(task, state, userInput)

        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = ex.Message,
                .IsCompleted = False
            }
        End Try
    End Function
End Class

' TaskExecutionResult moved to Common/TaskExecutionResult.vb
