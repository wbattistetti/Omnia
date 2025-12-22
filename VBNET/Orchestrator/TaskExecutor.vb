Option Strict On
Option Explicit On

Imports Compiler
Imports DDTEngine
Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Esegue un task compilato
''' </summary>
Public Class TaskExecutor
    Private ReadOnly _ddtEngine As Motore
    Private _onMessageCallback As Action(Of String, String, Integer)

    Public Sub New(ddtEngine As Motore)
        _ddtEngine = ddtEngine
    End Sub

    ''' <summary>
    ''' Imposta callback per messaggi
    ''' </summary>
    Public Sub SetMessageCallback(callback As Action(Of String, String, Integer))
        _onMessageCallback = callback
    End Sub

    ''' <summary>
    ''' Esegue un task
    ''' ✅ Type-safe dispatch con TypeOf
    ''' </summary>
    Public Function ExecuteTask(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            If TypeOf task Is CompiledTaskSayMessage Then
                Return ExecuteSayMessage(DirectCast(task, CompiledTaskSayMessage), state)
            ElseIf TypeOf task Is CompiledTaskGetData Then
                Return ExecuteGetData(DirectCast(task, CompiledTaskGetData), state)
            ElseIf TypeOf task Is CompiledTaskBackendCall Then
                Return ExecuteBackendCall(DirectCast(task, CompiledTaskBackendCall), state)
            ElseIf TypeOf task Is CompiledTaskClassifyProblem Then
                Return ExecuteClassifyProblem(DirectCast(task, CompiledTaskClassifyProblem), state)
            ElseIf TypeOf task Is CompiledTaskCloseSession Then
                Return ExecuteCloseSession(DirectCast(task, CompiledTaskCloseSession), state)
            ElseIf TypeOf task Is CompiledTaskTransfer Then
                Return ExecuteTransfer(DirectCast(task, CompiledTaskTransfer), state)
            Else
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = $"Unknown task type: {task.GetType().Name}"
                }
            End If
        Catch ex As Exception
            Console.WriteLine($"❌ [TaskExecutor] Error: {ex.Message}")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task SayMessage
    ''' ✅ Type-safe, usa CompiledTaskSayMessage
    ''' </summary>
    Private Function ExecuteSayMessage(task As CompiledTaskSayMessage, state As ExecutionState) As TaskExecutionResult
        Try
            Dim messageText = If(String.IsNullOrEmpty(task.Text), "", task.Text)

            If String.IsNullOrEmpty(messageText) Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = "Message text is empty"
                }
            End If

            If _onMessageCallback IsNot Nothing Then
                _onMessageCallback(messageText, "message", 0)
            End If

            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New With {.message = messageText}
            }
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task GetData (chiama DDT Engine)
    ''' ✅ Type-safe, usa CompiledTaskGetData
    ''' </summary>
    Private Function ExecuteGetData(task As CompiledTaskGetData, state As ExecutionState) As TaskExecutionResult
        Try
            Dim ddtInstance As DDTInstance = task.DDT

            If ddtInstance Is Nothing Then
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = "DDT not loaded in CompiledTaskGetData"
                }
            End If

            _ddtEngine.ExecuteDDT(ddtInstance)

            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New Dictionary(Of String, Object)()
            }
        Catch ex As Exception
            Console.WriteLine($"❌ [TaskExecutor] DDT execution failed: {ex.Message}")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = $"DDT execution failed: {ex.Message}"
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task BackendCall
    ''' ✅ Type-safe, usa CompiledTaskBackendCall
    ''' </summary>
    Private Function ExecuteBackendCall(task As CompiledTaskBackendCall, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare chiamata API esterna
            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New Dictionary(Of String, Object) From {
                    {"endpoint", task.Endpoint},
                    {"method", task.Method}
                }
            }
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task ClassifyProblem
    ''' ✅ Type-safe, usa CompiledTaskClassifyProblem
    ''' </summary>
    Private Function ExecuteClassifyProblem(task As CompiledTaskClassifyProblem, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare classificazione problema
            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New Dictionary(Of String, Object)()
            }
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task CloseSession
    ''' ✅ Type-safe, usa CompiledTaskCloseSession
    ''' </summary>
    Private Function ExecuteCloseSession(task As CompiledTaskCloseSession, state As ExecutionState) As TaskExecutionResult
        Try
            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New With {.action = "closeSession"}
            }
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task Transfer
    ''' ✅ Type-safe, usa CompiledTaskTransfer
    ''' </summary>
    Private Function ExecuteTransfer(task As CompiledTaskTransfer, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare transfer
            Return New TaskExecutionResult() With {
                .Success = True,
                .Output = New Dictionary(Of String, Object) From {
                    {"target", task.Target}
                }
            }
        Catch ex As Exception
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function
End Class

''' <summary>
''' Risultato dell'esecuzione di un task
''' </summary>
Public Class TaskExecutionResult
    ''' <summary>
    ''' Indica se l'esecuzione è riuscita
    ''' </summary>
    Public Property Success As Boolean

    ''' <summary>
    ''' Output del task (dati estratti, risultato API, ecc.)
    ''' </summary>
    Public Property Output As Object

    ''' <summary>
    ''' Errore se l'esecuzione è fallita
    ''' </summary>
    Public Property [Error] As String
End Class

