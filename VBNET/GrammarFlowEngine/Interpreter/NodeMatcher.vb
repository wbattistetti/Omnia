Option Strict On
Option Explicit On

Imports System.Text.RegularExpressions
Imports GrammarFlowEngine.Compiler
Imports GrammarFlowEngine.Models

''' <summary>
''' Matches a single node against text
''' </summary>
Public Module NodeMatcher

        ''' <summary>
        ''' Tries to match a node at the current position
        ''' </summary>
        Public Function MatchNode(node As CompiledNode, context As MatchContext, compiledGrammar As CompiledGrammar) As MatchResult
            Dim result As New MatchResult()

            ' 1. Try regex match (if present)
            If node.CompiledRegex IsNot Nothing Then
                Dim remainingText = context.Text.Substring(context.Position).Trim()
                Dim match = node.CompiledRegex.Match(remainingText)
                If match.Success AndAlso match.Index = 0 Then
                    ' Regex matched at the start
                    result.Success = True
                    result.ConsumedChars = match.Length
                    result.ConsumedWords = CountWords(match.Value)
                    result.Bindings = ExtractBindings(node, compiledGrammar, match.Value)
                    Return result
                End If
            End If

            ' 2. Try label and synonyms (word-by-word matching)
            Dim currentWord = GetCurrentWord(context)
            If Not String.IsNullOrEmpty(currentWord) Then
                If node.AllWords.Contains(currentWord) Then
                    result.Success = True
                    result.ConsumedWords = 1
                    result.ConsumedChars = currentWord.Length
                    result.Bindings = ExtractBindings(node, compiledGrammar, currentWord)
                    Return result
                End If
            End If

            ' 3. Try semantic-set
            Dim semanticSetBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "semantic-set")
            If semanticSetBinding IsNot Nothing Then
                Dim semanticSet = compiledGrammar.SemanticSets.GetValueOrDefault(semanticSetBinding.SetId)
                If semanticSet IsNot Nothing Then
                    For Each value In semanticSet.Values
                        If MatchSemanticValue(value, context) Then
                            result.Success = True
                            result.ConsumedWords = 1
                            result.ConsumedChars = GetCurrentWord(context).Length
                            result.Bindings = ExtractBindings(node, compiledGrammar, value.Value, value)
                            Return result
                        End If
                    Next
                End If
            End If

            ' 4. Try semantic-value
            Dim semanticValueBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "semantic-value")
            If semanticValueBinding IsNot Nothing Then
                Dim semanticValue = compiledGrammar.SemanticValues.GetValueOrDefault(semanticValueBinding.ValueId)
                If semanticValue IsNot Nothing AndAlso MatchSemanticValue(semanticValue, context) Then
                    result.Success = True
                    result.ConsumedWords = 1
                    result.ConsumedChars = GetCurrentWord(context).Length
                    result.Bindings = ExtractBindings(node, compiledGrammar, semanticValue.Value, semanticValue)
                    Return result
                End If
            End If

            Return result ' No match
        End Function

        ''' <summary>
        ''' Gets the current word at the position
        ''' </summary>
        Private Function GetCurrentWord(context As MatchContext) As String
            Dim remainingText = context.Text.Substring(context.Position).Trim()
            If String.IsNullOrEmpty(remainingText) Then Return String.Empty

            Dim words = remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries)
            If words.Length > 0 Then
                Return words(0)
            End If
            Return String.Empty
        End Function

        ''' <summary>
        ''' Counts words in a string
        ''' </summary>
        Private Function CountWords(text As String) As Integer
            If String.IsNullOrEmpty(text) Then Return 0
            Return text.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).Length
        End Function

        ''' <summary>
        ''' Matches a semantic value against the current word
        ''' </summary>
        Private Function MatchSemanticValue(value As SemanticValue, context As MatchContext) As Boolean
            Dim currentWord = GetCurrentWord(context)
            If String.IsNullOrEmpty(currentWord) Then Return False

            ' Check exact match (case-insensitive)
            If String.Equals(value.Value, currentWord, StringComparison.OrdinalIgnoreCase) Then
                Return True
            End If

            ' Check synonyms
            For Each synonym In value.Synonyms
                If String.Equals(synonym, currentWord, StringComparison.OrdinalIgnoreCase) Then
                    Return True
                End If
            Next

            ' Check regex if present
            If Not String.IsNullOrEmpty(value.Regex) Then
                Try
                    Dim regex = New Regex(value.Regex, RegexOptions.IgnoreCase)
                    Return regex.IsMatch(currentWord)
                Catch
                    ' Invalid regex, skip
                End Try
            End If

            Return False
        End Function

        ''' <summary>
        ''' Extracts bindings from a matched node
        ''' </summary>
        Private Function ExtractBindings(node As CompiledNode, compiledGrammar As CompiledGrammar, matchedText As String, Optional matchedValue As SemanticValue = Nothing) As Dictionary(Of String, Object)
            Dim bindings As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)

            For Each binding In node.Bindings
                Select Case binding.Type
                    Case "slot"
                        Dim slot = compiledGrammar.Slots.GetValueOrDefault(binding.SlotId)
                        If slot IsNot Nothing Then
                            Dim value = If(matchedValue IsNot Nothing, matchedValue.Value, matchedText)
                            bindings(slot.Name) = value
                        End If

                    Case "semantic-set"
                        Dim semanticSet = compiledGrammar.SemanticSets.GetValueOrDefault(binding.SetId)
                        If semanticSet IsNot Nothing AndAlso matchedValue IsNot Nothing Then
                            bindings(semanticSet.Name) = matchedValue.Value
                        End If

                    Case "semantic-value"
                        If matchedValue IsNot Nothing Then
                            bindings("value") = matchedValue.Value
                        End If
                End Select
            Next

            Return bindings
        End Function

    End Module
