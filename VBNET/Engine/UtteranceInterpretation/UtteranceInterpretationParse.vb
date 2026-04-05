Option Strict On
Option Explicit On

Imports Compiler
Imports TaskEngine

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Black box: escalation su task.Engines → primo Success → ParseResult.
    ''' </summary>
    Public Module UtteranceInterpretationParse

        ''' <summary>
        ''' Interpreta l'utterance usando i motori registrati sul task (ordine = escalation).
        ''' </summary>
        Public Function Parse(utterance As String, task As CompiledUtteranceTask) As ParseResult
            If String.IsNullOrWhiteSpace(utterance) Then
                Return ParseResult.NoMatch()
            End If

            Dim u = utterance.Trim()

            For Each engineObj In task.Engines
                Dim engine = DirectCast(engineObj, IUtteranceInterpretationEngine)
                Dim r = engine.Parse(u)
                If r IsNot Nothing AndAlso r.Success Then
                    Return ParseResultBuilder.BuildParseResult(r, u, consumeMatched:=True)
                End If
            Next

            Return ParseResult.NoMatch(u)
        End Function

    End Module

End Namespace
