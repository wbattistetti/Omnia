' ParserExtraction.vb
' Regex-based data extraction helpers for Parser.
' ✅ UPDATED: Support for GrammarFlow engine

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
    ' Simple (leaf node) extraction
    ' -------------------------------------------------------------------------

    Public Shared Function ExtractSimple(input As String, node As IParsableTask) As String
        If String.IsNullOrEmpty(input) Then
            Throw New ArgumentException("Input cannot be empty.", NameOf(input))
        End If

        If node.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract.")
        End If

        Dim contract = node.NlpContract
        Dim grammarFlowEngine = GetActiveGrammarFlowEngine(contract)
        Dim regexEngine = GetActiveRegexEngine(contract)

        ' ✅ ESCALATION: Try GrammarFlow first if enabled
        If grammarFlowEngine IsNot Nothing Then
            Dim grammarFlowResult = ExtractWithGrammarFlow(input, grammarFlowEngine)
            If Not String.IsNullOrEmpty(grammarFlowResult) Then
                Return grammarFlowResult
            End If
            ' ⚠️ GrammarFlow failed, continue to next engine (escalation)
        End If

        ' ✅ ESCALATION: Try regex if enabled (as fallback after GrammarFlow)
        If regexEngine IsNot Nothing Then
            If contract.CompiledMainRegex Is Nothing Then
                Throw New InvalidOperationException($"Task '{node.Id}' has no CompiledMainRegex.")
            End If

            Dim m = contract.CompiledMainRegex.Match(input.Trim())
            If m.Success Then
                For i As Integer = 1 To m.Groups.Count - 1
                    If Not String.IsNullOrEmpty(m.Groups(i).Value) Then Return m.Groups(i).Value
                Next
                Return m.Value
            End If
        End If

        ' ⚠️ All enabled engines failed - return Nothing
        Return Nothing
    End Function

    ' -------------------------------------------------------------------------
    ' Composite extraction
    ' -------------------------------------------------------------------------

    Private Shared Function ExtractComposite(
            input As String,
            node As IParsableTask) As Dictionary(Of String, Object)

        If node Is Nothing OrElse Not node.HasSubTasks() Then Return Nothing

        Dim contract = node.NlpContract
        If contract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract.")
        End If

        ' TODO: GrammarFlow composite extraction
        Dim grammarFlowEngine = GetActiveGrammarFlowEngine(contract)
        Dim regexEngine = GetActiveRegexEngine(contract)
        If grammarFlowEngine IsNot Nothing AndAlso regexEngine Is Nothing Then
            ' Composite GrammarFlow extraction not yet implemented
            Throw New InvalidOperationException($"Task '{node.Id}': GrammarFlow composite extraction not yet supported.")
        End If

        ' Use regex
        Dim regexContract = GetActiveRegexEngine(contract)
        If regexContract Is Nothing OrElse regexContract.Patterns Is Nothing OrElse regexContract.Patterns.Count = 0 Then
            Throw New InvalidOperationException($"Task '{node.Id}': No enabled regex contract.")
        End If

        If contract.SubDataMapping Is Nothing OrElse contract.SubDataMapping.Count = 0 Then
            Throw New InvalidOperationException($"Task '{node.Id}': SubDataMapping is empty.")
        End If

        Dim pattern = regexContract.Patterns(0)
        Dim m = New Regex(pattern, RegexOptions.IgnoreCase).Match(input.Trim())
        If Not m.Success Then Return Nothing

        Dim result As New Dictionary(Of String, Object)()
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

    ' -------------------------------------------------------------------------
    ' GrammarFlow extraction
    ' -------------------------------------------------------------------------

    Private Shared Function ExtractWithGrammarFlow(
            input As String,
            grammarFlowEngine As NLPEngine) As String

        Dim grammar = DeserializeGrammar(grammarFlowEngine.GrammarFlow)
        If grammar Is Nothing Then Return Nothing

        Dim engine As New GrammarEngine(grammar, useRegex:=True)
        Dim parseResult = engine.Parse(input)

        If Not parseResult.Success Then Return Nothing
        If parseResult.Bindings Is Nothing OrElse parseResult.Bindings.Count = 0 Then Return Nothing

        ' Simple case: one slot → one variable
        Dim firstValue = parseResult.Bindings.Values.FirstOrDefault()
        Return If(firstValue IsNot Nothing, firstValue.ToString(), Nothing)
    End Function

    ' -------------------------------------------------------------------------
    ' Helpers
    ' -------------------------------------------------------------------------

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
