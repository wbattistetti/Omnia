Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Compiler.DTO.IDE
Imports GrammarFlowEngine
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Compila NLPContract (IDE) in CompiledNlpContract (runtime): validazione forte, tutti i regex,
''' coerenza mapping / GrammarFlow / gruppi.
''' </summary>
Public Module NlpContractCompiler

    Public Function Compile(baseContract As NLPContract) As CompiledNlpContract
        If baseContract Is Nothing Then
            Throw New ArgumentNullException(NameOf(baseContract))
        End If

        Dim compiled As New CompiledNlpContract() With {
            .TemplateName = baseContract.TemplateName,
            .TemplateId = baseContract.TemplateId,
            .SourceTemplateId = baseContract.SourceTemplateId,
            .DataMapping = baseContract.SubDataMapping,
            .Engines = baseContract.Engines
        }

        Dim errors As New List(Of String)()
        compiled.IsValid = True
        compiled.ValidationErrors = errors

        Dim enabledEngines = If(baseContract.Engines Is Nothing,
            New List(Of NLPEngine)(),
            baseContract.Engines.Where(Function(e) e IsNot Nothing AndAlso e.Enabled).ToList())

        If enabledEngines.Count = 0 Then
            compiled.IsValid = False
            errors.Add("NLP contract must declare at least one enabled interpretation engine (escalation order).")
            Return compiled
        End If

        For Each eng In enabledEngines
            Dim t = If(eng.Type, String.Empty).Trim().ToLowerInvariant()
            Select Case t
                Case "regex", "grammarflow"
                    ' supported
                Case "ner", "rules", "llm", "embedding", "embeddings"
                    compiled.IsValid = False
                    errors.Add($"NLP engine type '{eng.Type}' is not supported by the compiler yet. Disable it or remove it from the contract.")
                Case Else
                    compiled.IsValid = False
                    errors.Add($"Unknown or unsupported NLP engine type '{eng.Type}'.")
            End Select
        Next

        If Not compiled.IsValid Then
            Return compiled
        End If

        compiled.CompiledRegexPatterns.Clear()

        Dim regexEngines = enabledEngines.Where(Function(e) String.Equals(e.Type, "regex", StringComparison.OrdinalIgnoreCase)).ToList()
        If regexEngines.Count > 1 Then
            errors.Add("NLP contract must have at most one 'regex' engine entry (escalation list).")
        Else
            For Each regexEngine In regexEngines
                CompileAndValidateRegexEngine(regexEngine, baseContract, compiled, errors)
            Next
        End If

        Dim gfEngines = enabledEngines.Where(Function(e) String.Equals(e.Type, "grammarflow", StringComparison.OrdinalIgnoreCase)).ToList()
        For Each gfEngine In gfEngines
            ValidateGrammarFlowEngine(gfEngine, baseContract, errors)
        Next

        If errors.Count > 0 Then
            compiled.IsValid = False
        End If

        Return compiled
    End Function

    Private Sub CompileAndValidateRegexEngine(
        regexEngine As NLPEngine,
        baseContract As NLPContract,
        compiled As CompiledNlpContract,
        errors As List(Of String)
    )
        If regexEngine.Patterns Is Nothing OrElse regexEngine.Patterns.Count = 0 Then
            errors.Add("Regex NLP engine is enabled but has no patterns.")
            Return
        End If

        compiled.CompiledRegexPatterns.Clear()
        Dim patternIndex As Integer = 0
        For Each pattern In regexEngine.Patterns
            patternIndex += 1
            Try
                Dim rx = New Regex(pattern, RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                compiled.CompiledRegexPatterns.Add(rx)
                ValidateRegexPatternGroupsAgainstMapping(pattern, rx, baseContract, patternIndex, errors)
            Catch ex As Exception
                errors.Add($"Regex pattern #{patternIndex} is invalid: {ex.Message}")
            End Try
        Next

        If compiled.CompiledRegexPatterns.Count > 0 Then
            compiled.CompiledMainRegex = compiled.CompiledRegexPatterns(0)
        End If
    End Sub

    Private Sub ValidateRegexPatternGroupsAgainstMapping(
        pattern As String,
        rx As Regex,
        baseContract As NLPContract,
        patternIndex As Integer,
        errors As List(Of String)
    )
        If baseContract.SubDataMapping Is Nothing OrElse baseContract.SubDataMapping.Count = 0 Then
            Return
        End If

        Dim regexGroups As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        For Each name As String In rx.GetGroupNames()
            Dim parsedIndex As Integer
            If Not String.IsNullOrEmpty(name) AndAlso Not Integer.TryParse(name, parsedIndex) Then
                regexGroups.Add(name)
            End If
        Next

        Dim mappingGroups As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In baseContract.SubDataMapping
            Dim groupName = kvp.Value?.GroupName
            If String.IsNullOrWhiteSpace(groupName) Then
                errors.Add(
                    $"SubDataMapping entry '{kvp.Key}' is missing GroupName (required for composite regex). " &
                    $"Pattern #{patternIndex}.")
                Continue For
            End If
            Dim indexPattern As New Regex("^s[0-9]+$", RegexOptions.IgnoreCase)
            If Not indexPattern.IsMatch(groupName) Then
                errors.Add(
                    $"SubDataMapping entry '{kvp.Key}': GroupName '{groupName}' must match format s[0-9]+. " &
                    $"Pattern #{patternIndex}.")
            End If
            mappingGroups.Add(groupName)
        Next

        For Each name As String In regexGroups
            If Not mappingGroups.Contains(name) Then
                errors.Add(
                    $"Pattern #{patternIndex}: named group '{name}' has no SubDataMapping entry (template '{baseContract.TemplateName}').")
            End If
        Next

        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In baseContract.SubDataMapping
            Dim groupName = kvp.Value?.GroupName
            If String.IsNullOrWhiteSpace(groupName) Then Continue For
            If Not regexGroups.Contains(groupName) Then
                errors.Add(
                    $"Pattern #{patternIndex}: SubDataMapping references group '{groupName}' (subtask '{kvp.Key}') " &
                    $"but that group is absent from the regex pattern.")
            End If
        Next
    End Sub

    Private Sub ValidateGrammarFlowEngine(
        gfEngine As NLPEngine,
        baseContract As NLPContract,
        errors As List(Of String)
    )
        If gfEngine.GrammarFlow Is Nothing Then
            errors.Add("GrammarFlow NLP engine is enabled but GrammarFlow is missing.")
            Return
        End If

        Dim grammar As Grammar = Nothing
        Try
            Dim grammarJson = JsonConvert.SerializeObject(gfEngine.GrammarFlow)
            grammar = JsonConvert.DeserializeObject(Of Grammar)(grammarJson)
        Catch ex As Exception
            errors.Add($"GrammarFlow JSON is invalid: {ex.Message}")
            Return
        End Try

        If grammar Is Nothing OrElse grammar.Nodes Is Nothing Then
            errors.Add("GrammarFlow graph has no nodes.")
            Return
        End If

        If baseContract.SubDataMapping Is Nothing OrElse baseContract.SubDataMapping.Count = 0 Then
            Return
        End If

        ValidateGrammarSlotBindingsG2(grammar, baseContract, errors)

        For Each gnode As GrammarNode In grammar.Nodes
            If gnode.Bindings Is Nothing Then Continue For
            For Each b As NodeBinding In gnode.Bindings
                If Not String.Equals(b.Type, "slot", StringComparison.OrdinalIgnoreCase) Then Continue For
                If String.IsNullOrWhiteSpace(b.SlotId) Then Continue For
                Dim resolved = ResolveGrammarSlotToSubMappingKey(b.SlotId, grammar, baseContract)
                If String.IsNullOrEmpty(resolved) Then
                    errors.Add(
                        $"GrammarFlow grammar slot '{b.SlotId}' cannot be resolved via slotBindings to SubDataMapping (template '{baseContract.TemplateName}').")
                End If
            Next
        Next
    End Sub

    ''' <summary>G2: grammarSlotId → flowVariableId via <see cref="Grammar.SlotBindings"/>, then SubDataMapping key.</summary>
    Private Sub ValidateGrammarSlotBindingsG2(grammar As Grammar, baseContract As NLPContract, errors As List(Of String))
        If grammar.Slots Is Nothing OrElse grammar.Slots.Count = 0 Then Return
        If grammar.SlotBindings Is Nothing OrElse grammar.SlotBindings.Count = 0 Then
            errors.Add($"GrammarFlow declares slots but slotBindings is missing or empty (G2 required, template '{baseContract.TemplateName}').")
            Return
        End If

        For Each slot In grammar.Slots
            If slot Is Nothing OrElse String.IsNullOrWhiteSpace(slot.Id) Then Continue For
            Dim flowVar = TryGetFlowVariableIdForGrammarSlot(grammar, slot.Id)
            If String.IsNullOrWhiteSpace(flowVar) Then
                errors.Add($"Grammar slot '{slot.Id}' has no slotBindings entry (grammarSlotId → flowVariableId).")
                Continue For
            End If
            If String.IsNullOrEmpty(ResolveSubIdForSlotCore(flowVar.Trim(), baseContract.SubDataMapping)) Then
                errors.Add(
                    $"Grammar slotBindings flowVariableId '{flowVar}' for grammar slot '{slot.Id}' is not in SubDataMapping (template '{baseContract.TemplateName}').")
            End If
        Next
    End Sub

    ''' <summary>G2: maps grammar slot id to SubDataMapping key using slotBindings + flow variable id.</summary>
    Friend Function ResolveGrammarSlotToSubMappingKey(grammarSlotId As String, grammar As Grammar, contract As NLPContract) As String
        Dim fv = TryGetFlowVariableIdForGrammarSlot(grammar, grammarSlotId)
        If String.IsNullOrWhiteSpace(fv) Then Return Nothing
        Return ResolveSubIdForSlotCore(fv.Trim(), contract.SubDataMapping)
    End Function

    ''' <summary>G2: maps grammar slot id to SubDataMapping key using slotBindings + flow variable id.</summary>
    Friend Function ResolveGrammarSlotToSubMappingKey(grammarSlotId As String, grammar As Grammar, contract As CompiledNlpContract) As String
        Dim fv = TryGetFlowVariableIdForGrammarSlot(grammar, grammarSlotId)
        If String.IsNullOrWhiteSpace(fv) Then Return Nothing
        Return ResolveSubIdForSlotCore(fv.Trim(), contract.DataMapping)
    End Function

    Public Function TryGetFlowVariableIdForGrammarSlot(grammar As Grammar, grammarSlotId As String) As String
        If grammar Is Nothing OrElse String.IsNullOrWhiteSpace(grammarSlotId) Then Return Nothing
        If grammar.SlotBindings Is Nothing Then Return Nothing
        Dim needle = grammarSlotId.Trim()
        For Each row In grammar.SlotBindings
            If row Is Nothing Then Continue For
            Dim gsid = If(row.GrammarSlotId, String.Empty).Trim()
            If String.Equals(gsid, needle, StringComparison.OrdinalIgnoreCase) Then
                Dim fv = If(row.FlowVariableId, String.Empty).Trim()
                Return If(String.IsNullOrEmpty(fv), Nothing, fv)
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>Inverse of <see cref="TryGetFlowVariableIdForGrammarSlot"/> for G2 extraction (flowVariableId → grammarSlotId).</summary>
    Public Function TryGetGrammarSlotIdForFlowVariable(grammar As Grammar, flowVariableId As String) As String
        If grammar Is Nothing OrElse String.IsNullOrWhiteSpace(flowVariableId) Then Return Nothing
        If grammar.SlotBindings Is Nothing Then Return Nothing
        Dim needle = flowVariableId.Trim()
        For Each row In grammar.SlotBindings
            If row Is Nothing Then Continue For
            Dim fv = If(row.FlowVariableId, String.Empty).Trim()
            If String.Equals(fv, needle, StringComparison.OrdinalIgnoreCase) Then
                Dim gsid = If(row.GrammarSlotId, String.Empty).Trim()
                Return If(String.IsNullOrEmpty(gsid), Nothing, gsid)
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>Resolve binding labels (e.g. <c>value</c>, semantic-set names, regex group aliases) to SubDataMapping keys.</summary>
    Friend Function ResolveSubIdForSlot(slotName As String, contract As NLPContract) As String
        Return ResolveSubIdForSlotCore(slotName, contract.SubDataMapping)
    End Function

    Friend Function ResolveSubIdForSlot(slotName As String, contract As CompiledNlpContract) As String
        Return ResolveSubIdForSlotCore(slotName, contract.DataMapping)
    End Function

    Private Function ResolveSubIdForSlotCore(slotName As String, map As Dictionary(Of String, SubDataMappingInfo)) As String
        If map Is Nothing OrElse map.Count = 0 Then
            Return Nothing
        End If
        If map.ContainsKey(slotName) Then Return slotName

        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In map
            Dim gn = kvp.Value?.GroupName
            If Not String.IsNullOrEmpty(gn) AndAlso String.Equals(gn, slotName, StringComparison.OrdinalIgnoreCase) Then
                Return kvp.Key
            End If
        Next
        Return Nothing
    End Function

End Module
