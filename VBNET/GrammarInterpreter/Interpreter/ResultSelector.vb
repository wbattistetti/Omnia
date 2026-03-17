Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Selects the best results from multiple match attempts
    ''' </summary>
    Public Module ResultSelector

        ''' <summary>
        ''' Selects the best results based on:
        ''' 1. Most bindings extracted
        ''' 2. Least garbage used
        ''' 3. Most text consumed (most complete match)
        ''' </summary>
        Public Function SelectBestResults(results As List(Of MatchResult)) As List(Of MatchResult)
            If results Is Nothing OrElse results.Count = 0 Then
                Return New List(Of MatchResult)()
            End If

            ' Filter only successful results
            Dim successfulResults = results.Where(Function(r) r.Success).ToList()
            If Not successfulResults.Any() Then
                Return New List(Of MatchResult)()
            End If

            ' Sort by criteria (in order of priority)
            Dim sorted = successfulResults.OrderByDescending(Function(r) r.Bindings.Count) _
                                          .ThenBy(Function(r) r.GarbageUsed) _
                                          .ThenByDescending(Function(r) r.ConsumedWords) _
                                          .ToList()

            ' Get the best score
            Dim best = sorted.First()
            Dim bestScore = (best.Bindings.Count, best.GarbageUsed, best.ConsumedWords)

            ' Return all results with the same score as the best
            Return sorted.Where(Function(r)
                Return r.Bindings.Count = bestScore.Item1 AndAlso
                       r.GarbageUsed = bestScore.Item2 AndAlso
                       r.ConsumedWords = bestScore.Item3
            End Function).ToList()
        End Function

    End Module

End Namespace
