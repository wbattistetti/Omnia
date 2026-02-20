' TaskUtteranceStateMachine.vb
' State machine logic for TaskUtterance (ApplyParseResult).

Option Strict On
Option Explicit On

''' <summary>
''' State machine behaviour for TaskUtterance.
''' Handles all parse result types and updates State accordingly.
''' </summary>
Partial Public Class TaskUtterance

    ''' <summary>
    ''' Applies a parse result and transitions the local state machine.
    ''' Handles: NoInput, NoMatch, IrrelevantMatch, NotConfirmed, Corrected, Match, Confirmed.
    ''' </summary>
    Public Sub ApplyParseResult(parseResult As ParseResult)
        If parseResult Is Nothing Then
            Throw New ArgumentNullException(NameOf(parseResult), "ParseResult cannot be Nothing.")
        End If

        Select Case parseResult.Result

            Case ParseResultType.NoInput
                State = DialogueState.NoInput

            Case ParseResultType.NoMatch
                State = DialogueState.NoMatch

            Case ParseResultType.IrrelevantMatch
                State = DialogueState.IrrelevantMatch

            Case ParseResultType.NotConfirmed
                ' User rejected the confirmation: clear value and restart acquisition.
                Value = Nothing
                For Each child As TaskUtterance In SubTasks
                    child.Value = Nothing
                    child.State = DialogueState.Start
                Next
                State = DialogueState.Start

            Case ParseResultType.Corrected
                ' User provided a correction while in Confirmation state.
                ' Value already updated by Parser; stay in Confirmation to re-confirm.
                State = DialogueState.Confirmation

            Case ParseResultType.Match
                ' Value already set by Parser on this node or its sub-nodes.
                ' Determine the authoritative node (parent for sub-data).
                Dim target As TaskUtterance = If(IsSubData(), ParentData, Me)

                If Not target.IsFilled() Then
                    ' More sub-data still needed.
                    target.State = DialogueState.Start
                    Exit Sub
                End If

                If target.RequiresConfirmation Then
                    target.State = DialogueState.Confirmation
                    Exit Sub
                End If

                If target.RequiresValidation Then
                    target.State = DialogueState.Invalid
                    target.InvalidConditionId = parseResult.ConditionId
                    Exit Sub
                End If

                target.State = DialogueState.Success

            Case ParseResultType.Confirmed
                ' User confirmed the data.
                If RequiresValidation Then
                    State = DialogueState.Invalid
                    InvalidConditionId = parseResult.ConditionId
                    Exit Sub
                End If
                State = DialogueState.Success

            Case Else
                Throw New InvalidOperationException($"Unhandled ParseResultType: {parseResult.Result}.")

        End Select
    End Sub

End Class
