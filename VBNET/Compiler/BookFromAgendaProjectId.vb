Option Strict On
Option Explicit On

Imports System.Text.RegularExpressions

''' <summary>
''' Generazione deterministica projectId per scope BookFromAgenda / Redis (allineato al TS generateProjectId).
''' </summary>
Public Module BookFromAgendaProjectIdUtil

    Public Function SanitizeSegment(raw As String) As String
        Dim s = If(raw, "").Trim()
        If s.Length = 0 Then Return "na"
        Dim sb As New System.Text.StringBuilder()
        For Each ch As Char In s.Normalize(System.Text.NormalizationForm.FormKD)
            If Char.IsLetterOrDigit(ch) Then
                sb.Append(ch)
            Else
                sb.Append("_"c)
            End If
        Next
        Dim collapsed = Regex.Replace(sb.ToString(), "_+", "_").Trim("_"c)
        Return If(String.IsNullOrWhiteSpace(collapsed), "na", collapsed)
    End Function

    ''' <summary>
    ''' Restituisce Omnia_&lt;cliente&gt;_&lt;nomeProgetto&gt;_&lt;versione&gt; con segmenti sanitizzati.
    ''' </summary>
    Public Function GenerateProjectId(cliente As String, nomeProgetto As String, versione As String) As String
        Dim c = SanitizeSegment(cliente)
        Dim p = SanitizeSegment(nomeProgetto)
        Dim v = SanitizeSegment(versione)
        Return $"Omnia_{c}_{p}_{v}"
    End Function

End Module
