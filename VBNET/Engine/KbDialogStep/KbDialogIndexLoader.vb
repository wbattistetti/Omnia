Option Strict On
Option Explicit On

Imports Newtonsoft.Json.Linq

Namespace KbDialogStep
    ''' <summary>Parse agentKbDialogIndexJson per il motore dialogo.</summary>
    Public NotInheritable Class KbDialogIndexLoader
        Public Shared Function ParseIndex(raw As String) As JObject
            Dim trimmed = If(raw, "").Trim()
            If trimmed.Length = 0 Then Return Nothing
            Try
                Dim parsed = JToken.Parse(trimmed)
                Dim jo = TryCast(parsed, JObject)
                If jo Is Nothing Then Return Nothing
                If jo.Value(Of Integer?)("schemaVersion") <> 1 Then Return Nothing
                Return jo
            Catch
                Return Nothing
            End Try
        End Function
    End Class
End Namespace
