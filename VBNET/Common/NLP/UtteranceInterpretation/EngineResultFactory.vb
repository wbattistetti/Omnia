Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

''' <summary>Costruisce <see cref="EngineResult"/> da una lista di <see cref="ParserMatch"/>.</summary>
Public Module EngineResultFactory

    ''' <summary>
    ''' MatchedText = join degli span linguistici; UnmatchedText = input meno la prima occorrenza di MatchedText.
    ''' Se joined non compare in input, usa <paramref name="fallbackMatchedText"/> (es. intero match regex).
    ''' </summary>
    Public Function FromMatches(
            matches As List(Of ParserMatch),
            inputTrimmed As String,
            Optional fallbackMatchedText As String = Nothing
        ) As EngineResult

        Dim list = If(matches, New List(Of ParserMatch)())
        Dim linguisticParts = list.
                Where(Function(m) m IsNot Nothing).
                Select(Function(m) If(m.Linguistic, String.Empty).Trim()).
                Where(Function(s) s.Length > 0).
                ToList()

        Dim joined = String.Join(" "c, linguisticParts)
        Dim matchedText = joined
        If String.IsNullOrEmpty(matchedText) AndAlso Not String.IsNullOrEmpty(fallbackMatchedText) Then
            matchedText = fallbackMatchedText.Trim()
        End If

        Dim unmatched = inputTrimmed
        If Not String.IsNullOrEmpty(matchedText) Then
            unmatched = RemoveFirstMatchedPortionInternal(inputTrimmed, matchedText)
            If unmatched = inputTrimmed AndAlso Not String.IsNullOrEmpty(fallbackMatchedText) Then
                matchedText = fallbackMatchedText.Trim()
                unmatched = RemoveFirstMatchedPortionInternal(inputTrimmed, matchedText)
            End If
        End If

        Return New EngineResult With {
            .Success = list.Count > 0,
            .MatchedText = If(matchedText, String.Empty),
            .UnmatchedText = If(unmatched, String.Empty).Trim(),
            .Matches = list
        }
    End Function

    Private Function RemoveFirstMatchedPortionInternal(full As String, matched As String) As String
        If String.IsNullOrEmpty(full) Then Return String.Empty
        If String.IsNullOrEmpty(matched) Then Return full.Trim()
        Dim idx = full.IndexOf(matched, StringComparison.Ordinal)
        If idx < 0 Then Return full.Trim()
        Dim before = full.Substring(0, idx)
        Dim after = full.Substring(idx + matched.Length)
        Return (before & after).Trim()
    End Function

End Module
