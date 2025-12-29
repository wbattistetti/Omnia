Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Esegue task compilati usando executor tipizzati
''' - Delega l'esecuzione a executor specifici per tipo di task
''' - Gestisce callback per messaggi
''' </summary>
Public Class TaskExecutor
    Private ReadOnly _ddtEngine As Motore
    Private _messageCallback As Action(Of String, String, Integer)

    Public Sub New(ddtEngine As Motore)
        _ddtEngine = ddtEngine
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
    Public Function ExecuteTask(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        If task Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is Nothing"
            }
        End If

        Try
            ' Ottieni l'executor appropriato per il tipo di task
            Dim executor = TaskExecutorFactory.GetExecutor(task.TaskType, _ddtEngine)

            If executor Is Nothing Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = $"No executor found for task type: {task.TaskType}"
                }
            End If

            ' Imposta il callback per i messaggi
            executor.SetMessageCallback(_messageCallback)

            ' Esegui il task usando l'executor specifico
            Return executor.Execute(task, state)

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
End Class

