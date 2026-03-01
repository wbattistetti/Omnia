Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Smistatore unificato: identifica l'executor corretto e lo esegue
''' Classe statica che combina factory + esecuzione
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
            ' UtteranceInterpretation tasks use ProcessTurnEngine.ProcessTurn() directly, not an executor
            ' TODO: After refactoring, add: Case TaskTypes.UtteranceInterpretation Return New TaskUtteranceStepExecutor()
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
        messageCallback As Action(Of String, String, Integer)
    ) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        If task Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is Nothing"
            }
        End If

        Try
            ' Identifica l'executor corretto
            Dim executor = GetExecutor(task.TaskType)

            If executor Is Nothing Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = $"No executor found for task type: {task.TaskType}"
                }
            End If

            ' Imposta callback e esegui
            executor.SetMessageCallback(messageCallback)
            Return Await executor.Execute(task, state)

        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = ex.Message
            }
        End Try
    End Function
End Class

''' <summary>
''' Risultato dell'esecuzione di un task
''' </summary>
Public Class TaskExecutionResult
    Public Property Success As Boolean
    Public Property Err As String

    ''' <summary>
    ''' Indica se il task richiede input asincrono (es. GetData)
    ''' Quando True, l'esecuzione del TaskGroup viene sospesa
    ''' </summary>
    Public Property RequiresInput As Boolean = False

    ''' <summary>
    ''' ID del task che sta attendendo input (se RequiresInput = True)
    ''' </summary>
    Public Property WaitingTaskId As String = Nothing
End Class
