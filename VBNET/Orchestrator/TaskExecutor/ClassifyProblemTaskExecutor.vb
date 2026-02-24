Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Executor per task di tipo ClassifyProblem
''' </summary>
Public Class ClassifyProblemTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' TODO: Implementare classificazione problema
        Console.WriteLine($"⚠️ [ClassifyProblemTaskExecutor] Task type ClassifyProblem not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








