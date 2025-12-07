Option Strict On
Option Explicit On

Imports Compiler
Imports DDTEngine
Imports System.Collections.Generic

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
    ''' </summary>
    Public Function ExecuteTask(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            Console.WriteLine($"🔧 [TaskExecutor] Executing task: {task.Id}, Action: {task.Action}")

            Select Case task.Action
                Case ActionType.SayMessage
                    Return ExecuteSayMessage(task, state)

                Case ActionType.GetData
                    Return ExecuteGetData(task, state)

                Case ActionType.BackendCall
                    Return ExecuteBackendCall(task, state)

                Case ActionType.ClassifyProblem
                    Return ExecuteClassifyProblem(task, state)

                Case ActionType.CloseSession
                    Return ExecuteCloseSession(task, state)

                Case ActionType.Transfer
                    Return ExecuteTransfer(task, state)

                Case Else
                    Console.WriteLine($"⚠️ [TaskExecutor] Unknown action type: {task.Action}")
                    Return New TaskExecutionResult() With {
                        .Success = False,
                        .Error = $"Unknown action type: {task.Action}"
                    }
            End Select
        Catch ex As Exception
            Console.WriteLine($"❌ [TaskExecutor] Error executing task {task.Id}: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Error = ex.Message
            }
        End Try
    End Function

    ''' <summary>
    ''' Esegue un task SayMessage
    ''' </summary>
    Private Function ExecuteSayMessage(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            Dim messageText As String = ""

            ' Estrai il testo del messaggio dal Value
            If task.Value IsNot Nothing AndAlso task.Value.ContainsKey("text") Then
                messageText = task.Value("text").ToString()
            ElseIf task.Value IsNot Nothing AndAlso task.Value.ContainsKey("message") Then
                messageText = task.Value("message").ToString()
            End If

            If String.IsNullOrEmpty(messageText) Then
                Console.WriteLine($"⚠️ [TaskExecutor] SayMessage task {task.Id} has no text")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = "Message text is empty"
                }
            End If

            Console.WriteLine($"📨 [TaskExecutor] Sending message: {messageText.Substring(0, Math.Min(100, messageText.Length))}")

            ' Invia messaggio tramite callback
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
    ''' </summary>
    Private Function ExecuteGetData(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare chiamata DDT Engine
            ' Deve estrarre il DDT dal Value e chiamare _ddtEngine.Execute()
            Console.WriteLine($"📥 [TaskExecutor] GetData task {task.Id} - TODO: Implement DDT execution")

            ' Per ora ritorna successo
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
    ''' Esegue un task BackendCall
    ''' </summary>
    Private Function ExecuteBackendCall(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare chiamata API esterna
            Console.WriteLine($"🔌 [TaskExecutor] BackendCall task {task.Id} - TODO: Implement API call")

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
    ''' Esegue un task ClassifyProblem
    ''' </summary>
    Private Function ExecuteClassifyProblem(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare classificazione problema
            Console.WriteLine($"🔍 [TaskExecutor] ClassifyProblem task {task.Id} - TODO: Implement problem classification")

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
    ''' </summary>
    Private Function ExecuteCloseSession(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            Console.WriteLine($"🔚 [TaskExecutor] CloseSession task {task.Id}")

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
    ''' </summary>
    Private Function ExecuteTransfer(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            ' TODO: Implementare transfer
            Console.WriteLine($"🔄 [TaskExecutor] Transfer task {task.Id} - TODO: Implement transfer")

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

