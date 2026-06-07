Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json.Linq

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
            peek As DialogStepResult,
            Optional valueLabels As JToken = Nothing,
            Optional grid As KbDialogGrid = Nothing,
            Optional selectorSpec As KbSelectorSpec = Nothing,
            Optional binding As Dictionary(Of String, String) = Nothing,
            Optional dialogIndex As JObject = Nothing
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

            If grid IsNot Nothing AndAlso selectorSpec IsNot Nothing Then
                Dim lex = KbDialogSlotLexiconParser.ParseUtterance(
                    text, grid, selectorSpec, binding, dialogIndex)
                If lex IsNot Nothing AndAlso lex.Updates IsNot Nothing AndAlso lex.Updates.Count > 0 Then
                    For Each kvp In lex.Updates
                        out(kvp.Key) = kvp.Value
                    Next
                    Return out
                End If
            End If

            Dim colId = If(peek.NextColumnId, "").Trim()
            If colId.Length = 0 AndAlso peek.Rejected IsNot Nothing Then
                colId = If(peek.Rejected.ColumnId, "").Trim()
            End If
            If colId.Length = 0 Then Return out

            Dim allowed = If(peek.AllowedValues, New List(Of String)())
            Dim matched = MatchAllowedValue(text, allowed, colId, valueLabels)
            If matched IsNot Nothing Then
                out(colId) = matched
            End If

            Return out
        End Function

        ''' <summary>Match deterministico utterance ↔ valori ammessi (token normalizzati + inclusione).</summary>
        Public Shared Function MatchAllowedValue(
            utterance As String,
            allowedValues As IList(Of String),
            Optional columnId As String = Nothing,
            Optional valueLabels As JToken = Nothing
        ) As String
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

            Dim col = If(columnId, "").Trim()
            If col.Length > 0 Then
                Dim byNatural = MatchByNaturalLabels(u, text, allowedValues, col, valueLabels)
                If byNatural IsNot Nothing Then Return byNatural
            End If

            If allowedValues.Count = 2 Then
                Return TryResolveBinaryChoice(u, text, allowedValues)
            End If

            Return Nothing
        End Function

        ''' <summary>Utterance in forma naturale (es. «cardiologica») → valore canonico tabella (es. «Cardiologia»).</summary>
        Private Shared Function MatchByNaturalLabels(
            normalizedUtterance As String,
            rawUtterance As String,
            allowedValues As IList(Of String),
            columnId As String,
            valueLabels As JToken
        ) As String
            For Each raw In allowedValues
                Dim av = If(raw, "").Trim()
                If av.Length = 0 Then Continue For
                Dim nat = KbDialogSayResolver.GetNaturalLabel(columnId, av, valueLabels).Trim()
                If nat.Length = 0 Then Continue For
                Dim n = KbDialogBindings.NormalizeToken(nat)
                If n.Length = 0 Then Continue For
                If String.Equals(n, normalizedUtterance, StringComparison.OrdinalIgnoreCase) Then Return av
                If normalizedUtterance.Contains(n) OrElse n.Contains(normalizedUtterance) Then Return av
                If String.Equals(KbDialogBindings.NormalizeToken(rawUtterance), n, StringComparison.OrdinalIgnoreCase) Then Return av
            Next

            If valueLabels Is Nothing OrElse valueLabels.Type <> JTokenType.Object Then Return Nothing
            Dim colTok = valueLabels(columnId)
            If colTok Is Nothing OrElse colTok.Type <> JTokenType.Object Then Return Nothing

            For Each prop In CType(colTok, JObject).Properties()
                Dim canonicalKey = If(prop.Name, "").Trim()
                If canonicalKey.Length = 0 Then Continue For
                Dim label = If(prop.Value?.ToString(), "").Trim()
                If label.Length = 0 Then Continue For
                Dim n = KbDialogBindings.NormalizeToken(label)
                If n.Length = 0 Then Continue For
                If Not String.Equals(n, normalizedUtterance, StringComparison.OrdinalIgnoreCase) AndAlso
                   Not normalizedUtterance.Contains(n) AndAlso Not n.Contains(normalizedUtterance) AndAlso
                   Not String.Equals(KbDialogBindings.NormalizeToken(rawUtterance), n, StringComparison.OrdinalIgnoreCase) Then
                    Continue For
                End If

                For Each raw In allowedValues
                    Dim av = If(raw, "").Trim()
                    If av.Length = 0 Then Continue For
                    If String.Equals(KbDialogBindings.NormalizeToken(av), KbDialogBindings.NormalizeToken(canonicalKey), StringComparison.OrdinalIgnoreCase) Then
                        Return av
                    End If
                Next
            Next

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
