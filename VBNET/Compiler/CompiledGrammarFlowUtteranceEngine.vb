Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports GrammarFlowEngine
Imports Newtonsoft.Json
Imports TaskEngine
Imports TaskEngine.UtteranceInterpretation

''' <summary>
''' Motore GrammarFlow da contratto NLP: stesso ordine logico del vecchio percorso, ma UniformExtraction + GUID canonici.
''' </summary>
Public NotInheritable Class CompiledGrammarFlowUtteranceEngine
    Implements IUtteranceInterpretationEngine

    Private ReadOnly _displayName As String
    Private ReadOnly _task As CompiledUtteranceTask
    Private ReadOnly _contract As CompiledNlpContract
    Private ReadOnly _table As CanonicalGuidTable
    Private ReadOnly _grammarEngine As GrammarEngine

    Public Sub New(displayName As String, task As CompiledUtteranceTask, contract As CompiledNlpContract, table As CanonicalGuidTable, grammarFlow As Object)
        _displayName = displayName
        _task = task
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
        _grammarEngine = New GrammarEngine(grammar, useRegex:=True)
    End Sub

    Public ReadOnly Property DisplayName As String Implements IUtteranceInterpretationEngine.DisplayName
        Get
            Return _displayName
        End Get
    End Property

    Public Function Parse(utterance As String) As UtteranceParseResult Implements IUtteranceInterpretationEngine.Parse
        If String.IsNullOrWhiteSpace(utterance) Then Return UtteranceParseResult.NoMatch()

        Dim input = utterance.Trim()
        Dim parseResult = _grammarEngine.Parse(input)
        If parseResult Is Nothing OrElse Not parseResult.Success Then
            Return UtteranceParseResult.NoMatch()
        End If
        If parseResult.Bindings Is Nothing OrElse parseResult.Bindings.Count = 0 Then
            Return UtteranceParseResult.NoMatch()
        End If

        Dim merged As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        For Each binding In parseResult.Bindings.OrderBy(Function(k) k.Key, StringComparer.OrdinalIgnoreCase)
            Dim slotName = binding.Key
            Dim slotValue = binding.Value
            If slotValue Is Nothing Then Continue For

            Dim matchedSubId = NlpContractCompiler.ResolveSubIdForSlot(slotName, _contract)
            If String.IsNullOrEmpty(matchedSubId) Then
                matchedSubId = slotName
            End If

            Dim s = slotValue.ToString()
            If merged.ContainsKey(matchedSubId) Then
                Dim prev = merged(matchedSubId).ToString()
                merged(matchedSubId) = prev & " " & s
            Else
                merged(matchedSubId) = slotValue
            End If
        Next

        If merged.Count = 0 Then Return UtteranceParseResult.NoMatch()

        Dim u As New UtteranceParseResult With {
            .Success = True,
            .MatchedText = input,
            .Confidence = 1R
        }

        For Each kv In merged.OrderBy(Function(k) k.Key, StringComparer.OrdinalIgnoreCase)
            Dim guid = _table.TryResolveBySubMappingKey(kv.Key)
            If String.IsNullOrEmpty(guid) Then
                guid = _table.MainNodeCanonicalGuid
            End If
            Dim valStr = kv.Value.ToString().Trim()
            u.Extractions.Add(New UniformExtraction With {
                .TaskInstanceId = _task.Id,
                .NodeId = guid,
                .SemanticValue = kv.Value,
                .LinguisticSpan = valStr
            })
        Next

        Return u
    End Function

End Class
