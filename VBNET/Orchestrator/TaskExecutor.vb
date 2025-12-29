Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Esegue task compilati
''' - Gestisce esecuzione di diversi tipi di task (SayMessage, GetData, ecc.)
''' - Chiama DDT Engine per task GetData
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
            Select Case task.TaskType
                Case TaskTypes.SayMessage
                    Return ExecuteSayMessage(DirectCast(task, CompiledTaskSayMessage))
                Case TaskTypes.DataRequest
                    Return ExecuteGetData(DirectCast(task, CompiledTaskGetData), state)
                Case TaskTypes.ClassifyProblem
                    Return ExecuteClassifyProblem(DirectCast(task, CompiledTaskClassifyProblem))
                Case TaskTypes.BackendCall
                    Return ExecuteBackendCall(DirectCast(task, CompiledTaskBackendCall))
                Case TaskTypes.CloseSession
                    Return ExecuteCloseSession(DirectCast(task, CompiledTaskCloseSession))
                Case TaskTypes.Transfer
                    Return ExecuteTransfer(DirectCast(task, CompiledTaskTransfer))
                Case Else
                    Return New TaskExecutionResult() With {
                        .Success = False,
                        .Err = $"Unknown task type: {task.TaskType}"
                    }
            End Select
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = ex.Message
            }
        End Try
    End Function

    Private Function ExecuteSayMessage(task As CompiledTaskSayMessage) As TaskExecutionResult
        If String.IsNullOrEmpty(task.Text) Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Message text is empty"
            }
        End If

        If _messageCallback IsNot Nothing Then
            _messageCallback(task.Text, Nothing, 0)
        End If

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function

    Private Function ExecuteGetData(task As CompiledTaskGetData, state As ExecutionState) As TaskExecutionResult
        If task.DDT Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "DDT instance is Nothing"
            }
        End If

        ' TODO: Implementare esecuzione DDT usando _ddtEngine
        ' Per ora ritorna successo
        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function

    Private Function ExecuteClassifyProblem(task As CompiledTaskClassifyProblem) As TaskExecutionResult
        ' TODO: Implementare classificazione problema
        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function

    Private Function ExecuteBackendCall(task As CompiledTaskBackendCall) As TaskExecutionResult
        ' TODO: Implementare chiamata backend
        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function

    Private Function ExecuteCloseSession(task As CompiledTaskCloseSession) As TaskExecutionResult
        ' TODO: Implementare chiusura sessione
        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function

    Private Function ExecuteTransfer(task As CompiledTaskTransfer) As TaskExecutionResult
        ' TODO: Implementare trasferimento
        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class

''' <summary>
''' Risultato dell'esecuzione di un task
''' </summary>
Public Class TaskExecutionResult
    Public Property Success As Boolean
    Public Property Err As String
End Class

