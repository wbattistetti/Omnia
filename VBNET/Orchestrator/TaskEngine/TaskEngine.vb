Option Strict On
Option Explicit On
Imports Compiler
Imports Newtonsoft.Json
Namespace TaskEngine

''' <summary>
''' TaskEngine: Crash-resilient dialogue engine
''' Executes tasks with fine-grained state tracking using microtasks
''' </summary>
Public Class TaskEngine
    Private ReadOnly _stateStorage As ITaskEngineStateStorage
    Private ReadOnly _callbacks As ITaskEngineCallbacks

    Public Sub New(stateStorage As ITaskEngineStateStorage, callbacks As ITaskEngineCallbacks)
        If stateStorage Is Nothing Then Throw New ArgumentNullException(NameOf(stateStorage))
        If callbacks Is Nothing Then Throw New ArgumentNullException(NameOf(callbacks))
        _stateStorage = stateStorage
        _callbacks = callbacks
    End Sub

        ''' <summary>
        ''' Single entry point for all task types
        ''' Routes based on task type
        ''' NOTE: UtteranceInterpretation tasks are handled by ProcessTurnEngine (stateless)
        ''' </summary>
        Public Async Function ExecuteTask(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
            Try
                Select Case task.TaskType
                    Case TaskTypes.UtteranceInterpretation
                        ' UtteranceInterpretation tasks should use ProcessTurnEngine directly
                        ' This routing is kept for backward compatibility but should not be used
                        Return New TaskExecutionResult() With {
                        .Success = False,
                        .Err = "UtteranceInterpretation tasks should use ProcessTurnEngine.ProcessTurn() directly"
                    }
                    Case TaskTypes.SayMessage
                        Return Await ExecuteTaskSayMessage(task)
                    Case TaskTypes.BackendCall
                        Return Await ExecuteTaskBackendCall(task)
                    Case TaskTypes.ClassifyProblem
                        Return Await ExecuteTaskClassifyProblem(task)
                    Case Else
                        Return New TaskExecutionResult() With {
                        .Success = False,
                        .Err = $"Unknown task type: {task.TaskType}"
                    }
                End Select
            Catch ex As Exception
                Return New TaskExecutionResult() With {
                .Success = False,
                .Err = ex.Message
            }
            End Try
        End Function

        ' ==========================================================================
        ' OTHER TASK TYPES (simple, no loops)
        ' ==========================================================================

        ''' <summary>
        ''' Executes SayMessage task
        ''' </summary>
        Private Async Function ExecuteTaskSayMessage(task As CompiledTask) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' Access TextKey property (if SayMessage task has it)
        Dim sayMessageTask = TryCast(task, CompiledSayMessageTask)
        If sayMessageTask IsNot Nothing AndAlso Not String.IsNullOrEmpty(sayMessageTask.TextKey) Then
            Await _callbacks.OnMessage(sayMessageTask.TextKey)
        End If

        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = False,
            .WaitingTaskId = Nothing,
            .Err = Nothing
        }
    End Function

    ''' <summary>
    ''' Executes BackendCall task
    ''' </summary>
    Private Async Function ExecuteTaskBackendCall(task As CompiledTask) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        Dim backendTask = TryCast(task, CompiledBackendCallTask)
        If backendTask IsNot Nothing AndAlso Not String.IsNullOrEmpty(backendTask.Endpoint) Then
            Try
                Dim payload As Dictionary(Of String, Object) = If(backendTask.Payload, New Dictionary(Of String, Object)())
                Await _callbacks.OnBackendCall(backendTask.Endpoint, payload)
            Catch ex As Exception
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = ex.Message
                }
            End Try
        End If

        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = False,
            .WaitingTaskId = Nothing,
            .Err = Nothing
        }
    End Function

    ''' <summary>
    ''' Executes ClassifyProblem task
    ''' </summary>
    Private Async Function ExecuteTaskClassifyProblem(task As CompiledTask) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        Dim classifyTask = TryCast(task, CompiledClassifyProblemTask)
        If classifyTask IsNot Nothing AndAlso classifyTask.Intents IsNot Nothing Then
            Try
                Await _callbacks.OnProblemClassify(classifyTask.Intents)
            Catch ex As Exception
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = ex.Message
                }
            End Try
        End If

        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = False,
            .WaitingTaskId = Nothing,
            .Err = Nothing
        }
    End Function
End Class
End Namespace
