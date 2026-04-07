Option Strict On
Option Explicit On

Imports TaskEngine

''' <summary>Un solo loop: ordine del cluster attivo; <see cref="DialogueState.SetVariable"/> per ogni match.</summary>
Public Module MixedInitiative

    ''' <summary>Parsing MI lineare sul cluster attivo (current per primo).</summary>
    Public Function Parse(
            utterance As String,
            state As DialogueState,
            cluster As IReadOnlyList(Of IUtteranceTask)
        ) As MixedInitiativeResult

        If state Is Nothing Then Throw New ArgumentNullException(NameOf(state))
        If cluster Is Nothing Then Throw New ArgumentNullException(NameOf(cluster))

        Dim remainder = If(utterance, "").Trim()
        Dim hasAny As Boolean = False

        For Each task In cluster
            If task Is Nothing Then Continue For
            Dim r = task.Parse(remainder)
            If r IsNot Nothing AndAlso r.Success Then
                hasAny = True
                If r.Matches IsNot Nothing Then
                    For Each m In r.Matches
                        If m Is Nothing OrElse String.IsNullOrEmpty(m.Guid) Then Continue For
                        state.SetVariable(m.Guid, m.Value)
                    Next
                End If
                remainder = If(r.UnmatchedText, "").Trim()
            End If
        Next

        Return New MixedInitiativeResult With {
            .HasMatches = hasAny,
            .FinalRemainder = remainder
        }
    End Function

End Module
