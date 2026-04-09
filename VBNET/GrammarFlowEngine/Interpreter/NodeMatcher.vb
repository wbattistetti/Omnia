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
        Public Function MatchNode(node As CompiledNode, context As PathMatchState, compiledGrammar As CompiledGrammar) As MatchResult
            Dim result As New MatchResult()

            ' ✅ Popolare informazioni base del nodo
            result.NodeId = node.Id
            result.NodeLabel = node.Label

            ' 1. Try regex match (if present)
            If node.CompiledRegex IsNot Nothing Then
                Dim remainingText = context.Text.Substring(context.Position).Trim()
                Dim match = node.CompiledRegex.Match(remainingText)
                If match.Success AndAlso match.Index = 0 Then
                    ' Regex matched at the start
                    result.Success = True
                    result.ConsumedChars = match.Length
                    result.ConsumedWords = match.Value.CountWords()
                    result.MatchedText = match.Value
                    result.MatchType = "regex"
                    result.Bindings = ExtractBindings(node, compiledGrammar, match.Value)
                    ' ✅ Tracciare informazioni sui bindings
                    ExtractBindingInfo(node, compiledGrammar, match.Value, Nothing, result)
                    Return result
                End If
            End If

            ' 2. Try label and synonyms (word-by-word matching)
            Dim currentWord = context.GetCurrentWord()
            If Not String.IsNullOrEmpty(currentWord) Then
                If node.AllWords.Contains(currentWord) Then
                    result.Success = True
                    result.ConsumedWords = 1
                    result.ConsumedChars = currentWord.Length
                    result.MatchedText = currentWord
                    result.MatchType = "label"
                    result.Bindings = ExtractBindings(node, compiledGrammar, currentWord)
                    ' ✅ Tracciare informazioni sui bindings
                    ExtractBindingInfo(node, compiledGrammar, currentWord, Nothing, result)
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
                            Dim matchedWord = context.GetCurrentWord()
                            result.Success = True
                            result.ConsumedWords = 1
                            result.ConsumedChars = matchedWord.Length
                            result.MatchedText = matchedWord
                            result.MatchType = "semantic-set"
                            result.Bindings = ExtractBindings(node, compiledGrammar, value.Value, value)
                            ' ✅ Tracciare informazioni sui bindings
                            ExtractBindingInfo(node, compiledGrammar, matchedWord, value, result)
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
                    Dim matchedWord = context.GetCurrentWord()
                    result.Success = True
                    result.ConsumedWords = 1
                    result.ConsumedChars = matchedWord.Length
                    result.MatchedText = matchedWord
                    result.MatchType = "semantic-value"
                    result.Bindings = ExtractBindings(node, compiledGrammar, semanticValue.Value, semanticValue)
                    ' ✅ Tracciare informazioni sui bindings
                    ExtractBindingInfo(node, compiledGrammar, matchedWord, semanticValue, result)
                    Return result
                End If
            End If

            Return result ' No match
        End Function

        ''' <summary>
        ''' Matches a semantic value against the current word
        ''' </summary>
        Private Function MatchSemanticValue(value As SemanticValue, context As PathMatchState) As Boolean
            Dim currentWord = context.GetCurrentWord()
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
                            bindings(slot.Id) = value
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

        ''' <summary>
        ''' Estrae informazioni sui bindings del nodo per costruire la struttura gerarchica
        ''' </summary>
        Private Sub ExtractBindingInfo(
            node As CompiledNode,
            compiledGrammar As CompiledGrammar,
            matchedText As String,
            matchedValue As SemanticValue,
            result As MatchResult
        )
            For Each binding In node.Bindings
                Select Case binding.Type
                    Case "slot"
                        Dim slot = compiledGrammar.Slots.GetValueOrDefault(binding.SlotId)
                        If slot IsNot Nothing Then
                            result.SlotBinding = New NodeBindingInfo() With {
                                .Type = "slot",
                                .Id = slot.Id,
                                .Name = slot.Name,
                                .Value = If(matchedValue IsNot Nothing, matchedValue.Value, matchedText)
                            }
                        End If

                    Case "semantic-value"
                        ' ✅ Quando il match avviene via AllWords (label), matchedValue è Nothing.
                        ' Fallback: cerca il semantic value per ID dalla grammar.
                        Dim sv As SemanticValue = matchedValue
                        If sv Is Nothing Then
                            sv = compiledGrammar.SemanticValues.GetValueOrDefault(binding.ValueId)
                        End If
                        If sv IsNot Nothing Then
                            result.SemanticValueBinding = New NodeBindingInfo() With {
                                .Type = "semantic-value",
                                .Id = sv.Id,
                                .Name = sv.Value,
                                .Value = matchedText ' Il testo effettivamente matchato dall'input
                            }
                        End If
                End Select
            Next
        End Sub

    End Module
