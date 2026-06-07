Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json.Linq

Namespace KbDialogStep
    ''' <summary>Carica tabella KB approvata e selectorSpec dal task agente (parità Node kbDialogRuntimeLoader.js).</summary>
    Public NotInheritable Class KbDialogRuntimeLoader
        Private Const MinUsableRestructureChars As Integer = 80

        Public Shared Function ExtractDataMarkdown(stored As String) As String
            Dim raw = If(stored, "").Trim()
            If raw.Length = 0 Then Return ""
            Dim marker = New System.Text.RegularExpressions.Regex("(?m)^##\s+Dati normalizzati\s*$")
            Dim match = marker.Match(raw)
            If match.Success Then
                Return raw.Substring(match.Index).Trim()
            End If
            If raw.StartsWith("|") Then Return raw
            Return raw
        End Function

        Public Shared Function HasUsableRestructure(doc As JObject) As Boolean
            If doc Is Nothing Then Return False
            Dim text = doc.Value(Of String)("documentRestructuredMarkdown")
            text = If(text, "").Trim()
            If text.Length < MinUsableRestructureChars Then Return False
            If System.Text.RegularExpressions.Regex.IsMatch(text, "(da definire\)|_Nessuna sintesi)", System.Text.RegularExpressions.RegexOptions.IgnoreCase) AndAlso text.Length < 120 Then
                Return False
            End If
            Return True
        End Function

        Public Shared Function ParseKbDocumentsJson(raw As String) As List(Of JObject)
            Dim trimmed = If(raw, "").Trim()
            If trimmed.Length = 0 Then Return New List(Of JObject)
            Try
                Dim parsed = JToken.Parse(trimmed)
                If parsed.Type = JTokenType.Array Then
                    Return parsed.Select(Function(t) TryCast(t, JObject)).Where(Function(o) o IsNot Nothing).ToList()
                End If
            Catch
            End Try
            Return New List(Of JObject)
        End Function

        Public Shared Function ParseSelectorSpec(raw As JToken) As KbSelectorSpec
            If raw Is Nothing OrElse raw.Type <> JTokenType.Object Then Return Nothing
            Dim jo = CType(raw, JObject)
            Dim columnsTok = jo("columns")
            If columnsTok Is Nothing OrElse columnsTok.Type <> JTokenType.Array Then Return Nothing
            Dim columns As New List(Of SelectorColumnSpec)
            For Each colTok In columnsTok
                Dim col = TryCast(colTok, JObject)
                If col Is Nothing Then Continue For
                columns.Add(New SelectorColumnSpec With {
                    .ColumnId = col.Value(Of String)("columnId"),
                    .HeaderLabel = col.Value(Of String)("headerLabel"),
                    .Role = col.Value(Of String)("role"),
                    .PromptType = col.Value(Of String)("promptType"),
                    .SortOrder = If(col.Value(Of Integer?)("sortOrder"), 0),
                    .PromptTemplate = col.Value(Of String)("promptTemplate"),
                    .AskPolicy = col.Value(Of String)("askPolicy"),
                    .AutoFillSingleValue = col.Value(Of Boolean?)("autoFillSingleValue").GetValueOrDefault(False),
                    .InformOnAutofill = col.Value(Of Boolean?)("informOnAutofill").GetValueOrDefault(False)
                })
                Dim lastCol = columns(columns.Count - 1)
                Dim acceptance As New List(Of SelectorAcceptanceWhenSpec)
                Dim accTok = col("acceptanceWhen")
                If accTok IsNot Nothing AndAlso accTok.Type = JTokenType.Array Then
                    For Each aTok In accTok
                        Dim a = TryCast(aTok, JObject)
                        If a Is Nothing Then Continue For
                        acceptance.Add(New SelectorAcceptanceWhenSpec With {
                            .MetadataColumnId = a.Value(Of String)("metadataColumnId"),
                            .MetadataValue = a.Value(Of String)("metadataValue")
                        })
                    Next
                End If
                lastCol.AcceptanceWhen = acceptance
            Next
            If columns.Count = 0 Then Return Nothing

            Dim invalidation As New List(Of InvalidationTemplateSpec)
            Dim invTok = jo("invalidationTemplates")
            If invTok IsNot Nothing AndAlso invTok.Type = JTokenType.Array Then
                For Each tTok In invTok
                    Dim t = TryCast(tTok, JObject)
                    If t Is Nothing Then Continue For
                    invalidation.Add(New InvalidationTemplateSpec With {
                        .Id = t.Value(Of String)("id"),
                        .Approved = t.Value(Of Boolean?)("approved").GetValueOrDefault(False),
                        .Template = t.Value(Of String)("template")
                    })
                Next
            End If

            Return New KbSelectorSpec With {
                .SchemaVersion = 1,
                .Columns = columns,
                .InvalidationTemplates = invalidation
            }
        End Function

        ''' <summary>Carica runtime KB da task agente (JObject da Mongo/Express).</summary>
        Public Shared Function LoadKbDialogRuntime(agentTask As JObject, Optional preferredDocId As String = Nothing) As KbDialogRuntimeLoadResult
            Dim result As New KbDialogRuntimeLoadResult()
            If agentTask Is Nothing Then
                result.ErrorCode = "no_approved_kb_dialog_config"
                Return result
            End If

            Dim docsJson = agentTask.Value(Of String)("agentKnowledgeBaseDocumentsJson")
            Dim docs = ParseKbDocumentsJson(docsJson)
            Dim eligible = docs.Where(Function(d)
                                          If d Is Nothing Then Return False
                                          If d.Value(Of Boolean?)("documentRestructuredApprovedForRuntime") <> True Then Return False
                                          If Not HasUsableRestructure(d) Then Return False
                                          Dim spec = d("documentSelectorSpec")
                                          If spec Is Nothing OrElse spec.Type <> JTokenType.Object Then Return False
                                          Dim cols = spec("columns")
                                          Return cols IsNot Nothing AndAlso cols.Type = JTokenType.Array AndAlso cols.HasValues
                                      End Function).ToList()

            If eligible.Count = 0 Then
                result.ErrorCode = "no_approved_kb_dialog_config"
                Return result
            End If

            Dim pid = If(preferredDocId, "").Trim()
            Dim doc As JObject
            If pid.Length > 0 Then
                doc = eligible.FirstOrDefault(Function(d) String.Equals(d.Value(Of String)("id"), pid, StringComparison.Ordinal))
                If doc Is Nothing Then doc = eligible(0)
            Else
                doc = eligible(0)
            End If

            Dim dataMd = ExtractDataMarkdown(doc.Value(Of String)("documentRestructuredMarkdown"))
            Dim parsed = KbPipeTableParser.ParseKbPipeTable(dataMd)
            If parsed Is Nothing OrElse parsed.Headers.Count = 0 Then
                result.ErrorCode = "kb_table_parse_failed"
                result.DocumentId = doc.Value(Of String)("id")
                Return result
            End If

            Dim selectorSpec = ParseSelectorSpec(doc("documentSelectorSpec"))
            If selectorSpec Is Nothing Then
                result.ErrorCode = "kb_selector_spec_invalid"
                result.DocumentId = doc.Value(Of String)("id")
                Return result
            End If

            result.DocumentId = doc.Value(Of String)("id")
            result.DocumentName = doc.Value(Of String)("name")
            result.Grid = New KbDialogGrid With {
                .Headers = parsed.Headers,
                .Rows = parsed.Rows.Select(Function(r) CType(r, List(Of String))).ToList()
            }
            result.SelectorSpec = selectorSpec
            Return result
        End Function
    End Class
End Namespace
