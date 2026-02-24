Option Strict On
Option Explicit On

''' <summary>
''' Dialogue context (minimal, without old engine)
''' </summary>
Public Class DialogueContext
    ''' <summary>
    ''' Task ID
    ''' </summary>
    Public Property TaskId As String

    ''' <summary>
    ''' Steps from CompiledTask.Steps
    ''' </summary>
    Public Property Steps As List(Of TaskStep)

    ''' <summary>
    ''' Current step index (null if no step)
    ''' </summary>
    Public Property CurrentStepIndex As Integer?

    ''' <summary>
    ''' Current step (null if no step)
    ''' </summary>
    Public Property CurrentStep As TaskStep

    ''' <summary>
    ''' Step execution state (null if no step in progress)
    ''' </summary>
    Public Property StepExecutionState As StepExecutionState

    ''' <summary>
    ''' Creates a clone of the context (for immutability)
    ''' </summary>
    Public Function Clone() As DialogueContext
        Return New DialogueContext() With {
            .TaskId = Me.TaskId,
            .Steps = If(Me.Steps IsNot Nothing, New List(Of TaskStep)(Me.Steps), Nothing),
            .CurrentStepIndex = Me.CurrentStepIndex,
            .CurrentStep = Me.CurrentStep,
            .StepExecutionState = If(Me.StepExecutionState IsNot Nothing,
                New StepExecutionState() With {
                    .StepName = Me.StepExecutionState.StepName,
                    .MicrotaskIndex = Me.StepExecutionState.MicrotaskIndex
                }, Nothing)
        }
    End Function
End Class
