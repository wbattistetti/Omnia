Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Executor per task di tipo BackendCall
''' </summary>
Public Class BackendCallTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(taskEngine As Motore)
        MyBase.New(taskEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        ' TODO: Implementare chiamata backend
        Console.WriteLine($"⚠️ [BackendCallTaskExecutor] Task type BackendCall not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








