Option Strict On
Option Explicit On

Imports TaskEngine
Imports Compiler

''' <summary>
''' Executor per task di tipo DataRequest
''' Gestisce l'esecuzione completa del DDT Engine
''' </summary>
Public Class DataRequestTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(ddtEngine As Motore)
        MyBase.New(ddtEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Dim utteranceTask = DirectCast(task, CompiledTaskUtteranceInterpretation)

        ' ✅ Verifica che abbia almeno Steps o SubTasks
        If (utteranceTask.Steps Is Nothing OrElse utteranceTask.Steps.Count = 0) AndAlso
           Not utteranceTask.HasSubTasks() Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "CompiledTaskUtteranceInterpretation has no Steps or SubTasks"
            }
        End If

        Try
            Console.WriteLine($"🚀 [DataRequestTaskExecutor] Starting DDT execution for task {task.Id}")

            ' Collega l'evento MessageToShow del Motore al callback per i messaggi
            Dim messageHandler As EventHandler(Of MessageEventArgs) = Nothing
            messageHandler = Sub(sender As Object, e As MessageEventArgs)
                                 If _messageCallback IsNot Nothing Then
                                     _messageCallback(e.Message, "DDT", 0)
                                 End If
                             End Sub

            ' Registra l'handler per l'evento
            AddHandler _ddtEngine.MessageToShow, messageHandler

            Try
                ' Esegue il DDT: questa chiamata è sincrona e blocca finché il DDT non completa
                ' Il Motore gestisce internamente:
                ' - Navigazione attraverso i nodi (GetNextData)
                ' - Esecuzione dei response (ExecuteResponse)
                ' - Parsing dell'input utente (Parser.InterpretUtterance)
                ' - Transizioni di stato (SetState)
                ' L'input utente deve essere fornito dall'esterno tramite Parser.SetUserInput()
                ' TODO: Modificare ExecuteDDT per accettare RuntimeTask invece di DDTInstance
                ' Per ora commentato - il runtime deve essere aggiornato
                ' _ddtEngine.ExecuteDDT(dataRequestTask.Task)
                Throw New NotImplementedException("ExecuteDDT must be updated to accept RuntimeTask instead of DDTInstance")

                Console.WriteLine($"✅ [DataRequestTaskExecutor] DDT execution completed for task {task.Id}")

                Return New TaskExecutionResult() With {
                    .Success = True
                }
            Finally
                ' Rimuovi l'handler per evitare memory leak
                RemoveHandler _ddtEngine.MessageToShow, messageHandler
            End Try

        Catch ex As Exception
            Console.WriteLine($"❌ [DataRequestTaskExecutor] DDT execution failed for task {task.Id}: {ex.Message}")
            Console.WriteLine($"   Stack trace: {ex.StackTrace}")

            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = $"DDT execution failed: {ex.Message}"
            }
        End Try
    End Function
End Class








