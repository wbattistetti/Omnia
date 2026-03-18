Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports GrammarFlowEngine.Compiler

''' <summary>
''' Core navigation engine with cycle protection
''' Builds hierarchical match results with parent-child relationships
''' </summary>
Public Class NavigationEngine
    Private ReadOnly compiledGrammar As CompiledGrammar
    Private Const MAX_REPEAT As Integer = 100 ' Safety limit for repeatable nodes

    ' ❌ RIMOSSA memoization: era problematica perché la chiave non includeva bindings
    ' La memoization causava risultati errati quando due context diversi con bindings diversi
    ' avevano la stessa chiave (nodeId:position:garbageUsed)

    Public Sub New(compiledGrammar As CompiledGrammar)
        Me.compiledGrammar = compiledGrammar
    End Sub

    ''' <summary>
    ''' Main navigation function
    ''' Builds hierarchical results where each MatchResult contains its children
    ''' </summary>
    Public Function Navigate(
            node As CompiledNode,
            context As PathMatchState,
            visited As HashSet(Of String)
        ) As List(Of MatchResult)

        ' Cycle protection
        If visited.Contains(node.Id) Then
            Return New List(Of MatchResult)() ' Avoid infinite loops
        End If

        visited.Add(node.Id)
        Dim results As New List(Of MatchResult)()

        Try
            ' 1. Try to match the node directly
            Dim match = NodeMatcher.MatchNode(node, context, compiledGrammar)

            If match.Success Then
                Dim newContext = context.WithMatch(match)

                ' ✅ Check if this is an end path AFTER matching the node
                If node.IsPathEnd(newContext, compiledGrammar) Then
                    ' Node matched successfully and we're at a valid end path
                    Dim endResult = New MatchResult() With {
                        .Success = True,
                        .Bindings = newContext.Bindings,
                        .ConsumedWords = match.ConsumedWords,
                        .ConsumedChars = match.ConsumedChars,
                        .GarbageUsed = newContext.GarbageUsed,
                        .NodeId = match.NodeId,
                        .NodeLabel = match.NodeLabel,
                        .MatchedText = match.MatchedText,
                        .MatchType = match.MatchType,
                        .SlotBinding = match.SlotBinding,
                        .SemanticValueBinding = match.SemanticValueBinding,
                        .Children = New List(Of MatchResult)() ' Nessun figlio, è un end node
                    }
                    Return New List(Of MatchResult) From {endResult}
                End If

                ' ✅ Naviga i figli e costruisci gerarchia
                Dim childResults = EdgeNavigator.NavigateChildren(node, newContext, compiledGrammar, visited, AddressOf Navigate)

                ' ✅ Per ogni risultato dei figli, crea un risultato padre che contiene i figli
                For Each childResult In childResults
                    Dim parentResult = New MatchResult() With {
                        .Success = True,
                        .Bindings = newContext.Bindings, ' Bindings aggregati (già nel newContext)
                        .ConsumedWords = match.ConsumedWords + childResult.ConsumedWords,
                        .ConsumedChars = match.ConsumedChars + childResult.ConsumedChars,
                        .GarbageUsed = newContext.GarbageUsed + childResult.GarbageUsed,
                        .NodeId = match.NodeId,
                        .NodeLabel = match.NodeLabel,
                        .MatchedText = match.MatchedText,
                        .MatchType = match.MatchType,
                        .SlotBinding = match.SlotBinding,
                        .SemanticValueBinding = match.SemanticValueBinding,
                        .Children = New List(Of MatchResult) From {childResult} ' ✅ Figlio nella gerarchia
                    }
                    results.Add(parentResult)
                Next

                ' Handle repeatable nodes
                If node.Repeatable Then
                    Dim repeatResults = TryRepeatMatch(node, newContext, visited)
                    results.AddRange(repeatResults)
                End If
            End If

            ' 2. If node is optional, try to skip it
            ' ❌ RIMOSSO controllo IsPathEnd qui - era pericoloso perché poteva chiudere prematuramente
            ' ✅ Semplicemente naviga i figli senza matchare il nodo
            If node.[Optional] Then
                Dim skipResults = EdgeNavigator.NavigateChildren(node, context, compiledGrammar, visited, AddressOf Navigate)
                For Each skipResult In skipResults
                    Dim skipParentResult = New MatchResult() With {
                        .Success = True,
                        .Bindings = context.Bindings,
                        .ConsumedWords = skipResult.ConsumedWords,
                        .ConsumedChars = skipResult.ConsumedChars,
                        .GarbageUsed = context.GarbageUsed + skipResult.GarbageUsed,
                        .Skipped = True,
                        .NodeId = node.Id,
                        .NodeLabel = node.Label,
                        .Children = New List(Of MatchResult) From {skipResult}
                    }
                    results.Add(skipParentResult)
                Next
            End If

            ' 3. Try with garbage
            If context.GarbageUsed < context.MaxGarbage Then
                Dim garbageResults = GarbageHandler.TryWithGarbage(node, context, compiledGrammar, visited, AddressOf Navigate)
                ' ✅ Costruisci gerarchia anche per garbage results
                For Each garbageResult In garbageResults
                    Dim garbageParentResult = New MatchResult() With {
                        .Success = True,
                        .Bindings = context.Bindings,
                        .ConsumedWords = garbageResult.ConsumedWords,
                        .ConsumedChars = garbageResult.ConsumedChars,
                        .GarbageUsed = context.GarbageUsed + garbageResult.GarbageUsed,
                        .NodeId = node.Id,
                        .NodeLabel = node.Label,
                        .Children = New List(Of MatchResult) From {garbageResult}
                    }
                    results.Add(garbageParentResult)
                Next
            End If

        Finally
            visited.Remove(node.Id) ' Backtracking
        End Try

        Return results
    End Function

    ''' <summary>
    ''' Tries to match a repeatable node multiple times
    ''' Builds hierarchical results for each repetition
    ''' </summary>
    Private Function TryRepeatMatch(
            node As CompiledNode,
            context As PathMatchState,
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
            currentContext = currentContext.WithMatch(match)

            ' After each match, try to navigate children
            Dim childResults = EdgeNavigator.NavigateChildren(node, currentContext, compiledGrammar, visited, AddressOf Navigate)

            ' ✅ Costruisci gerarchia per ogni ripetizione
            For Each childResult In childResults
                Dim repeatParentResult = New MatchResult() With {
                    .Success = True,
                    .Bindings = currentContext.Bindings,
                    .ConsumedWords = match.ConsumedWords + childResult.ConsumedWords,
                    .ConsumedChars = match.ConsumedChars + childResult.ConsumedChars,
                    .GarbageUsed = currentContext.GarbageUsed + childResult.GarbageUsed,
                    .NodeId = match.NodeId,
                    .NodeLabel = match.NodeLabel,
                    .MatchedText = match.MatchedText,
                    .MatchType = match.MatchType,
                    .SlotBinding = match.SlotBinding,
                    .SemanticValueBinding = match.SemanticValueBinding,
                    .Children = New List(Of MatchResult) From {childResult}
                }
                results.Add(repeatParentResult)
            Next
        End While

        ' If node is also optional and we matched 0 times, add skip result
        If node.[Optional] AndAlso repeatCount = 0 Then
            Dim skipResults = EdgeNavigator.NavigateChildren(node, context, compiledGrammar, visited, AddressOf Navigate)
            For Each skipResult In skipResults
                Dim skipParentResult = New MatchResult() With {
                    .Success = True,
                    .Bindings = context.Bindings,
                    .ConsumedWords = skipResult.ConsumedWords,
                    .ConsumedChars = skipResult.ConsumedChars,
                    .GarbageUsed = context.GarbageUsed + skipResult.GarbageUsed,
                    .Skipped = True,
                    .NodeId = node.Id,
                    .NodeLabel = node.Label,
                    .Children = New List(Of MatchResult) From {skipResult}
                }
                results.Add(skipParentResult)
            Next
        End If

        Return results
    End Function


End Class
