Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text
Imports System.Text.RegularExpressions
Imports GrammarFlowEngine.Models

''' <summary>
''' Compiles a grammar graph into a single regex pattern
''' Supports highlighting of matched nodes for UI visualization
''' </summary>
Public Module RegexGrammarCompiler

    ''' <summary>
    ''' Compiles a grammar into a single regex pattern
    ''' </summary>
    Public Function CompileToRegex(compiledGrammar As CompiledGrammar) As CompiledRegexGrammar
        Dim compiler As New RegexCompilerState(compiledGrammar)

        ' 1. Generate GroupId for all observable nodes (with binding or linguistic relevance)
        compiler.AssignGroupIds()

        ' 2. Generate pattern for each node
        compiler.GenerateNodePatterns()

        ' 3. Build pattern for each entry node
        compiler.BuildEntryPatterns()

        ' 4. Combine all entry patterns into single regex
        Dim fullPattern = compiler.CombineEntryPatterns()

        ' 5. Compile final regex
        Dim compiledRegex = New Regex(fullPattern, RegexOptions.IgnoreCase Or RegexOptions.Compiled)

        Return New CompiledRegexGrammar() With {
            .FullRegex = compiledRegex,
            .RegexPattern = fullPattern,
            .GroupMapping = compiler.GroupMapping,
            .OriginalGrammar = compiledGrammar,
            .GarbagePattern = String.Empty, ' Garbage is handled per-node via FreeSpeech property
            .EntryPatterns = compiler.EntryPatterns
        }
    End Function

    ''' <summary>
    ''' Matches text against compiled regex grammar and extracts bindings + matched nodes
    ''' </summary>
    Public Function MatchAndExtract(
        compiledRegexGrammar As CompiledRegexGrammar,
        text As String
    ) As RegexMatchResult
        Dim match = compiledRegexGrammar.FullRegex.Match(text)

        If Not match.Success Then
            Return New RegexMatchResult() With {.Success = False}
        End If

        Dim result As New RegexMatchResult() With {
            .Success = True,
            .MatchedText = match.Value,
            .Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase),
            .MatchedNodes = New List(Of String)(),
            .SlotValues = New Dictionary(Of String, String)(),
            .SemanticValues = New List(Of String)(),
            .NodeMatches = New List(Of NodeMatchInfo)(),
            .ConsumedWords = match.Value.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length,
            .GarbageUsed = 0 ' Regex handles garbage internally
        }

        ' Collect all matched groups with their order
        Dim matchedGroups As New List(Of (GroupName As String, Group As Group, Order As Integer))()

        For Each groupName In match.Groups.Keys
            If groupName = "0" Then Continue For ' Skip group 0 (full match)

            Dim group = match.Groups(groupName)
            If group.Success Then
                matchedGroups.Add((groupName, group, group.Index))
            End If
        Next

        ' Sort by position in text (order of appearance)
        matchedGroups = matchedGroups.OrderBy(Function(g) g.Order).ToList()

        ' Process each matched group
        Dim matchOrder = 0
        For Each matchedGroup In matchedGroups
            Dim groupName = matchedGroup.GroupName
            Dim group = matchedGroup.Group

            ' Look up group info in mapping
            Dim groupInfo = compiledRegexGrammar.GroupMapping.GetValueOrDefault(groupName)
            If groupInfo IsNot Nothing Then
                matchOrder += 1
                groupInfo.MatchOrder = matchOrder

                ' Add to matched nodes list
                result.MatchedNodes.Add(groupInfo.NodeId)

                ' Create NodeMatchInfo for highlighting
                Dim nodeMatch As New NodeMatchInfo() With {
                    .NodeId = groupInfo.NodeId,
                    .NodeLabel = groupInfo.NodeLabel,
                    .MatchedText = group.Value,
                    .BindingType = groupInfo.BindingType,
                    .SlotId = groupInfo.SlotId,
                    .SemanticValueId = groupInfo.SemanticValueId,
                    .SemanticSetId = groupInfo.SemanticSetId,
                    .MatchOrder = matchOrder,
                    .StartIndex = group.Index,
                    .EndIndex = group.Index + group.Length
                }
                result.NodeMatches.Add(nodeMatch)

                ' Extract bindings based on type
                Select Case groupInfo.BindingType
                    Case "slot"
                        If Not String.IsNullOrEmpty(groupInfo.SlotId) Then
                            Dim slot = compiledRegexGrammar.OriginalGrammar.Slots.GetValueOrDefault(groupInfo.SlotId)
                            If slot IsNot Nothing Then
                                ' G2: keys use grammar slot id, not slot name (no implicit slotId === variable label).
                                result.Bindings(slot.Id) = group.Value
                                result.SlotValues(groupInfo.SlotId) = group.Value
                            End If
                        End If

                    Case "semantic-value"
                        If Not String.IsNullOrEmpty(groupInfo.SemanticValueId) Then
                            Dim semanticValue = compiledRegexGrammar.OriginalGrammar.SemanticValues.GetValueOrDefault(groupInfo.SemanticValueId)
                            If semanticValue IsNot Nothing Then
                                result.Bindings("value") = semanticValue.Value
                                result.SemanticValues.Add(groupInfo.SemanticValueId)
                            End If
                        End If

                    Case "semantic-set"
                        ' Resolve semantic value from captured text: search every semantic-set bound to this node
                        ' (pattern may union multiple sets; first matching value wins)
                        Dim compiledNode = compiledRegexGrammar.OriginalGrammar.Nodes.GetValueOrDefault(groupInfo.NodeId)
                        If compiledNode IsNot Nothing AndAlso compiledNode.Bindings IsNot Nothing Then
                            Dim resolvedSet = False
                            For Each nb In compiledNode.Bindings
                                If resolvedSet Then Exit For
                                If Not String.Equals(nb.Type, "semantic-set", StringComparison.Ordinal) Then Continue For
                                If String.IsNullOrEmpty(nb.SetId) Then Continue For
                                Dim semanticSet = compiledRegexGrammar.OriginalGrammar.SemanticSets.GetValueOrDefault(nb.SetId)
                                If semanticSet Is Nothing OrElse semanticSet.Values Is Nothing Then Continue For
                                For Each value In semanticSet.Values
                                    If SemanticSetCapturedTextMatchesValue(value, group.Value) Then
                                        result.Bindings(semanticSet.Name) = value.Value
                                        result.SemanticValues.Add(value.Id)
                                        resolvedSet = True
                                        Exit For
                                    End If
                                Next
                            Next
                        End If

                    Case "linguistic"
                        ' Linguistic nodes don't have bindings, but are tracked for highlighting
                        ' No action needed
                End Select
            End If
        Next

        Return result
    End Function

    ''' <summary>
    ''' True if captured regex text corresponds to this semantic value (canonical, synonym, or value regex).
    ''' </summary>
    Private Function SemanticSetCapturedTextMatchesValue(value As SemanticValue, captured As String) As Boolean
        If value Is Nothing OrElse String.IsNullOrEmpty(captured) Then Return False
        If String.Equals(value.Value, captured, StringComparison.OrdinalIgnoreCase) Then Return True
        If value.Synonyms IsNot Nothing AndAlso
           value.Synonyms.Any(Function(s) String.Equals(s, captured, StringComparison.OrdinalIgnoreCase)) Then
            Return True
        End If
        If Not String.IsNullOrEmpty(value.Regex) Then
            Try
                Return Regex.IsMatch(captured, value.Regex, RegexOptions.IgnoreCase)
            Catch
                Return False
            End Try
        End If
        Return False
    End Function

End Module

''' <summary>
''' Internal state for regex compilation
''' </summary>
Friend Class RegexCompilerState
    Private ReadOnly grammar As CompiledGrammar
    Public Property GroupMapping As Dictionary(Of String, RegexGroupInfo)
    Public Property NodePatterns As Dictionary(Of String, String) ' NodeId → Pattern
    Public Property EntryPatterns As List(Of String)

    ''' <summary>
    ''' Generic garbage pattern for free speech mode (matches any characters/words)
    ''' </summary>
    Private ReadOnly GarbagePatternGeneric As String = ".*"

    Public Sub New(compiledGrammar As CompiledGrammar)
        grammar = compiledGrammar
        GroupMapping = New Dictionary(Of String, RegexGroupInfo)()
        NodePatterns = New Dictionary(Of String, String)()
        EntryPatterns = New List(Of String)()
    End Sub

    ''' <summary>
    ''' Gets garbage pattern if free speech is enabled for a node
    ''' </summary>
    Private Function GetGarbagePatternIfNeeded(node As CompiledNode) As String
        If node.FreeSpeech Then
            Return GarbagePatternGeneric
        End If
        Return String.Empty
    End Function

    ''' <summary>
    ''' Assign GroupId for all observable nodes (with binding or linguistic relevance)
    ''' </summary>
    Public Sub AssignGroupIds()
        GroupMapping = New Dictionary(Of String, RegexGroupInfo)()

        For Each node In grammar.Nodes.Values
            ' Every node with binding OR linguistic content gets a GroupId
            If HasBinding(node) OrElse HasLinguisticContent(node) Then
                Dim groupName = GenerateGroupName(node)
                Dim groupInfo = New RegexGroupInfo() With {
                    .NodeId = node.Id,
                    .NodeLabel = node.Label,
                    .BindingType = GetBindingType(node),
                    .SlotId = GetSlotId(node),
                    .SemanticValueId = GetSemanticValueId(node),
                    .SemanticSetId = GetSemanticSetId(node),
                    .IsOptional = node.[Optional],
                    .IsRepeatable = node.Repeatable
                }
                GroupMapping(groupName) = groupInfo
            End If
        Next
    End Sub

    ''' <summary>
    ''' Normalize group name to contain only valid characters (letters, numbers, underscore)
    ''' .NET regex group names cannot contain hyphens or other special characters
    ''' </summary>
    Private Function NormalizeGroupName(name As String) As String
        ' Replace everything that is not letter, number, or underscore with underscore
        Return Regex.Replace(name, "[^A-Za-z0-9_]", "_")
    End Function

    ''' <summary>
    ''' Generate unique group name for a node
    ''' </summary>
    Private Function GenerateGroupName(node As CompiledNode) As String
        ' Generate unique names: NODE_<id>, SLOT_<slotId>, SEM_<valueId>
        For Each binding In node.Bindings
            Select Case binding.Type
                Case "slot"
                    Return NormalizeGroupName($"SLOT_{binding.SlotId}")
                Case "semantic-value"
                    Return NormalizeGroupName($"SEM_{binding.ValueId}")
                Case "semantic-set"
                    ' For semantic-set, use set ID
                    Dim semanticSet = grammar.SemanticSets.GetValueOrDefault(binding.SetId)
                    If semanticSet IsNot Nothing Then
                        Return NormalizeGroupName($"SET_{semanticSet.Id}")
                    End If
            End Select
        Next
        ' Fallback: use NodeId for linguistic nodes
        Return NormalizeGroupName($"NODE_{node.Id}")
    End Function

    ''' <summary>
    ''' Check if node has any binding
    ''' </summary>
    Private Function HasBinding(node As CompiledNode) As Boolean
        Return node.Bindings IsNot Nothing AndAlso node.Bindings.Count > 0
    End Function

    ''' <summary>
    ''' Check if node has linguistic content (label, synonyms, regex)
    ''' </summary>
    Private Function HasLinguisticContent(node As CompiledNode) As Boolean
        Return Not String.IsNullOrEmpty(node.Label) OrElse
               (node.Synonyms IsNot Nothing AndAlso node.Synonyms.Count > 0) OrElse
               node.CompiledRegex IsNot Nothing
    End Function

    ''' <summary>
    ''' Get binding type for a node
    ''' </summary>
    Private Function GetBindingType(node As CompiledNode) As String
        If Not HasBinding(node) Then
            Return If(HasLinguisticContent(node), "linguistic", "none")
        End If

        For Each binding In node.Bindings
            Select Case binding.Type
                Case "slot"
                    Return "slot"
                Case "semantic-value"
                    Return "semantic-value"
                Case "semantic-set"
                    Return "semantic-set"
            End Select
        Next

        Return "none"
    End Function

    Private Function GetSlotId(node As CompiledNode) As String
        Dim slotBinding = node.Bindings?.FirstOrDefault(Function(b) b.Type = "slot")
        Return If(slotBinding IsNot Nothing, slotBinding.SlotId, Nothing)
    End Function

    Private Function GetSemanticValueId(node As CompiledNode) As String
        Dim svBinding = node.Bindings?.FirstOrDefault(Function(b) b.Type = "semantic-value")
        Return If(svBinding IsNot Nothing, svBinding.ValueId, Nothing)
    End Function

    Private Function GetSemanticSetId(node As CompiledNode) As String
        Dim setBinding = node.Bindings?.FirstOrDefault(Function(b) b.Type = "semantic-set")
        Return If(setBinding IsNot Nothing, setBinding.SetId, Nothing)
    End Function

    ''' <summary>
    ''' Single alternation of all linguistic forms from every semantic-set binding on the node.
    ''' Literals (canonical value + synonyms) are escaped; per-value Regex entries are alternated raw.
    ''' All alternatives sorted by length descending (longest first).
    ''' </summary>
    Private Function BuildSemanticSetsUnionPattern(node As CompiledNode) As String
        Dim literals As New List(Of String)()
        Dim rawRegexes As New List(Of String)()

        If node.Bindings Is Nothing Then Return String.Empty

        For Each binding In node.Bindings
            If Not String.Equals(binding.Type, "semantic-set", StringComparison.Ordinal) Then Continue For
            If String.IsNullOrEmpty(binding.SetId) Then Continue For
            Dim semanticSet = grammar.SemanticSets.GetValueOrDefault(binding.SetId)
            If semanticSet Is Nothing OrElse semanticSet.Values Is Nothing Then Continue For
            For Each sv In semanticSet.Values
                If Not String.IsNullOrEmpty(sv.Value) Then
                    literals.Add(sv.Value)
                End If
                If sv.Synonyms IsNot Nothing Then
                    For Each syn In sv.Synonyms
                        If Not String.IsNullOrEmpty(syn) Then
                            literals.Add(syn)
                        End If
                    Next
                End If
                If Not String.IsNullOrEmpty(sv.Regex) Then
                    rawRegexes.Add(sv.Regex)
                End If
            Next
        Next

        If literals.Count = 0 AndAlso rawRegexes.Count = 0 Then
            Return String.Empty
        End If

        Dim distinctLiterals = literals.Distinct(StringComparer.OrdinalIgnoreCase).ToList()
        Dim distinctRegexes = rawRegexes.Distinct(StringComparer.Ordinal).ToList()

        Dim combined As New List(Of Tuple(Of String, Boolean))()
        For Each lit In distinctLiterals
            combined.Add(Tuple.Create(lit, False))
        Next
        For Each r In distinctRegexes
            combined.Add(Tuple.Create(r, True))
        Next

        combined = combined.OrderByDescending(Function(t) t.Item1.Length).ToList()

        Dim parts As New List(Of String)()
        For Each t In combined
            If t.Item2 Then
                parts.Add(t.Item1)
            Else
                parts.Add(Regex.Escape(t.Item1))
            End If
        Next

        Return String.Join("|", parts)
    End Function

    ''' <summary>
    ''' Generate pattern for each node
    ''' </summary>
    Public Sub GenerateNodePatterns()
        NodePatterns = New Dictionary(Of String, String)()

        For Each node In grammar.Nodes.Values
            Dim pattern = BuildNodePattern(node)
            NodePatterns(node.Id) = pattern
        Next
    End Sub

    ''' <summary>
    ''' Build regex pattern for a single node
    ''' IMPORTANT: Pattern contains ONLY linguistic words (no semantic values)
    ''' Semantic values are handled at a higher layer after regex match
    ''' </summary>
    Private Function BuildNodePattern(node As CompiledNode) As String
        Dim nodePattern As String

        ' 1. Build pattern for node content - SOLO parole linguistiche
        If node.CompiledRegex IsNot Nothing Then
            ' Use existing regex (already compiled)
            nodePattern = node.CompiledRegex.ToString()
        Else
            Dim hasSemanticSetBinding = node.Bindings IsNot Nothing AndAlso
                                          node.Bindings.Any(Function(b) b.Type = "semantic-set")

            If hasSemanticSetBinding Then
                ' Union of all linguistic forms from all bound semantic sets (value + synonyms + per-value regex)
                nodePattern = BuildSemanticSetsUnionPattern(node)
                If String.IsNullOrEmpty(nodePattern) Then
                    If Not String.IsNullOrEmpty(node.Label) Then
                        nodePattern = Regex.Escape(node.Label)
                    Else
                        nodePattern = ".*?"
                    End If
                End If
            Else
                Dim words As New List(Of String)()

                Dim hasSemanticValueBinding = node.Bindings IsNot Nothing AndAlso
                                              node.Bindings.Any(Function(b) b.Type = "semantic-value")

                If hasSemanticValueBinding Then
                    ' Nodo con semantic-value binding: sinonimi del valore + sinonimi di nodo
                    Dim svBinding = node.Bindings.FirstOrDefault(Function(b) b.Type = "semantic-value")
                    If svBinding IsNot Nothing AndAlso Not String.IsNullOrEmpty(svBinding.ValueId) Then
                        Dim semanticValue = grammar.SemanticValues.GetValueOrDefault(svBinding.ValueId)
                        If semanticValue IsNot Nothing Then
                            If semanticValue.Synonyms IsNot Nothing AndAlso semanticValue.Synonyms.Count > 0 Then
                                words.AddRange(semanticValue.Synonyms)
                            End If
                        End If
                    End If

                    If node.Synonyms IsNot Nothing AndAlso node.Synonyms.Count > 0 Then
                        words.AddRange(node.Synonyms)
                    End If

                ElseIf node.Synonyms IsNot Nothing AndAlso node.Synonyms.Count > 0 Then
                    words.AddRange(node.Synonyms)

                Else
                    If Not String.IsNullOrEmpty(node.Label) Then
                        words.Add(node.Label)
                    End If
                End If

                If words.Count > 0 Then
                    Dim uniqueWords = words.Distinct(StringComparer.OrdinalIgnoreCase).OrderByDescending(Function(w) w.Length).ToList()
                    Dim escapedWords = uniqueWords.Select(Function(w) Regex.Escape(w))
                    nodePattern = String.Join("|", escapedWords)
                Else
                    nodePattern = ".*?"
                End If
            End If
        End If

        ' 2. Wrap in named group if has binding or linguistic content
        If HasBinding(node) OrElse HasLinguisticContent(node) Then
            Dim groupName = GenerateGroupName(node)
            nodePattern = $"(?<{groupName}>{nodePattern})"
        Else
            ' Non-capturing group
            nodePattern = $"(?:{nodePattern})"
        End If

        ' 3. Apply optionality
        If node.[Optional] Then
            nodePattern = $"{nodePattern}?"
        End If

        ' 4. Apply repeatability
        If node.Repeatable Then
            nodePattern = $"{nodePattern}+"
        End If

        Return nodePattern
    End Function

    ''' <summary>
    ''' Build pattern for a semantic value (value + synonyms + regex)
    ''' </summary>
    Private Function BuildSemanticValuePattern(semanticValue As SemanticValue) As String
        Dim patterns As New List(Of String)()

        ' Add main value
        patterns.Add(Regex.Escape(semanticValue.Value))

        ' Add synonyms (ordered by length)
        Dim synonyms = semanticValue.Synonyms.OrderByDescending(Function(s) s.Length)
        For Each synonym In synonyms
            patterns.Add(Regex.Escape(synonym))
        Next

        ' Add regex if present
        If Not String.IsNullOrEmpty(semanticValue.Regex) Then
            patterns.Add(semanticValue.Regex)
        End If

        Return String.Join("|", patterns)
    End Function

    ''' <summary>
    ''' Build pattern for a semantic set (all values in the set)
    ''' </summary>
    Private Function BuildSemanticSetPattern(semanticSet As SemanticSet) As String
        Dim patterns As New List(Of String)()

        For Each value In semanticSet.Values
            Dim svPattern = BuildSemanticValuePattern(value)
            patterns.Add(svPattern)
        Next

        ' Order by length (longer patterns first)
        Return String.Join("|", patterns)
    End Function

    ''' <summary>
    ''' Build pattern for each entry node
    ''' </summary>
    Public Sub BuildEntryPatterns()
        EntryPatterns = New List(Of String)()

        For Each entryNode In grammar.EntryNodes
            Dim entryPattern = BuildPathPattern(entryNode, New HashSet(Of String)(), 0)
            If Not String.IsNullOrEmpty(entryPattern) Then
                ' ✅ Add garbage at the beginning if entry node has FreeSpeech = True
                If entryNode.FreeSpeech Then
                    entryPattern = $"{GarbagePatternGeneric}?{entryPattern}"
                End If
                EntryPatterns.Add(entryPattern)
            End If
        Next
    End Sub

    ''' <summary>
    ''' Build pattern for a path starting from a node
    ''' </summary>
    Private Function BuildPathPattern(
        node As CompiledNode,
        visited As HashSet(Of String),
        depth As Integer
    ) As String
        ' Cycle protection (max depth)
        If depth > 100 Then
            Return String.Empty
        End If

        ' Cycle protection (visited)
        If visited.Contains(node.Id) Then
            ' Cycle detected: use quantifier for repetition
            Return String.Empty
        End If

        visited.Add(node.Id)

        Try
            ' 1. Pattern of current node
            Dim nodePattern = NodePatterns(node.Id)

            ' 2. Pattern of children
            Dim edges = grammar.Edges.GetValueOrDefault(node.Id, New List(Of CompiledEdge)())

            Dim fullPattern As String
            Dim isTerminalNode = edges.Count = 0

            If isTerminalNode Then
                ' Terminal node
                fullPattern = nodePattern
                ' ✅ Add garbage at the end if terminal node has FreeSpeech = True
                If node.FreeSpeech Then
                    fullPattern = $"{fullPattern}{GarbagePatternGeneric}?"
                End If
            Else
                ' Determine connection type
                Dim sequential = edges.Where(Function(e) e.Type = EdgeType.Sequential).ToList()
                Dim alternative = edges.Where(Function(e) e.Type = EdgeType.Alternative).ToList()
                Dim optionalEdges = edges.Where(Function(e) e.Type = EdgeType.IsOptional).ToList()

                If sequential.Any() Then
                    ' SEQUENTIAL: node + (garbage?) + children in order
                    Dim sequentialPattern = BuildSequentialPattern(node, sequential, visited, depth)
                    If Not String.IsNullOrEmpty(sequentialPattern) Then
                        fullPattern = $"{nodePattern}\s*{sequentialPattern}"
                    Else
                        fullPattern = nodePattern
                    End If
                ElseIf alternative.Any() Then
                    ' ALTERNATIVE: node + (child1|child2|...)
                    Dim alternativePattern = BuildAlternativePattern(node, alternative, visited, depth)
                    If Not String.IsNullOrEmpty(alternativePattern) Then
                        fullPattern = $"{nodePattern}\s*{alternativePattern}"
                    Else
                        fullPattern = nodePattern
                    End If
                ElseIf optionalEdges.Any() Then
                    ' OPTIONAL: node + (child)?
                    Dim optionalPattern = BuildOptionalPattern(node, optionalEdges, visited, depth)
                    If Not String.IsNullOrEmpty(optionalPattern) Then
                        fullPattern = $"{nodePattern}\s*{optionalPattern}?"
                    Else
                        fullPattern = nodePattern
                    End If
                Else
                    fullPattern = nodePattern
                End If
            End If

            ' 4. Add garbage at the end if this path ends here and node has FreeSpeech = True
            ' (For terminal nodes, garbage is already added above)
            ' For paths with children, we add garbage only if the last processed node has FreeSpeech = True
            ' This is handled recursively when children are terminal nodes

            Return fullPattern

        Finally
            visited.Remove(node.Id)
        End Try
    End Function

    ''' <summary>
    ''' Build pattern for sequential edges
    ''' </summary>
    Private Function BuildSequentialPattern(
        node As CompiledNode,
        sequentialEdges As List(Of CompiledEdge),
        visited As HashSet(Of String),
        depth As Integer
    ) As String
        ' Sort by Order
        Dim orderedEdges = sequentialEdges.OrderBy(Function(e) e.Order).ToList()

        Dim patterns As New List(Of String)()

        For Each edge In orderedEdges
            Dim targetNode = grammar.Nodes.GetValueOrDefault(edge.Target)
            If targetNode IsNot Nothing Then
                Dim childPattern = BuildPathPattern(targetNode, visited, depth + 1)
                If Not String.IsNullOrEmpty(childPattern) Then
                    patterns.Add(childPattern)
                End If
            End If
        Next

        ' Sequence: pattern1 + pattern2 + ... (no garbage separator for now)
        ' Use minimal whitespace if needed, but better nothing
        Return String.Join("", patterns)
    End Function

    ''' <summary>
    ''' Build pattern for alternative edges
    ''' </summary>
    Private Function BuildAlternativePattern(
        node As CompiledNode,
        alternativeEdges As List(Of CompiledEdge),
        visited As HashSet(Of String),
        depth As Integer
    ) As String
        Dim patterns As New List(Of String)()

        For Each edge In alternativeEdges
            Dim targetNode = grammar.Nodes.GetValueOrDefault(edge.Target)
            If targetNode IsNot Nothing Then
                Dim childPattern = BuildPathPattern(targetNode, visited, depth + 1)
                If Not String.IsNullOrEmpty(childPattern) Then
                    patterns.Add(childPattern)
                End If
            End If
        Next

        ' Alternative: (pattern1|pattern2|pattern3)
        If patterns.Count > 0 Then
            Return $"({String.Join("|", patterns)})"
        End If

        Return String.Empty
    End Function

    ''' <summary>
    ''' Build pattern for optional edges
    ''' </summary>
    Private Function BuildOptionalPattern(
        node As CompiledNode,
        optionalEdges As List(Of CompiledEdge),
        visited As HashSet(Of String),
        depth As Integer
    ) As String
        ' For optional, build pattern of child
        Dim patterns As New List(Of String)()

        For Each edge In optionalEdges
            Dim targetNode = grammar.Nodes.GetValueOrDefault(edge.Target)
            If targetNode IsNot Nothing Then
                Dim childPattern = BuildPathPattern(targetNode, visited, depth + 1)
                If Not String.IsNullOrEmpty(childPattern) Then
                    patterns.Add(childPattern)
                End If
            End If
        Next

        If patterns.Count > 0 Then
            Return $"({String.Join("|", patterns)})"
        End If

        Return String.Empty
    End Function

    ''' <summary>
    ''' Combine all entry patterns into single regex
    ''' </summary>
    Public Function CombineEntryPatterns() As String
        If EntryPatterns.Count = 0 Then
            Throw New InvalidOperationException("No entry patterns found")
        End If

        If EntryPatterns.Count = 1 Then
            ' Single entry: simple regex (no garbage)
            Return $"^{EntryPatterns(0)}$"
        Else
            ' Multiple entries: alternation (no garbage)
            Dim combined = String.Join("|", EntryPatterns)
            Return $"^({combined})$"
        End If
    End Function

End Class
