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
    ''' </summary>
    Public Function ExecuteTask(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Try
            Console.WriteLine($"🔧 [TaskExecutor] Executing task: {task.Id}, Action: {task.Type}")

            Select Case task.Type
                Case TaskTypes.SayMessage
                    Return ExecuteSayMessage(task, state)

                Case TaskTypes.GetData
                    Return ExecuteGetData(task, state)

                Case TaskTypes.BackendCall
                    Return ExecuteBackendCall(task, state)

                Case TaskTypes.ClassifyProblem
                    Return ExecuteClassifyProblem(task, state)

                Case TaskTypes.CloseSession
                    Return ExecuteCloseSession(task, state)

                Case TaskTypes.Transfer
                    Return ExecuteTransfer(task, state)

                Case Else
                    Console.WriteLine($"⚠️ [TaskExecutor] Unknown action type: {task.Type}")
                    Return New TaskExecutionResult() With {
                        .Success = False,
                        .Error = $"Unknown action type: {task.Type}"
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
            ' Debug: log Value structure
            Console.WriteLine($"🔍 [TaskExecutor] SayMessage task {task.Id} - Value structure:")
            If task.Value IsNot Nothing Then
                Console.WriteLine($"   Value keys: {String.Join(", ", task.Value.Keys)}")
                For Each kvp In task.Value
                    Console.WriteLine($"   - {kvp.Key}: {If(kvp.Value IsNot Nothing, kvp.Value.ToString().Substring(0, Math.Min(100, kvp.Value.ToString().Length)), "Nothing")}")
                Next
            Else
                Console.WriteLine($"   Value is Nothing")
            End If

            Dim messageText As String = ""

            ' Estrai il testo del messaggio dal Value
            ' Prova diverse chiavi possibili
            If task.Value IsNot Nothing AndAlso task.Value.ContainsKey("text") Then
                messageText = If(task.Value("text") IsNot Nothing, task.Value("text").ToString(), "")
            ElseIf task.Value IsNot Nothing AndAlso task.Value.ContainsKey("message") Then
                messageText = If(task.Value("message") IsNot Nothing, task.Value("message").ToString(), "")
            ElseIf task.Value IsNot Nothing AndAlso task.Value.ContainsKey("value") Then
                ' Alcuni task potrebbero avere un campo "value" annidato
                Dim valueObj = task.Value("value")
                If valueObj IsNot Nothing Then
                    If TypeOf valueObj Is Dictionary(Of String, Object) Then
                        Dim valueDict = CType(valueObj, Dictionary(Of String, Object))
                        If valueDict.ContainsKey("text") Then
                            messageText = If(valueDict("text") IsNot Nothing, valueDict("text").ToString(), "")
                        ElseIf valueDict.ContainsKey("message") Then
                            messageText = If(valueDict("message") IsNot Nothing, valueDict("message").ToString(), "")
                        End If
                    End If
                End If
            End If

            If String.IsNullOrEmpty(messageText) Then
                Console.WriteLine($"⚠️ [TaskExecutor] SayMessage task {task.Id} has no text")
                Console.WriteLine($"   Available keys in Value: {If(task.Value IsNot Nothing, String.Join(", ", task.Value.Keys), "Value is Nothing")}")
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
            Console.WriteLine($"📥 [TaskExecutor] GetData task {task.Id} - Starting DDT execution")

            ' Estrai DDT dal Value
            If task.Value Is Nothing OrElse Not task.Value.ContainsKey("ddt") Then
                Console.WriteLine($"❌ [TaskExecutor] GetData task {task.Id} missing DDT in Value")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = "GetData task missing DDT in Value"
                }
            End If

            Dim ddtValue = task.Value("ddt")
            If ddtValue Is Nothing Then
                Console.WriteLine($"❌ [TaskExecutor] GetData task {task.Id} DDT value is Nothing")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = "DDT value is Nothing"
                }
            End If

            ' Carica DDTInstance
            Dim ddtInstance As DDTInstance = Nothing
            Try
                If TypeOf ddtValue Is DDTInstance Then
                    ' Se è già un DDTInstance, usalo direttamente
                    ddtInstance = DDTLoader.LoadFromObject(CType(ddtValue, DDTInstance))
                ElseIf TypeOf ddtValue Is String Then
                    ' Se è una stringa JSON, deserializza
                    ddtInstance = DDTLoader.LoadFromJsonString(CStr(ddtValue))
                Else
                    Throw New InvalidOperationException($"Tipo ddtValue non supportato: {ddtValue.GetType().Name}. Atteso: DDTInstance o String JSON")
                End If

                Console.WriteLine($"✅ [TaskExecutor] DDTInstance loaded: {If(ddtInstance IsNot Nothing AndAlso ddtInstance.MainDataList IsNot Nothing, ddtInstance.MainDataList.Count, 0)} mainData nodes")
            Catch loadEx As Exception
                Console.WriteLine($"❌ [TaskExecutor] Error loading DDTInstance: {loadEx.Message}")
                Console.WriteLine($"   Stack trace: {loadEx.StackTrace}")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = $"Failed to load DDTInstance: {loadEx.Message}"
                }
            End Try

            ' Esegui DDT Engine
            Try
                Console.WriteLine($"🚀 [TaskExecutor] Calling DDT Engine ExecuteDDT...")
                _ddtEngine.ExecuteDDT(ddtInstance)
                Console.WriteLine($"✅ [TaskExecutor] DDT Engine execution completed")

                ' Il DDT Engine solleva eventi MessageToShow che vengono gestiti da FlowOrchestrator
                ' Non possiamo aspettare qui perché ExecuteDDT è sincrono e gestisce tutto internamente

                Return New TaskExecutionResult() With {
                    .Success = True,
                    .Output = New Dictionary(Of String, Object)()
                }
            Catch execEx As Exception
                Console.WriteLine($"❌ [TaskExecutor] Error executing DDT: {execEx.Message}")
                Console.WriteLine($"   Stack trace: {execEx.StackTrace}")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Error = $"DDT execution failed: {execEx.Message}"
                }
            End Try
        Catch ex As Exception
            Console.WriteLine($"❌ [TaskExecutor] Unexpected error in ExecuteGetData: {ex.Message}")
            Console.WriteLine($"   Stack trace: {ex.StackTrace}")
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

