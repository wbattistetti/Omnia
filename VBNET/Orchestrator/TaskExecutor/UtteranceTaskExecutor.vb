Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports System.Linq

''' <summary>
''' Executor per task di tipo UtteranceInterpretation
''' ✅ NEW: Usa TaskEngine.ExecuteTask() con microtask e crash resilience
''' </summary>
Public Class UtteranceTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        Dim utteranceTask = TryCast(task, CompiledUtteranceTask)
        If utteranceTask Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is not UtteranceInterpretation"
            }
        End If

        ' ✅ Verifica che abbia almeno Steps
        If utteranceTask.Steps Is Nothing OrElse utteranceTask.Steps.Count = 0 Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "CompiledUtteranceTask has no Steps"
            }
        End If

        Try
            Console.WriteLine($"🚀 [UtteranceTaskExecutor] Starting Task execution for task {task.Id}")

            ' ✅ Create state storage and callbacks
            Dim stateStorage As New TaskEngineStateStorage(state)
            Dim callbacks As New TaskEngineCallbacks(_messageCallback)

            ' ✅ Create TaskEngine and execute
            Dim engine As New TaskEngine(stateStorage, callbacks)
            Dim resultObj = Await engine.ExecuteTask(task, state)

            ' Access result properties via reflection (result is Object to avoid circular dependency)
            Dim requiresInputProp = resultObj.GetType().GetProperty("RequiresInput")
            Dim requiresInput = If(requiresInputProp IsNot Nothing, DirectCast(requiresInputProp.GetValue(resultObj), Boolean), False)

            Console.WriteLine($"✅ [UtteranceTaskExecutor] Task {task.Id} completed. RequiresInput: {requiresInput}")

            ' Cast result back to TaskExecutionResult (it's the same object, just typed as Object in TaskEngine)
            Return DirectCast(resultObj, TaskExecutionResult)

        Catch ex As Exception
            Console.WriteLine($"❌ [UtteranceTaskExecutor] Task execution failed for task {task.Id}: {ex.Message}")
            Console.WriteLine($"   Stack trace: {ex.StackTrace}")

            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = $"Task execution failed: {ex.Message}"
            }
        End Try
    End Function
End Class








