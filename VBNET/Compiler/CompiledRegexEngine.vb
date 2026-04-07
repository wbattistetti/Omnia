Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports TaskEngine

''' <summary>
''' Motore regex lineare: gruppi nominati del pattern → <see cref="EngineResult"/>.
''' </summary>
Public NotInheritable Class CompiledRegexEngine
    Implements IInterpretationEngine

    Private ReadOnly _displayName As String
    Private ReadOnly _contract As CompiledNlpContract
    Private ReadOnly _table As CanonicalGuidTable

    Public Sub New(displayName As String, task As CompiledUtteranceTask, contract As CompiledNlpContract, table As CanonicalGuidTable)
        _displayName = displayName
        _contract = contract
        _table = table
    End Sub

    Public ReadOnly Property DisplayName As String Implements IInterpretationEngine.DisplayName
        Get
            Return _displayName
        End Get
    End Property

    Public Function Parse(utterance As String) As EngineResult Implements IInterpretationEngine.Parse
        Dim inputTrimmed = If(utterance, String.Empty).Trim()

        Try
            If _contract.CompiledMainRegex Is Nothing Then
                Return EngineResult.NoMatch(inputTrimmed)
            End If

            Dim rxMatch = _contract.CompiledMainRegex.Match(inputTrimmed)
            If Not rxMatch.Success Then
                Return EngineResult.NoMatch(inputTrimmed)
            End If

            Dim matches As New List(Of ParserMatch)()

            If _contract.DataMapping IsNot Nothing AndAlso _contract.DataMapping.Count > 0 Then
                For Each kvp In _contract.DataMapping
                    Dim groupName = kvp.Value.GroupName
                    If String.IsNullOrEmpty(groupName) Then Continue For

                    Dim g = rxMatch.Groups(groupName)
                    If g Is Nothing OrElse Not g.Success Then Continue For

                    Dim value = g.Value.Trim()
                    If value = "" Then Continue For

                    matches.Add(New ParserMatch With {
                        .Guid = ResolveCanonical(kvp.Key),
                        .Value = value,
                        .Linguistic = value
                    })
                Next
            End If

            If matches.Count = 0 Then
                Return EngineResult.NoMatch(inputTrimmed)
            End If

            Return EngineResultFactory.FromMatches(matches, inputTrimmed, rxMatch.Value.Trim())

        Catch ex As Exception
            Throw New InvalidOperationException($"[CompiledRegexEngine] Parse failed: {ex.Message}", ex)
        End Try
    End Function

    Private Function ResolveCanonical(subMappingKey As String) As String
        Dim resolved = _table.TryResolveBySubMappingKey(subMappingKey)
        If Not String.IsNullOrEmpty(resolved) Then Return resolved
        Return _table.MainNodeCanonicalGuid
    End Function

End Class
