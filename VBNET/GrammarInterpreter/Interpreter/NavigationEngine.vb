Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports GrammarInterpreter.Compiler

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Core navigation engine with memoization and cycle protection
    ''' </summary>
    Public Class NavigationEngine
        Private ReadOnly compiledGrammar As CompiledGrammar
        Private ReadOnly cache As New Dictionary(Of String, List(Of MatchResult))()
        Private Const MAX_REPEAT As Integer = 100 ' Safety limit for repeatable nodes

        Public Sub New(compiledGrammar As CompiledGrammar)
            Me.compiledGrammar = compiledGrammar
        End Sub

        ''' <summary>
        ''' Main navigation function
        ''' </summary>
        Public Function Navigate(
            node As CompiledNode,
            context As MatchContext,
            visited As HashSet(Of String)
        ) As List(Of MatchResult)

            ' Memoization key
            Dim cacheKey = $"{node.Id}:{context.Position}:{context.GarbageUsed}"
            If cache.ContainsKey(cacheKey) Then
                Return cache(cacheKey)
            End If

            ' Cycle protection
            If visited.Contains(node.Id) Then
                Return New List(Of MatchResult)() ' Avoid infinite loops
            End If

            ' Check end condition
            If IsEndCondition(node, context) Then
                Dim endResult = New List(Of MatchResult) From {
                    New MatchResult() With {
                        .Success = True,
                        .Bindings = context.Bindings,
                        .ConsumedWords = 0
                    }
                }
                cache(cacheKey) = endResult
                Return endResult
            End If

            visited.Add(node.Id)
            Dim results As New List(Of MatchResult)()

            Try
                ' 1. Try to match the node directly
                Dim match = NodeMatcher.MatchNode(node, context, compiledGrammar)

                If match.Success Then
                    Dim newContext = UpdateContext(context, match)

                    ' Handle repeatable nodes
                    If node.Repeatable Then
                        Dim repeatResults = TryRepeatMatch(node, newContext, visited)
                        results.AddRange(repeatResults)
                    End If

                    ' Navigate children
                    Dim childResults = EdgeNavigator.NavigateChildren(node, newContext, compiledGrammar, visited, AddressOf Navigate)
                    results.AddRange(childResults)
                End If

                ' 2. If node is optional, try to skip it
                If node.Optional Then
                    Dim skipResults = EdgeNavigator.NavigateChildren(node, context, compiledGrammar, visited, AddressOf Navigate)
                    results.AddRange(skipResults)
                End If

                ' 3. Try with garbage
                If context.GarbageUsed < context.MaxGarbage Then
                    Dim garbageResults = GarbageHandler.TryWithGarbage(node, context, compiledGrammar, visited, AddressOf Navigate)
                    results.AddRange(garbageResults)
                End If

            Finally
                visited.Remove(node.Id) ' Backtracking
            End Try

            ' Cache result
            cache(cacheKey) = results
            Return results
        End Function

        ''' <summary>
        ''' Tries to match a repeatable node multiple times
        ''' </summary>
        Private Function TryRepeatMatch(
            node As CompiledNode,
            context As MatchContext,
            visited As HashSet(Of String)
        ) As List(Of MatchResult)

            Dim results As New List(Of MatchResult)()
            Dim currentContext = context.Clone()
            Dim repeatCount = 0

            ' Try to match as many times as possible
            While repeatCount < MAX_REPEAT
                Dim match = NodeMatcher.MatchNode(node, currentContext, compiledGrammar)
                If Not match.Success Then
                    Exit While ' Can't match anymore
                End If

                repeatCount += 1
                currentContext = UpdateContext(currentContext, match)

                ' After each match, try to navigate children
                Dim childResults = EdgeNavigator.NavigateChildren(node, currentContext, compiledGrammar, visited, AddressOf Navigate)
                results.AddRange(childResults)
            End While

            ' If node is also optional and we matched 0 times, add skip result
            If node.Optional AndAlso repeatCount = 0 Then
                Dim skipResults = EdgeNavigator.NavigateChildren(node, context, compiledGrammar, visited, AddressOf Navigate)
                results.AddRange(skipResults)
            End If

            Return results
        End Function

        ''' <summary>
        ''' Updates context after a match
        ''' </summary>
        Private Function UpdateContext(context As MatchContext, match As MatchResult) As MatchContext
            Dim newContext = context.Clone()
            newContext.Position += match.ConsumedChars
            newContext.GarbageUsed += match.GarbageUsed

            ' Merge bindings
            For Each kvp In match.Bindings
                newContext.Bindings(kvp.Key) = kvp.Value
            Next

            Return newContext
        End Function

        ''' <summary>
        ''' Checks if we've reached an end condition
        ''' </summary>
        Private Function IsEndCondition(node As CompiledNode, context As MatchContext) As Boolean
            ' End node: no outgoing edges
            If Not compiledGrammar.Edges.ContainsKey(node.Id) OrElse compiledGrammar.Edges(node.Id).Count = 0 Then
                ' Check if we're at end of text or have acceptable remaining garbage
                Dim remainingText = context.Text.Substring(context.Position).Trim()
                Dim remainingWords = If(String.IsNullOrEmpty(remainingText), 0, remainingText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length)
                Dim availableGarbage = context.MaxGarbage - context.GarbageUsed

                Return remainingWords <= availableGarbage
            End If

            Return False
        End Function

    End Class

End Namespace
