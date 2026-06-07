Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Globalization
Imports System.Linq
Imports System.Text
Imports System.Text.RegularExpressions

Namespace KbDialogStep
    ''' <summary>Normalizzazione celle/intestazioni tabella KB per dialog step runtime (parità Node kbDialogBindings.js).</summary>
    Public NotInheritable Class KbDialogBindings
        ' DiacriticsRegex / ItalianComparer must initialize before EmptyCellValues (BuildEmptyCellValues calls NormalizeToken).
        Private Shared ReadOnly DiacriticsRegex As New Regex("[\u0300-\u036f]", RegexOptions.Compiled)
        Private Shared ReadOnly ItalianComparer As StringComparer = StringComparer.Create(New CultureInfo("it-IT"), ignoreCase:=False)
        Private Shared ReadOnly EmptyCellValues As HashSet(Of String) = BuildEmptyCellValues()

        Private Shared Function BuildEmptyCellValues() As HashSet(Of String)
            Dim tokens = {
                "-", "—", "–", "n/a", "n.a.", "na", "non applicabile", "non_applicable",
                "not_applicable", "not applicable", "unknown", "sconosciuto", "unspecified", "non specificato"
            }
            Return New HashSet(Of String)(tokens.Select(AddressOf NormalizeToken), StringComparer.OrdinalIgnoreCase)
        End Function

        Public Shared Function SlugifyColumnId(header As String) As String
            Dim raw = If(header, "").Trim().ToLowerInvariant()
            raw = raw.Normalize(NormalizationForm.FormD)
            raw = DiacriticsRegex.Replace(raw, "")
            raw = Regex.Replace(raw, "[^a-z0-9]+", "_")
            raw = Regex.Replace(raw, "^_+|_+$", "")
            If raw.Length > 48 Then raw = raw.Substring(0, 48)
            Return If(String.IsNullOrEmpty(raw), "column", raw)
        End Function

        Public Shared Function NormalizeToken(value As String) As String
            Dim raw = If(value, "").Trim().ToLowerInvariant()
            raw = raw.Normalize(NormalizationForm.FormD)
            raw = DiacriticsRegex.Replace(raw, "")
            raw = Regex.Replace(raw, "\s+", "_")
            Return raw
        End Function

        Public Shared Function IsEmptyCellValue(value As String) As Boolean
            Dim v = If(value, "").Trim()
            If v.Length = 0 Then Return True
            Return EmptyCellValues.Contains(NormalizeToken(v))
        End Function

        Public Shared Function NormalizeCellValue(value As String) As String
            If IsEmptyCellValue(value) Then Return ""
            Return If(value, "").Trim()
        End Function

        Public Shared Function HeaderIndex(headers As IList(Of String), name As String) As Integer
            Dim target = SlugifyColumnId(name)
            For i = 0 To headers.Count - 1
                If SlugifyColumnId(headers(i)) = target Then Return i
            Next
            Return -1
        End Function

        Public Shared Function CellAt(row As IList(Of String), index As Integer) As String
            If index < 0 Then Return ""
            If row Is Nothing OrElse index >= row.Count Then Return ""
            Return NormalizeCellValue(row(index))
        End Function

        Public Shared Function DistinctColumnValues(rows As IEnumerable(Of IList(Of String)), colIndex As Integer) As List(Of String)
            Dim seen As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
            Dim out As New List(Of String)
            If rows Is Nothing Then Return out
            For Each row In rows
                Dim v = CellAt(row, colIndex)
                If v.Length = 0 Then Continue For
                If seen.Add(v) Then out.Add(v)
            Next
            out.Sort(Function(a, b) ItalianComparer.Compare(a, b))
            Return out
        End Function

        Public Shared Function RowMatchesBinding(row As IList(Of String), headers As IList(Of String), binding As Dictionary(Of String, String)) As Boolean
            If binding Is Nothing Then Return True
            For Each kvp In binding
                Dim idx = HeaderIndex(headers, kvp.Key)
                If idx < 0 Then Continue For
                Dim want = NormalizeCellValue(kvp.Value)
                If want.Length = 0 Then Continue For
                Dim got = CellAt(row, idx)
                If Not String.Equals(got, want, StringComparison.OrdinalIgnoreCase) Then Return False
            Next
            Return True
        End Function

        Public Shared Function FilterRowsByBinding(rows As IEnumerable(Of IList(Of String)), headers As IList(Of String), binding As Dictionary(Of String, String)) As List(Of IList(Of String))
            Dim out As New List(Of IList(Of String))
            If rows Is Nothing Then Return out
            Dim hasBinding = binding IsNot Nothing AndAlso binding.Any(Function(kvp) NormalizeCellValue(kvp.Value).Length > 0)
            If Not hasBinding Then
                For Each row In rows
                    out.Add(row)
                Next
                Return out
            End If
            For Each row In rows
                If RowMatchesBinding(row, headers, binding) Then out.Add(row)
            Next
            Return out
        End Function

        Public Shared Function ListAskableColumns(selectorSpec As KbSelectorSpec) As List(Of SelectorColumnSpec)
            If selectorSpec Is Nothing OrElse selectorSpec.Columns Is Nothing Then Return New List(Of SelectorColumnSpec)
            Return selectorSpec.Columns.
                Where(Function(c) c IsNot Nothing AndAlso String.Equals(c.Role, "selector", StringComparison.OrdinalIgnoreCase) AndAlso Not c.AutoFillSingleValue).
                OrderBy(Function(c) c.SortOrder).
                ThenBy(Function(c) If(c.HeaderLabel, ""), ItalianComparer).
                ToList()
        End Function

        Public Shared Function FillInvalidationTemplate(template As String, vars As Dictionary(Of String, String)) As String
            Dim out = If(template, "")
            If vars IsNot Nothing Then
                For Each kvp In vars
                    out = out.Replace("{" & kvp.Key & "}", If(kvp.Value, ""))
                Next
            End If
            out = Regex.Replace(out, "\{[^}]+\}", "")
            out = Regex.Replace(out, "\s+", " ").Trim()
            Return out
        End Function
    End Class
End Namespace
