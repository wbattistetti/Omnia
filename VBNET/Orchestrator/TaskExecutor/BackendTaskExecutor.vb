Option Strict On
Option Explicit On

Imports TaskEngine
Imports Compiler

''' <summary>
''' Executor per task di tipo BackendCall
''' </summary>
Public Class BackendTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(taskEngine As Motore)
        MyBase.New(taskEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        ' TODO: Implementare chiamata backend
        Console.WriteLine($"⚠️ [BackendTaskExecutor] Task type BackendCall not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








