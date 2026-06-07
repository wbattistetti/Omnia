Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

Namespace KbDialogStep.Tests
    ''' <summary>Test parità motore omnia_dialog_step (allineati a backend/services/__tests__/omniaDialogStepEngine.test.mjs).</summary>
    Public NotInheritable Class DialogStepEngineTests
        Private Const SampleMd As String = "## Dati normalizzati

| codice | specialita | tipo_visita | esame_associato |
| --- | --- | --- | --- |
| A1 | Cardiologia | Prima visita | ECG |
| A2 | Cardiologia | Controllo | - |
| B1 | Ortopedia | Prima visita | RX |
"

        Public Shared Function RunAll() As Boolean
            Dim ok = True
            ok = ok AndAlso TestParseKbPipeTable()
            ok = ok AndAlso TestAskFirstColumn()
            ok = ok AndAlso TestCompleteViaAutoFill()
            ok = ok AndAlso TestAskNextColumnWhenAmbiguous()
            ok = ok AndAlso TestAutoFillSingleValueComplete()
            ok = ok AndAlso TestInvalidCombination()
            ok = ok AndAlso TestCompleteAllSelectors()
            ok = ok AndAlso TestFilterCaseInsensitive()
            ok = ok AndAlso TestAcquisitionSayFromIndex()
            ok = ok AndAlso TestCompleteWithDialogIndex()
            ok = ok AndAlso TestCorrectionWalk()
            If ok Then
                Console.WriteLine("[DialogStepEngineTests] All passed.")
            Else
                Console.WriteLine("[DialogStepEngineTests] FAILED.")
            End If
            Return ok
        End Function

        Private Shared Function BaseSelectorSpec() As KbSelectorSpec
            Return New KbSelectorSpec With {
                .SchemaVersion = 1,
                .Columns = New List(Of SelectorColumnSpec) From {
                    New SelectorColumnSpec With {.ColumnId = "specialita", .HeaderLabel = "specialita", .Role = "selector", .PromptType = "closed_list", .SortOrder = 0, .PromptTemplate = "la specialità", .AskPolicy = "required"},
                    New SelectorColumnSpec With {.ColumnId = "tipo_visita", .HeaderLabel = "tipo_visita", .Role = "selector", .PromptType = "closed_list", .SortOrder = 10, .PromptTemplate = "il tipo di visita", .AskPolicy = "optional"},
                    New SelectorColumnSpec With {.ColumnId = "esame_associato", .HeaderLabel = "esame_associato", .Role = "selector", .PromptType = "closed_list", .SortOrder = 20, .PromptTemplate = "l'esame associato", .AskPolicy = "optional", .AutoFillSingleValue = True},
                    New SelectorColumnSpec With {.ColumnId = "codice", .HeaderLabel = "codice", .Role = "data", .PromptType = "closed_list", .SortOrder = 99, .PromptTemplate = "codice"}
                },
                .InvalidationTemplates = New List(Of InvalidationTemplateSpec) From {
                    New InvalidationTemplateSpec With {.Id = "tpl1", .Approved = True, .Template = "Per {colonna} non è disponibile {valore_rifiutato}. Provi con {alternativa_suggerita}."}
                }
            }
        End Function

        Private Shared Function SampleGrid() As KbDialogGrid
            Dim parsed = KbPipeTableParser.ParseKbPipeTable(SampleMd)
            Return New KbDialogGrid With {.Headers = parsed.Headers, .Rows = parsed.Rows.Select(Function(r) CType(r, List(Of String))).ToList()}
        End Function

        Private Shared Function TestParseKbPipeTable() As Boolean
            Dim parsed = KbPipeTableParser.ParseKbPipeTable(SampleMd)
            If parsed Is Nothing OrElse parsed.Headers.Count <> 4 OrElse parsed.Rows.Count <> 3 Then
                Console.WriteLine("FAIL TestParseKbPipeTable")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestAskFirstColumn() As Boolean
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), New Dictionary(Of String, String), New Dictionary(Of String, String))
            If r.Status <> "ask" OrElse r.NextColumnId <> "specialita" Then
                Console.WriteLine("FAIL TestAskFirstColumn status/next")
                Return False
            End If
            If Not r.AllowedValues.Contains("Cardiologia") OrElse Not r.Say.ToLowerInvariant().Contains("special") Then
                Console.WriteLine("FAIL TestAskFirstColumn values/say")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestCompleteViaAutoFill() As Boolean
            Dim updates As New Dictionary(Of String, String) From {{"specialita", "Cardiologia"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), New Dictionary(Of String, String), updates)
            If r.Status <> "complete" OrElse r.MatchedRow Is Nothing OrElse r.MatchedRow("codice") <> "A1" Then
                Console.WriteLine("FAIL TestCompleteViaAutoFill")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestAskNextColumnWhenAmbiguous() As Boolean
            Dim md = "| codice | specialita | tipo_visita | esame_associato |
| --- | --- | --- | --- |
| A1 | Cardiologia | Prima visita | ECG |
| A2 | Cardiologia | Controllo | Holter |
"
            Dim parsed = KbPipeTableParser.ParseKbPipeTable(md)
            Dim grid As New KbDialogGrid With {.Headers = parsed.Headers, .Rows = parsed.Rows.Select(Function(rowList) CType(rowList, List(Of String))).ToList()}
            Dim updates As New Dictionary(Of String, String) From {{"specialita", "Cardiologia"}}
            Dim stepResult = DialogStepEngine.ExecuteDialogStep(grid, BaseSelectorSpec(), New Dictionary(Of String, String), updates)
            If stepResult.Status <> "ask" OrElse stepResult.NextColumnId <> "tipo_visita" OrElse stepResult.RemainingRowCount <> 2 Then
                Console.WriteLine("FAIL TestAskNextColumnWhenAmbiguous")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestAutoFillSingleValueComplete() As Boolean
            Dim binding As New Dictionary(Of String, String) From {{"specialita", "Ortopedia"}}
            Dim updates As New Dictionary(Of String, String) From {{"tipo_visita", "Prima visita"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), binding, updates)
            If r.Status <> "complete" OrElse r.MatchedRow Is Nothing OrElse r.MatchedRow("codice") <> "B1" Then
                Console.WriteLine("FAIL TestAutoFillSingleValueComplete")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestInvalidCombination() As Boolean
            Dim binding As New Dictionary(Of String, String) From {{"specialita", "Cardiologia"}}
            Dim updates As New Dictionary(Of String, String) From {{"tipo_visita", "Prima visita"}, {"esame_associato", "RX"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), binding, updates)
            If r.Status <> "invalid" OrElse r.Rejected Is Nothing OrElse r.Rejected.ColumnId <> "esame_associato" Then
                Console.WriteLine("FAIL TestInvalidCombination")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestCompleteAllSelectors() As Boolean
            Dim binding As New Dictionary(Of String, String) From {{"specialita", "Cardiologia"}}
            Dim updates As New Dictionary(Of String, String) From {{"tipo_visita", "Controllo"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), binding, updates)
            If r.Status <> "complete" OrElse r.MatchedRow Is Nothing OrElse r.MatchedRow("codice") <> "A2" Then
                Console.WriteLine("FAIL TestCompleteAllSelectors")
                Return False
            End If
            Return True
        End Function

        Private Shared Function SampleDialogIndex() As Newtonsoft.Json.Linq.JObject
            Dim json = "{
  ""schemaVersion"": 1,
  ""completeTemplate"": ""Perfetto, prenoto {tipo_visita_nat} {specialita_nat}{esame_suffix}."",
  ""valueLabels"": {
    ""specialita"": { ""cardiologia"": ""cardiologica"" },
    ""tipo_visita"": { ""controllo"": ""visita di controllo"", ""prima visita"": ""prima visita"" },
    ""esame_associato"": { ""ecg"": ""ECG"", ""holter"": ""Holter"" }
  },
  ""acquisition"": {
    ""specialita"": {
      ""useCaseId"": ""uc_ask_specialita"",
      ""rows"": [{ ""bindingWhen"": {}, ""say"": ""Quale specialità desidera?"" }]
    }
  },
  ""correction"": [{
    ""useCaseId"": ""uc_corr_tipo_esame"",
    ""triggerColumnId"": ""tipo_visita"",
    ""incompatibleColumnId"": ""esame_associato"",
    ""sayTemplate"": ""Cambiando il tipo visita, {esame_associato_nat} non è più valido. {alternativa_messaggio}""
  }],
  ""complete"": {
    ""useCaseId"": ""uc_complete"",
    ""sayTemplate"": ""Perfetto, prenoto {tipo_visita_nat} {specialita_nat}{esame_suffix}.""
  }
}"
            Return Newtonsoft.Json.Linq.JObject.Parse(json)
        End Function

        Private Shared Function TestAcquisitionSayFromIndex() As Boolean
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), New Dictionary(Of String, String), New Dictionary(Of String, String), SampleDialogIndex())
            If r.Status <> "ask" OrElse r.Say <> "Quale specialità desidera?" OrElse r.UseCaseId <> "uc_ask_specialita" Then
                Console.WriteLine("FAIL TestAcquisitionSayFromIndex")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestCompleteWithDialogIndex() As Boolean
            Dim binding As New Dictionary(Of String, String) From {{"specialita", "Cardiologia"}}
            Dim updates As New Dictionary(Of String, String) From {{"tipo_visita", "Controllo"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(SampleGrid(), BaseSelectorSpec(), binding, updates, SampleDialogIndex())
            If r.Status <> "complete" OrElse r.UseCaseId <> "uc_complete" OrElse Not r.Say.ToLowerInvariant().Contains("cardiolog") Then
                Console.WriteLine("FAIL TestCompleteWithDialogIndex")
                Return False
            End If
            If r.Say.Contains("Perfetto, ho trovato") Then
                Console.WriteLine("FAIL TestCompleteWithDialogIndex fallback")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestCorrectionWalk() As Boolean
            Dim md = "| codice | specialita | tipo_visita | esame_associato |
| --- | --- | --- | --- |
| A1 | Cardiologia | Prima visita | ECG |
| A2 | Cardiologia | Controllo | Holter |
"
            Dim parsed = KbPipeTableParser.ParseKbPipeTable(md)
            Dim grid As New KbDialogGrid With {.Headers = parsed.Headers, .Rows = parsed.Rows.Select(Function(rowList) CType(rowList, List(Of String))).ToList()}
            Dim binding As New Dictionary(Of String, String) From {
                {"specialita", "Cardiologia"},
                {"tipo_visita", "Prima visita"},
                {"esame_associato", "ECG"}
            }
            Dim updates As New Dictionary(Of String, String) From {{"tipo_visita", "Controllo"}}
            Dim r = DialogStepEngine.ExecuteDialogStep(grid, BaseSelectorSpec(), binding, updates, SampleDialogIndex())
            If r.Status <> "correction" OrElse r.UseCaseKind <> "correction" Then
                Console.WriteLine("FAIL TestCorrectionWalk status")
                Return False
            End If
            If Not r.Say.ToLowerInvariant().Contains("non") Then
                Console.WriteLine("FAIL TestCorrectionWalk say")
                Return False
            End If
            If r.UseCaseId <> "uc_corr_tipo_esame" Then
                Console.WriteLine("FAIL TestCorrectionWalk useCaseId")
                Return False
            End If
            Return True
        End Function

        Private Shared Function TestFilterCaseInsensitive() As Boolean
            Dim grid = SampleGrid()
            Dim rows = KbDialogBindings.FilterRowsByBinding(grid.Rows, grid.Headers, New Dictionary(Of String, String) From {{"specialita", "cardiologia"}})
            If rows.Count <> 2 Then
                Console.WriteLine("FAIL TestFilterCaseInsensitive")
                Return False
            End If
            Return True
        End Function
    End Class
End Namespace
