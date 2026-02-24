Option Strict On
Option Explicit On
Namespace TaskEngine

''' <summary>
''' Dialogue context (minimal, without old engine)
''' Includes DDT state for complete dialogue logic
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
    ''' ✅ NEW: DDT DialogueState (memory, counters, turnState)
    ''' </summary>
    Public Property DialogueState As DialogueState

    ''' <summary>
    ''' ✅ NEW: Current data being collected (only NodeId, not full RuntimeTask)
    ''' </summary>
    Public Property CurrentData As CurrentData

    ''' <summary>
    ''' ✅ NEW: Last TurnEvent (result of user input interpretation)
    ''' </summary>
    Public Property LastTurnEvent As TurnEvent?

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
                }, Nothing),
            .DialogueState = If(Me.DialogueState IsNot Nothing, Me.DialogueState, Nothing),
            .CurrentData = If(Me.CurrentData IsNot Nothing, Me.CurrentData, Nothing),
            .LastTurnEvent = Me.LastTurnEvent
        }
        End Function
    End Class
End Namespace
