Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
''' <summary>
''' Main Grammar Flow Engine
''' Front end → Grammar Compiler → Grammar Flow Engine
''' </summary>
Public Class GrammarEngine
    Private compiledGrammar As CompiledGrammar

    ''' <summary>
    ''' Creates a new engine from a compiled grammar
    ''' </summary>
    Public Sub New(compiledGrammar As CompiledGrammar)
        Me.compiledGrammar = compiledGrammar
    End Sub

    ''' <summary>
    ''' Creates a new engine from a raw grammar (compiles it first)
    ''' </summary>
    Public Sub New(grammar As Grammar)
        Me.compiledGrammar = GrammarCompiler.Compile(grammar)
    End Sub

    ''' <summary>
    ''' Parses text using the grammar
    ''' </summary>
    Public Function Parse(text As String, Optional maxGarbage As Integer = 5) As ParseResult
        If String.IsNullOrEmpty(text) Then
            Return New ParseResult() With {
                    .Success = False,
                    .ErrorMessage = "Input text is empty"
                }
        End If

        If compiledGrammar.EntryNodes.Count = 0 Then
            Return New ParseResult() With {
                    .Success = False,
                    .ErrorMessage = "Grammar has no entry nodes"
                }
        End If

        Dim allResults As New List(Of MatchResult)()

        ' Try each entry node
        For Each entryNode In compiledGrammar.EntryNodes
            Dim context As New MatchContext() With {
                    .Text = text,
                    .Position = 0,
                    .GarbageUsed = 0,
                    .MaxGarbage = maxGarbage
                }

            Dim visited As New HashSet(Of String)()
            Dim navigationEngine As New NavigationEngine(compiledGrammar)
            Dim results = navigationEngine.Navigate(entryNode, context, visited)
            allResults.AddRange(results)
        Next

        ' Select best results
        Dim bestResults = ResultSelector.SelectBestResults(allResults)

        If Not bestResults.Any() Then
            Return New ParseResult() With {
                    .Success = False,
                    .ErrorMessage = "No match found"
                }
        End If

        ' Take the first best result (or merge if multiple)
        Dim bestResult = bestResults.First()
        Dim parseResult As New ParseResult() With {
                .Success = True,
                .Bindings = bestResult.Bindings,
                .ConsumedWords = bestResult.ConsumedWords,
                .GarbageUsed = bestResult.GarbageUsed
            }

        Return parseResult
    End Function

    ''' <summary>
    ''' Gets the compiled grammar
    ''' </summary>
    Public ReadOnly Property Grammar As CompiledGrammar
        Get
            Return compiledGrammar
        End Get
    End Property

End Class
