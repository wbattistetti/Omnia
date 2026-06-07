Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Globalization
Imports System.Linq
Imports Newtonsoft.Json.Linq

Namespace KbDialogStep
    ''' <summary>Motore runtime dialogo KB: filtra tabella, UC acquisition/correction/complete.</summary>
    Public NotInheritable Class DialogStepEngine
        Private Shared ReadOnly ItalianComparer As StringComparer = StringComparer.Create(New CultureInfo("it-IT"), ignoreCase:=False)

        Public Shared Function NormalizeUpdates(updates As Dictionary(Of String, String), headers As IList(Of String)) As Dictionary(Of String, String)
            Dim out As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If updates Is Nothing OrElse headers Is Nothing Then Return out
            For Each kvp In updates
                Dim val = KbDialogBindings.NormalizeCellValue(kvp.Value)
                If val.Length = 0 Then Continue For
                Dim idx = KbDialogBindings.HeaderIndex(headers, kvp.Key)
                If idx < 0 Then Continue For
                out(KbDialogBindings.SlugifyColumnId(headers(idx))) = val
            Next
            Return out
        End Function

        Public Shared Function BindingKeysCanonical(binding As Dictionary(Of String, String), headers As IList(Of String)) As Dictionary(Of String, String)
            Dim out As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding Is Nothing OrElse headers Is Nothing Then Return out
            For Each kvp In binding
                Dim idx = KbDialogBindings.HeaderIndex(headers, kvp.Key)
                If idx < 0 Then Continue For
                Dim v = KbDialogBindings.NormalizeCellValue(kvp.Value)
                If v.Length = 0 Then Continue For
                out(KbDialogBindings.SlugifyColumnId(headers(idx))) = v
            Next
            Return out
        End Function

        Private Shared Function ListSelectorColumns(selectorSpec As KbSelectorSpec) As List(Of SelectorColumnSpec)
            If selectorSpec Is Nothing OrElse selectorSpec.Columns Is Nothing Then Return New List(Of SelectorColumnSpec)
            Return selectorSpec.Columns.
                Where(Function(c) c IsNot Nothing AndAlso String.Equals(c.Role, "selector", StringComparison.OrdinalIgnoreCase)).
                OrderBy(Function(c) c.SortOrder).
                ThenBy(Function(c) If(c.HeaderLabel, ""), ItalianComparer).
                ToList()
        End Function

        Private Shared Function ApplyAutoFills(binding As Dictionary(Of String, String), headers As IList(Of String), rows As IEnumerable(Of IList(Of String)), selectorSpec As KbSelectorSpec) As Dictionary(Of String, String)
            Dim nextBinding As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding IsNot Nothing Then
                For Each kvp In binding
                    nextBinding(kvp.Key) = kvp.Value
                Next
            End If
            For Each col In ListSelectorColumns(selectorSpec)
                Dim colId = KbDialogBindings.SlugifyColumnId(col.HeaderLabel)
                If KbDialogBindings.NormalizeCellValue(If(nextBinding.ContainsKey(colId), nextBinding(colId), "")).Length > 0 Then Continue For
                Dim idx = KbDialogBindings.HeaderIndex(headers, col.HeaderLabel)
                If idx < 0 Then Continue For
                Dim filtered = KbDialogBindings.FilterRowsByBinding(rows, headers, nextBinding)
                Dim distinct = KbDialogBindings.DistinctColumnValues(filtered, idx)
                If distinct.Count = 1 Then nextBinding(colId) = distinct(0)
            Next
            Return nextBinding
        End Function

        Private Shared Function PickInvalidationTemplate(selectorSpec As KbSelectorSpec) As InvalidationTemplateSpec
            Dim templates = If(selectorSpec IsNot Nothing AndAlso selectorSpec.InvalidationTemplates IsNot Nothing,
                               selectorSpec.InvalidationTemplates,
                               New List(Of InvalidationTemplateSpec))
            Dim approved = templates.FirstOrDefault(Function(t) t IsNot Nothing AndAlso t.Approved AndAlso If(t.Template, "").Trim().Length > 0)
            If approved IsNot Nothing Then Return approved
            Return templates.FirstOrDefault(Function(t) t IsNot Nothing AndAlso If(t.Template, "").Trim().Length > 0)
        End Function

        Private Shared Function RowToObject(row As IList(Of String), headers As IList(Of String)) As Dictionary(Of String, String)
            Dim out As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            For i = 0 To headers.Count - 1
                Dim h = If(headers(i), "").Trim()
                If h.Length = 0 Then Continue For
                Dim slug = KbDialogBindings.SlugifyColumnId(h)
                Dim val = KbDialogBindings.NormalizeCellValue(If(i < row.Count, row(i), ""))
                If val.Length = 0 Then val = "-"
                out(slug) = val
                out(h) = val
            Next
            Return out
        End Function

        Private Shared Function CopyBinding(binding As Dictionary(Of String, String)) As Dictionary(Of String, String)
            Dim copy As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If binding Is Nothing Then Return copy
            For Each kvp In binding
                copy(kvp.Key) = kvp.Value
            Next
            Return copy
        End Function

        Public Shared Function ExecuteDialogStep(grid As KbDialogGrid, selectorSpec As KbSelectorSpec, binding As Dictionary(Of String, String), Optional updates As Dictionary(Of String, String) = Nothing, Optional dialogIndex As JObject = Nothing, Optional informState As DialogInformState = Nothing) As DialogStepResult
            If informState Is Nothing Then informState = KbDialogSelectorSemantics.EmptyInformState()
            Dim headers = grid.Headers
            Dim rows = grid.Rows
            Dim askable = KbDialogBindings.ListAskableColumns(selectorSpec)

            Dim priorBinding = BindingKeysCanonical(binding, headers)
            Dim normalizedUpdates = NormalizeUpdates(updates, headers)
            Dim updateKeys = normalizedUpdates.Keys.ToList()

            Dim merged = CopyBinding(priorBinding)
            Dim rowsBefore = KbDialogBindings.FilterRowsByBinding(rows, headers, merged)

            For Each colId In updateKeys
                merged(colId) = normalizedUpdates(colId)
            Next

            Dim filtered = KbDialogBindings.FilterRowsByBinding(rows, headers, merged)

            Dim correctionTrigger = KbDialogSayResolver.IsCorrectionUpdate(priorBinding, normalizedUpdates)
            If correctionTrigger IsNot Nothing AndAlso dialogIndex IsNot Nothing Then
                Dim incompatibles = KbDialogSayResolver.FindCorrectionIncompatibilities(
                    priorBinding, merged, headers, rows, ListSelectorColumns(selectorSpec), correctionTrigger)
                If incompatibles.Count > 0 Then
                    Dim resolved = KbDialogSayResolver.ResolveCorrectionMessages(
                        dialogIndex, correctionTrigger, incompatibles, merged, headers, rows, dialogIndex("valueLabels"))
                    merged = ApplyAutoFills(resolved.Binding, headers, rows, selectorSpec)
                    filtered = KbDialogBindings.FilterRowsByBinding(rows, headers, merged)
                    Dim correctionSay = String.Join(" ", resolved.Messages.Where(Function(m) Not String.IsNullOrWhiteSpace(m)))
                    Dim correctionUseCaseId As String = Nothing
                    Dim correctionArr = dialogIndex("correction")
                    If correctionArr IsNot Nothing AndAlso correctionArr.Type = JTokenType.Array Then
                        For Each item In CType(correctionArr, JArray)
                            If String.Equals(item.Value(Of String)("triggerColumnId"), correctionTrigger, StringComparison.OrdinalIgnoreCase) Then
                                correctionUseCaseId = item.Value(Of String)("useCaseId")
                                Exit For
                            End If
                        Next
                    End If
                    Return New DialogStepResult With {
                        .Status = "correction",
                        .Say = correctionSay.Trim(),
                        .UseCaseId = correctionUseCaseId,
                        .UseCaseKind = "correction",
                        .Binding = merged,
                        .RemainingRowCount = filtered.Count
                    }
                End If
            End If

            If filtered.Count = 0 AndAlso rowsBefore.Count > 0 AndAlso updateKeys.Count > 0 Then
                Dim rejectedColId = updateKeys(updateKeys.Count - 1)
                Dim rejectedVal = merged(rejectedColId)
                Dim partialBinding = CopyBinding(merged)
                partialBinding.Remove(rejectedColId)
                Dim partialRows = KbDialogBindings.FilterRowsByBinding(rows, headers, partialBinding)
                Dim col = askable.FirstOrDefault(Function(c) KbDialogBindings.SlugifyColumnId(c.HeaderLabel) = rejectedColId)
                Dim colIdx = KbDialogBindings.HeaderIndex(headers, rejectedColId)
                Dim alternatives = If(colIdx >= 0, KbDialogBindings.DistinctColumnValues(partialRows, colIdx), New List(Of String))
                Dim alt = alternatives.FirstOrDefault(Function(a) Not String.Equals(a, rejectedVal, StringComparison.OrdinalIgnoreCase))
                If alt Is Nothing AndAlso alternatives.Count > 0 Then alt = alternatives(0)
                If alt Is Nothing Then alt = ""

                Dim tpl = PickInvalidationTemplate(selectorSpec)
                Dim colLabel = If(col IsNot Nothing AndAlso Not String.IsNullOrEmpty(col.PromptTemplate), col.PromptTemplate, rejectedColId)
                Dim say As String
                If tpl IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(tpl.Template) Then
                    Dim vars As New Dictionary(Of String, String) From {
                        {"colonna", colLabel},
                        {"valore_rifiutato", rejectedVal},
                        {"alternativa_suggerita", alt},
                        {"alternativa", alt}
                    }
                    vars(rejectedColId) = rejectedVal
                    Dim specialita As String = ""
                    If partialBinding.ContainsKey("specialita") Then
                        specialita = partialBinding("specialita")
                    ElseIf merged.ContainsKey("specialita") Then
                        specialita = merged("specialita")
                    End If
                    Dim tipoVisita As String = ""
                    If partialBinding.ContainsKey("tipo_visita") Then
                        tipoVisita = partialBinding("tipo_visita")
                    ElseIf merged.ContainsKey("tipo_visita") Then
                        tipoVisita = merged("tipo_visita")
                    End If
                    vars("specialita") = specialita
                    vars("tipo_visita") = tipoVisita
                    say = KbDialogBindings.FillInvalidationTemplate(tpl.Template, vars)
                Else
                    say = "La combinazione scelta non è disponibile." & If(alt.Length > 0, " Può andare bene " & alt & ".", "")
                End If

                Return New DialogStepResult With {
                    .Status = "invalid",
                    .Say = say.Trim(),
                    .Binding = partialBinding,
                    .Rejected = New DialogStepRejectedInfo With {.ColumnId = rejectedColId, .Value = rejectedVal, .Alternative = alt},
                    .RemainingRowCount = partialRows.Count,
                    .AllowedValues = alternatives
                }
            End If

            merged = ApplyAutoFills(merged, headers, rows, selectorSpec)
            filtered = KbDialogBindings.FilterRowsByBinding(rows, headers, merged)

            Dim pending = askable.Where(Function(c)
                                            Dim colId = KbDialogBindings.SlugifyColumnId(c.HeaderLabel)
                                            Return KbDialogBindings.NormalizeCellValue(If(merged.ContainsKey(colId), merged(colId), "")).Length = 0
                                        End Function).ToList()

            If pending.Count = 0 OrElse filtered.Count <= 1 Then
                Dim matched = If(filtered.Count > 0, filtered(0), Nothing)
                If matched IsNot Nothing AndAlso dialogIndex IsNot Nothing Then
                    Dim resolved = KbDialogSayResolver.ResolveCompleteSay(dialogIndex, merged, headers, matched)
                    Return New DialogStepResult With {
                        .Status = If(filtered.Count > 0, "complete", "error"),
                        .Say = resolved.Say,
                        .SayCore = resolved.SayCore,
                        .UseCaseId = resolved.UseCaseId,
                        .UseCaseKind = resolved.UseCaseKind,
                        .Binding = merged,
                        .RemainingRowCount = filtered.Count,
                        .MatchedRow = RowToObject(matched, headers),
                        .MatchedRows = filtered.Select(Function(r) RowToObject(r, headers)).ToList()
                    }
                End If
                Dim sayComplete = If(matched IsNot Nothing,
                    "Perfetto, ho trovato la combinazione disponibile.",
                    "Non ho trovato combinazioni disponibili con le scelte fatte.")
                Return New DialogStepResult With {
                    .Status = If(filtered.Count > 0, "complete", "error"),
                    .Say = sayComplete,
                    .Binding = merged,
                    .RemainingRowCount = filtered.Count,
                    .MatchedRow = If(matched IsNot Nothing, RowToObject(matched, headers), Nothing),
                    .MatchedRows = filtered.Select(Function(r) RowToObject(r, headers)).ToList()
                }
            End If

            Dim nextCol = pending(0)
            Dim nextColIdx = KbDialogBindings.HeaderIndex(headers, nextCol.HeaderLabel)
            Dim allowedValues = If(nextColIdx >= 0, KbDialogBindings.DistinctColumnValues(filtered, nextColIdx), New List(Of String))
            Dim nextColId = KbDialogBindings.SlugifyColumnId(nextCol.HeaderLabel)

            If allowedValues.Count = 1 Then
                merged(nextColId) = allowedValues(0)
                Return ExecuteDialogStep(grid, selectorSpec, merged, New Dictionary(Of String, String), dialogIndex, informState)
            End If

            Dim acquired As KbDialogSayResolver.AcquisitionResolveResult = Nothing
            If dialogIndex IsNot Nothing Then
                acquired = KbDialogSayResolver.ResolveAcquisitionSay(dialogIndex, nextColId, merged, nextCol, allowedValues)
            End If
            Dim sayAsk = If(acquired IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(acquired.Say),
                            acquired.Say,
                            If(Not String.IsNullOrEmpty(nextCol.PromptTemplate), nextCol.PromptTemplate, nextCol.HeaderLabel) & "?")

            Return New DialogStepResult With {
                .Status = "ask",
                .Say = sayAsk,
                .UseCaseId = If(acquired?.UseCaseId, Nothing),
                .UseCaseKind = If(acquired?.UseCaseKind, "acquisition"),
                .Binding = merged,
                .InformState = informState,
                .NextColumnId = nextColId,
                .NextHeaderLabel = nextCol.HeaderLabel,
                .PromptType = nextCol.PromptType,
                .AskPolicy = nextCol.AskPolicy,
                .AllowedValues = allowedValues,
                .RemainingRowCount = filtered.Count
            }
        End Function
    End Class
End Namespace
