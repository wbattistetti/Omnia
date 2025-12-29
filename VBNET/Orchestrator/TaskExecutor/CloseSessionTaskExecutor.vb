Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Executor per task di tipo CloseSession
''' </summary>
Public Class CloseSessionTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(ddtEngine As Motore)
        MyBase.New(ddtEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        ' TODO: Implementare chiusura sessione
        Console.WriteLine($"⚠️ [CloseSessionTaskExecutor] Task type CloseSession not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class

