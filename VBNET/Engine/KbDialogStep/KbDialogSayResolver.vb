Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json.Linq

Namespace KbDialogStep
    ''' <summary>Risoluzione frasi UC dialogo KB a runtime (parità backend/services/omniaDialogStep/kbDialogSayResolver.js).</summary>
    Public NotInheritable Class KbDialogSayResolver
        Public Const KB_DIALOG_EXPLICIT_LIST_MAX As Integer = 3

        Private Shared ReadOnly ExamEmpty As HashSet(Of String) = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
            "", "nessuno", "none", "no", "-"
        }

        Public Class AcquisitionResolveResult
            Public Property Say As String
            Public Property UseCaseId As String
            Public Property UseCaseKind As String = "acquisition"
        End Class

        Public Class CorrectionResolveResult
            Public Property Messages As List(Of String)
            Public Property Binding As Dictionary(Of String, String)
        End Class

        Public Class CompleteResolveResult
            Public Property Say As String
            Public Property SayCore As String
            Public Property UseCaseId As String
            Public Property UseCaseKind As String = "complete"
        End Class

        Public Class IncompatibleColumn
            Public Property ColumnId As String
            Public Property Value As String
        End Class

        Public Shared Function ResolveCompleteSay(index As JObject, binding As Dictionary(Of String, String), headers As IList(Of String), matched As IList(Of String)) As CompleteResolveResult
            Dim completeTok As JToken = If(index IsNot Nothing, index("complete"), Nothing)
            Dim template = If(completeTok?.Value(Of String)("sayTemplate"), "").Trim()
            If template.Length = 0 AndAlso index IsNot Nothing Then template = If(index.Value(Of String)("completeTemplate"), "").Trim()
            If template.Length = 0 Then template = "Perfetto, prenoto {tipo_visita_nat} {specialita_nat}{esame_suffix}."

            Dim valueLabels As JToken = If(index IsNot Nothing, index("valueLabels"), Nothing)
            Dim placeholders = BuildCompletePlaceholders(binding, headers, matched, valueLabels)
            Dim sayCore = InterpolateTemplate(template, placeholders)
            Dim useCaseId = If(completeTok?.Value(Of String)("useCaseId"), "uc_complete")

            Return New CompleteResolveResult With {
                .Say = sayCore,
                .SayCore = sayCore,
                .UseCaseId = useCaseId,
                .UseCaseKind = "complete"
            }
        End Function

        Public Shared Function ResolveAcquisitionSay(index As JObject, selectorColumnId As String, binding As Dictionary(Of String, String), col As SelectorColumnSpec, allowedValues As IList(Of String)) As AcquisitionResolveResult
            Dim entry As JToken = Nothing
            If index IsNot Nothing AndAlso index("acquisition") IsNot Nothing Then
                entry = index("acquisition")(selectorColumnId)
            End If
            Dim useCaseId = If(entry?.Value(Of String)("useCaseId"), Nothing)

            If entry IsNot Nothing AndAlso entry("rows") IsNot Nothing AndAlso entry("rows").Type = JTokenType.Array Then
                Dim rows = CType(entry("rows"), JArray).
                    OrderByDescending(Function(r) CountBindingWhenKeys(r)).
                    ToList()
                For Each rowTok In rows
                    Dim whenObj = rowTok("bindingWhen")
                    If whenObj Is Nothing OrElse whenObj.Type <> JTokenType.Object Then Continue For
                    Dim whenDict = whenObj.ToObject(Of Dictionary(Of String, String))()
                    If BindingPrefixMatches(whenDict, binding) Then
                        Dim say = If(rowTok.Value(Of String)("say"), "").Trim()
                        If say.Length > 0 Then
                            Dim valueLabels = If(index IsNot Nothing, index("valueLabels"), Nothing)
                            Dim interpolated = InterpolateAcquisitionSay(
                                say, binding, valueLabels, allowedValues, selectorColumnId)
                            Return New AcquisitionResolveResult With {
                                .Say = interpolated,
                                .UseCaseId = useCaseId,
                                .UseCaseKind = "acquisition"
                            }
                        End If
                    End If
                Next
            End If

            Return Nothing
        End Function

        Public Shared Function IsCorrectionUpdate(priorBinding As Dictionary(Of String, String), updates As Dictionary(Of String, String)) As String
            If updates Is Nothing Then Return Nothing
            For Each kvp In updates
                Dim prior = KbDialogBindings.NormalizeCellValue(If(priorBinding IsNot Nothing AndAlso priorBinding.ContainsKey(kvp.Key), priorBinding(kvp.Key), ""))
                Dim nextVal = KbDialogBindings.NormalizeCellValue(kvp.Value)
                If prior.Length > 0 AndAlso nextVal.Length > 0 AndAlso Not String.Equals(prior, nextVal, StringComparison.OrdinalIgnoreCase) Then
                    Return kvp.Key
                End If
            Next
            Return Nothing
        End Function

        Public Shared Function FindCorrectionIncompatibilities(
            priorBinding As Dictionary(Of String, String),
            merged As Dictionary(Of String, String),
            headers As IList(Of String),
            rows As IEnumerable(Of IList(Of String)),
            selectorColumns As IList(Of SelectorColumnSpec),
            triggerColId As String
        ) As List(Of IncompatibleColumn)
            Dim out As New List(Of IncompatibleColumn)
            Dim ordered = selectorColumns.Select(Function(c) KbDialogBindings.SlugifyColumnId(c.HeaderLabel)).ToList()
            Dim triggerIdx = ordered.IndexOf(triggerColId)
            If triggerIdx < 0 Then Return out

            For i = triggerIdx + 1 To ordered.Count - 1
                Dim colId = ordered(i)
                Dim val = KbDialogBindings.NormalizeCellValue(
                    If(priorBinding IsNot Nothing AndAlso priorBinding.ContainsKey(colId), priorBinding(colId),
                       If(merged.ContainsKey(colId), merged(colId), "")))
                If val.Length = 0 Then Continue For

                Dim walkBinding As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
                For j = 0 To i
                    Dim cid = ordered(j)
                    If j <= triggerIdx Then
                        walkBinding(cid) = merged(cid)
                    ElseIf cid = colId Then
                        walkBinding(cid) = val
                    Else
                        Dim prev = KbDialogBindings.NormalizeCellValue(
                            If(priorBinding IsNot Nothing AndAlso priorBinding.ContainsKey(cid), priorBinding(cid),
                               If(merged.ContainsKey(cid), merged(cid), "")))
                        If prev.Length > 0 Then walkBinding(cid) = prev
                    End If
                Next

                If KbDialogBindings.FilterRowsByBinding(rows, headers, walkBinding).Count = 0 Then
                    out.Add(New IncompatibleColumn With {.ColumnId = colId, .Value = val})
                End If
            Next
            Return out
        End Function

        Public Shared Function ResolveCorrectionMessages(
            index As JObject,
            triggerColId As String,
            incompatibles As IList(Of IncompatibleColumn),
            merged As Dictionary(Of String, String),
            headers As IList(Of String),
            rows As IEnumerable(Of IList(Of String)),
            valueLabels As JToken
        ) As CorrectionResolveResult
            Dim messages As New List(Of String)
            Dim cleared = CopyBinding(merged)

            For Each inc In incompatibles
                Dim tplEntry As JToken = Nothing
                Dim correctionArr As JToken = If(index IsNot Nothing, index("correction"), Nothing)
                If correctionArr IsNot Nothing AndAlso correctionArr.Type = JTokenType.Array Then
                    For Each item In CType(correctionArr, JArray)
                        If String.Equals(item.Value(Of String)("triggerColumnId"), triggerColId, StringComparison.OrdinalIgnoreCase) AndAlso
                           String.Equals(item.Value(Of String)("incompatibleColumnId"), inc.ColumnId, StringComparison.OrdinalIgnoreCase) Then
                            tplEntry = item
                            Exit For
                        End If
                    Next
                End If

                Dim partialWithout = CopyBinding(cleared)
                partialWithout.Remove(inc.ColumnId)
                Dim altRows = KbDialogBindings.FilterRowsByBinding(rows, headers, partialWithout)
                Dim colIdx = KbDialogBindings.HeaderIndex(headers, inc.ColumnId)
                Dim alternatives = If(colIdx >= 0, KbDialogBindings.DistinctColumnValues(altRows, colIdx), New List(Of String))
                Dim alternativa = alternatives.FirstOrDefault(Function(a) Not String.Equals(a, inc.Value, StringComparison.OrdinalIgnoreCase))
                If alternativa Is Nothing AndAlso alternatives.Count > 0 Then alternativa = alternatives(0)
                If alternativa Is Nothing Then alternativa = ""

                Dim alternativaMessaggio = If(alternativa.Length > 0,
                    "Propongo " & GetNaturalLabel(inc.ColumnId, alternativa, valueLabels) & ".",
                    "")

                If alternatives.Count = 1 Then
                    cleared(inc.ColumnId) = alternatives(0)
                    alternativaMessaggio = "Diventa " & GetNaturalLabel(inc.ColumnId, alternatives(0), valueLabels) & "."
                Else
                    cleared.Remove(inc.ColumnId)
                End If

                Dim vars As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase) From {
                    {triggerColId & "_nat", GetNaturalLabel(triggerColId, If(merged.ContainsKey(triggerColId), merged(triggerColId), ""), valueLabels)},
                    {inc.ColumnId & "_nat", GetNaturalLabel(inc.ColumnId, inc.Value, valueLabels)},
                    {"alternativa_messaggio", alternativaMessaggio},
                    {"alternativa", alternativaMessaggio}
                }

                Dim template = If(tplEntry?.Value(Of String)("sayTemplate"), "").Trim()
                Dim msg = If(template.Length > 0,
                    InterpolateTemplate(template, vars),
                    GetNaturalLabel(inc.ColumnId, inc.Value, valueLabels) & " non è compatibile. " & alternativaMessaggio)
                messages.Add(msg.Trim())
            Next

            Return New CorrectionResolveResult With {.Messages = messages, .Binding = cleared}
        End Function

        Public Shared Function GetNaturalLabel(columnId As String, rawValue As String, valueLabels As JToken) As String
            Dim key = KbDialogBindings.NormalizeToken(rawValue)
            If valueLabels IsNot Nothing AndAlso valueLabels.Type = JTokenType.Object Then
                Dim col = valueLabels(columnId)
                If col IsNot Nothing AndAlso col.Type = JTokenType.Object Then
                    Dim hit = col(key)
                    If hit IsNot Nothing AndAlso hit.Type = JTokenType.String Then Return hit.ToString()
                End If
            End If
            Return HumanizeCell(rawValue)
        End Function

        Private Shared Function BuildCompletePlaceholders(binding As Dictionary(Of String, String), headers As IList(Of String), matched As IList(Of String), valueLabels As JToken) As Dictionary(Of String, String)
            Dim map As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding IsNot Nothing Then
                For Each kvp In binding
                    If KbDialogBindings.NormalizeCellValue(kvp.Value).Length = 0 Then Continue For
                    map(kvp.Key & "_nat") = GetNaturalLabel(kvp.Key, kvp.Value, valueLabels)
                Next
            End If
            If Not map.ContainsKey("tipo_visita_nat") Then
                map("tipo_visita_nat") = GetNaturalLabel("tipo_visita", If(binding IsNot Nothing AndAlso binding.ContainsKey("tipo_visita"), binding("tipo_visita"), ""), valueLabels)
            End If
            If Not map.ContainsKey("specialita_nat") Then
                Dim spec = If(binding IsNot Nothing AndAlso binding.ContainsKey("specialita"), binding("specialita"),
                              If(binding IsNot Nothing AndAlso binding.ContainsKey("specialty"), binding("specialty"), ""))
                map("specialita_nat") = GetNaturalLabel("specialita", spec, valueLabels)
            End If

            Dim examCol = DetectExamColumnId(headers)
            If examCol IsNot Nothing AndAlso binding IsNot Nothing AndAlso binding.ContainsKey(examCol) AndAlso Not IsEmptyExamValue(binding(examCol)) Then
                Dim nat = GetNaturalLabel(examCol, binding(examCol), valueLabels)
                map("esame_suffix") = If(nat.Length > 0, " con " & nat, "")
            Else
                map("esame_suffix") = ""
            End If

            If matched IsNot Nothing Then
                Dim idx = KbDialogBindings.HeaderIndex(headers, "etichetta")
                If idx >= 0 Then
                    Dim et = KbDialogBindings.NormalizeCellValue(If(idx < matched.Count, matched(idx), ""))
                    If et.Length > 0 Then map("etichetta_riga") = et
                End If
            End If
            Return map
        End Function

        Private Shared Function DetectExamColumnId(headers As IList(Of String)) As String
            If headers Is Nothing Then Return Nothing
            For Each h In headers
                Dim id = KbDialogBindings.SlugifyColumnId(h)
                If id.IndexOf("esame", StringComparison.OrdinalIgnoreCase) >= 0 AndAlso
                   id.IndexOf("obbligatorio", StringComparison.OrdinalIgnoreCase) < 0 Then
                    Return id
                End If
            Next
            Return Nothing
        End Function

        Private Shared Function IsEmptyExamValue(value As String) As Boolean
            Dim v = KbDialogBindings.NormalizeToken(value)
            Return ExamEmpty.Contains(v) OrElse v.StartsWith("non_", StringComparison.OrdinalIgnoreCase)
        End Function

        Private Shared Function HumanizeCell(raw As String) As String
            Dim v = KbDialogBindings.NormalizeCellValue(raw)
            If v.Length = 0 Then Return ""
            Dim norm = KbDialogBindings.NormalizeToken(v)
            Select Case norm
                Case "prima_visita" : Return "prima visita"
                Case "controllo" : Return "visita di controllo"
                Case "cardiologia" : Return "cardiologica"
                Case "radiologia" : Return "radiologica"
                Case "ecg" : Return "ECG"
                Case "nessuno" : Return ""
                Case Else : Return v.Replace("_"c, " "c).Trim()
            End Select
        End Function

        Private Shared Function BindingPrefixMatches(whenDict As Dictionary(Of String, String), binding As Dictionary(Of String, String)) As Boolean
            If whenDict Is Nothing OrElse whenDict.Count = 0 Then Return True
            For Each kvp In whenDict
                Dim got = KbDialogBindings.NormalizeCellValue(If(binding IsNot Nothing AndAlso binding.ContainsKey(kvp.Key), binding(kvp.Key), ""))
                If Not String.Equals(got, KbDialogBindings.NormalizeCellValue(kvp.Value), StringComparison.OrdinalIgnoreCase) Then Return False
            Next
            Return True
        End Function

        Private Shared Function CountBindingWhenKeys(rowTok As JToken) As Integer
            Dim whenObj = rowTok?("bindingWhen")
            If whenObj Is Nothing OrElse whenObj.Type <> JTokenType.Object Then Return 0
            Return CType(whenObj, JObject).Properties().Count()
        End Function

        Private Shared Function CopyBinding(binding As Dictionary(Of String, String)) As Dictionary(Of String, String)
            Dim copy As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding Is Nothing Then Return copy
            For Each kvp In binding
                copy(kvp.Key) = kvp.Value
            Next
            Return copy
        End Function

        Private Shared Function InterpolateTemplate(template As String, placeholders As Dictionary(Of String, String)) As String
            Dim outText = If(template, "")
            If placeholders IsNot Nothing Then
                For Each kvp In placeholders
                    outText = outText.Replace("{" & kvp.Key & "}", If(kvp.Value, ""))
                Next
            End If
            Return System.Text.RegularExpressions.Regex.Replace(outText, "\s+", " ").Trim()
        End Function

        ''' <summary>Interpola say acquisition: {col_nat}, [col] da binding, [semantic] da allowedValues.</summary>
        Public Shared Function InterpolateAcquisitionSay(
            say As String,
            binding As Dictionary(Of String, String),
            valueLabels As JToken,
            Optional allowedValues As IList(Of String) = Nothing,
            Optional selectorColumnId As String = Nothing
        ) As String
            Dim raw = If(say, "").Trim()
            If raw.Length = 0 Then Return raw

            Dim placeholders = BuildAcquisitionPlaceholders(binding, valueLabels)
            Dim withCurlies = InterpolateTemplate(raw, placeholders)
            Return InterpolateBracketPlaceholders(withCurlies, binding, valueLabels, allowedValues, selectorColumnId)
        End Function

        Private Shared Function BuildAcquisitionPlaceholders(binding As Dictionary(Of String, String), valueLabels As JToken) As Dictionary(Of String, String)
            Dim map As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding Is Nothing Then Return map
            For Each kvp In binding
                If KbDialogBindings.NormalizeCellValue(kvp.Value).Length = 0 Then Continue For
                map(kvp.Key & "_nat") = GetNaturalLabel(kvp.Key, kvp.Value, valueLabels)
                map(kvp.Key) = kvp.Value
            Next
            Return map
        End Function

        Private Shared Function InterpolateBracketPlaceholders(
            text As String,
            binding As Dictionary(Of String, String),
            valueLabels As JToken,
            allowedValues As IList(Of String),
            selectorColumnId As String
        ) As String
            Return System.Text.RegularExpressions.Regex.Replace(
                If(text, ""),
                "\[([a-z0-9_]+)\]",
                Function(m As System.Text.RegularExpressions.Match)
                    Dim token = If(m.Groups(1).Value, "").Trim()
                    If token.Length = 0 Then Return m.Value

                    If binding IsNot Nothing AndAlso binding.ContainsKey(token) Then
                        Dim bound = KbDialogBindings.NormalizeCellValue(binding(token))
                        If bound.Length > 0 Then
                            Return GetNaturalLabel(token, bound, valueLabels)
                        End If
                    End If

                    If allowedValues IsNot Nothing Then
                        For Each av In allowedValues
                            Dim semantic = If(av, "").Trim()
                            If semantic.Length = 0 Then Continue For
                            If String.Equals(KbDialogBindings.NormalizeToken(semantic), KbDialogBindings.NormalizeToken(token), StringComparison.OrdinalIgnoreCase) Then
                                Dim col = If(selectorColumnId, "").Trim()
                                Return GetNaturalLabel(If(col.Length > 0, col, token), semantic, valueLabels)
                            End If
                            Dim nat = GetNaturalLabel(If(selectorColumnId, token), semantic, valueLabels)
                            If String.Equals(KbDialogBindings.NormalizeToken(nat), KbDialogBindings.NormalizeToken(token), StringComparison.OrdinalIgnoreCase) Then
                                Return nat
                            End If
                        Next
                    End If

                    If binding IsNot Nothing Then
                        For Each kvp In binding
                            If KbDialogBindings.NormalizeCellValue(kvp.Value).Length = 0 Then Continue For
                            Dim nat = GetNaturalLabel(kvp.Key, kvp.Value, valueLabels)
                            If String.Equals(KbDialogBindings.NormalizeToken(nat), KbDialogBindings.NormalizeToken(token), StringComparison.OrdinalIgnoreCase) Then
                                Return nat
                            End If
                        Next
                    End If

                    Return m.Value
                End Function,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase)
        End Function
    End Class
End Namespace
