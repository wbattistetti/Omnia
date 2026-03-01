Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine

''' <summary>
''' Executor per task di tipo UtteranceInterpretation
''' NOTE: UtteranceInterpretation tasks should use ProcessTurnEngine.ProcessTurn() directly
''' This executor is kept for backward compatibility but should not be used
''' </summary>
Public Class UtteranceTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' UtteranceInterpretation tasks should use ProcessTurnEngine.ProcessTurn() directly
        ' This executor is legacy and should not be used
        Return New TaskExecutionResult() With {
            .Success = False,
            .Err = "UtteranceInterpretation tasks must use ProcessTurnEngine.ProcessTurn() directly. This executor is deprecated."
        }
    End Function
End Class








