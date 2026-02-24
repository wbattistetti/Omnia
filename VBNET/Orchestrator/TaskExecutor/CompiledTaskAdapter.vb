Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports System.Linq

''' <summary>
''' Adapter to convert CompiledUtteranceTask.Steps to TaskEngine.TaskStep
''' </summary>
Public Module CompiledTaskAdapter
    ''' <summary>
    ''' Creates DialogueContext from CompiledUtteranceTask
    ''' Converts CompiledUtteranceTask.Steps (TaskEngine.DialogueStep) to TaskEngine.TaskStep
    ''' </summary>
    Public Function CreateDialogueContextFromTask(task As CompiledUtteranceTask) As TaskEngine.DialogueContext
        Dim steps As New List(Of TaskEngine.TaskStep)()

        ' Convert CompiledUtteranceTask.Steps to TaskStep
        If task.Steps IsNot Nothing Then
            For Each compiledStep In task.Steps
                Dim dialogueStep As New TaskEngine.TaskStep() With {
                    .Name = compiledStep.Type.ToString(),
                    .RequiresUserInput = (compiledStep.Type = DialogueState.Start OrElse
                                         compiledStep.Type = DialogueState.Confirmation OrElse
                                         compiledStep.Type = DialogueState.Invalid),
                    .Microtasks = New List(Of TaskEngine.Microtask)()
                }

                ' Convert Escalations to Microtasks
                ' Simplified: take current escalation (first one with tasks) and convert its tasks
                If compiledStep.Escalations IsNot Nothing Then
                    Dim microtaskIndex = 0
                    ' Find first escalation with tasks
                    Dim escalation = compiledStep.Escalations.FirstOrDefault(Function(e) e.Tasks IsNot Nothing AndAlso e.Tasks.Count > 0)
                    If escalation IsNot Nothing Then
                        For Each taskObj In escalation.Tasks
                            ' Convert MessageTask to SendMessage microtask
                            If TypeOf taskObj Is MessageTask Then
                                Dim msgTask = DirectCast(taskObj, MessageTask)
                                dialogueStep.Microtasks.Add(New TaskEngine.Microtask() With {
                                    .Index = microtaskIndex,
                                    .Type = TaskEngine.MicrotaskType.SendMessage,
                                    .Data = msgTask.TextKey
                                })
                                microtaskIndex += 1
                            End If
                            ' TODO: Convert other task types to microtasks (BackendCall, etc.)
                        Next
                    End If
                End If

                steps.Add(dialogueStep)
            Next
        End If

        Return New TaskEngine.DialogueContext() With {
            .TaskId = task.Id,
            .Steps = steps,
            .CurrentStepIndex = Nothing,
            .CurrentStep = Nothing,
            .StepExecutionState = Nothing
        }
    End Function
End Module
