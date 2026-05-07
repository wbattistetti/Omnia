Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Globalization
Imports System.Text.RegularExpressions
Imports Newtonsoft.Json.Linq

Namespace ElevenLabs

''' <summary>
''' Estrae da messaggi WebSocket ConvAI un payload di errore backend (es. BookFromAgenda <c>ok:false</c>) per il debugger Omnia.
''' </summary>
Friend NotInheritable Class ElevenLabsConvaiToolDiagnosticExtractor

    Private Const PreviewLen As Integer = 1200

    Private Sub New()
    End Sub

    ''' <summary>Ritorna Nothing se non è un fallimento backend rilevante.</summary>
    Public Shared Function TryExtractFailure(root As JObject, raw As String) As JObject
        If root Is Nothing OrElse String.IsNullOrWhiteSpace(raw) Then Return Nothing

        Dim candidates As New List(Of String)()
        CollectStringLeaves(root, candidates, 0)

        Dim ranked As JObject = Nothing
        Dim rankedScore As Integer = -1

        For Each s In candidates
            Dim trimmed = s.Trim()
            If trimmed.Length < 12 Then Continue For
            Dim jo As JObject = Nothing
            Try
                Dim tok = JToken.Parse(trimmed)
                jo = TryCast(tok, JObject)
            Catch
                Continue For
            End Try
            If jo Is Nothing Then Continue For

            Dim score As Integer
            Dim diag = TryMapFailure(jo, trimmed, raw, score)
            If diag IsNot Nothing AndAlso score > rankedScore Then
                ranked = diag
                rankedScore = score
            End If
        Next

        If ranked IsNot Nothing Then Return ranked

        ' Fallback: body principale se è già un errore JSON (senza nesting).
        Try
            Dim score2 As Integer
            Dim top = TryMapFailure(root, raw, raw, score2)
            If top IsNot Nothing Then Return top
        Catch
        End Try

        Return Nothing
    End Function

    Private Shared Sub CollectStringLeaves(t As JToken, acc As List(Of String), depth As Integer)
        If t Is Nothing OrElse depth > 14 Then Return
        Select Case t.Type
            Case JTokenType.String
                acc.Add(t.Value(Of String)())
            Case JTokenType.Object
                For Each p In CType(t, JObject).Properties()
                    CollectStringLeaves(p.Value, acc, depth + 1)
                Next
            Case JTokenType.Array
                For Each c In CType(t, JArray)
                    CollectStringLeaves(c, acc, depth + 1)
                Next
            Case Else
        End Select
    End Sub

    Private Shared Function TryMapFailure(jo As JObject, responseSource As String, rawHint As String, ByRef scoreOut As Integer) As JObject
        scoreOut = 0
        If jo Is Nothing Then Return Nothing

        Dim okTok = jo("ok")
        Dim httpTok = jo("httpStatus")
        Dim errTok = jo("error")
        Dim diagTok = jo("diagnostic")

        Dim httpSt As Integer? = ParsePositiveInt(httpTok)
        If Not httpSt.HasValue Then httpSt = ParsePositiveInt(jo("statusCode"))
        If Not httpSt.HasValue Then httpSt = ParsePositiveInt(jo("status"))

        Dim okFalse = okTok IsNot Nothing AndAlso okTok.Type = JTokenType.Boolean AndAlso okTok.Value(Of Boolean)() = False

        Dim errStr = If(errTok?.Type = JTokenType.String, errTok.ToString(), Nothing)
        If String.IsNullOrWhiteSpace(errStr) AndAlso errTok IsNot Nothing AndAlso errTok.Type = JTokenType.Object Then
            errStr = errTok("message")?.ToString()
        End If

        Dim hasErr = Not String.IsNullOrWhiteSpace(errStr)
        Dim hasDiag = diagTok IsNot Nothing AndAlso diagTok.Type <> JTokenType.Null

        Dim failure As Boolean =
            (httpSt.HasValue AndAlso httpSt.Value >= 400) OrElse
            okFalse OrElse
            (hasErr AndAlso LooksSchedulingRelated(errStr)) OrElse
            (hasDiag AndAlso LooksSchedulingRelated(diagTok.ToString()))

        If Not failure Then Return Nothing

        scoreOut = 1
        If httpSt.HasValue AndAlso httpSt.Value >= 400 Then scoreOut += 4
        If okFalse Then scoreOut += 2
        If hasDiag Then scoreOut += 2
        If hasErr AndAlso LooksSchedulingRelated(errStr) Then scoreOut += 1

        Dim ep = FirstSchedulingUrl(rawHint)
        If String.IsNullOrWhiteSpace(ep) Then ep = "POST …/api/runtime/bookfromagenda"

        Dim preview = Truncate(responseSource, PreviewLen)

        Dim out As New JObject From {
            {"endpoint", ep},
            {"method", "POST"},
            {"responsePreview", preview}
        }

        If httpSt.HasValue Then out("httpStatus") = httpSt.Value
        If hasErr Then out("errorMessage") = errStr
        If hasDiag Then out("diagnostic") = diagTok

        Return out
    End Function

    Private Shared Function LooksSchedulingRelated(s As String) As Boolean
        If String.IsNullOrWhiteSpace(s) Then Return False
        Dim t = s.ToLowerInvariant()
        Return t.Contains("bookfromagenda") OrElse
            t.Contains("scheduling") OrElse
            t.Contains("queryconstraints") OrElse
            t.Contains("agenda") OrElse
            t.Contains("horizon") OrElse
            t.Contains("slot")
    End Function

    Private Shared Function ParsePositiveInt(tok As JToken) As Integer?
        If tok Is Nothing OrElse tok.Type = JTokenType.Null Then Return Nothing
        If tok.Type = JTokenType.Integer Then Return tok.Value(Of Integer)()
        If tok.Type = JTokenType.Float Then
            Dim d = tok.Value(Of Double)()
            If Double.IsNaN(d) OrElse Double.IsInfinity(d) Then Return Nothing
            Return CInt(Math.Truncate(d))
        End If
        If tok.Type = JTokenType.String Then
            Dim s = tok.ToString().Trim()
            Dim v As Integer
            If Integer.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, v) Then Return v
        End If
        Return Nothing
    End Function

    Private Shared Function FirstSchedulingUrl(raw As String) As String
        If String.IsNullOrWhiteSpace(raw) Then Return Nothing
        Dim ms = Regex.Matches(raw, "https?://[^\s""\\]+", RegexOptions.IgnoreCase)
        For Each m As Match In ms
            Dim u = m.Value
            If u.IndexOf("bookfromagenda", StringComparison.OrdinalIgnoreCase) >= 0 OrElse
                u.IndexOf("scheduling", StringComparison.OrdinalIgnoreCase) >= 0 Then
                Return u.TrimEnd(","c, ")"c, "]"c, "}"c)
            End If
        Next
        Return Nothing
    End Function

    Private Shared Function Truncate(s As String, maxLen As Integer) As String
        If s Is Nothing Then Return ""
        If s.Length <= maxLen Then Return s
        Return s.Substring(0, maxLen) & "…"
    End Function

End Class

End Namespace
