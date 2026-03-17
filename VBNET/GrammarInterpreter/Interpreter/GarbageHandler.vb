Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports GrammarInterpreter.Compiler

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Handles garbage words (skipped words between nodes)
    ''' </summary>
    Public Module GarbageHandler

        ''' <summary>
        ''' Tries to match children by consuming garbage words
        ''' </summary>
        Public Function TryWithGarbage(
            node As CompiledNode,
            context As MatchContext,
            compiledGrammar As CompiledGrammar,
            visited As HashSet(Of String),
            navigateFunc As Func(Of CompiledNode, MatchContext, HashSet(Of String), List(Of MatchResult))
        ) As List(Of MatchResult)

            Dim results As New List(Of MatchResult)()
            Dim remainingGarbage = context.MaxGarbage - context.GarbageUsed

            If remainingGarbage <= 0 Then
                Return results
            End If

            ' Get children nodes
            Dim children = GetChildren(node, compiledGrammar)
            If children.Count = 0 Then
                Return results
            End If

            ' Get words from current position
            Dim words = GetWords(context.Text, context.Position)
            If words.Count = 0 Then
                Return results
            End If

            ' Try with 1, 2, ..., remainingGarbage words of garbage
            For garbageCount = 1 To Math.Min(remainingGarbage, words.Count - 1)
                Dim newPosition = GetPositionAfterWords(context.Text, context.Position, garbageCount)

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

        ''' <summary>
        ''' Gets children nodes for a given node
        ''' </summary>
        Private Function GetChildren(node As CompiledNode, compiledGrammar As CompiledGrammar) As List(Of CompiledNode)
            Dim children As New List(Of CompiledNode)()

            If compiledGrammar.Edges.ContainsKey(node.Id) Then
                For Each edge In compiledGrammar.Edges(node.Id)
                    Dim childNode = compiledGrammar.Nodes.GetValueOrDefault(edge.Target)
                    If childNode IsNot Nothing Then
                        children.Add(childNode)
                    End If
                Next
            End If

            Return children
        End Function

        ''' <summary>
        ''' Gets words from text starting at position
        ''' </summary>
        Private Function GetWords(text As String, position As Integer) As List(Of String)
            Dim remainingText = text.Substring(position).Trim()
            If String.IsNullOrEmpty(remainingText) Then
                Return New List(Of String)()
            End If

            Return remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).ToList()
        End Function

        ''' <summary>
        ''' Gets position after consuming N words
        ''' </summary>
        Private Function GetPositionAfterWords(text As String, startPosition As Integer, wordCount As Integer) As Integer
            Dim remainingText = text.Substring(startPosition).Trim()
            If String.IsNullOrEmpty(remainingText) Then
                Return startPosition
            End If

            Dim words = remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries)
            If wordCount >= words.Length Then
                Return text.Length ' End of text
            End If

            ' Find position after N words
            Dim charsConsumed = 0
            For i = 0 To wordCount - 1
                charsConsumed += words(i).Length
                If i < wordCount - 1 Then
                    ' Add space
                    charsConsumed += 1
                End If
            Next

            ' Find actual position in original text
            Dim currentPos = startPosition
            Dim wordsFound = 0
            While currentPos < text.Length AndAlso wordsFound < wordCount
                If Char.IsWhiteSpace(text(currentPos)) Then
                    currentPos += 1
                    While currentPos < text.Length AndAlso Char.IsWhiteSpace(text(currentPos))
                        currentPos += 1
                    End While
                    wordsFound += 1
                Else
                    currentPos += 1
                End If
            End While

            ' Skip whitespace
            While currentPos < text.Length AndAlso Char.IsWhiteSpace(text(currentPos))
                currentPos += 1
            End While

            Return currentPos
        End Function

    End Module

End Namespace
