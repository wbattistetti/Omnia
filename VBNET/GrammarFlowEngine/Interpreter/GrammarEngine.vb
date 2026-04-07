Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports GrammarFlowEngine.Models
''' <summary>
''' Main Grammar Flow Engine
''' Front end → Grammar Compiler → Grammar Flow Engine
''' Supports both navigation-based and regex-based parsing
''' </summary>
Public Class GrammarEngine
    Private compiledGrammar As CompiledGrammar
    Private compiledRegexGrammar As CompiledRegexGrammar
    Private useRegexMode As Boolean = False

    ''' <summary>
    ''' Creates a new engine from a compiled grammar
    ''' </summary>
    Public Sub New(compiledGrammar As CompiledGrammar, Optional useRegex As Boolean = False)
        Me.compiledGrammar = compiledGrammar
        Me.useRegexMode = useRegex

        If useRegex Then
            Me.compiledRegexGrammar = RegexGrammarCompiler.CompileToRegex(compiledGrammar)
        End If
    End Sub

    ''' <summary>
    ''' Creates a new engine from a raw grammar (compiles it first)
    ''' </summary>
    Public Sub New(grammar As Grammar, Optional useRegex As Boolean = False)
        Me.compiledGrammar = GrammarCompiler.Compile(grammar)
        Me.useRegexMode = useRegex

        If useRegex Then
            Me.compiledRegexGrammar = RegexGrammarCompiler.CompileToRegex(compiledGrammar)
        End If
    End Sub

    ''' <summary>
    ''' Parses text using the grammar
    ''' </summary>
    Public Function Parse(text As String, Optional maxGarbage As Integer = 5) As ParseResult
        If String.IsNullOrEmpty(text) Then
            Return New ParseResult() With {
                    .ParseEvent = ParseEvents.NoInput,
                    .ErrorMessage = "Input text is empty"
                }
        End If

        If compiledGrammar.EntryNodes.Count = 0 Then
            Return New ParseResult() With {
                    .ParseEvent = ParseEvents.InvalidGrammar,
                    .ErrorMessage = "Grammar has no entry nodes"
                }
        End If

        ' Use regex mode if enabled and compiled
        If useRegexMode AndAlso compiledRegexGrammar IsNot Nothing Then
            Return ParseWithRegex(text)
        Else
            Return ParseWithNavigation(text, maxGarbage)
        End If
    End Function

    ''' <summary>
    ''' Parses text using regex-based matching
    ''' </summary>
    Private Function ParseWithRegex(text As String) As ParseResult
        Dim regexResult = RegexGrammarCompiler.MatchAndExtract(compiledRegexGrammar, text)

        If Not regexResult.Success Then
            Return New ParseResult() With {
                .ParseEvent = ParseEvents.NoMatch,
                .ErrorMessage = "No match found"
            }
        End If

        ' Convert RegexMatchResult to ParseResult
        ' Build list of matches (no fake root)
        Dim matches = BuildMatchTreeFromRegexResult(regexResult, compiledRegexGrammar)

        ' Create a temporary root for compatibility with ParseResult.MatchTree
        ' But we'll use matches directly in BuildMatchDetails
        Dim root As New MatchResult() With {
            .Success = True,
            .MatchedText = regexResult.MatchedText,
            .ConsumedWords = regexResult.ConsumedWords,
            .ConsumedChars = regexResult.MatchedText.Length,
            .Bindings = regexResult.Bindings,
            .Children = matches ' Store matches as children (will be processed directly)
        }

        Return New ParseResult() With {
            .ParseEvent = ParseEvents.Match,
            .Bindings = regexResult.Bindings,
            .ConsumedWords = regexResult.ConsumedWords,
            .GarbageUsed = regexResult.GarbageUsed,
            .MatchTree = root ' Temporary root, but matches are in Children
        }
    End Function

    ''' <summary>
    ''' Parses text using navigation-based matching (original implementation)
    ''' </summary>
    Private Function ParseWithNavigation(text As String, maxGarbage As Integer) As ParseResult
        Dim allResults As New List(Of MatchResult)()

        ' Try each entry node
        For Each entryNode In compiledGrammar.EntryNodes
            Dim context As New PathMatchState() With {
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
                    .ParseEvent = ParseEvents.NoMatch,
                    .ErrorMessage = "No match found"
                }
        End If

        ' Take the first best result (or merge if multiple)
        Dim bestResult = bestResults.First()
        Dim parseResult As New ParseResult() With {
                .ParseEvent = ParseEvents.Match,
                .Bindings = bestResult.Bindings,
                .ConsumedWords = bestResult.ConsumedWords,
                .GarbageUsed = bestResult.GarbageUsed,
                .MatchTree = bestResult ' ✅ Passa l'albero gerarchico completo
            }

        Return parseResult
    End Function

    ''' <summary>
    ''' Builds MatchTree from RegexMatchResult for UI display
    ''' ✅ SIMPLIFIED: Process each matched node directly, check its bindings, build hierarchy
    ''' Returns a list of root matches (each match is independent, no fake root)
    ''' Structure: Slot → SemanticValue → Linguistic (or SemanticValue → Linguistic, or Linguistic)
    ''' </summary>
    Private Function BuildMatchTreeFromRegexResult(
        regexResult As RegexMatchResult,
        compiledRegexGrammar As CompiledRegexGrammar
    ) As List(Of MatchResult)
        Dim matches As New List(Of MatchResult)()
        Dim processedNodeIds = New HashSet(Of String)()

        ' ✅ SIMPLIFIED: Process each matched node directly
        For Each nodeMatch In regexResult.NodeMatches
            ' Skip if already processed (avoid duplicates)
            If processedNodeIds.Contains(nodeMatch.NodeId) Then Continue For

            Dim node = compiledRegexGrammar.OriginalGrammar.Nodes.GetValueOrDefault(nodeMatch.NodeId)
            If node Is Nothing Then Continue For

            ' Check bindings of THIS node (source of truth)
            Dim hasSlot = node.Bindings IsNot Nothing AndAlso
                          node.Bindings.Any(Function(b) b.Type = "slot" AndAlso Not String.IsNullOrEmpty(b.SlotId))
            Dim hasSemanticValue = node.Bindings IsNot Nothing AndAlso
                                   node.Bindings.Any(Function(b) b.Type = "semantic-value" AndAlso Not String.IsNullOrEmpty(b.ValueId))

            ' Get slot and semantic-value IDs from node bindings
            Dim slotId As String = Nothing
            Dim semanticValueId As String = Nothing

            If hasSlot Then
                Dim slotBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "slot")
                If slotBinding IsNot Nothing Then
                    slotId = slotBinding.SlotId
                End If
            End If

            If hasSemanticValue Then
                Dim svBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "semantic-value")
                If svBinding IsNot Nothing Then
                    semanticValueId = svBinding.ValueId
                End If
            End If

            Dim hasSemanticSet = node.Bindings IsNot Nothing AndAlso
                                 node.Bindings.Any(Function(b) b.Type = "semantic-set" AndAlso Not String.IsNullOrEmpty(b.SetId))
            Dim semanticSetId As String = Nothing
            If hasSemanticSet Then
                Dim ssBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "semantic-set")
                If ssBinding IsNot Nothing Then
                    semanticSetId = ssBinding.SetId
                End If
            End If

            ' Build hierarchy based on bindings
            If hasSlot AndAlso hasSemanticValue Then
                ' ✅ Caso 1: Slot + SemanticValue → Slot → SemanticValue → Linguistic
                Dim slot = compiledRegexGrammar.OriginalGrammar.Slots.GetValueOrDefault(slotId)
                Dim semanticValue = compiledRegexGrammar.OriginalGrammar.SemanticValues.GetValueOrDefault(semanticValueId)

                If slot IsNot Nothing AndAlso semanticValue IsNot Nothing Then
                    ' Create Slot
                    Dim slotResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "slot",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SlotBinding = New NodeBindingInfo() With {
                            .Type = "slot",
                            .Id = slot.Id,
                            .Name = slot.Name,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    ' Create SemanticValue as child of Slot
                    Dim svResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "semantic-value",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SemanticValueBinding = New NodeBindingInfo() With {
                            .Type = "semantic-value",
                            .Id = semanticValue.Id,
                            .Name = semanticValue.Value,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    ' Add Linguistic as child of SemanticValue
                    If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                        svResult.Children.Add(New MatchResult() With {
                            .Success = True,
                            .NodeId = $"ling-{nodeMatch.NodeId}",
                            .NodeLabel = nodeMatch.MatchedText,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "linguistic",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)()
                        })
                    End If

                    slotResult.Children.Add(svResult)
                    matches.Add(slotResult)
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If

            ElseIf hasSlot AndAlso hasSemanticSet Then
                ' Slot + semantic-set on same node: Slot → resolved semantic value → Linguistic
                Dim resolvedFromSet = ResolveSemanticValueForSet(regexResult, semanticSetId, nodeMatch.MatchedText, compiledRegexGrammar)
                Dim slot = compiledRegexGrammar.OriginalGrammar.Slots.GetValueOrDefault(slotId)
                If slot IsNot Nothing Then
                    Dim slotResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "slot",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SlotBinding = New NodeBindingInfo() With {
                            .Type = "slot",
                            .Id = slot.Id,
                            .Name = slot.Name,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    If resolvedFromSet IsNot Nothing Then
                        Dim svResult As New MatchResult() With {
                            .Success = True,
                            .NodeId = nodeMatch.NodeId,
                            .NodeLabel = nodeMatch.NodeLabel,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "semantic-value",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)(),
                            .SemanticValueBinding = New NodeBindingInfo() With {
                                .Type = "semantic-value",
                                .Id = resolvedFromSet.Id,
                                .Name = resolvedFromSet.Value,
                                .Value = nodeMatch.MatchedText
                            }
                        }
                        If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                            svResult.Children.Add(New MatchResult() With {
                                .Success = True,
                                .NodeId = $"ling-{nodeMatch.NodeId}",
                                .NodeLabel = nodeMatch.MatchedText,
                                .MatchedText = nodeMatch.MatchedText,
                                .MatchType = "linguistic",
                                .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                                .ConsumedChars = nodeMatch.MatchedText.Length,
                                .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                                .Children = New List(Of MatchResult)()
                            })
                        End If
                        slotResult.Children.Add(svResult)
                    ElseIf Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                        slotResult.Children.Add(New MatchResult() With {
                            .Success = True,
                            .NodeId = $"ling-{nodeMatch.NodeId}",
                            .NodeLabel = nodeMatch.MatchedText,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "linguistic",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)()
                        })
                    End If

                    matches.Add(slotResult)
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If

            ElseIf hasSlot Then
                ' ✅ Caso 2: Solo Slot → Slot → Linguistic
                Dim slot = compiledRegexGrammar.OriginalGrammar.Slots.GetValueOrDefault(slotId)
                If slot IsNot Nothing Then
                    Dim slotResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "slot",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SlotBinding = New NodeBindingInfo() With {
                            .Type = "slot",
                            .Id = slot.Id,
                            .Name = slot.Name,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    ' Add Linguistic as child of Slot
                    If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                        slotResult.Children.Add(New MatchResult() With {
                            .Success = True,
                            .NodeId = $"ling-{nodeMatch.NodeId}",
                            .NodeLabel = nodeMatch.MatchedText,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "linguistic",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)()
                        })
                    End If

                    matches.Add(slotResult)
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If

            ElseIf hasSemanticValue Then
                ' ✅ Caso 3: Solo SemanticValue → SemanticValue → Linguistic
                Dim semanticValue = compiledRegexGrammar.OriginalGrammar.SemanticValues.GetValueOrDefault(semanticValueId)
                If semanticValue IsNot Nothing Then
                    Dim svResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "semantic-value",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SemanticValueBinding = New NodeBindingInfo() With {
                            .Type = "semantic-value",
                            .Id = semanticValue.Id,
                            .Name = semanticValue.Value,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    ' Add Linguistic as child of SemanticValue
                    If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                        svResult.Children.Add(New MatchResult() With {
                            .Success = True,
                            .NodeId = $"ling-{nodeMatch.NodeId}",
                            .NodeLabel = nodeMatch.MatchedText,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "linguistic",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)()
                        })
                    End If

                    matches.Add(svResult)
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If

            ElseIf hasSemanticSet Then
                ' Semantic-set only: resolved canonical value (from MatchAndExtract bindings) → Linguistic
                Dim resolvedFromSet = ResolveSemanticValueForSet(regexResult, semanticSetId, nodeMatch.MatchedText, compiledRegexGrammar)
                If resolvedFromSet IsNot Nothing Then
                    Dim svResult As New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "semantic-value",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)(),
                        .SemanticValueBinding = New NodeBindingInfo() With {
                            .Type = "semantic-value",
                            .Id = resolvedFromSet.Id,
                            .Name = resolvedFromSet.Value,
                            .Value = nodeMatch.MatchedText
                        }
                    }

                    If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                        svResult.Children.Add(New MatchResult() With {
                            .Success = True,
                            .NodeId = $"ling-{nodeMatch.NodeId}",
                            .NodeLabel = nodeMatch.MatchedText,
                            .MatchedText = nodeMatch.MatchedText,
                            .MatchType = "linguistic",
                            .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                            .ConsumedChars = nodeMatch.MatchedText.Length,
                            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                            .Children = New List(Of MatchResult)()
                        })
                    End If

                    matches.Add(svResult)
                    processedNodeIds.Add(nodeMatch.NodeId)
                ElseIf Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                    matches.Add(New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "linguistic",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)()
                    })
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If

            Else
                ' ✅ Caso 4: Nessun binding → Solo Linguistic
                If Not String.IsNullOrEmpty(nodeMatch.MatchedText) Then
                    matches.Add(New MatchResult() With {
                        .Success = True,
                        .NodeId = nodeMatch.NodeId,
                        .NodeLabel = nodeMatch.NodeLabel,
                        .MatchedText = nodeMatch.MatchedText,
                        .MatchType = "linguistic",
                        .ConsumedWords = nodeMatch.MatchedText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
                        .ConsumedChars = nodeMatch.MatchedText.Length,
                        .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
                        .Children = New List(Of MatchResult)()
                    })
                    processedNodeIds.Add(nodeMatch.NodeId)
                End If
            End If
        Next

        Return matches
    End Function

    ''' <summary>
    ''' Resolves the SemanticValue for a semantic-set node using the same data MatchAndExtract produced:
    ''' first <see cref="RegexMatchResult.Bindings"/> keyed by semantic set name (canonical value),
    ''' then ids in <see cref="RegexMatchResult.SemanticValues"/>, then linguistic disambiguation.
    ''' </summary>
    Private Function ResolveSemanticValueForSet(
        regexResult As RegexMatchResult,
        setId As String,
        matchedText As String,
        compiled As CompiledRegexGrammar
    ) As SemanticValue
        If String.IsNullOrEmpty(setId) OrElse compiled?.OriginalGrammar Is Nothing Then Return Nothing

        Dim semSet = compiled.OriginalGrammar.SemanticSets.GetValueOrDefault(setId)
        If semSet Is Nothing OrElse semSet.Values Is Nothing OrElse semSet.Values.Count = 0 Then Return Nothing

        Dim canonical As String = Nothing
        If regexResult.Bindings IsNot Nothing AndAlso Not String.IsNullOrEmpty(semSet.Name) Then
            Dim obj As Object = Nothing
            If regexResult.Bindings.TryGetValue(semSet.Name, obj) AndAlso obj IsNot Nothing Then
                canonical = obj.ToString()
            End If
        End If
        If Not String.IsNullOrEmpty(canonical) Then
            Dim byCanon = semSet.Values.FirstOrDefault(Function(v) String.Equals(v.Value, canonical, StringComparison.OrdinalIgnoreCase))
            If byCanon IsNot Nothing Then Return byCanon
        End If

        If regexResult.SemanticValues IsNot Nothing Then
            For Each vid In regexResult.SemanticValues
                Dim byId = semSet.Values.FirstOrDefault(Function(v) v.Id = vid)
                If byId IsNot Nothing Then Return byId
            Next
        End If

        For Each v In semSet.Values
            If SemanticValueMatchesLinguisticCapture(v, matchedText) Then Return v
        Next
        Return Nothing
    End Function

    ''' <summary>
    ''' Same disambiguation idea as RegexGrammarCompiler semantic-set extraction (linguistic capture → value).
    ''' </summary>
    Private Function SemanticValueMatchesLinguisticCapture(v As SemanticValue, captured As String) As Boolean
        If v Is Nothing OrElse String.IsNullOrEmpty(captured) Then Return False
        If String.Equals(v.Value, captured, StringComparison.OrdinalIgnoreCase) Then Return True
        If v.Synonyms IsNot Nothing AndAlso v.Synonyms.Any(Function(s) String.Equals(s, captured, StringComparison.OrdinalIgnoreCase)) Then Return True
        If Not String.IsNullOrEmpty(v.Regex) Then
            Try
                Return Regex.IsMatch(captured, v.Regex, RegexOptions.IgnoreCase)
            Catch
                Return False
            End Try
        End If
        Return False
    End Function

    ''' <summary>
    ''' Gets the compiled grammar
    ''' </summary>
    Public ReadOnly Property Grammar As CompiledGrammar
        Get
            Return compiledGrammar
        End Get
    End Property

    ''' <summary>
    ''' Gets the compiled regex grammar (if regex mode is enabled)
    ''' </summary>
    Public ReadOnly Property RegexGrammar As CompiledRegexGrammar
        Get
            Return compiledRegexGrammar
        End Get
    End Property

    ''' <summary>
    ''' Gets whether regex mode is enabled
    ''' </summary>
    Public ReadOnly Property IsRegexMode As Boolean
        Get
            Return useRegexMode
        End Get
    End Property

End Class
