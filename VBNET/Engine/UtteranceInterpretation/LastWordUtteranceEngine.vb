Option Strict On
Option Explicit On

Imports System.Text.RegularExpressions
Imports System.Collections.Generic
Imports Compiler

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Demo: ultima parola; emette UniformExtraction con GUID presi dal task (compilatore).
    ''' </summary>
    Public NotInheritable Class LastWordUtteranceEngine
        Implements IUtteranceInterpretationEngine

        Private ReadOnly _displayName As String
        Private ReadOnly _task As CompiledUtteranceTask

        Public Sub New(displayName As String, task As CompiledUtteranceTask)
            _displayName = displayName
            _task = task
        End Sub

        Public ReadOnly Property DisplayName As String Implements IUtteranceInterpretationEngine.DisplayName
            Get
                Return _displayName
            End Get
        End Property

        Public Function Parse(utterance As String) As UtteranceParseResult Implements IUtteranceInterpretationEngine.Parse
            If String.IsNullOrWhiteSpace(utterance) Then
                Return UtteranceParseResult.NoMatch()
            End If

            Dim t = utterance.Trim()
            Dim m = Regex.Match(t, "(\S+)\s*$")
            If Not m.Success Then
                Return UtteranceParseResult.NoMatch()
            End If

            Dim word = m.Groups(1).Value
            Dim result As New UtteranceParseResult With {
                .Success = True,
                .MatchedText = word,
                .Confidence = 1R
            }
            result.Extractions.Add(New UniformExtraction With {
                .TaskInstanceId = _task.Id,
                .NodeId = _task.NodeId,
                .SemanticValue = word,
                .LinguisticSpan = word
            })
            Return result
        End Function

    End Class

End Namespace
