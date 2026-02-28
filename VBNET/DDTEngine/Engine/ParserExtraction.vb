' ParserExtraction.vb
' Regex-based data extraction helpers for Parser.

Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Text.RegularExpressions

''' <summary>
''' Low-level extraction logic: simple regex and composite regex extraction.
''' </summary>
Partial Public Class Parser

    ' -------------------------------------------------------------------------
    ' Simple (leaf node) extraction
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Extracts a single value from an utterance using the node NLP contract.
    ''' Returns Nothing when no match; throws on structural errors.
    ''' </summary>
    Private Shared Function ExtractSimple(input As String, node As TaskUtterance) As String
        If String.IsNullOrEmpty(input) Then
            Throw New ArgumentException("Input cannot be empty.", NameOf(input))
        End If

        If node.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no NlpContract. NlpContract is mandatory for data extraction.")
        End If

        Dim contract = node.NlpContract
        If contract.CompiledMainRegex Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no CompiledMainRegex in NlpContract.")
        End If

        Try
            Dim m = contract.CompiledMainRegex.Match(input.Trim())
            If Not m.Success Then Return Nothing

            ' Prefer first named group with a value.
            For i As Integer = 1 To m.Groups.Count - 1
                If Not String.IsNullOrEmpty(m.Groups(i).Value) Then Return m.Groups(i).Value
            Next
            Return m.Value
        Catch ex As Exception
            Throw New InvalidOperationException($"Regex match failed for task '{node.Id}': {ex.Message}", ex)
        End Try
    End Function

    ' -------------------------------------------------------------------------
    ' Composite extraction
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' Extracts multiple sub-field values from a composite utterance.
    ''' Iterates SubDataMapping and uses EffectiveGroupName() as the sole group-name source.
    ''' Returns Nothing when the pattern does not match; throws on structural errors.
    ''' </summary>
    Private Shared Function ExtractComposite(
            input As String,
            node As TaskUtterance) As System.Collections.Generic.Dictionary(Of String, Object)

        ' ✅ LOG: Entry point
        Console.WriteLine($"[ParserExtraction.ExtractComposite] 🔍 ENTRY - Task '{If(node IsNot Nothing, node.Id, "NULL")}'")
        Console.WriteLine($"[ParserExtraction.ExtractComposite]   - node IsNothing: {node Is Nothing}")
        If node IsNot Nothing Then
            Console.WriteLine($"[ParserExtraction.ExtractComposite]   - node.HasSubTasks(): {node.HasSubTasks()}")
            Console.WriteLine($"[ParserExtraction.ExtractComposite]   - node.NlpContract IsNothing: {node.NlpContract Is Nothing}")
            If node.NlpContract IsNot Nothing Then
                Console.WriteLine($"[ParserExtraction.ExtractComposite]   - node.NlpContract.SubDataMapping IsNothing: {node.NlpContract.SubDataMapping Is Nothing}")
                If node.NlpContract.SubDataMapping IsNot Nothing Then
                    Console.WriteLine($"[ParserExtraction.ExtractComposite]   - node.NlpContract.SubDataMapping.Count: {node.NlpContract.SubDataMapping.Count}")
                    For Each kvp In node.NlpContract.SubDataMapping
                        Console.WriteLine($"[ParserExtraction.ExtractComposite]     - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
                    Next
                Else
                    Console.WriteLine($"[ParserExtraction.ExtractComposite] ⚠️ node.NlpContract.SubDataMapping is Nothing at entry!")
                End If
            Else
                Console.WriteLine($"[ParserExtraction.ExtractComposite] ⚠️ node.NlpContract is Nothing at entry!")
            End If
        End If

        If node Is Nothing OrElse Not node.HasSubTasks() Then Return Nothing

        Dim contract = node.NlpContract
        If contract Is Nothing Then
            Console.WriteLine($"[ParserExtraction.ExtractComposite] ❌ Task '{If(node IsNot Nothing, node.Id, "NULL")}': NlpContract is Nothing - throwing exception")
            Throw New InvalidOperationException(
                $"Task '{node.Id}' has no NlpContract. Cannot perform composite extraction.")
        End If

        ' ✅ NEW: Leggi regex contract da Contracts invece di contract.Regex
        Dim regexContract = contract.Contracts?.FirstOrDefault(Function(c) c.Type = "regex" AndAlso c.Enabled)
        If regexContract Is Nothing OrElse
           regexContract.Patterns Is Nothing OrElse
           regexContract.Patterns.Count = 0 Then
            Throw New InvalidOperationException(
                $"Task '{node.Id}': NlpContract has no enabled regex contract. " &
                $"The contract must contain a 'regex' contract in the 'contracts' array with at least one pattern.")
        End If

        ' ✅ LOG: Verifica prima di usare SubDataMapping
        Console.WriteLine($"[ParserExtraction.TryExtractComposite] 🔍 Task '{node.Id}': Checking SubDataMapping")
        Console.WriteLine($"[ParserExtraction.TryExtractComposite]   - contract.SubDataMapping IsNothing: {contract.SubDataMapping Is Nothing}")
        If contract.SubDataMapping IsNot Nothing Then
            Console.WriteLine($"[ParserExtraction.TryExtractComposite]   - contract.SubDataMapping.Count: {contract.SubDataMapping.Count}")
            For Each kvp In contract.SubDataMapping
                Console.WriteLine($"[ParserExtraction.TryExtractComposite]     - [{kvp.Key}] → groupName: '{kvp.Value.GroupName}'")
            Next
        Else
            Console.WriteLine($"[ParserExtraction.TryExtractComposite] ⚠️ contract.SubDataMapping is Nothing!")
        End If

        If contract.SubDataMapping Is Nothing OrElse contract.SubDataMapping.Count = 0 Then
            Console.WriteLine($"[ParserExtraction.TryExtractComposite] ❌ Task '{node.Id}': SubDataMapping is empty - throwing exception")
            Throw New InvalidOperationException(
                $"Task '{node.Id}': SubDataMapping is empty. Cannot map extracted groups to sub-tasks.")
        End If

        Try
            Dim pattern = regexContract.Patterns(0)
            Dim rx As New Regex(pattern, RegexOptions.IgnoreCase)
            Dim m = rx.Match(input.Trim())
            If Not m.Success Then Return Nothing

            Dim result As New System.Collections.Generic.Dictionary(Of String, Object)()

            For Each kvp As System.Collections.Generic.KeyValuePair(Of String, SubDataMappingInfo) In contract.SubDataMapping
                Dim subId As String = kvp.Key
                Dim info As SubDataMappingInfo = kvp.Value
                Dim groupName As String = info.GroupName

                If String.IsNullOrWhiteSpace(groupName) Then
                    Throw New InvalidOperationException(
                        $"Task '{node.Id}': SubDataMapping entry '{subId}' is missing a GroupName. " &
                        $"GroupName is required (format: g_[a-f0-9]{{12}}).")
                End If

                Dim group = m.Groups(groupName)

                ' Group not captured in this match (optional group) → skip.
                If group Is Nothing OrElse Not group.Success Then Continue For

                Dim value = group.Value.Trim()

                ' Whitespace-only → treat as not captured.
                If String.IsNullOrEmpty(value) Then Continue For

                result(subId) = value
            Next

            Return If(result.Count > 0, result, Nothing)
        Catch ex As Exception
            Throw New InvalidOperationException(
                $"Composite extraction failed for task '{node.Id}': {ex.Message}", ex)
        End Try
    End Function
End Class
