' ============================================================================
' TASKENGINE CLASS
' Simple, clean implementation without old engine logic
' ============================================================================

Option Strict On
Option Explicit On
' NOTE: Cannot import Compiler or Orchestrator due to circular dependency
' Types are passed as Object and accessed via reflection
Imports Newtonsoft.Json
Imports TaskEngine
Imports System.Reflection
Imports System.Linq

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
    ''' NOTE: task and state are Object to avoid circular dependency
    ''' </summary>
    Public Async Function ExecuteTask(task As Object, state As Object) As System.Threading.Tasks.Task(Of Object)
        Try
            Dim taskType = TaskEngineHelpers.GetTaskType(task)
            Dim taskTypeName = If(taskType IsNot Nothing, taskType.ToString(), "")

            ' Get TaskTypes enum value via reflection
            Dim compilerAssembly = AppDomain.CurrentDomain.GetAssemblies().
                FirstOrDefault(Function(a) a.GetName().Name = "Compiler")
            If compilerAssembly Is Nothing Then
                Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, "Compiler assembly not found")
            End If

            Dim taskTypesType = compilerAssembly.GetType("Compiler.TaskTypes")
            If taskTypesType Is Nothing Then
                Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, "TaskTypes enum not found")
            End If

            ' Compare task type
            Dim utteranceType = [Enum].Parse(taskTypesType, "UtteranceInterpretation")
            Dim sayMessageType = [Enum].Parse(taskTypesType, "SayMessage")
            Dim backendCallType = [Enum].Parse(taskTypesType, "BackendCall")
            Dim classifyProblemType = [Enum].Parse(taskTypesType, "ClassifyProblem")

            If taskType.Equals(utteranceType) Then
                Return Await ExecuteTaskUtterance(task, state)
            ElseIf taskType.Equals(sayMessageType) Then
                Return Await ExecuteTaskSayMessage(task)
            ElseIf taskType.Equals(backendCallType) Then
                Return Await ExecuteTaskBackendCall(task)
            ElseIf taskType.Equals(classifyProblemType) Then
                Return Await ExecuteTaskClassifyProblem(task)
            Else
                Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, $"Unknown task type: {taskTypeName}")
            End If
        Catch ex As Exception
            Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, ex.Message)
        End Try
    End Function

    ' ==========================================================================
    ' UTTERANCE TASK (with microtask loop and crash resilience)
    ' ==========================================================================

    ''' <summary>
    ''' Entry point for UtteranceInterpretation tasks
    ''' Loads/creates DialogueContext and starts pipeline
    ''' NOTE: task and state are Object to avoid circular dependency
    ''' </summary>
    Private Async Function ExecuteTaskUtterance(task As Object, state As Object) As System.Threading.Tasks.Task(Of Object)
        Dim taskId = TaskEngineHelpers.GetTaskId(task)

        ' Verify it has steps
        Dim steps = TaskEngineHelpers.GetTaskSteps(task)
        If steps Is Nothing OrElse TaskEngineHelpers.GetStepsCount(steps) = 0 Then
            Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, "Utterance task has no steps")
        End If

        ' Load or create DialogueContext
        Dim ctx As DialogueContext
        Dim dialogueContexts = TaskEngineHelpers.GetDialogueContexts(state)

        If dialogueContexts IsNot Nothing AndAlso dialogueContexts.ContainsKey(taskId) Then
            ' Load saved DialogueContext (for async input or crash recovery)
            Dim savedCtxJson = dialogueContexts(taskId)
            ctx = JsonConvert.DeserializeObject(Of DialogueContext)(savedCtxJson)
        Else
            ' Create new DialogueContext from CompiledTask
            ' NOTE: CompiledTaskAdapter is in Orchestrator to avoid circular dependency
            ' We use reflection to call it
            Dim adapterType = Type.GetType("TaskEngine.Orchestrator.CompiledTaskAdapter, Orchestrator")
            If adapterType IsNot Nothing Then
                Dim method = adapterType.GetMethod("CreateDialogueContextFromTask", BindingFlags.Public Or BindingFlags.Static)
                If method IsNot Nothing Then
                    ctx = DirectCast(method.Invoke(Nothing, {task}), DialogueContext)
                Else
                    Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, "CreateDialogueContextFromTask method not found")
                End If
            Else
                Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, "CompiledTaskAdapter type not found")
            End If
        End If

        ' Execute pipeline with microtask loop
        ctx = Await ExecuteTaskUtterancePipeline(taskId, ctx)

        ' Determine if it requires user input
        Dim requiresInput = ctx.CurrentStep IsNot Nothing AndAlso ctx.CurrentStep.RequiresUserInput

        ' Save DialogueContext in ExecutionState (for FlowOrchestrator)
        Dim newCtxJson = JsonConvert.SerializeObject(ctx)
        TaskEngineHelpers.SetDialogueContext(state, taskId, newCtxJson)

        Return TaskEngineHelpers.CreateTaskExecutionResult(True, requiresInput, If(requiresInput, taskId, Nothing), Nothing)
    End Function

    ''' <summary>
    ''' Main pipeline for UtteranceInterpretation
    ''' Contains microtask loop with fine-grained tracking (StepExecutionState)
    ''' </summary>
    Private Async Function ExecuteTaskUtterancePipeline(taskId As String, ctx As DialogueContext) As System.Threading.Tasks.Task(Of DialogueContext)
        Dim currentCtx = ctx

        ' Main loop
        While True
            ' 1. Calculate next context (pure logic, no side effects)
            Dim newCtx = GetNextContext(currentCtx)

            ' 2. Check exit conditions
            If newCtx.CurrentStep Is Nothing Then
                ' No more steps → task completed
                Await _stateStorage.SaveDialogueContext(taskId, newCtx)
                Return newCtx
            End If

            ' 3. Initialize StepExecutionState if needed
            Dim stepState As StepExecutionState
            If newCtx.StepExecutionState IsNot Nothing Then
                stepState = newCtx.StepExecutionState
            Else
                stepState = New StepExecutionState() With {
                    .StepName = newCtx.CurrentStep.Name,
                    .MicrotaskIndex = -1  ' -1 = no microtask executed
                }
            End If

            ' 4. Microtask loop with fine-grained tracking
            Dim microtasks = newCtx.CurrentStep.Microtasks
            If microtasks IsNot Nothing Then
                For Each microtask In microtasks
                    ' Check if microtask should be executed
                    If microtask.Index > stepState.MicrotaskIndex Then
                        ' Execute microtask (isolated side effect, async)
                        Await ExecuteMicrotask(microtask)

                        ' Update state
                        stepState = New StepExecutionState() With {
                            .StepName = newCtx.CurrentStep.Name,
                            .MicrotaskIndex = microtask.Index
                        }
                        newCtx.StepExecutionState = stepState

                        ' Commit microtask: save DialogueContext with updated StepExecutionState
                        ' This allows crash recovery without duplications
                        Await _stateStorage.SaveDialogueContext(taskId, newCtx)
                    End If
                Next
            End If

            ' 5. Step completed: reset StepExecutionState
            newCtx.StepExecutionState = Nothing
            Await _stateStorage.SaveDialogueContext(taskId, newCtx)

            ' 6. If step requires input, stop here
            If newCtx.CurrentStep.RequiresUserInput Then
                Return newCtx
            End If

            ' 7. Update context for next iteration
            currentCtx = newCtx
        End While
    End Function

    ' ==========================================================================
    ' PURE LOGIC: calculate next context
    ' ==========================================================================

    ''' <summary>
    ''' Calculates next context (pure function)
    ''' Simple: move to next step or handle current step not completed
    ''' No side effects, no loops, no storage dependencies
    ''' </summary>
    Private Function GetNextContext(ctx As DialogueContext) As DialogueContext
        Dim steps = ctx.Steps
        Dim currentStepIndex = ctx.CurrentStepIndex
        Dim currentStep = ctx.CurrentStep
        Dim stepExecutionState = ctx.StepExecutionState

        ' If current step is not completed (microtaskIndex < last), stay on same step
        If currentStep IsNot Nothing AndAlso
           stepExecutionState IsNot Nothing AndAlso
           stepExecutionState.StepName = currentStep.Name AndAlso
           currentStep.Microtasks IsNot Nothing AndAlso
           stepExecutionState.MicrotaskIndex < currentStep.Microtasks.Count - 1 Then
            ' Current step not completed → stay on same step
            Return ctx
        End If

        ' Otherwise move to next step
        Dim nextIndex As Integer?

        If currentStepIndex Is Nothing Then
            ' First step
            nextIndex = If(steps IsNot Nothing AndAlso steps.Count > 0, 0, Nothing)
        Else
            ' Next step
            Dim candidate = currentStepIndex.Value + 1
            nextIndex = If(steps IsNot Nothing AndAlso candidate < steps.Count, candidate, Nothing)
        End If

        If nextIndex Is Nothing Then
            ' No more steps available
            Return New DialogueContext() With {
                .TaskId = ctx.TaskId,
                .Steps = ctx.Steps,
                .CurrentStepIndex = Nothing,
                .CurrentStep = Nothing,
                .StepExecutionState = Nothing
            }
        End If

        ' Next step available
        Dim nextStep = steps(nextIndex.Value)

        ' New step → no microtask executed yet
        Return New DialogueContext() With {
            .TaskId = ctx.TaskId,
            .Steps = ctx.Steps,
            .CurrentStepIndex = nextIndex,
            .CurrentStep = nextStep,
            .StepExecutionState = New StepExecutionState() With {
                .StepName = nextStep.Name,
                .MicrotaskIndex = -1
            }
        }
    End Function

    ' ==========================================================================
    ' SIDE EFFECT: execute single microtask
    ' ==========================================================================

    ''' <summary>
    ''' Executes a single microtask (isolated side effect, async)
    ''' No loops, no saves, no state dependencies
    ''' </summary>
    Private Async Function ExecuteMicrotask(microtask As Microtask) As System.Threading.Tasks.Task
        Select Case microtask.Type
            Case MicrotaskType.SendMessage
                Dim text = If(microtask.Data IsNot Nothing, microtask.Data.ToString(), "")
                Await _callbacks.OnMessage(text)

            Case MicrotaskType.Log
                Dim message = If(microtask.Data IsNot Nothing, microtask.Data.ToString(), "")
                Await _callbacks.OnLog(message)

            ' Case MicrotaskType.UpdateUI - REMOVED: UI project no longer exists

            Case MicrotaskType.CallBackend
                Dim endpoint = If(microtask.Data IsNot Nothing, microtask.Data.ToString(), "")
                Dim params As Dictionary(Of String, Object) = New Dictionary(Of String, Object)()
                ' TODO: Extract params from microtask.Data if needed
                Await _callbacks.OnBackendCall(endpoint, params)

            Case Else
                Await _callbacks.OnLog($"Unknown microtask type: {microtask.Type}")
        End Select
    End Function

    ' ==========================================================================
    ' OTHER TASK TYPES (simple, no loops)
    ' ==========================================================================

    ''' <summary>
    ''' Executes SayMessage task
    ''' </summary>
    Private Async Function ExecuteTaskSayMessage(task As Object) As System.Threading.Tasks.Task(Of Object)
        ' Access TextKey property via reflection
        Dim textKeyProp = task.GetType().GetProperty("TextKey")
        If textKeyProp IsNot Nothing Then
            Dim textKey = DirectCast(textKeyProp.GetValue(task), String)
            If Not String.IsNullOrEmpty(textKey) Then
                Await _callbacks.OnMessage(textKey)
            End If
        End If

        Return TaskEngineHelpers.CreateTaskExecutionResult(True, False, Nothing, Nothing)
    End Function

    ''' <summary>
    ''' Executes BackendCall task
    ''' </summary>
    Private Async Function ExecuteTaskBackendCall(task As Object) As System.Threading.Tasks.Task(Of Object)
        Dim endpointProp = task.GetType().GetProperty("Endpoint")
        Dim payloadProp = task.GetType().GetProperty("Payload")
        If endpointProp IsNot Nothing Then
            Dim endpoint = DirectCast(endpointProp.GetValue(task), String)
            If Not String.IsNullOrEmpty(endpoint) Then
                Try
                    Dim payloadObj = payloadProp?.GetValue(task)
                    Dim payload As Dictionary(Of String, Object) = Nothing
                    If payloadObj IsNot Nothing Then
                        If TypeOf payloadObj Is Dictionary(Of String, Object) Then
                            payload = DirectCast(payloadObj, Dictionary(Of String, Object))
                        Else
                            ' Initialize empty dictionary if payload is not a dictionary
                            payload = New Dictionary(Of String, Object)()
                        End If
                    Else
                        payload = New Dictionary(Of String, Object)()
                    End If
                    Await _callbacks.OnBackendCall(endpoint, payload)
                Catch ex As Exception
                    Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, ex.Message)
                End Try
            End If
        End If

        Return TaskEngineHelpers.CreateTaskExecutionResult(True, False, Nothing, Nothing)
    End Function

    ''' <summary>
    ''' Executes ClassifyProblem task
    ''' </summary>
    Private Async Function ExecuteTaskClassifyProblem(task As Object) As System.Threading.Tasks.Task(Of Object)
        Dim intentsProp = task.GetType().GetProperty("Intents")
        If intentsProp IsNot Nothing Then
            Dim intentsObj = intentsProp.GetValue(task)
            If intentsObj IsNot Nothing Then
                Try
                    Dim intents As List(Of String) = Nothing
                    If TypeOf intentsObj Is List(Of String) Then
                        intents = DirectCast(intentsObj, List(Of String))
                    ElseIf TypeOf intentsObj Is IEnumerable Then
                        ' Try to convert IEnumerable to List(Of String)
                        intents = DirectCast(intentsObj, IEnumerable).Cast(Of Object)().Select(Function(x) x.ToString()).ToList()
                    Else
                        ' Initialize empty list if intents is not a list
                        intents = New List(Of String)()
                    End If
                    Await _callbacks.OnProblemClassify(intents)
                Catch ex As Exception
                    Return TaskEngineHelpers.CreateTaskExecutionResult(False, False, Nothing, ex.Message)
                End Try
            End If
        End If

        Return TaskEngineHelpers.CreateTaskExecutionResult(True, False, Nothing, Nothing)
    End Function
End Class
