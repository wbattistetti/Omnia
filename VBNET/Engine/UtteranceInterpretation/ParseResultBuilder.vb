Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Costruisce ParseResult da UtteranceParseResult (liste uniformi). Nessun ParserExtraction, nessun leaf/composite.
    ''' </summary>
    Public Module ParseResultBuilder

        Public Function BuildParseResult(
            raw As UtteranceParseResult,
            fullUtteranceTrimmed As String,
            consumeMatched As Boolean
        ) As ParseResult

            Dim conf = raw.Confidence
            If conf <= 0R Then conf = 1.0R

            Dim pr As New ParseResult() With {
                .Result = ParseResultType.Match,
                .Confidence = conf,
                .MatchedText = If(raw.MatchedText, String.Empty)
            }

            Dim remainder = fullUtteranceTrimmed
            If consumeMatched AndAlso Not String.IsNullOrEmpty(raw.MatchedText) Then
                remainder = UtteranceRemainder.RemoveFirstMatchedPortion(fullUtteranceTrimmed, raw.MatchedText)
            End If
            pr.UnmatchedText = remainder

            pr.ExtractedVariables = BuildExtractedVariables(raw.Extractions)
            Return pr
        End Function

        Private Function BuildExtractedVariables(extractions As List(Of UniformExtraction)) As List(Of ExtractedVariable)
            Dim list As New List(Of ExtractedVariable)()
            If extractions Is Nothing OrElse extractions.Count = 0 Then
                Return list
            End If

            For Each ex In extractions
                list.Add(New ExtractedVariable(ex.TaskInstanceId, ex.NodeId, ex.SemanticValue))
            Next
            Return list
        End Function

    End Module

End Namespace
