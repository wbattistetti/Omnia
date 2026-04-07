' Parser.vb
' Interprete utterance: solo UtteranceInterpretationParse (task.Engines).

Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports Compiler
Imports TaskEngine.Models
Imports TaskEngine
Imports TaskEngine.UtteranceInterpretation
Imports IParsableTask = TaskEngine.IParsableTask
Imports Compiler.DTO.Runtime

''' <summary>
''' Interprets user utterances for a CompiledUtteranceTask via UtteranceInterpretationParse (cascade engines).
''' </summary>
Public Class Parser

    ''' <summary>
    ''' Parses an utterance in the context of the current task.
    ''' Returns NoInput when utterance is empty or null.
    ''' </summary>
    Public Function Parse(utterance As String, current As IParsableTask, Optional currentStepType As DialogueStepType = DialogueStepType.Start) As ParseResult
        If String.IsNullOrEmpty(utterance) Then
            Return New ParseResult() With {.Result = ParseResultType.NoInput}
        End If

        If currentStepType = DialogueStepType.Confirmation Then
            Return ParseConfirmation(utterance, current)
        End If

        Dim utt = TryCast(current, CompiledUtteranceTask)
        If utt Is Nothing Then
            Throw New InvalidOperationException("Expected CompiledUtteranceTask.")
        End If

        If utt.Engines Is Nothing OrElse utt.Engines.Count = 0 Then
            Throw New InvalidOperationException("CompiledUtteranceTask.Engines must be populated.")
        End If

        Return UtteranceInterpretationParse.Parse(utterance, utt)
    End Function

    Private Function ParseConfirmation(utterance As String, current As IParsableTask) As ParseResult
        Dim trimmed = utterance.Trim().ToLower()

        If IsYes(trimmed) Then
            Return New ParseResult() With {.Result = ParseResultType.Confirmed}
        End If

        If IsNo(trimmed) AndAlso trimmed.Length <= 3 Then
            Return New ParseResult() With {.Result = ParseResultType.NotConfirmed}
        End If

        Dim utt = TryCast(current, CompiledUtteranceTask)
        If utt Is Nothing Then
            Throw New InvalidOperationException("Expected CompiledUtteranceTask for confirmation correction.")
        End If

        Dim valueInput As String
        If trimmed.StartsWith("no ") Then
            valueInput = utterance.Trim().Substring(3).Trim()
        ElseIf trimmed.StartsWith("non ") Then
            valueInput = utterance.Trim().Substring(4).Trim()
        Else
            valueInput = utterance.Trim()
        End If

        If String.IsNullOrEmpty(valueInput) Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        If utt.Engines Is Nothing OrElse utt.Engines.Count = 0 Then
            Throw New InvalidOperationException("CompiledUtteranceTask.Engines must be populated.")
        End If

        Dim corrected = UtteranceInterpretationParse.Parse(valueInput, utt)
        If corrected.Result <> ParseResultType.Match OrElse corrected.SlotValues Is Nothing OrElse corrected.SlotValues.Count = 0 Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        Dim extractedData As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        For Each kvp In corrected.SlotValues
            extractedData(kvp.Key) = kvp.Value
        Next

        Dim slotCopy As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        For Each kvp In corrected.SlotValues
            slotCopy(kvp.Key) = kvp.Value
        Next

        Return New ParseResult With {
            .Result = ParseResultType.Corrected,
            .ExtractedData = extractedData,
            .SlotValues = slotCopy,
            .MatchedText = corrected.MatchedText,
            .UnmatchedText = corrected.UnmatchedText,
            .Confidence = corrected.Confidence
        }
    End Function

    Private Shared Function IsYes(input As String) As Boolean
        Dim words As String() = {"sì", "si", "yes", "ok", "va bene", "corretto", "giusto", "esatto", "perfetto", "confermo"}
        Return words.Contains(input)
    End Function

    Private Shared Function IsNo(input As String) As Boolean
        Dim words As String() = {"no", "non", "sbagliato", "errato", "correggi", "modifica", "cambia"}
        Return words.Contains(input)
    End Function

End Class
