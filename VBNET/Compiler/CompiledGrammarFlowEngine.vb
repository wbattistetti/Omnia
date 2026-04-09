Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports GrammarFlowEngine
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Motore GrammarFlow: parse grafo → <see cref="EngineResult"/> (GUID canonici via CanonicalGuidTable).
''' </summary>
Public NotInheritable Class CompiledGrammarFlowEngine
    Implements IInterpretationEngine

    Private ReadOnly _displayName As String
    Private ReadOnly _contract As CompiledNlpContract
    Private ReadOnly _table As CanonicalGuidTable
    Private ReadOnly _grammar As Grammar
    Private ReadOnly _grammarEngine As GrammarEngine

    Public Sub New(displayName As String, task As CompiledUtteranceTask, contract As CompiledNlpContract, table As CanonicalGuidTable, grammarFlow As Object)
        _displayName = displayName
        _contract = contract
        _table = table
        If grammarFlow Is Nothing Then
            Throw New ArgumentNullException(NameOf(grammarFlow))
        End If
        Dim grammarJson = JsonConvert.SerializeObject(grammarFlow)
        Dim grammar = JsonConvert.DeserializeObject(Of Grammar)(grammarJson)
        If grammar Is Nothing Then
            Throw New InvalidOperationException("GrammarFlow deserialization returned Nothing.")
        End If
        _grammar = grammar
        _grammarEngine = New GrammarEngine(grammar, useRegex:=True)
    End Sub

    Public ReadOnly Property DisplayName As String Implements IInterpretationEngine.DisplayName
        Get
            Return _displayName
        End Get
    End Property

    Public Function Parse(utterance As String) As EngineResult Implements IInterpretationEngine.Parse

        Dim inputTrimmed = If(utterance, String.Empty).Trim()
        Dim gf = _grammarEngine.Parse(inputTrimmed)

        If gf Is Nothing OrElse gf.ParseEvent <> ParseEvents.Match Then
            Return EngineResult.NoMatch(inputTrimmed)
        End If

        If gf.Bindings Is Nothing OrElse gf.Bindings.Count = 0 Then
            Return EngineResult.NoMatch(inputTrimmed)
        End If

        Dim merged As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        For Each binding In gf.Bindings
            Dim bindingKey = binding.Key
            Dim slotValue = binding.Value
            If slotValue Is Nothing Then Continue For

            Dim matchedSubId As String = Nothing
            Dim fv = NlpContractCompiler.TryGetFlowVariableIdForGrammarSlot(_grammar, bindingKey)
            If Not String.IsNullOrEmpty(fv) Then
                matchedSubId = NlpContractCompiler.ResolveGrammarSlotToSubMappingKey(bindingKey, _grammar, _contract)
            Else
                matchedSubId = NlpContractCompiler.ResolveSubIdForSlot(bindingKey, _contract)
            End If
            If String.IsNullOrEmpty(matchedSubId) Then
                matchedSubId = bindingKey
            End If

            merged(matchedSubId) = slotValue
        Next

        If merged.Count = 0 Then
            Return EngineResult.NoMatch(inputTrimmed)
        End If

        Dim matches As New List(Of ParserMatch)()
        For Each kv In merged.OrderBy(Function(k) k.Key, StringComparer.OrdinalIgnoreCase)
            Dim guid = _table.TryResolveSlotBindingKey(kv.Key)
            If String.IsNullOrEmpty(guid) Then
                guid = _table.MainNodeCanonicalGuid
            End If
            Dim valStr = kv.Value.ToString().Trim()
            matches.Add(New ParserMatch With {
                .Guid = guid,
                .Value = valStr,
                .Linguistic = valStr
            })
        Next

        Return EngineResultFactory.FromMatches(matches, inputTrimmed, inputTrimmed)
    End Function

End Class
