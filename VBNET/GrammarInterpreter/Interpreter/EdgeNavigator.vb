Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports GrammarInterpreter.Compiler

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Navigates edges (sequential, alternative, optional)
    ''' </summary>
    Public Module EdgeNavigator

        ''' <summary>
        ''' Navigates children nodes based on edge types
        ''' </summary>
        Public Function NavigateChildren(
            node As CompiledNode,
            context As MatchContext,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, MatchContext, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

            If Not compiledGrammar.Edges.ContainsKey(node.Id) Then
                ' End node: check if we're at end of text
                If IsEndOfText(context) Then
                    Return New List(Of MatchResult) From {
                        New MatchResult() With {
                            .Success = True,
                            .Bindings = context.Bindings,
                            .ConsumedWords = 0
                        }
                    }
                End If
                Return New List(Of MatchResult)()
            End If

            Dim edges = compiledGrammar.Edges(node.Id)
            If edges.Count = 0 Then
                Return New List(Of MatchResult)()
            End If

            ' Group edges by type
            Dim sequential = edges.Where(Function(e) e.Type = "sequential").ToList()
            Dim alternative = edges.Where(Function(e) e.Type = "alternative").ToList()
            Dim optional = edges.Where(Function(e) e.Type = "optional").ToList()

            ' Navigate based on edge type (priority: sequential > alternative > optional)
            If sequential.Any() Then
                Return NavigateSequential(sequential, context, compiledGrammar, visited, navigateFunc)
            ElseIf alternative.Any() Then
                Return NavigateAlternative(alternative, context, compiledGrammar, visited, navigateFunc)
            ElseIf optional.Any() Then
                Return NavigateOptional(optional, context, compiledGrammar, visited, navigateFunc)
            End If

            Return New List(Of MatchResult)()
        End Function

        ''' <summary>
        ''' Navigates sequential edges (all must match in order)
        ''' </summary>
        Private Function NavigateSequential(
            edges As List(Of CompiledEdge),
            context As MatchContext,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, MatchContext, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

            ' Sort by Order
            Dim orderedEdges = edges.OrderBy(Function(e) e.Order).ToList()

            Dim currentContext = context.Clone()
            Dim allBindings As New Dictionary(Of String, Object)(context.Bindings)

            ' Try to match all edges in sequence
            For Each edge In orderedEdges
                Dim targetNode = compiledGrammar.Nodes.GetValueOrDefault(edge.Target)
                If targetNode Is Nothing Then
                    Return New List(Of MatchResult)() ' Sequence failed
                End If

                Dim stepResults = navigateFunc(targetNode, currentContext, visited)
                Dim successfulResults = stepResults.Where(Function(r) r.Success).ToList()

                If Not successfulResults.Any() Then
                    Return New List(Of MatchResult)() ' Sequence failed
                End If

                ' Take the best result for this step (greedy approach)
                Dim bestStep = ResultSelector.SelectBestResults(successfulResults).FirstOrDefault()
                If bestStep Is Nothing Then
                    Return New List(Of MatchResult)()
                End If

                ' Merge bindings
                For Each kvp In bestStep.Bindings
                    allBindings(kvp.Key) = kvp.Value
                Next

                ' Update context for next step
                currentContext.Position += bestStep.ConsumedChars
                currentContext.GarbageUsed += bestStep.GarbageUsed
                currentContext.Bindings = New Dictionary(Of String, Object)(allBindings)
            Next

            ' All steps succeeded
            Return New List(Of MatchResult) From {
                New MatchResult() With {
                    .Success = True,
                    .Bindings = allBindings,
                    .ConsumedWords = CountWords(context.Text, context.Position, currentContext.Position),
                    .ConsumedChars = currentContext.Position - context.Position
                }
            }
        End Function

        ''' <summary>
        ''' Navigates alternative edges (at least one must match)
        ''' </summary>
        Private Function NavigateAlternative(
            edges As List(Of CompiledEdge),
            context As MatchContext,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, MatchContext, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

            Dim results As New List(Of MatchResult)()

            ' Try all alternatives
            For Each edge In edges
                Dim targetNode = compiledGrammar.Nodes.GetValueOrDefault(edge.Target)
                If targetNode IsNot Nothing Then
                    Dim altResults = navigateFunc(targetNode, context, visited)
                    ' Add only successful results
                    results.AddRange(altResults.Where(Function(r) r.Success))
                End If
            Next

            Return results
        End Function

        ''' <summary>
        ''' Navigates optional edges (try with and without)
        ''' </summary>
        Private Function NavigateOptional(
            edges As List(Of CompiledEdge),
            context As MatchContext,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, MatchContext, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

            Dim results As New List(Of MatchResult)()

            ' Try WITH the edge
            For Each edge In edges
                Dim targetNode = compiledGrammar.Nodes.GetValueOrDefault(edge.Target)
                If targetNode IsNot Nothing Then
                    Dim withResults = navigateFunc(targetNode, context, visited)
                    results.AddRange(withResults)
                End If
            Next

            ' Try WITHOUT the edge (skip - return context unchanged)
            ' This is handled by the fact that the node itself can be optional
            ' But we can also explicitly add a skip result if no results were found
            If Not results.Any(Function(r) r.Success) Then
                ' Add skip result
                results.Add(New MatchResult() With {
                    .Success = True,
                    .Bindings = context.Bindings,
                    .ConsumedWords = 0,
                    .Skipped = True
                })
            End If

            Return results
        End Function

        ''' <summary>
        ''' Checks if we're at the end of text
        ''' </summary>
        Private Function IsEndOfText(context As MatchContext) As Boolean
            Dim remainingText = context.Text.Substring(context.Position).Trim()
            Return String.IsNullOrEmpty(remainingText)
        End Function

        ''' <summary>
        ''' Counts words between two positions
        ''' </summary>
        Private Function CountWords(text As String, startPos As Integer, endPos As Integer) As Integer
            If endPos <= startPos OrElse endPos > text.Length Then
                Return 0
            End If

            Dim segment = text.Substring(startPos, endPos - startPos).Trim()
            If String.IsNullOrEmpty(segment) Then
                Return 0
            End If

            Return segment.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).Length
        End Function

    End Module

End Namespace
