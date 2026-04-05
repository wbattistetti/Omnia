Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Runtime
Imports System.Text.RegularExpressions
Imports TaskEngine
Imports TaskEngine.UtteranceInterpretation

''' <summary>
''' Motore regex lineare: un solo passaggio su SubDataMapping (gruppi nominati), nessun leaf/composite né fallback.
''' </summary>
Public NotInheritable Class CompiledRegexUtteranceEngine
    Implements IUtteranceInterpretationEngine

    Private ReadOnly _displayName As String
    Private ReadOnly _task As CompiledUtteranceTask
    Private ReadOnly _contract As CompiledNlpContract
    Private ReadOnly _table As CanonicalGuidTable

    Public Sub New(displayName As String, task As CompiledUtteranceTask, contract As CompiledNlpContract, table As CanonicalGuidTable)
        _displayName = displayName
        _task = task
        _contract = contract
        _table = table
    End Sub

    Public ReadOnly Property DisplayName As String Implements IUtteranceInterpretationEngine.DisplayName
        Get
            Return _displayName
        End Get
    End Property

    Public Function Parse(utterance As String) As UtteranceParseResult _
    Implements IUtteranceInterpretationEngine.Parse

        Try
            Dim input = utterance.Trim()
            Dim m = _contract.CompiledMainRegex.Match(input)
            If Not m.Success Then
                Return UtteranceParseResult.NoMatch()
            End If

            Dim result As New UtteranceParseResult With {
            .Success = True,
            .MatchedText = m.Value,
            .Confidence = 1.0R
        }

            '────────────────────────────────────────────────────────────
            ' CASO 1: DataMapping presente → usa i groupName → GUID specifici
            '────────────────────────────────────────────────────────────
            If _contract.DataMapping IsNot Nothing AndAlso _contract.DataMapping.Count > 0 Then

                For Each kvp In _contract.DataMapping
                    Dim groupName = kvp.Value.GroupName
                    If String.IsNullOrEmpty(groupName) Then Continue For

                    Dim g = m.Groups(groupName)
                    If g Is Nothing OrElse Not g.Success Then Continue For

                    Dim value = g.Value.Trim()
                    If value = "" Then Continue For

                    result.Extractions.Add(New UniformExtraction With {
                    .TaskInstanceId = _task.Id,
                    .NodeId = ResolveCanonical(kvp.Key),
                    .SemanticValue = value,
                    .LinguisticSpan = value
                })
                Next

                If result.Extractions.Count > 0 Then
                    Return result
                Else
                    ' Mapping presente ma nessun gruppo ha prodotto valore
                    Return UtteranceParseResult.NoMatch()
                End If
            End If

            '────────────────────────────────────────────────────────────
            ' CASO 2: DataMapping assente → task con UNA sola variabile
            '────────────────────────────────────────────────────────────
            ' Qui basta il GUID principale: non serve la tabella completa.
            Dim mainGuid = _task.CanonicalGuidTable.MainNodeCanonicalGuid

            ' Nei casi semplici, il valore semantico coincide con l'intero match.
            Dim val = m.Value.Trim()
            If val = "" Then Return UtteranceParseResult.NoMatch()

            result.Extractions.Add(New UniformExtraction With {
            .TaskInstanceId = _task.Id,
            .NodeId = mainGuid,
            .SemanticValue = val,
            .LinguisticSpan = val
        })

            Return result

        Catch ex As Exception
            ' Logga l'errore ma NON lancia eccezioni: il motore deve essere resiliente.
            'Logger.Error($"[RegexEngine] Unexpected error in Parse(): {ex.Message}", ex)
            Throw New InvalidOperationException($"[RegexEngine] Unexpected error in Parse(): {ex.Message}")

            Return UtteranceParseResult.NoMatch()
        End Try

    End Function



    Private Function ResolveCanonical(subMappingKey As String) As String
        Dim resolved = _table.TryResolveBySubMappingKey(subMappingKey)
        If Not String.IsNullOrEmpty(resolved) Then Return resolved
        Return _table.MainNodeCanonicalGuid
    End Function

End Class
