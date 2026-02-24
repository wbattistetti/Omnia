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
    ''' </summary>
    Public Async Function ExecuteTask(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        Try
            Select Case task.TaskType
                Case TaskTypes.UtteranceInterpretation
                    Return Await ExecuteTaskUtterance(DirectCast(task, CompiledUtteranceTask), state)
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
    ' UTTERANCE TASK (with microtask loop and crash resilience)
    ' ==========================================================================

    ''' <summary>
    ''' Entry point for UtteranceInterpretation tasks
    ''' Loads/creates DialogueContext and starts DDT pipeline
    ''' </summary>
    Private Async Function ExecuteTaskUtterance(task As CompiledUtteranceTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' Verify it has steps
        If task.Steps Is Nothing OrElse task.Steps.Count = 0 Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Utterance task has no steps"
            }
        End If

        ' Load or create DialogueContext
        Dim ctx As DialogueContext
        If state.DialogueContexts IsNot Nothing AndAlso state.DialogueContexts.ContainsKey(task.Id) Then
            ' Load saved DialogueContext (for async input or crash recovery)
            Dim savedCtxJson = state.DialogueContexts(task.Id)
            ctx = JsonConvert.DeserializeObject(Of DialogueContext)(savedCtxJson)
        Else
            ' Create new DialogueContext from CompiledTask
            ctx = CompiledTaskAdapter.CreateDialogueContextFromTask(task)
            ' Initialize DialogueState
            If ctx.DialogueState Is Nothing Then
                ctx.DialogueState = InitializeDialogueState(task)
            End If
        End If

        ' Execute DDT pipeline with microtask loop
        ctx = Await ExecuteTaskUtterancePipeline(task, ctx)

        ' Determine if it requires user input
        Dim requiresInput = ctx.CurrentStep IsNot Nothing AndAlso ctx.CurrentStep.RequiresUserInput

        ' Save DialogueContext in ExecutionState (for FlowOrchestrator)
        Dim newCtxJson = JsonConvert.SerializeObject(ctx)
        state.DialogueContexts(task.Id) = newCtxJson

        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = requiresInput,
            .WaitingTaskId = If(requiresInput, task.Id, Nothing),
            .Err = Nothing
        }
    End Function

    ''' <summary>
    ''' Main DDT pipeline for UtteranceInterpretation
    ''' Porting of runDDT from TypeScript
    ''' Contains microtask loop with fine-grained tracking (StepExecutionState)
    ''' </summary>
    Private Async Function ExecuteTaskUtterancePipeline(task As CompiledUtteranceTask, ctx As DialogueContext) As System.Threading.Tasks.Task(Of DialogueContext)
        Dim currentCtx = ctx
        Dim limits As New Limits() ' Default limits

        ' Main DDT loop
        While True
            ' 1. Find next data to collect
            Dim currData = GetNextData(task, currentCtx.DialogueState)
            If currData Is Nothing Then
                ' All data collected → task completed
                Await _stateStorage.SaveDialogueContext(task.Id, currentCtx)
                Return currentCtx
            End If

            ' 2. Determine current node state
            Dim nodeState = GetNodeState(currentCtx.DialogueState, currData.NodeId)
            Dim turnState = nodeState.Item1
            Dim counters = nodeState.Item2

            ' 3. Select response (step/escalation) to show
            Dim response = SelectResponse(task, currData, turnState, counters, limits)

            ' 4. Build microtasks from response
            Dim microtasks = BuildMicrotasksFromResponse(response)

            ' 5. Update CurrentStep in context (for microtask execution)
            Dim responseStep As New TaskStep() With {
                .Name = response.StepType,
                .RequiresUserInput = (response.StepType = "start" OrElse response.StepType = "confirmation"),
                .Microtasks = microtasks
            }
            currentCtx.CurrentStep = responseStep
            currentCtx.CurrentData = currData

            ' 6. Initialize StepExecutionState if needed
            Dim stepState As StepExecutionState
            If currentCtx.StepExecutionState IsNot Nothing AndAlso
               currentCtx.StepExecutionState.StepName = responseStep.Name Then
                stepState = currentCtx.StepExecutionState
            Else
                stepState = New StepExecutionState() With {
                    .StepName = responseStep.Name,
                    .MicrotaskIndex = -1  ' -1 = no microtask executed
                }
            End If

            ' 7. Execute microtasks with fine-grained tracking
            If microtasks IsNot Nothing Then
                For Each microtask In microtasks
                    ' Check if microtask should be executed
                    If microtask.Index > stepState.MicrotaskIndex Then
                        ' Execute microtask (isolated side effect, async)
                        Await ExecuteMicrotask(microtask)

                        ' Update state
                        stepState = New StepExecutionState() With {
                            .StepName = responseStep.Name,
                            .MicrotaskIndex = microtask.Index
                        }
                        currentCtx.StepExecutionState = stepState

                        ' Commit microtask: save DialogueContext with updated StepExecutionState
                        ' This allows crash recovery without duplications
                        Await _stateStorage.SaveDialogueContext(task.Id, currentCtx)
                    End If
                Next
            End If

            ' 8. Step completed: reset StepExecutionState
            currentCtx.StepExecutionState = Nothing
            Await _stateStorage.SaveDialogueContext(task.Id, currentCtx)

            ' 9. If step requires input, stop here
            If responseStep.RequiresUserInput Then
                Return currentCtx
            End If

            ' 10. If NoMatch/NoInput, show escalation and return to Start
            If turnState = TurnState.NoMatch OrElse turnState = TurnState.NoInput Then
                ' Increment counter (already done in SelectResponse)
                ' Show escalation (already done via microtasks)
                ' Return to Start
                currentCtx.DialogueState.TurnState = TurnState.Start
                currentCtx.DialogueState.Context = If(currData.IsMain, "CollectingMain", "CollectingSub")
                Continue While
            End If

            ' 11. Update DialogueState for next iteration
            ' (TurnState transitions are handled by ComputeTurnState when user input is provided)
            ' For now, continue loop
        End While
    End Function

    ' ==========================================================================
    ' DDT LOGIC: Pure functions (ported from TypeScript)
    ' ==========================================================================

    ''' <summary>
    ''' Initialize DialogueState for a new task
    ''' </summary>
    Private Function InitializeDialogueState(task As CompiledUtteranceTask) As DialogueState
        Return New DialogueState() With {
            .Memory = New Dictionary(Of String, Object)(),
            .Counters = New Dictionary(Of String, Counters)(),
            .TurnState = TurnState.Start,
            .Context = "CollectingMain",
            .CurrentDataId = Nothing
        }
    End Function

    ''' <summary>
    ''' Get next data to collect (ported from getNextData)
    ''' Returns CurrentData with NodeId (not full RuntimeTask)
    ''' </summary>
    Private Function GetNextData(task As CompiledUtteranceTask, dialogueState As DialogueState) As CurrentData
        ' If collecting sub data, return current sub
        If dialogueState.Context = "CollectingSub" AndAlso Not String.IsNullOrEmpty(dialogueState.CurrentDataId) Then
            ' Find main data that contains this sub
            Dim mainDataId = FindMainDataForSub(task, dialogueState.CurrentDataId)
            If Not String.IsNullOrEmpty(mainDataId) Then
                Return New CurrentData() With {
                    .NodeId = dialogueState.CurrentDataId,
                    .IsMain = False,
                    .MainDataId = mainDataId,
                    .SubDataId = dialogueState.CurrentDataId
                }
            End If
        End If

        ' Otherwise, find first main data not collected
        Dim firstMain = FindFirstUncollectedMainData(task, dialogueState)
        If firstMain IsNot Nothing Then
            Return New CurrentData() With {
                .NodeId = firstMain,
                .IsMain = True,
                .MainDataId = firstMain,
                .SubDataId = Nothing
            }
        End If

        ' All data collected
        Return Nothing
    End Function

    ''' <summary>
    ''' Get node state (TurnState and Counters) for a node
    ''' </summary>
    Private Function GetNodeState(dialogueState As DialogueState, nodeId As String) As Tuple(Of TurnState, Counters)
        Dim turnState = dialogueState.TurnState
        Dim counters As Counters = Nothing

        If dialogueState.Counters.ContainsKey(nodeId) Then
            counters = dialogueState.Counters(nodeId)
        Else
            counters = New Counters()
            dialogueState.Counters(nodeId) = counters
        End If

        Return New Tuple(Of TurnState, Counters)(turnState, counters)
    End Function

    ''' <summary>
    ''' Select response (step/escalation) to show (ported from getResponse)
    ''' </summary>
    Private Function SelectResponse(task As CompiledUtteranceTask, currData As CurrentData, turnState As TurnState, counters As Counters, limits As Limits) As Response
        ' Find step for current data node
        Dim currentStep As DialogueStep = FindStepForNode(task, currData.NodeId)
        If currentStep Is Nothing Then
            ' No step found → use first step as fallback
            If task.Steps IsNot Nothing AndAlso task.Steps.Count > 0 Then
                currentStep = DirectCast(task.Steps(0), DialogueStep)
            Else
                Return New Response() With {
                    .StepType = "start",
                    .StepOrEscalation = Nothing,
                    .EscalationLevel = 0
                }
            End If
        End If

        ' Select escalation based on turnState and counters
        Dim escalationLevel = 0
        Select Case turnState
            Case TurnState.NoMatch
                escalationLevel = Math.Min(counters.NoMatch, If(currentStep.Escalations IsNot Nothing, currentStep.Escalations.Count - 1, 0))
                counters.NoMatch += 1
                ' Return the step with escalation level info
                Return New Response() With {
                    .StepType = "noMatch",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = escalationLevel
                }

            Case TurnState.NoInput
                escalationLevel = Math.Min(counters.NoInput, If(currentStep.Escalations IsNot Nothing, currentStep.Escalations.Count - 1, 0))
                counters.NoInput += 1
                ' Return the step with escalation level info
                Return New Response() With {
                    .StepType = "noInput",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = escalationLevel
                }

            Case TurnState.Confirmation
                Return New Response() With {
                    .StepType = "confirmation",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = 0
                }

            Case TurnState.Start
                Return New Response() With {
                    .StepType = "start",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = 0
                }

            Case TurnState.Success
                Return New Response() With {
                    .StepType = "success",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = 0
                }

            Case Else
                Return New Response() With {
                    .StepType = "start",
                    .StepOrEscalation = currentStep,
                    .EscalationLevel = 0
                }
        End Select
    End Function

    ''' <summary>
    ''' Build microtasks from Response
    ''' </summary>
    Private Function BuildMicrotasksFromResponse(response As Response) As List(Of Microtask)
        Dim microtasks As New List(Of Microtask)()
        Dim index = 0

        If response.StepOrEscalation IsNot Nothing Then
            ' Extract tasks from step or escalation
            Dim tasks = ExtractTasksFromStepOrEscalation(response.StepOrEscalation)

            For Each taskObj In tasks
                ' Convert MessageTask to SendMessage microtask
                If TypeOf taskObj Is MessageTask Then
                    Dim msgTask = DirectCast(taskObj, MessageTask)
                    microtasks.Add(New Microtask() With {
                        .Index = index,
                        .Type = MicrotaskType.SendMessage,
                        .Data = msgTask.TextKey
                    })
                    index += 1
                End If
                ' TODO: Convert other task types (BackendCall, etc.)
            Next
        End If

        Return microtasks
    End Function

    ''' <summary>
    ''' Process user input and produce TurnEvent (ported from processUserInput)
    ''' NOTE: This is called when user provides input, not during initial execution
    ''' </summary>
    Public Async Function ProcessUserInput(task As CompiledUtteranceTask, ctx As DialogueContext, userInput As String) As System.Threading.Tasks.Task(Of TurnEvent)
        ' TODO: Implement NLP interpretation
        ' For now, return Match as default
        ' This should call NLP contract to interpret input
        Return TurnEvent.Match
    End Function

    ''' <summary>
    ''' Compute next TurnState based on TurnEvent (ported from getState)
    ''' </summary>
    Public Function ComputeTurnState(turnEvent As TurnEvent, currData As CurrentData, prevState As TurnState, counters As Counters, limits As Limits, dialogueState As DialogueState, task As CompiledUtteranceTask) As TurnStateDescriptor
        Select Case turnEvent
            Case TurnEvent.Match
                If prevState = TurnState.Start Then
                    ' First match → check if collecting sub or main
                    If dialogueState.Context = "CollectingSub" Then
                        ' Check if sub has missing required subs
                        Dim subNode = FindNodeById(task, currData.SubDataId)
                        If subNode IsNot Nothing Then
                            Dim missingSubs = FindMissingRequiredSubs(subNode, dialogueState.Memory)
                            If missingSubs.Count > 0 Then
                                Return New TurnStateDescriptor() With {
                                    .TurnState = TurnState.Start,
                                    .Context = "CollectingSub",
                                    .Counter = 0,
                                    .NextDataId = missingSubs(0).Id
                                }
                            End If
                        End If
                        ' All subs filled → confirmation or success
                        Dim mainNode = FindNodeById(task, currData.MainDataId)
                        If mainNode IsNot Nothing AndAlso RequiresConfirmation(mainNode) Then
                            Return New TurnStateDescriptor() With {
                                .TurnState = TurnState.Confirmation,
                                .Context = "CollectingMain",
                                .Counter = 0
                            }
                        Else
                            Return New TurnStateDescriptor() With {
                                .TurnState = TurnState.Success,
                                .Context = "CollectingMain",
                                .Counter = 0
                            }
                        End If
                    Else
                        ' CollectingMain
                        Dim mainNode = FindNodeById(task, currData.MainDataId)
                        If mainNode IsNot Nothing Then
                            Dim missingSubs = FindMissingRequiredSubs(mainNode, dialogueState.Memory)
                            If missingSubs.Count > 0 Then
                                Return New TurnStateDescriptor() With {
                                    .TurnState = TurnState.Start,
                                    .Context = "CollectingSub",
                                    .Counter = 0,
                                    .NextDataId = missingSubs(0).Id
                                }
                            Else
                                ' All subs filled → confirmation or success
                                If RequiresConfirmation(mainNode) Then
                                    Return New TurnStateDescriptor() With {
                                        .TurnState = TurnState.Confirmation,
                                        .Context = "CollectingMain",
                                        .Counter = 0
                                    }
                                Else
                                    Return New TurnStateDescriptor() With {
                                        .TurnState = TurnState.Success,
                                        .Context = "CollectingMain",
                                        .Counter = 0
                                    }
                                End If
                            End If
                        End If
                    End If
                End If
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.Success,
                    .Context = dialogueState.Context,
                    .Counter = 0
                }

            Case TurnEvent.NoMatch
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.NoMatch,
                    .Context = dialogueState.Context,
                    .Counter = counters.NoMatch
                }

            Case TurnEvent.NoInput
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.NoInput,
                    .Context = dialogueState.Context,
                    .Counter = counters.NoInput
                }

            Case TurnEvent.Confirmed
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.Success,
                    .Context = dialogueState.Context,
                    .Counter = 0
                }

            Case TurnEvent.NotConfirmed
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.NotConfirmed,
                    .Context = dialogueState.Context,
                    .Counter = counters.NotConfirmed
                }

            Case Else
                Return New TurnStateDescriptor() With {
                    .TurnState = TurnState.Start,
                    .Context = dialogueState.Context,
                    .Counter = 0
                }
        End Select
    End Function

    ' ==========================================================================
    ' HELPER FUNCTIONS
    ' ==========================================================================

    ''' <summary>
    ''' Find missing required sub data (ported from findMissingRequiredSubs)
    ''' </summary>
    Private Function FindMissingRequiredSubs(node As DialogueStep, memory As Dictionary(Of String, Object)) As List(Of DialogueStep)
        Dim missingSubs As New List(Of DialogueStep)()
        ' TODO: Implement based on node structure
        ' For now, return empty list
        Return missingSubs
    End Function

    ''' <summary>
    ''' Check if node requires confirmation (ported from requiresConfirmation)
    ''' </summary>
    Private Function RequiresConfirmation(node As DialogueStep) As Boolean
        ' TODO: Implement based on node structure
        ' For now, return False
        Return False
    End Function

    ''' <summary>
    ''' Find step for a node ID
    ''' </summary>
    Private Function FindStepForNode(task As CompiledUtteranceTask, nodeId As String) As DialogueStep
        If task.Steps IsNot Nothing Then
            For Each dialogueStep In task.Steps
                ' TODO: Match dialogueStep to nodeId based on step structure
                ' For now, return first step
                Return dialogueStep
            Next
        End If
        Return Nothing
    End Function

    ''' <summary>
    ''' Find node by ID (from task structure)
    ''' </summary>
    Private Function FindNodeById(task As CompiledUtteranceTask, nodeId As String) As DialogueStep
        ' TODO: Implement recursive search in task.SubTasks
        ' For now, return Nothing
        Return Nothing
    End Function

    ''' <summary>
    ''' Get escalation by level (returns Escalation, not DialogueStep)
    ''' </summary>
    Private Function GetEscalation(currentStep As DialogueStep, level As Integer) As Escalation
        If currentStep.Escalations IsNot Nothing AndAlso level < currentStep.Escalations.Count Then
            Return currentStep.Escalations(level)
        End If
        Return Nothing
    End Function

    ''' <summary>
    ''' Extract tasks from step or escalation
    ''' </summary>
    Private Function ExtractTasksFromStepOrEscalation(stepOrEscalation As DialogueStep) As List(Of Object)
        Dim tasks As New List(Of Object)()
        ' TODO: Extract tasks from step structure
        ' For now, return empty list
        Return tasks
    End Function

    ''' <summary>
    ''' Find main data for a sub data ID
    ''' </summary>
    Private Function FindMainDataForSub(task As CompiledUtteranceTask, subDataId As String) As String
        ' TODO: Implement recursive search
        Return Nothing
    End Function

    ''' <summary>
    ''' Find first uncollected main data
    ''' </summary>
    Private Function FindFirstUncollectedMainData(task As CompiledUtteranceTask, dialogueState As DialogueState) As String
        ' TODO: Implement recursive search
        ' For now, return first step ID as placeholder
        If task.Steps IsNot Nothing AndAlso task.Steps.Count > 0 Then
            Dim firstStep = DirectCast(task.Steps(0), DialogueStep)
            Return If(firstStep IsNot Nothing, firstStep.Id, Nothing)
        End If
        Return Nothing
    End Function

    ' ==========================================================================
    ' PURE LOGIC: calculate next context (DEPRECATED - replaced by DDT logic)
    ' ==========================================================================

    ''' <summary>
    ''' Calculates next context (pure function)
    ''' DEPRECATED: Replaced by DDT logic in ExecuteTaskUtterancePipeline
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
