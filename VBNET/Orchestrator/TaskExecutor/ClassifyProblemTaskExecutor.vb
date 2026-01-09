Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Executor per task di tipo ClassifyProblem
''' </summary>
Public Class ClassifyProblemTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New(ddtEngine As Motore)
        MyBase.New(ddtEngine)
    End Sub

    Public Overrides Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
        ' TODO: Implementare classificazione problema
        Console.WriteLine($"⚠️ [ClassifyProblemTaskExecutor] Task type ClassifyProblem not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








