Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Executor per task di tipo BackendCall
''' </summary>
Public Class BackendCallTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState, Optional userInput As String = "") As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' TODO: Implementare chiamata backend
        Console.WriteLine($"⚠️ [BackendCallTaskExecutor] Task type BackendCall not yet implemented, returning success")

        ' ✅ ARCHITECTURAL: BackendCall è un task atomico - se Success=True, è completato
        Return New TaskExecutionResult() With {
            .Success = True,
            .IsCompleted = True  ' ✅ TaskExecutor decide: task atomico completato
        }
    End Function
End Class
