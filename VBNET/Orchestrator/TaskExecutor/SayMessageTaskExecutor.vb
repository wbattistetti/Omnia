Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Executor per task di tipo SayMessage
''' </summary>
Public Class SayMessageTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(ddtEngine As Motore)
        MyBase.New(ddtEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        Dim sayMessageTask = DirectCast(task, CompiledTaskSayMessage)

        If String.IsNullOrEmpty(sayMessageTask.Text) Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Message text is empty"
            }
        End If

        If _messageCallback IsNot Nothing Then
            _messageCallback(sayMessageTask.Text, "SayMessage", 0)
        End If

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








