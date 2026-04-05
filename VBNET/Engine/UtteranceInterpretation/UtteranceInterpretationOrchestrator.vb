Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Compiler

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Escalation motori → ParseResult. Single-task (mixed-initiative opzionale altrove).
    ''' </summary>
    Public NotInheritable Class UtteranceInterpretationOrchestrator

        Private ReadOnly _consumeMatched As Boolean

        Public Sub New(Optional consumeMatched As Boolean = True)
            _consumeMatched = consumeMatched
        End Sub

        Public Function ParseSingleTask(
            utterance As String,
            current As CompiledUtteranceTask,
            engines As IReadOnlyList(Of IUtteranceInterpretationEngine)
        ) As ParseResult

            Return ExtractTaskInfoFromUtterance(engines, utterance, current).RuntimeResult
        End Function

        Public Function ExtractTaskInfoFromUtterance(
            engines As IReadOnlyList(Of IUtteranceInterpretationEngine),
            utterance As String,
            current As CompiledUtteranceTask
        ) As SingleTaskExtractionResult

            Dim u = If(utterance, String.Empty).Trim()

            Dim r As New SingleTaskExtractionResult With {
                .TaskId = current.Id,
                .UtteranceAfterExtraction = u
            }

            For i = 0 To engines.Count - 1
                Dim parsed = engines(i).Parse(u)

                If parsed IsNot Nothing AndAlso parsed.Success Then
                    r.Success = True
                    r.EngineIndexUsed = i
                    r.RuntimeResult = ParseResultBuilder.BuildParseResult(parsed, u, _consumeMatched)

                    If _consumeMatched AndAlso Not String.IsNullOrEmpty(parsed.MatchedText) Then
                        r.UtteranceAfterExtraction = UtteranceRemainder.RemoveFirstMatchedPortion(u, parsed.MatchedText)
                    End If

                    Return r
                End If
            Next

            r.Success = False
            r.EngineIndexUsed = -1
            r.RuntimeResult = ParseResult.NoMatch(u)
            Return r
        End Function

        ''' <summary>
        ''' Mixed-initiative: applica main e altri task sul residuo progressivo (secondo order).
        ''' </summary>
        Public Function InterpretUtterance(
            main As TaskEngineBundle,
            otherTasks As IReadOnlyList(Of TaskEngineBundle),
            utterance As String,
            order As MixedInitiativeOrder
        ) As UtteranceInterpretationSessionResult

            Dim session As New UtteranceInterpretationSessionResult()
            Dim current = If(utterance, String.Empty).Trim()

            If order = MixedInitiativeOrder.OthersFirstThenMain Then
                current = RunOtherTasks(otherTasks, current, session)
                current = RunMain(main, current, session)
            Else
                current = RunMain(main, current, session)
                current = RunOtherTasks(otherTasks, current, session)
            End If

            session.FinalUtteranceRemainder = current
            Return session
        End Function

        Private Function RunMain(main As TaskEngineBundle, utterance As String, session As UtteranceInterpretationSessionResult) As String
            If main Is Nothing OrElse String.IsNullOrWhiteSpace(main.TaskId) Then Return utterance
            Dim ext = ExtractTaskInfoFromUtterance(main.Engines, utterance, main.ParsableTask)
            ext.TaskId = main.TaskId
            session.PerTaskResults.Add(ext)
            Return ext.UtteranceAfterExtraction
        End Function

        Private Function RunOtherTasks(
            others As IReadOnlyList(Of TaskEngineBundle),
            utterance As String,
            session As UtteranceInterpretationSessionResult
        ) As String

            Dim u = utterance
            If others Is Nothing Then Return u

            For Each bundle In others
                If bundle Is Nothing OrElse String.IsNullOrWhiteSpace(bundle.TaskId) Then Continue For
                Dim ext = ExtractTaskInfoFromUtterance(bundle.Engines, u, bundle.ParsableTask)
                ext.TaskId = bundle.TaskId
                session.PerTaskResults.Add(ext)
                u = ext.UtteranceAfterExtraction
            Next

            Return u
        End Function

    End Class

End Namespace
