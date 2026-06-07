Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions

Namespace KbDialogStep
    ''' <summary>Parse tabella markdown pipe per runtime dialogo KB (parità Node parseKbPipeTable.js).</summary>
    Public NotInheritable Class KbPipeTableParser
        Private Shared ReadOnly SeparatorRowRegex As New Regex("^\|[\s\-:|]+\|$", RegexOptions.Compiled)

        Public Shared Function TrimCell(v As String) As String
            Return If(v, "").Trim().Replace("\|", "|")
        End Function

        Public Shared Function IsSeparatorRow(line As String) As Boolean
            Dim t = If(line, "").Trim()
            If Not t.StartsWith("|"c) Then Return False
            Return SeparatorRowRegex.IsMatch(t)
        End Function

        Public Class ParsedKbTable
            Public Property Preamble As List(Of String)
            Public Property Headers As List(Of String)
            Public Property Rows As List(Of List(Of String))
        End Class

        Public Shared Function ParseKbPipeTable(markdown As String) As ParsedKbTable
            Dim lines = Regex.Split(If(markdown, ""), "\r?\n").
                Select(Function(l) l.Trim()).
                Where(Function(l) l.Length > 0).
                ToList()

            Dim tableStart = -1
            For i = 0 To lines.Count - 1
                If lines(i).StartsWith("|") AndAlso Not IsSeparatorRow(lines(i)) Then
                    tableStart = i
                    Exit For
                End If
            Next
            If tableStart < 0 Then Return Nothing

            Dim headerLine = lines(tableStart)
            Dim headerParts = headerLine.Split("|"c)
            Dim headers = headerParts.
                Skip(1).
                Take(Math.Max(0, headerParts.Length - 2)).
                Select(AddressOf TrimCell).
                ToList()
            headers = headers.Where(Function(h) h.Length > 0 OrElse headers.Count > 1).ToList()
            If headers.Count = 0 Then Return Nothing

            Dim rows As New List(Of List(Of String))
            For i = tableStart + 1 To lines.Count - 1
                Dim line = lines(i)
                If Not line.StartsWith("|") Then Exit For
                If IsSeparatorRow(line) Then Continue For
                Dim cells = line.Split("|"c).
                    Skip(1).
                    Take(Math.Max(0, line.Split("|"c).Length - 2)).
                    Select(AddressOf TrimCell).
                    ToList()
                While cells.Count < headers.Count
                    cells.Add("")
                End While
                rows.Add(cells.Take(headers.Count).ToList())
            Next

            Return New ParsedKbTable With {
                .Preamble = lines.Take(tableStart).ToList(),
                .Headers = headers,
                .Rows = rows
            }
        End Function
    End Class
End Namespace
