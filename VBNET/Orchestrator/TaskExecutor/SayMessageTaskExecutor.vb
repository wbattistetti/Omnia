Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Executor per task di tipo SayMessage
''' </summary>
Public Class SayMessageTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(taskEngine As Motore)
        MyBase.New(taskEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Dim sayMessageTask = DirectCast(task, CompiledSayMessageTask)

        ' ✅ FASE 1.1: Usa TextKey invece di Text
        ' NOTA: La risoluzione TextKey → testo deve essere fatta a livello superiore
        ' (tramite TranslationResolver) prima di chiamare questo executor
        If String.IsNullOrEmpty(sayMessageTask.TextKey) Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Message TextKey is empty"
            }
        End If

        ' ✅ TODO: Risolvere TextKey → testo usando TranslationResolver
        ' Per ora, passa TextKey al callback (il livello superiore deve risolvere)
        If _messageCallback IsNot Nothing Then
            _messageCallback(sayMessageTask.TextKey, "SayMessage", 0)
        End If

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








