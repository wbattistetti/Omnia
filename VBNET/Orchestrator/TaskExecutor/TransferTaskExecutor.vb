Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Executor per task di tipo Transfer
''' </summary>
Public Class TransferTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' TODO: Implementare trasferimento
        Console.WriteLine($"⚠️ [TransferTaskExecutor] Task type Transfer not yet implemented, returning success")

        Return New TaskExecutionResult() With {
            .Success = True
        }
    End Function
End Class








