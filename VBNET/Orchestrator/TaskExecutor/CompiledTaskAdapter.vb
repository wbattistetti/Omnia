Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports System.Linq

''' <summary>
''' Adapter to convert CompiledUtteranceTask.Steps to TaskEngine.TaskStep
''' Moved here from TaskEngine to avoid circular dependency
''' </summary>
Public Module CompiledTaskAdapter
    ''' <summary>
    ''' Creates DialogueContext from CompiledUtteranceTask
    ''' Converts CompiledUtteranceTask.Steps (TaskEngine.DialogueStep) to TaskEngine.TaskStep
    ''' </summary>
    Public Function CreateDialogueContextFromTask(task As CompiledUtteranceTask) As DialogueContext
        Dim steps As New List(Of TaskStep)()

        ' Convert CompiledUtteranceTask.Steps (TaskEngine.DialogueStep) to TaskEngine.TaskStep
        If task.Steps IsNot Nothing Then
            For Each compiledStep In task.Steps
                Dim dialogueStep As New TaskStep() With {
                    .Name = compiledStep.Type.ToString(),
                    .RequiresUserInput = (compiledStep.Type = DialogueState.Start OrElse
                                         compiledStep.Type = DialogueState.Confirmation OrElse
                                         compiledStep.Type = DialogueState.Invalid),
                    .Microtasks = New List(Of Microtask)()
                }

                ' Convert Escalations to Microtasks
                If compiledStep.Escalations IsNot Nothing Then
                    Dim microtaskIndex = 0
                    For Each escalation In compiledStep.Escalations
                        If escalation.Tasks IsNot Nothing Then
                            For Each taskObj In escalation.Tasks
                                ' Convert MessageTask to SendMessage microtask
                                If TypeOf taskObj Is MessageTask Then
                                    Dim msgTask = DirectCast(taskObj, MessageTask)
                                    dialogueStep.Microtasks.Add(New Microtask() With {
                                        .Index = microtaskIndex,
                                        .Type = MicrotaskType.SendMessage,
                                        .Data = msgTask.TextKey
                                    })
                                    microtaskIndex += 1
                                End If
                                ' TODO: Convert other task types to microtasks (BackendCall, etc.)
                            Next
                        End If
                    Next
                End If

                steps.Add(dialogueStep)
            Next
        End If

        Return New DialogueContext() With {
            .TaskId = task.Id,
            .Steps = steps,
            .CurrentStepIndex = Nothing,
            .CurrentStep = Nothing,
            .StepExecutionState = Nothing
        }
    End Function
End Module
