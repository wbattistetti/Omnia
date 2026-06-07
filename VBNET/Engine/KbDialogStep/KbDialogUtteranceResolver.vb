Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

Namespace KbDialogStep
    ''' <summary>
    ''' Mappa utterance utente → updates slot per il motore KB (host VB o EL slot-filler via webhook).
    ''' </summary>
    Public NotInheritable Class KbDialogUtteranceResolver
        Private Shared ReadOnly Affirmative As HashSet(Of String) = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
            "si", "sì", "ok", "okay", "va bene", "certo", "confermo", "procediamo", "yes", "yep"
        }

        Private Shared ReadOnly Negative As HashSet(Of String) = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
            "no", "nope", "non", "negativo", "annulla", "stop", "basta"
        }

        Private Shared ReadOnly ExamEmpty As HashSet(Of String) = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
            "", "nessuno", "none", "no", "-", "senza", "senza esame", "no grazie"
        }

        ''' <summary>Risolve updates dal testo utente e dallo stato peek del motore.</summary>
        Public Shared Function ResolveUpdates(
            userUtterance As String,
            peek As DialogStepResult
        ) As Dictionary(Of String, String)
            Dim out As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            Dim text = If(userUtterance, "").Trim()
            If text.Length = 0 OrElse peek Is Nothing Then Return out

            If String.Equals(peek.Status, "inform_pending", StringComparison.OrdinalIgnoreCase) Then
                Dim informCol = If(Not String.IsNullOrWhiteSpace(peek.InformColumnId), peek.InformColumnId, peek.NextColumnId).Trim()
                If informCol.Length > 0 Then
                    If IsAffirmative(text) Then
                        out("__inform_response") = "accept"
                        Return out
                    End If
                    If IsNegative(text) Then
                        out("__inform_response") = "reject"
                        Return out
                    End If
                End If
            End If

            Dim colId = If(peek.NextColumnId, "").Trim()
            If colId.Length = 0 AndAlso peek.Rejected IsNot Nothing Then
                colId = If(peek.Rejected.ColumnId, "").Trim()
            End If
            If colId.Length = 0 Then Return out

            Dim allowed = If(peek.AllowedValues, New List(Of String)())
            Dim matched = MatchAllowedValue(text, allowed)
            If matched IsNot Nothing Then
                out(colId) = matched
            End If

            Return out
        End Function

        ''' <summary>Match deterministico utterance ↔ valori ammessi (token normalizzati + inclusione).</summary>
        Public Shared Function MatchAllowedValue(utterance As String, allowedValues As IList(Of String)) As String
            If allowedValues Is Nothing OrElse allowedValues.Count = 0 Then Return Nothing
            Dim text = If(utterance, "").Trim()
            If text.Length = 0 Then Return Nothing

            Dim u = KbDialogBindings.NormalizeToken(text)
            If u.Length = 0 Then Return Nothing

            For Each raw In allowedValues
                Dim av = If(raw, "").Trim()
                If av.Length = 0 Then Continue For
                If String.Equals(KbDialogBindings.NormalizeToken(av), u, StringComparison.OrdinalIgnoreCase) Then
                    Return av
                End If
            Next

            For Each raw In allowedValues
                Dim av = If(raw, "").Trim()
                If av.Length = 0 Then Continue For
                Dim t = KbDialogBindings.NormalizeToken(av)
                If t.Length = 0 Then Continue For
                If u.Contains(t) OrElse t.Contains(u) Then Return av
            Next

            If allowedValues.Count = 2 Then
                Return TryResolveBinaryChoice(u, text, allowedValues)
            End If

            Return Nothing
        End Function

        Private Shared Function TryResolveBinaryChoice(
            normalizedUtterance As String,
            rawUtterance As String,
            allowedValues As IList(Of String)
        ) As String
            Dim nonEmpty = allowedValues.Where(Function(v) Not KbDialogBindings.IsEmptyCellValue(v)).ToList()
            Dim emptyVal = allowedValues.FirstOrDefault(Function(v) KbDialogBindings.IsEmptyCellValue(v))

            If IsAffirmative(rawUtterance) OrElse Affirmative.Contains(normalizedUtterance) Then
                If nonEmpty.Count = 1 Then Return nonEmpty(0)
            End If

            If IsNegative(rawUtterance) OrElse Negative.Contains(normalizedUtterance) OrElse ExamEmpty.Contains(normalizedUtterance) Then
                If emptyVal IsNot Nothing Then Return emptyVal
                Dim nessuno = allowedValues.FirstOrDefault(Function(v) KbDialogBindings.NormalizeToken(v) = "nessuno")
                If nessuno IsNot Nothing Then Return nessuno
            End If

            Return Nothing
        End Function

        Private Shared Function IsAffirmative(text As String) As Boolean
            Dim t = KbDialogBindings.NormalizeToken(text).Replace("_"c, " "c)
            If Affirmative.Contains(t) Then Return True
            For Each a In Affirmative
                If t.StartsWith(a, StringComparison.OrdinalIgnoreCase) Then Return True
            Next
            Return False
        End Function

        Private Shared Function IsNegative(text As String) As Boolean
            Dim t = KbDialogBindings.NormalizeToken(text).Replace("_"c, " "c)
            If Negative.Contains(t) Then Return True
            For Each n In Negative
                If t.StartsWith(n, StringComparison.OrdinalIgnoreCase) Then Return True
            Next
            Return False
        End Function
    End Class
End Namespace
