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
            .DialogueState = If(Me.DialogueState IsNot Nothing, Me.DialogueState, Nothing),
            .CurrentData = If(Me.CurrentData IsNot Nothing, Me.CurrentData, Nothing),
            .LastTurnEvent = Me.LastTurnEvent
        }
        End Function
    End Class
End Namespace
