Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports GrammarFlowEngine.Compiler

''' <summary>
''' Handles garbage words (skipped words between nodes)
''' </summary>
Public Module GarbageHandler

    ''' <summary>
    ''' Tries to match children by consuming garbage words
    ''' </summary>
    Public Function TryWithGarbage(
            node As CompiledNode,
            context As PathMatchState,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, PathMatchState, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

        Dim results As New List(Of MatchResult)()
        Dim remainingGarbage = context.MaxGarbage - context.GarbageUsed

        If remainingGarbage <= 0 Then
            Return results
        End If

        ' Get children nodes
        Dim children = node.GetChildren(compiledGrammar)
        If children.Count = 0 Then
            Return results
        End If

        ' Get words from current position
        Dim words = context.Text.GetWordsAt(context.Position)
        If words.Count = 0 Then
            Return results
        End If

        ' Try with 1, 2, ..., remainingGarbage words of garbage
        For garbageCount = 1 To Math.Min(remainingGarbage, words.Count - 1)
            Dim newPosition = context.Text.GetPositionAfterWords(context.Position, garbageCount)

            ' Quick lookahead: if children can't match, skip this garbage count
            If LookaheadChecker.LookaheadFails(children, newPosition, context.Text, compiledGrammar) Then
                Continue For
            End If

            ' Create new context with garbage consumed
            Dim newContext = context.Clone()
            newContext.Position = newPosition
            newContext.GarbageUsed += garbageCount

            ' Try to navigate children
            For Each child In children
                Dim childResults = navigateFunc(child, newContext, visited)
                results.AddRange(childResults)
            Next
        Next

        Return results
    End Function


End Module
