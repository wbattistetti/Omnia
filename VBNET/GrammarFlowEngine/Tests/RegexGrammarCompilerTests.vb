Option Strict On
Option Explicit On

Imports System.Linq
Imports GrammarFlowEngine.Models
Imports GrammarFlowEngine.Compiler

''' <summary>
''' Unit tests for RegexGrammarCompiler
''' Tests simple grammars, alternatives, optionals, semantic values, and node highlighting
''' </summary>
Public Module RegexGrammarCompilerTests

    ''' <summary>
    ''' Test simple grammar with single node
    ''' </summary>
    Public Function TestSimpleGrammar() As Boolean
        Try
            ' Create simple grammar: "voglio" → slot "intent"
            Dim grammar As New Grammar() With {
                .Id = "test-1",
                .Name = "Simple Grammar",
                .Nodes = New List(Of GrammarNode)(),
                .Edges = New List(Of GrammarEdge)(),
                .Slots = New List(Of SemanticSlot)(),
                .SemanticSets = New List(Of SemanticSet)(),
                .SemanticValues = New List(Of SemanticValue)()
            }

            ' Create slot
            Dim slot As New SemanticSlot() With {
                .Id = "slot-intent",
                .Name = "intent",
                .Type = "string"
            }
            grammar.Slots.Add(slot)

            ' Create node with slot binding
            Dim node As New GrammarNode() With {
                .Id = "node-voglio",
                .Label = "voglio",
                .Synonyms = New List(Of String) From {"vorrei", "desidero"},
                .Bindings = New List(Of NodeBinding) From {
                    New NodeBinding() With {.Type = "slot", .SlotId = "slot-intent"}
                }
            }
            grammar.Nodes.Add(node)

            ' Compile grammar
            Dim compiledGrammar = GrammarCompiler.Compile(grammar)
            Dim compiledRegex = RegexGrammarCompiler.CompileToRegex(compiledGrammar)

            ' Test match
            Dim result = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio")

            If Not result.Success Then
                Console.WriteLine("❌ TestSimpleGrammar: Match failed")
                Return False
            End If

            If result.MatchedNodes.Count <> 1 Then
                Console.WriteLine($"❌ TestSimpleGrammar: Expected 1 matched node, got {result.MatchedNodes.Count}")
                Return False
            End If

            If result.MatchedNodes(0) <> "node-voglio" Then
                Console.WriteLine($"❌ TestSimpleGrammar: Expected node 'node-voglio', got '{result.MatchedNodes(0)}'")
                Return False
            End If

            If Not result.Bindings.ContainsKey("intent") Then
                Console.WriteLine("❌ TestSimpleGrammar: Missing 'intent' binding")
                Return False
            End If

            Console.WriteLine("✅ TestSimpleGrammar: PASSED")
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ TestSimpleGrammar: Exception - {ex.Message}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Test grammar with alternatives
    ''' </summary>
    Public Function TestAlternativeGrammar() As Boolean
        Try
            Dim grammar As New Grammar() With {
                .Id = "test-2",
                .Name = "Alternative Grammar",
                .Nodes = New List(Of GrammarNode)(),
                .Edges = New List(Of GrammarEdge)(),
                .Slots = New List(Of SemanticSlot)(),
                .SemanticSets = New List(Of SemanticSet)(),
                .SemanticValues = New List(Of SemanticValue)()
            }

            ' Create entry node
            Dim entryNode As New GrammarNode() With {
                .Id = "node-entry",
                .Label = "voglio"
            }
            grammar.Nodes.Add(entryNode)

            ' Create alternative nodes
            Dim alt1 As New GrammarNode() With {
                .Id = "node-alt1",
                .Label = "pizza"
            }
            grammar.Nodes.Add(alt1)

            Dim alt2 As New GrammarNode() With {
                .Id = "node-alt2",
                .Label = "pasta"
            }
            grammar.Nodes.Add(alt2)

            ' Create alternative edges
            Dim edge1 As New GrammarEdge() With {
                .Id = "edge-1",
                .Source = "node-entry",
                .Target = "node-alt1",
                .Type = "alternative",
                .Order = 0
            }
            grammar.Edges.Add(edge1)

            Dim edge2 As New GrammarEdge() With {
                .Id = "edge-2",
                .Source = "node-entry",
                .Target = "node-alt2",
                .Type = "alternative",
                .Order = 1
            }
            grammar.Edges.Add(edge2)

            ' Compile and test
            Dim compiledGrammar = GrammarCompiler.Compile(grammar)
            Dim compiledRegex = RegexGrammarCompiler.CompileToRegex(compiledGrammar)

            ' Test match with first alternative
            Dim result1 = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio pizza")
            If Not result1.Success OrElse result1.MatchedNodes.Count < 2 Then
                Console.WriteLine("❌ TestAlternativeGrammar: First alternative failed")
                Return False
            End If

            ' Test match with second alternative
            Dim result2 = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio pasta")
            If Not result2.Success OrElse result2.MatchedNodes.Count < 2 Then
                Console.WriteLine("❌ TestAlternativeGrammar: Second alternative failed")
                Return False
            End If

            Console.WriteLine("✅ TestAlternativeGrammar: PASSED")
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ TestAlternativeGrammar: Exception - {ex.Message}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Test grammar with optional node
    ''' </summary>
    Public Function TestOptionalGrammar() As Boolean
        Try
            Dim grammar As New Grammar() With {
                .Id = "test-3",
                .Name = "Optional Grammar",
                .Nodes = New List(Of GrammarNode)(),
                .Edges = New List(Of GrammarEdge)(),
                .Slots = New List(Of SemanticSlot)(),
                .SemanticSets = New List(Of SemanticSet)(),
                .SemanticValues = New List(Of SemanticValue)()
            }

            ' Create entry node
            Dim entryNode As New GrammarNode() With {
                .Id = "node-entry",
                .Label = "voglio"
            }
            grammar.Nodes.Add(entryNode)

            ' Create optional node
            Dim optionalNode As New GrammarNode() With {
                .Id = "node-optional",
                .Label = "per favore",
                .[Optional] = True
            }
            grammar.Nodes.Add(optionalNode)

            ' Create optional edge
            Dim edge As New GrammarEdge() With {
                .Id = "edge-1",
                .Source = "node-entry",
                .Target = "node-optional",
                .Type = "optional",
                .Order = 0
            }
            grammar.Edges.Add(edge)

            ' Compile and test
            Dim compiledGrammar = GrammarCompiler.Compile(grammar)
            Dim compiledRegex = RegexGrammarCompiler.CompileToRegex(compiledGrammar)

            ' Test match with optional node
            Dim result1 = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio per favore")
            If Not result1.Success Then
                Console.WriteLine("❌ TestOptionalGrammar: Match with optional failed")
                Return False
            End If

            ' Test match without optional node
            Dim result2 = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio")
            If Not result2.Success Then
                Console.WriteLine("❌ TestOptionalGrammar: Match without optional failed")
                Return False
            End If

            Console.WriteLine("✅ TestOptionalGrammar: PASSED")
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ TestOptionalGrammar: Exception - {ex.Message}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Test grammar with semantic-value
    ''' </summary>
    Public Function TestSemanticValueGrammar() As Boolean
        Try
            Dim grammar As New Grammar() With {
                .Id = "test-4",
                .Name = "Semantic Value Grammar",
                .Nodes = New List(Of GrammarNode)(),
                .Edges = New List(Of GrammarEdge)(),
                .Slots = New List(Of SemanticSlot)(),
                .SemanticSets = New List(Of SemanticSet)(),
                .SemanticValues = New List(Of SemanticValue)()
            }

            ' Create semantic value
            Dim semanticValue As New SemanticValue() With {
                .Id = "sem-nome-chat",
                .Value = "nome chat",
                .Synonyms = New List(Of String) From {"chat", "conversazione"}
            }
            grammar.SemanticValues.Add(semanticValue)

            ' Create slot
            Dim slot As New SemanticSlot() With {
                .Id = "slot-risposta",
                .Name = "risposta",
                .Type = "string"
            }
            grammar.Slots.Add(slot)

            ' Create node with slot and semantic-value binding
            Dim node As New GrammarNode() With {
                .Id = "node-risposta",
                .Label = "risposta",
                .Bindings = New List(Of NodeBinding) From {
                    New NodeBinding() With {.Type = "slot", .SlotId = "slot-risposta"},
                    New NodeBinding() With {.Type = "semantic-value", .ValueId = "sem-nome-chat"}
                }
            }
            grammar.Nodes.Add(node)

            ' Create child node for semantic value match
            Dim childNode As New GrammarNode() With {
                .Id = "node-nome-chat",
                .Label = "nome chat",
                .Synonyms = New List(Of String) From {"chat", "conversazione"}
            }
            grammar.Nodes.Add(childNode)

            ' Create sequential edge
            Dim edge As New GrammarEdge() With {
                .Id = "edge-1",
                .Source = "node-risposta",
                .Target = "node-nome-chat",
                .Type = "sequential",
                .Order = 0
            }
            grammar.Edges.Add(edge)

            ' Compile and test
            Dim compiledGrammar = GrammarCompiler.Compile(grammar)
            Dim compiledRegex = RegexGrammarCompiler.CompileToRegex(compiledGrammar)

            ' Test match
            Dim result = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "risposta nome chat")

            If Not result.Success Then
                Console.WriteLine("❌ TestSemanticValueGrammar: Match failed")
                Return False
            End If

            If result.MatchedNodes.Count < 2 Then
                Console.WriteLine($"❌ TestSemanticValueGrammar: Expected at least 2 matched nodes, got {result.MatchedNodes.Count}")
                Return False
            End If

            If Not result.Bindings.ContainsKey("risposta") Then
                Console.WriteLine("❌ TestSemanticValueGrammar: Missing 'risposta' binding")
                Return False
            End If

            If result.SemanticValues.Count = 0 Then
                Console.WriteLine("❌ TestSemanticValueGrammar: No semantic values activated")
                Return False
            End If

            Console.WriteLine("✅ TestSemanticValueGrammar: PASSED")
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ TestSemanticValueGrammar: Exception - {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Test node highlighting (all matched nodes should be tracked)
    ''' </summary>
    Public Function TestNodeHighlighting() As Boolean
        Try
            Dim grammar As New Grammar() With {
                .Id = "test-5",
                .Name = "Highlighting Grammar",
                .Nodes = New List(Of GrammarNode)(),
                .Edges = New List(Of GrammarEdge)(),
                .Slots = New List(Of SemanticSlot)(),
                .SemanticSets = New List(Of SemanticSet)(),
                .SemanticValues = New List(Of SemanticValue)()
            }

            ' Create sequential nodes
            Dim node1 As New GrammarNode() With {
                .Id = "node-1",
                .Label = "voglio"
            }
            grammar.Nodes.Add(node1)

            Dim node2 As New GrammarNode() With {
                .Id = "node-2",
                .Label = "pizza"
            }
            grammar.Nodes.Add(node2)

            Dim node3 As New GrammarNode() With {
                .Id = "node-3",
                .Label = "margherita"
            }
            grammar.Nodes.Add(node3)

            ' Create sequential edges
            Dim edge1 As New GrammarEdge() With {
                .Id = "edge-1",
                .Source = "node-1",
                .Target = "node-2",
                .Type = "sequential",
                .Order = 0
            }
            grammar.Edges.Add(edge1)

            Dim edge2 As New GrammarEdge() With {
                .Id = "edge-2",
                .Source = "node-2",
                .Target = "node-3",
                .Type = "sequential",
                .Order = 0
            }
            grammar.Edges.Add(edge2)

            ' Compile and test
            Dim compiledGrammar = GrammarCompiler.Compile(grammar)
            Dim compiledRegex = RegexGrammarCompiler.CompileToRegex(compiledGrammar)

            ' Test match
            Dim result = RegexGrammarCompiler.MatchAndExtract(compiledRegex, "voglio pizza margherita")

            If Not result.Success Then
                Console.WriteLine("❌ TestNodeHighlighting: Match failed")
                Return False
            End If

            ' Check that all nodes are matched
            If result.MatchedNodes.Count < 3 Then
                Console.WriteLine($"❌ TestNodeHighlighting: Expected at least 3 matched nodes, got {result.MatchedNodes.Count}")
                Return False
            End If

            ' Check that nodes are in correct order
            If result.MatchedNodes(0) <> "node-1" Then
                Console.WriteLine($"❌ TestNodeHighlighting: First node should be 'node-1', got '{result.MatchedNodes(0)}'")
                Return False
            End If

            ' Check NodeMatches for highlighting
            If result.NodeMatches.Count < 3 Then
                Console.WriteLine($"❌ TestNodeHighlighting: Expected at least 3 node matches, got {result.NodeMatches.Count}")
                Return False
            End If

            ' Check match order
            For i = 0 To result.NodeMatches.Count - 1
                If result.NodeMatches(i).MatchOrder <> i + 1 Then
                    Console.WriteLine($"❌ TestNodeHighlighting: Node {i} has incorrect match order")
                    Return False
                End If
            Next

            Console.WriteLine("✅ TestNodeHighlighting: PASSED")
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ TestNodeHighlighting: Exception - {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Run all tests
    ''' </summary>
    Public Sub RunAllTests()
        Console.WriteLine("========================================")
        Console.WriteLine("Running RegexGrammarCompiler Tests")
        Console.WriteLine("========================================")

        Dim results As New List(Of Boolean)()

        results.Add(TestSimpleGrammar())
        results.Add(TestAlternativeGrammar())
        results.Add(TestOptionalGrammar())
        results.Add(TestSemanticValueGrammar())
        results.Add(TestNodeHighlighting())

        Dim passed = results.Count(Function(r) r)
        Dim total = results.Count

        Console.WriteLine("========================================")
        Console.WriteLine($"Tests: {passed}/{total} passed")
        Console.WriteLine("========================================")
    End Sub

End Module
