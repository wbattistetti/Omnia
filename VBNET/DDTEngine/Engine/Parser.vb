' Parser.vb
' Parses user utterances against a TaskUtterance NLP contract.

Option Strict On
Option Explicit On
Imports System.Text.RegularExpressions

''' <summary>
''' Interprets user utterances for a given TaskUtterance.
''' Stateless: receives the utterance as a parameter (no blocking queue).
''' </summary>
Partial Public Class Parser

    ''' <summary>
    ''' Parses an utterance in the context of the current task.
    ''' Returns NoInput when utterance is empty or null.
    ''' </summary>
    Public Function Parse(utterance As String, current As TaskUtterance) As ParseResult
        If current Is Nothing Then
            Throw New ArgumentNullException(NameOf(current), "Current task cannot be Nothing.")
        End If

        If String.IsNullOrEmpty(utterance) Then
            Return New ParseResult() With {.Result = ParseResultType.NoInput}
        End If

        ' Handle confirmation state separately.
        If current.State = DialogueState.Confirmation Then
            Return ParseConfirmation(utterance, current)
        End If

        ' Normal extraction flow.
        If current.HasSubTasks() Then
            Return ParseComposite(utterance, current)
        End If

        Return ParseSimple(utterance, current)
    End Function

    ' -------------------------------------------------------------------------
    ' Confirmation parsing
    ' -------------------------------------------------------------------------

    Private Function ParseConfirmation(utterance As String, current As TaskUtterance) As ParseResult
        Dim trimmed = utterance.Trim().ToLower()

        If IsYes(trimmed) Then
            Return New ParseResult() With {.Result = ParseResultType.Confirmed}
        End If

        If IsNo(trimmed) AndAlso trimmed.Length <= 3 Then
            Return New ParseResult() With {.Result = ParseResultType.NotConfirmed}
        End If

        ' "no <value>" or "non <value>" → try to extract a correction.
        Dim valueInput As String = Nothing
        If trimmed.StartsWith("no ") Then
            valueInput = utterance.Trim().Substring(3).Trim()
        ElseIf trimmed.StartsWith("non ") Then
            valueInput = utterance.Trim().Substring(4).Trim()
        Else
            ' Implicit correction (no negation prefix).
            valueInput = utterance.Trim()
        End If

        If Not String.IsNullOrEmpty(valueInput) Then
            Dim corrected = TryExtractAndApply(valueInput, current)
            If corrected Then Return New ParseResult() With {.Result = ParseResultType.Corrected}
        End If

        Return New ParseResult() With {.Result = ParseResultType.NoMatch}
    End Function

    ' -------------------------------------------------------------------------
    ' Simple (leaf) extraction
    ' -------------------------------------------------------------------------

    Private Function ParseSimple(utterance As String, current As TaskUtterance) As ParseResult
        Dim value = ExtractSimple(utterance, current)
        If String.IsNullOrEmpty(value) Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        current.Value = value
        Dim data As New System.Collections.Generic.Dictionary(Of String, Object)()
        data(current.Id) = value

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedData = data
        }
    End Function

    ' -------------------------------------------------------------------------
    ' Composite extraction
    ' -------------------------------------------------------------------------

    Private Function ParseComposite(utterance As String, current As TaskUtterance) As ParseResult
        Dim data = ExtractComposite(utterance, current)
        If data Is Nothing OrElse data.Count = 0 Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        For Each kvp In data
            Dim subTask = FindSubTaskById(current, kvp.Key)
            subTask.Value = kvp.Value
        Next

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedData = data
        }
    End Function

    ' -------------------------------------------------------------------------
    ' Helpers
    ' -------------------------------------------------------------------------

    Private Function TryExtractAndApply(utterance As String, current As TaskUtterance) As Boolean
        If current.HasSubTasks() Then
            Dim data = ExtractComposite(utterance, current)
            If data Is Nothing OrElse data.Count = 0 Then Return False
            For Each kvp In data
                FindSubTaskById(current, kvp.Key).Value = kvp.Value
            Next
            Return True
        End If

        Dim value = ExtractSimple(utterance, current)
        If String.IsNullOrEmpty(value) Then Return False
        current.Value = value
        Return True
    End Function

    Private Shared Function FindSubTaskById(current As TaskUtterance, subId As String) As TaskUtterance
        Dim matches = current.SubTasks.Where(Function(s) s.Id = subId).ToList()
        If matches.Count = 0 Then
            Throw New InvalidOperationException($"SubTask '{subId}' not found in task '{current.Id}'.")
        End If
        If matches.Count > 1 Then
            Throw New InvalidOperationException($"Duplicate SubTask id '{subId}' in task '{current.Id}'.")
        End If
        Return matches.Single()
    End Function

    Private Shared Function IsYes(input As String) As Boolean
        Dim words As String() = {"sì", "si", "yes", "ok", "va bene", "corretto", "giusto", "esatto", "perfetto", "confermo"}
        Return words.Contains(input)
    End Function

    Private Shared Function IsNo(input As String) As Boolean
        Dim words As String() = {"no", "non", "sbagliato", "errato", "correggi", "modifica", "cambia"}
        Return words.Contains(input)
    End Function
End Class
