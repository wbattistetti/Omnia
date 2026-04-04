' ParserExtraction.vb
' NLP extraction: GrammarFlow (mapped to subId) → regex contract fallback.
' Single source of truth for VB runtime; TS simulator/debugger call /api/nlp/contract-extract.

Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Compiler.DTO.IDE
Imports TaskEngine
Imports IParsableTask = TaskEngine.IParsableTask
Imports GrammarFlowEngine
Imports GrammarFlowEngine.Models
Imports Newtonsoft.Json

Partial Public Class Parser

    ' -------------------------------------------------------------------------
    ' Public API — leaf: single string (merged) for legacy callers
    ' -------------------------------------------------------------------------

    Public Shared Function ExtractSimple(input As String, node As IParsableTask) As String
        If String.IsNullOrEmpty(input) Then
            Throw New ArgumentException("Input cannot be empty.", NameOf(input))
        End If

        If node.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract.")
        End If

        Dim dict = ExtractLeafDictionary(input, node)
        If dict Is Nothing OrElse dict.Count = 0 Then Return Nothing
        Return MergeDictionaryValuesToString(dict)
    End Function

    ''' <summary>
    ''' Leaf extraction: subId → value. GrammarFlow first, then regex. No FirstOrDefault on bindings.
    ''' </summary>
    Public Shared Function ExtractLeafDictionary(input As String, node As IParsableTask) As Dictionary(Of String, Object)
        If String.IsNullOrEmpty(input) Then
            Throw New ArgumentException("Input cannot be empty.", NameOf(input))
        End If
        If node.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract.")
        End If
        Return ExtractLeafDictionaryInternal(input.Trim(), node.NlpContract)
    End Function

    ''' <summary>
    ''' Composite extraction: subId → value. GrammarFlow first, then regex.
    ''' </summary>
    Public Shared Function ExtractCompositeDictionary(input As String, node As IParsableTask) As Dictionary(Of String, Object)
        If String.IsNullOrEmpty(input) Then
            Throw New ArgumentException("Input cannot be empty.", NameOf(input))
        End If
        If node.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract.")
        End If
        Return ExtractCompositeDictionaryInternal(input.Trim(), node.NlpContract)
    End Function

    ''' <summary>
    ''' Maps GrammarFlow binding keys to contract subIds (same rules as grammarflow-extract HTTP handler).
    ''' Multiple slots mapping to the same subId are merged with a single space (deterministic key order).
    ''' </summary>
    Public Shared Function MapGrammarBindingsToSubIds(
        bindings As Dictionary(Of String, Object),
        contract As CompiledNlpContract
    ) As Dictionary(Of String, Object)

        Dim extracted As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        If bindings Is Nothing OrElse bindings.Count = 0 Then Return extracted

        If contract.SubDataMapping Is Nothing OrElse contract.SubDataMapping.Count = 0 Then
            For Each kv In bindings.OrderBy(Function(k) k.Key, StringComparer.OrdinalIgnoreCase)
                extracted(kv.Key) = kv.Value
            Next
            Return extracted
        End If

        For Each binding In bindings.OrderBy(Function(k) k.Key, StringComparer.OrdinalIgnoreCase)
            Dim slotName = binding.Key
            Dim slotValue = binding.Value
            If slotValue Is Nothing Then Continue For

            Dim matchedSubId As String = ResolveSubIdForSlot(slotName, contract)
            If String.IsNullOrEmpty(matchedSubId) Then
                matchedSubId = slotName
            End If

            Dim s = slotValue.ToString()
            If extracted.ContainsKey(matchedSubId) Then
                Dim prev = extracted(matchedSubId).ToString()
                extracted(matchedSubId) = prev & " " & s
            Else
                extracted(matchedSubId) = slotValue
            End If
        Next

        Return extracted
    End Function

    Private Shared Function ResolveSubIdForSlot(slotName As String, contract As CompiledNlpContract) As String
        If contract.SubDataMapping.ContainsKey(slotName) Then Return slotName

        For Each kvp In contract.SubDataMapping
            Dim gn = kvp.Value?.GroupName
            If Not String.IsNullOrEmpty(gn) AndAlso String.Equals(gn, slotName, StringComparison.OrdinalIgnoreCase) Then
                Return kvp.Key
            End If
        Next
        Return Nothing
    End Function

    ' -------------------------------------------------------------------------
    ' Internal — leaf
    ' -------------------------------------------------------------------------

    Private Shared Function ExtractLeafDictionaryInternal(input As String, contract As CompiledNlpContract) As Dictionary(Of String, Object)
        EnsureCompiledMainRegex(contract)

        Dim grammarFlowEngine = GetActiveGrammarFlowEngine(contract)
        Dim regexEngine = GetActiveRegexEngine(contract)

        If grammarFlowEngine IsNot Nothing Then
            Dim gf = TryGrammarFlowMapped(input, contract, grammarFlowEngine)
            If gf IsNot Nothing AndAlso gf.Count > 0 Then Return gf
        End If

        If regexEngine IsNot Nothing Then
            Return TryRegexLeafDictionary(input, contract)
        End If

        Return Nothing
    End Function

    ' -------------------------------------------------------------------------
    ' Internal — composite
    ' -------------------------------------------------------------------------

    Private Shared Function ExtractCompositeDictionaryInternal(input As String, contract As CompiledNlpContract) As Dictionary(Of String, Object)
        EnsureCompiledMainRegex(contract)

        Dim grammarFlowEngine = GetActiveGrammarFlowEngine(contract)
        Dim regexEngine = GetActiveRegexEngine(contract)

        If grammarFlowEngine IsNot Nothing Then
            Dim gf = TryGrammarFlowMapped(input, contract, grammarFlowEngine)
            If gf IsNot Nothing AndAlso gf.Count > 0 Then Return gf
        End If

        If regexEngine IsNot Nothing Then
            Return TryRegexCompositeDictionary(input, contract)
        End If

        Return Nothing
    End Function

    Private Shared Function TryGrammarFlowMapped(
        input As String,
        contract As CompiledNlpContract,
        grammarFlowEngine As NLPEngine
    ) As Dictionary(Of String, Object)

        Dim grammar = DeserializeGrammar(grammarFlowEngine.GrammarFlow)
        If grammar Is Nothing Then Return Nothing

        Dim engine As New GrammarEngine(grammar, useRegex:=True)
        Dim parseResult = engine.Parse(input)

        If Not parseResult.Success Then Return Nothing
        If parseResult.Bindings Is Nothing OrElse parseResult.Bindings.Count = 0 Then Return Nothing

        Return MapGrammarBindingsToSubIds(parseResult.Bindings, contract)
    End Function

    Private Shared Function TryRegexCompositeDictionary(input As String, contract As CompiledNlpContract) As Dictionary(Of String, Object)
        Dim regexContract = GetActiveRegexEngine(contract)
        If regexContract Is Nothing OrElse regexContract.Patterns Is Nothing OrElse regexContract.Patterns.Count = 0 Then
            Throw New InvalidOperationException("No enabled regex contract with patterns for composite extraction.")
        End If

        If contract.SubDataMapping Is Nothing OrElse contract.SubDataMapping.Count = 0 Then
            Throw New InvalidOperationException("SubDataMapping is empty for composite extraction.")
        End If

        Dim pattern = regexContract.Patterns(0)
        Dim m = New Regex(pattern, RegexOptions.IgnoreCase).Match(input.Trim())
        If Not m.Success Then Return Nothing

        Dim result As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        For Each kvp In contract.SubDataMapping
            Dim group = m.Groups(kvp.Value.GroupName)
            If group IsNot Nothing AndAlso group.Success Then
                Dim value = group.Value.Trim()
                If Not String.IsNullOrEmpty(value) Then
                    result(kvp.Key) = value
                End If
            End If
        Next

        Return If(result.Count > 0, result, Nothing)
    End Function

    Private Shared Function TryRegexLeafDictionary(input As String, contract As CompiledNlpContract) As Dictionary(Of String, Object)
        If contract.CompiledMainRegex Is Nothing Then
            Throw New InvalidOperationException("CompiledMainRegex is required for regex leaf extraction.")
        End If

        Dim m = contract.CompiledMainRegex.Match(input.Trim())
        If Not m.Success Then Return Nothing

        Dim result As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)

        If contract.SubDataMapping IsNot Nothing AndAlso contract.SubDataMapping.Count > 0 Then
            For Each kvp In contract.SubDataMapping
                Dim gn = kvp.Value?.GroupName
                If String.IsNullOrEmpty(gn) Then Continue For
                Dim g = m.Groups(gn)
                If g IsNot Nothing AndAlso g.Success Then
                    Dim value = g.Value.Trim()
                    If Not String.IsNullOrEmpty(value) Then
                        result(kvp.Key) = value
                    End If
                End If
            Next
            If result.Count > 0 Then Return result
        End If

        For i As Integer = 1 To m.Groups.Count - 1
            If Not String.IsNullOrEmpty(m.Groups(i).Value) Then
                If contract.SubDataMapping IsNot Nothing AndAlso contract.SubDataMapping.Count = 1 Then
                    Dim onlyKey = contract.SubDataMapping.Keys.First()
                    result(onlyKey) = m.Groups(i).Value
                    Return result
                End If
                Throw New InvalidOperationException(
                    "Leaf regex extraction: numbered capture matched but SubDataMapping is not a single entry; use named groups in the pattern.")
            End If
        Next

        If Not String.IsNullOrEmpty(m.Value) Then
            If contract.SubDataMapping IsNot Nothing AndAlso contract.SubDataMapping.Count = 1 Then
                result(contract.SubDataMapping.Keys.First()) = m.Value
                Return result
            End If
        End If

        Return Nothing
    End Function

    Private Shared Function MergeDictionaryValuesToString(d As Dictionary(Of String, Object)) As String
        If d Is Nothing OrElse d.Count = 0 Then Return Nothing
        Dim parts = d.OrderBy(Function(kv) kv.Key, StringComparer.OrdinalIgnoreCase).Select(Function(kv) kv.Value.ToString())
        Return String.Join(" ", parts)
    End Function

    Public Shared Sub EnsureCompiledMainRegex(contract As CompiledNlpContract)
        If contract Is Nothing Then Return
        If contract.CompiledMainRegex IsNot Nothing Then Return

        Dim regexEngine = GetActiveRegexEngine(contract)
        If regexEngine Is Nothing OrElse regexEngine.Patterns Is Nothing OrElse regexEngine.Patterns.Count = 0 Then Return

        Try
            contract.CompiledMainRegex = New Regex(regexEngine.Patterns(0), RegexOptions.IgnoreCase Or RegexOptions.Compiled)
        Catch ex As Exception
            Throw New InvalidOperationException($"Failed to compile main regex pattern: {ex.Message}", ex)
        End Try
    End Sub

    ' -------------------------------------------------------------------------
    ' Legacy entry used by Parser.vb — keep private wrapper
    ' -------------------------------------------------------------------------

    Private Shared Function ExtractComposite(input As String, node As IParsableTask) As Dictionary(Of String, Object)
        If node Is Nothing OrElse Not node.HasSubTasks() Then Return Nothing
        Return ExtractCompositeDictionary(input, node)
    End Function

    ''' <summary> Exposed for unit tests and HTTP contract-extract handler. </summary>
    Public Shared Function MergeLeafDictionaryToString(d As Dictionary(Of String, Object)) As String
        Return MergeDictionaryValuesToString(d)
    End Function

    Private Shared Function GetActiveGrammarFlowEngine(contract As CompiledNlpContract) As NLPEngine
        Return contract.Engines?.FirstOrDefault(
            Function(e) e.Type = "grammarflow" AndAlso e.Enabled AndAlso e.GrammarFlow IsNot Nothing)
    End Function

    Private Shared Function GetActiveRegexEngine(contract As CompiledNlpContract) As NLPEngine
        Return contract.Engines?.FirstOrDefault(
            Function(e) e.Type = "regex" AndAlso e.Enabled)
    End Function

    Private Shared Function DeserializeGrammar(grammarFlow As Object) As GrammarFlowEngine.Grammar
        Try
            Dim grammarJson = JsonConvert.SerializeObject(grammarFlow)
            Return JsonConvert.DeserializeObject(Of GrammarFlowEngine.Grammar)(grammarJson)
        Catch
            Return Nothing
        End Try
    End Function

End Class
