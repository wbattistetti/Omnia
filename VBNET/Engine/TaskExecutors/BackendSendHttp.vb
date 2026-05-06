Option Strict On
Option Explicit On

Imports System.Collections
Imports System.Collections.Generic
Imports System.Globalization
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Allinea il runtime VB alla semantica di <c>buildSendHttpRequest</c> (TypeScript): SEND da VariableStore,
''' path <c>{apiParam}</c>, GET → query string, POST/PUT/PATCH → JSON body flat per chiave apiParam.
''' </summary>
Public Module BackendSendHttp

    Public NotInheritable Class BuiltBackendHttpRequest
        Public Property Url As String
        Public Property Method As String
        Public Property Headers As Dictionary(Of String, String)
        ''' <summary>Nothing per GET/HEAD/DELETE senza body.</summary>
        Public Property BodyJson As String
    End Class

    ''' <summary>Coercizione come <c>coerceMockCellValue</c> nel designer.</summary>
    Public Function CoerceMockCellValue(raw As Object) As Object
        If raw Is Nothing Then Return Nothing
        If TypeOf raw Is String Then
            Dim t = DirectCast(raw, String).Trim()
            If t = "" Then Return ""
            If String.Equals(t, "true", StringComparison.OrdinalIgnoreCase) Then Return True
            If String.Equals(t, "false", StringComparison.OrdinalIgnoreCase) Then Return False
            If t <> "0" AndAlso Regex.IsMatch(t, "^-?\d+$") Then Return Long.Parse(t, CultureInfo.InvariantCulture)
            If Regex.IsMatch(t, "^-?\d+\.\d+$") Then Return Double.Parse(t, CultureInfo.InvariantCulture)
            If (t.StartsWith("{"c) AndAlso t.EndsWith("}"c)) OrElse (t.StartsWith("["c) AndAlso t.EndsWith("]"c)) Then
                Try
                    Return JToken.Parse(t)
                Catch
                    Return raw
                End Try
            End If
            Return raw
        End If
        If TypeOf raw Is JToken Then Return raw
        Return raw
    End Function

    Private Function StableJsonFromDict(values As Dictionary(Of String, Object)) As String
        Dim jo As New JObject()
        For Each k As String In values.Keys.OrderBy(Function(x) x, StringComparer.Ordinal)
            jo(k) = JToken.FromObject(values(k))
        Next
        Return jo.ToString(Formatting.None)
    End Function

    Private Function SubstitutePathParams(urlStr As String, values As Dictionary(Of String, Object)) As Tuple(Of String, HashSet(Of String))
        Dim used As New HashSet(Of String)(StringComparer.Ordinal)
        Dim u = urlStr
        Dim re As New Regex("\{([^}]+)\}", RegexOptions.CultureInvariant)
        For Each m As Match In re.Matches(urlStr)
            Dim name = m.Groups(1).Value.Trim()
            If values.ContainsKey(name) Then
                used.Add(name)
                Dim v = values(name)
                Dim enc = Uri.EscapeDataString(If(v Is Nothing, "", v.ToString()))
                u = u.Replace(m.Value, enc)
            End If
        Next
        Return Tuple.Create(u, used)
    End Function

    ''' <summary>
    ''' Costruisce URL, metodo, header e body come nel designer Node/Vite.
    ''' </summary>
    Public Function BuildSendHttpRequest(
        endpointUrl As String,
        methodRaw As String,
        endpointHeaders As IDictionary(Of String, String),
        inputs As List(Of Dictionary(Of String, Object)),
        variableStore As Dictionary(Of String, Object)
    ) As BuiltBackendHttpRequest

        Dim method = If(String.IsNullOrWhiteSpace(methodRaw), "GET", methodRaw.Trim().ToUpperInvariant())

        Dim headers As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
        If endpointHeaders IsNot Nothing Then
            For Each kv In endpointHeaders
                headers(kv.Key) = kv.Value
            Next
        End If

        Dim values As New Dictionary(Of String, Object)(StringComparer.Ordinal)

        If inputs IsNot Nothing Then
            For Each inp In inputs
                Dim api = DictStr(inp, "apiParam").Trim()
                Dim varId = DictStr(inp, "variable").Trim()
                If api = "" Then Continue For

                Dim raw As Object = Nothing
                If varId <> "" AndAlso variableStore IsNot Nothing AndAlso variableStore.ContainsKey(varId) Then
                    raw = variableStore(varId)
                End If

                values(api) = CoerceMockCellValue(raw)
            Next
        End If

        Dim pathPart = endpointUrl.Trim()
        Dim queryFromUrl = ""
        Dim qIdx = pathPart.IndexOf("?"c)
        If qIdx >= 0 Then
            queryFromUrl = pathPart.Substring(qIdx + 1)
            pathPart = pathPart.Substring(0, qIdx)
        End If

        Dim subRet = SubstitutePathParams(pathPart, values)
        Dim basePath = subRet.Item1
        Dim pathUsed = subRet.Item2

        Dim remaining As New Dictionary(Of String, Object)(StringComparer.Ordinal)
        For Each kv In values
            If Not pathUsed.Contains(kv.Key) Then
                remaining(kv.Key) = kv.Value
            End If
        Next

        Dim useQuery = method = "GET" OrElse method = "HEAD" OrElse method = "DELETE"

        If useQuery Then
            Dim qsPairs As New List(Of String)()
            If queryFromUrl <> "" Then
                For Each part In queryFromUrl.Split("&"c)
                    If part <> "" Then qsPairs.Add(part)
                Next
            End If
            For Each kv In remaining
                If kv.Value Is Nothing Then Continue For
                Dim encVal As String
                If TypeOf kv.Value Is JToken OrElse TypeOf kv.Value Is Dictionary(Of String, Object) OrElse TypeOf kv.Value Is IList Then
                    encVal = Uri.EscapeDataString(JToken.FromObject(kv.Value).ToString(Formatting.None))
                Else
                    encVal = Uri.EscapeDataString(kv.Value.ToString())
                End If
                qsPairs.Add(Uri.EscapeDataString(kv.Key) & "=" & encVal)
            Next
            Dim qs = String.Join("&", qsPairs)
            Dim finalUrl = If(qs <> "", basePath & "?" & qs, basePath)
            Return New BuiltBackendHttpRequest With {
                .Url = finalUrl,
                .Method = method,
                .Headers = headers,
                .BodyJson = Nothing
            }
        End If

        Dim urlWithQuery = basePath
        If queryFromUrl <> "" Then urlWithQuery = basePath & "?" & queryFromUrl

        If Not headers.ContainsKey("Content-Type") AndAlso Not headers.ContainsKey("content-type") Then
            headers("Content-Type") = "application/json"
        End If

        Dim bodyJson = StableJsonFromDict(remaining)
        Return New BuiltBackendHttpRequest With {
            .Url = urlWithQuery,
            .Method = method,
            .Headers = headers,
            .BodyJson = bodyJson
        }
    End Function

    Private Function DictStr(d As Dictionary(Of String, Object), key As String) As String
        If d Is Nothing OrElse Not d.ContainsKey(key) Then Return ""
        Dim o = d(key)
        Return If(o?.ToString(), "")
    End Function

    ''' <summary>Estrae valore dalla risposta JSON con path puntato (es. <c>slots</c>, <c>data.items</c>).</summary>
    Public Function GetJsonAtPath(root As JToken, path As String) As JToken
        If root Is Nothing OrElse String.IsNullOrWhiteSpace(path) Then Return Nothing
        Dim parts = path.Split("."c).Select(Function(p) p.Trim()).Where(Function(p) p <> "").ToArray()
        Dim cur As JToken = root
        For Each p In parts
            If cur Is Nothing OrElse cur.Type = JTokenType.Null Then Return Nothing
            Dim jo = TryCast(cur, JObject)
            If jo Is Nothing Then Return Nothing
            Dim nxt = jo(p)
            If nxt Is Nothing Then Return Nothing
            cur = nxt
        Next
        Return cur
    End Function

End Module
