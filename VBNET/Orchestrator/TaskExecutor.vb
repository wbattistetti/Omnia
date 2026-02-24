Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Esegue task compilati usando executor tipizzati
''' - Delega l'esecuzione a executor specifici per tipo di task
''' - Gestisce callback per messaggi
''' </summary>
Public Class TaskExecutor
    ' ✅ REMOVED: _taskEngine (Motore) - use StatelessDialogueEngine when needed
    Private _messageCallback As Action(Of String, String, Integer)

    Public Sub New()
        ' ✅ REMOVED: taskEngine parameter - use StatelessDialogueEngine when needed
    End Sub

    ''' <summary>
    ''' Imposta il callback per i messaggi
    ''' </summary>
    Public Sub SetMessageCallback(callback As Action(Of String, String, Integer))
        _messageCallback = callback
    End Sub

    ''' <summary>
    ''' Esegue un task compilato
    ''' </summary>
    Public Async Function ExecuteTask(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        If task Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is Nothing"
            }
        End If

        Try
            ' Ottieni l'executor appropriato per il tipo di task
            Dim executor = TaskExecutorFactory.GetExecutor(task.TaskType)

            If executor Is Nothing Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = $"No executor found for task type: {task.TaskType}"
                }
            End If

            ' Imposta il callback per i messaggi
            executor.SetMessageCallback(_messageCallback)

            ' Esegui il task usando l'executor specifico
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

