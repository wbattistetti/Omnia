' TurnResult.vb
' Represents the result of one dialogue turn.

Option Strict On
Option Explicit On

''' <summary>
''' Indicates the outcome of a single dialogue turn.
''' </summary>
Public Enum TurnStatus
    ''' <summary>Prompt shown; waiting for user utterance.</summary>
    WaitingForInput
    ''' <summary>Non-utterance step executed; loop should continue.</summary>
    [Continue]
    ''' <summary>All tasks completed successfully.</summary>
    Completed
    ''' <summary>Session terminated via CloseSession or Transfer task.</summary>
    SessionClosed
End Enum

''' <summary>
''' Result returned by Motore.ExecuteTurn or Motore.ProcessInput.
''' </summary>
Public Class TurnResult
    Public Property Status As TurnStatus
    Public Property Message As String

    Public Sub New(status As TurnStatus, Optional message As String = "")
        Me.Status = status
        Me.Message = If(message, "")
    End Sub

    Public Shared ReadOnly Property Completed As TurnResult
        Get
            Return New TurnResult(TurnStatus.Completed)
        End Get
    End Property

    Public Shared ReadOnly Property [Continue] As TurnResult
        Get
            Return New TurnResult(TurnStatus.Continue)
        End Get
    End Property

    Public Shared ReadOnly Property SessionClosed As TurnResult
        Get
            Return New TurnResult(TurnStatus.SessionClosed)
        End Get
    End Property

    Public Shared Function WaitingForInput(Optional message As String = "") As TurnResult
        Return New TurnResult(TurnStatus.WaitingForInput, message)
    End Function
End Class
