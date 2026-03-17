Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports GrammarInterpreter.Models
Imports GrammarInterpreter.Compiler

Namespace GrammarInterpreter.Compiler

    ''' <summary>
    ''' Compiles Grammar JSON to optimized CompiledGrammar structure
    ''' Front end → Grammar Compiler → Grammar Interpreter
    ''' </summary>
    Public Module GrammarCompiler

        ''' <summary>
        ''' Compiles a Grammar to an optimized CompiledGrammar
        ''' </summary>
        Public Function Compile(grammar As Grammar) As CompiledGrammar
            If grammar Is Nothing Then
                Throw New ArgumentNullException(NameOf(grammar))
            End If

            Dim compiled As New CompiledGrammar() With {
                .Id = grammar.Id,
                .Name = grammar.Name
            }

            ' Compile nodes
            For Each node In grammar.Nodes
                Dim compiledNode = CompileNode(node)
                compiled.Nodes(node.Id) = compiledNode
            Next

            ' Compile edges (grouped by source)
            For Each edge In grammar.Edges
                If Not compiled.Edges.ContainsKey(edge.Source) Then
                    compiled.Edges(edge.Source) = New List(Of CompiledEdge)()
                End If

                Dim compiledEdge As New CompiledEdge() With {
                    .Id = edge.Id,
                    .Source = edge.Source,
                    .Target = edge.Target,
                    .Type = edge.Type,
                    .Label = edge.Label,
                    .Order = edge.Order
                }

                compiled.Edges(edge.Source).Add(compiledEdge)
            Next

            ' Sort sequential edges by Order
            For Each edgeList In compiled.Edges.Values
                Dim sequentialEdges = edgeList.Where(Function(e) e.Type = "sequential").ToList()
                If sequentialEdges.Any() Then
                    sequentialEdges.Sort(Function(e1, e2) e1.Order.CompareTo(e2.Order))
                End If
            Next

            ' Compile slots
            For Each slot In grammar.Slots
                compiled.Slots(slot.Id) = slot
            Next

            ' Compile semantic sets and values
            For Each semanticSet In grammar.SemanticSets
                compiled.SemanticSets(semanticSet.Id) = semanticSet

                ' Index all values for fast lookup
                For Each value In semanticSet.Values
                    compiled.SemanticValues(value.Id) = value
                Next
            Next

            ' Find entry nodes (nodes without incoming edges)
            Dim nodesWithIncoming = grammar.Edges.Select(Function(e) e.Target).Distinct().ToHashSet()
            For Each node In compiled.Nodes.Values
                If Not nodesWithIncoming.Contains(node.Id) Then
                    compiled.EntryNodes.Add(node)
                End If
            Next

            Return compiled
        End Function

        ''' <summary>
        ''' Compiles a single node with pre-compiled regex and optimized structures
        ''' </summary>
        Private Function CompileNode(node As GrammarNode) As CompiledNode
            Dim compiled As New CompiledNode() With {
                .Id = node.Id,
                .Label = node.Label,
                .Bindings = node.Bindings,
                .Optional = node.Optional,
                .Repeatable = node.Repeatable
            }

            ' Compile synonyms to HashSet for fast lookup
            For Each synonym In node.Synonyms
                compiled.Synonyms.Add(synonym)
                compiled.AllWords.Add(synonym)
            Next

            ' Add label to all words
            compiled.AllWords.Add(node.Label)

            ' Pre-compile regex if present
            If Not String.IsNullOrEmpty(node.Regex) Then
                Try
                    compiled.CompiledRegex = New Regex(node.Regex, RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                Catch ex As Exception
                    ' Log warning: invalid regex pattern
                    ' For now, we'll skip it and rely on label/synonyms matching
                End Try
            End If

            Return compiled
        End Function

    End Module

End Namespace
