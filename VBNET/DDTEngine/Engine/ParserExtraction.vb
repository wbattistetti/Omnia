' ParserExtraction.vb
' Regex-based data extraction helpers for Parser.

Option Strict On
Option Explicit On
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
    ''' Extracts multiple sub-values from an utterance using the main node's composite regex.
    ''' Returns Nothing when no match; throws on structural errors.
    ''' </summary>
    Private Shared Function ExtractComposite(input As String, node As TaskUtterance) As System.Collections.Generic.Dictionary(Of String, Object)
        If node Is Nothing OrElse Not node.HasSubTasks() Then Return Nothing

        Dim contract = node.NlpContract
        If contract Is Nothing OrElse
           contract.Regex Is Nothing OrElse
           contract.Regex.Patterns Is Nothing OrElse
           contract.Regex.Patterns.Count = 0 OrElse
           contract.SubDataMapping Is Nothing Then
            Throw New InvalidOperationException($"Task '{node.Id}' has no valid NlpContract for composite extraction.")
        End If

        Try
            Dim pattern = contract.Regex.Patterns(0)
            Dim rx As New Regex(pattern, RegexOptions.IgnoreCase)
            Dim m = rx.Match(input.Trim())
            If Not m.Success Then Return Nothing

            Dim result As New System.Collections.Generic.Dictionary(Of String, Object)()
            For Each groupName As String In rx.GetGroupNames()
                If groupName = "0" OrElse String.IsNullOrEmpty(groupName) Then Continue For
                Dim groupValue = m.Groups(groupName).Value
                If String.IsNullOrEmpty(groupValue) Then Continue For

                Dim subId = FindSubIdByCanonicalKey(contract, groupName)
                If Not String.IsNullOrEmpty(subId) Then
                    result(subId) = groupValue
                End If
            Next

            Return If(result.Count > 0, result, Nothing)
        Catch ex As Exception
            Throw New InvalidOperationException($"Composite extraction failed for task '{node.Id}': {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Looks up the sub-task ID corresponding to a canonical key in the NLP contract.
    ''' </summary>
    Private Shared Function FindSubIdByCanonicalKey(contract As NLPContract, canonicalKey As String) As String
        If contract.SubDataMapping Is Nothing Then Return ""
        For Each kvp As System.Collections.Generic.KeyValuePair(Of String, SubDataMappingInfo) In contract.SubDataMapping
            If String.Equals(kvp.Value.CanonicalKey, canonicalKey, StringComparison.OrdinalIgnoreCase) Then
                Return kvp.Key
            End If
        Next
        Return ""
    End Function
End Class
