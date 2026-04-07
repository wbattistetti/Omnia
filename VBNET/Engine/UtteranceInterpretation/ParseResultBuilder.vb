Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Proietta <see cref="EngineResult"/> (estrazione NLP) nel <see cref="ParseResult"/> usato dal motore dialogo
''' (slot values, conferme e validazioni restano responsabilità di <see cref="Parser"/> / executor).
''' </summary>
Public Module ParseResultBuilder

    ''' <summary>
    ''' Costruisce <see cref="ParseResult"/> con <see cref="ParseResultType.Match"/> da un <see cref="EngineResult"/>.
    ''' </summary>
    Public Function BuildParseResultFromEngineResult(
            engResult As EngineResult,
            fullUtteranceTrimmed As String,
            consumeMatched As Boolean
        ) As ParseResult

        If engResult Is Nothing OrElse Not engResult.Success Then
            Return ParseResult.NoMatch(fullUtteranceTrimmed)
        End If

        Dim pr As New ParseResult() With {
            .Result = ParseResultType.Match,
            .Confidence = 1.0R,
            .MatchedText = If(engResult.MatchedText, String.Empty)
        }

        If consumeMatched Then
            pr.UnmatchedText = If(engResult.UnmatchedText, String.Empty).Trim()
        Else
            pr.UnmatchedText = fullUtteranceTrimmed
        End If

        If engResult.Matches IsNot Nothing Then
            For Each m In engResult.Matches
                If m Is Nothing OrElse String.IsNullOrEmpty(m.Guid) Then Continue For
                pr.SlotValues(m.Guid) = m.Value
            Next
        End If

        Return pr
    End Function

End Module
