Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Newtonsoft.Json.Linq

Namespace KbDialogStep
    ''' <summary>Match NL utterance → slot semantici via lessico gruppo/sinonimi (multi-colonna).</summary>
    Public NotInheritable Class KbDialogSlotLexiconParser
        Public Class SlotMatchDetail
            Public Property ColumnId As String
            Public Property Semantic As String
            Public Property Matched As String
        End Class

        Public Class ParseResult
            Public Property Updates As Dictionary(Of String, String)
            Public Property Matches As List(Of SlotMatchDetail)
        End Class

        Public Shared Function ParseUtterance(
            utterance As String,
            grid As KbDialogGrid,
            selectorSpec As KbSelectorSpec,
            binding As Dictionary(Of String, String),
            dialogIndex As JObject
        ) As ParseResult
            Dim out As New ParseResult With {
                .Updates = New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase),
                .Matches = New List(Of SlotMatchDetail)
            }

            Dim text = If(utterance, "").Trim()
            If text.Length = 0 OrElse grid Is Nothing OrElse selectorSpec Is Nothing Then Return out

            Dim valueLabels = If(dialogIndex IsNot Nothing, dialogIndex("valueLabels"), Nothing)
            Dim slotLexicon = If(dialogIndex IsNot Nothing, dialogIndex("slotLexicon"), Nothing)
            Dim headers = grid.Headers
            Dim rows = grid.Rows
            Dim askable = KbDialogBindings.ListAskableColumns(selectorSpec)
            Dim merged = CopyBinding(binding)

            For Each col In askable
                Dim colId = ResolveColumnId(col)
                If KbDialogBindings.NormalizeCellValue(If(merged.ContainsKey(colId), merged(colId), "")).Length > 0 Then
                    Continue For
                End If

                Dim colIdx = KbDialogBindings.HeaderIndex(headers, col.HeaderLabel)
                If colIdx < 0 Then Continue For

                Dim filtered = KbDialogBindings.FilterRowsByBinding(rows, headers, merged)
                Dim allowed = KbDialogBindings.DistinctColumnValues(filtered, colIdx)
                If allowed Is Nothing OrElse allowed.Count = 0 Then Continue For

                Dim bestSemantic As String = Nothing
                Dim bestMatched As String = Nothing
                Dim bestLen = 0

                For Each semantic In allowed
                    Dim synonyms = CollectSynonyms(slotLexicon, colId, semantic, valueLabels)
                    For Each syn In synonyms.OrderByDescending(Function(s) NormalizeForMatch(s).Length)
                        If Not UtteranceContainsPhrase(text, syn) Then Continue For
                        Dim len = NormalizeForMatch(syn).Length
                        If len > bestLen Then
                            bestLen = len
                            bestSemantic = semantic
                            bestMatched = syn
                        End If
                    Next
                Next

                If bestSemantic IsNot Nothing Then
                    out.Updates(colId) = bestSemantic
                    out.Matches.Add(New SlotMatchDetail With {
                        .ColumnId = colId,
                        .Semantic = bestSemantic,
                        .Matched = If(bestMatched, bestSemantic)
                    })
                End If
            Next

            Return out
        End Function

        Private Shared Function CollectSynonyms(
            slotLexicon As JToken,
            columnId As String,
            semantic As String,
            valueLabels As JToken
        ) As List(Of String)
            Dim seen As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
            Dim out As New List(Of String)

            Dim add As Action(Of String) = Sub(raw As String)
                                               Dim t = If(raw, "").Trim()
                                               If t.Length = 0 Then Return
                                               If seen.Add(t) Then out.Add(t)
                                           End Sub

            If slotLexicon IsNot Nothing AndAlso slotLexicon.Type = JTokenType.Object Then
                Dim colTok = slotLexicon(columnId)
                If colTok IsNot Nothing AndAlso colTok.Type = JTokenType.Array Then
                    For Each groupTok In CType(colTok, JArray)
                        Dim sem = If(groupTok.Value(Of String)("semantic"), "").Trim()
                        If Not String.Equals(
                            KbDialogBindings.NormalizeToken(sem),
                            KbDialogBindings.NormalizeToken(semantic),
                            StringComparison.OrdinalIgnoreCase) Then
                            Continue For
                        End If
                        Dim synArr = groupTok("synonyms")
                        If synArr IsNot Nothing AndAlso synArr.Type = JTokenType.Array Then
                            For Each st In CType(synArr, JArray)
                                add(st.ToString())
                            Next
                        End If
                        Exit For
                    Next
                End If
            End If

            If out.Count = 0 Then
                add(semantic)
                add(semantic.Replace("_"c, " "c))
                add(KbDialogSayResolver.GetNaturalLabel(columnId, semantic, valueLabels))
            End If

            Return out
        End Function

        Public Shared Function UtteranceContainsPhrase(utterance As String, phrase As String) As Boolean
            Dim u = NormalizeForMatch(utterance)
            Dim p = NormalizeForMatch(phrase)
            If u.Length = 0 OrElse p.Length = 0 Then Return False
            If p.Contains(" "c) Then Return u.Contains(p)
            Return Regex.IsMatch(" " & u & " ", "(?:^|\s)" & Regex.Escape(p) & "(?:\s|$)", RegexOptions.IgnoreCase)
        End Function

        Private Shared Function NormalizeForMatch(raw As String) As String
            Dim t = KbDialogBindings.NormalizeToken(If(raw, "")).Replace("_"c, " "c).Trim()
            Return Regex.Replace(t, "\s+", " ").Trim()
        End Function

        Private Shared Function ResolveColumnId(col As SelectorColumnSpec) As String
            If col Is Nothing Then Return ""
            Dim id = If(col.ColumnId, "").Trim()
            If id.Length > 0 Then Return id
            Return KbDialogBindings.SlugifyColumnId(col.HeaderLabel)
        End Function

        Private Shared Function CopyBinding(binding As Dictionary(Of String, String)) As Dictionary(Of String, String)
            Dim copy As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding Is Nothing Then Return copy
            For Each kvp In binding
                copy(kvp.Key) = kvp.Value
            Next
            Return copy
        End Function
    End Class
End Namespace
