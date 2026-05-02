Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Net.Http
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Namespace Designer

    ''' <summary>
    ''' Proxy design-time: inoltra richieste HTTP verso backend esterni (evita CORS dal browser).
    ''' POST /api/designer/backend-call-test/proxy — body JSON: { "target": { "url", "method", "headers", "bodyJson" } }.
    ''' </summary>
    Public NotInheritable Class BackendCallTestProxyHandler

        Private Shared ReadOnly Http As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}

        Private Shared ReadOnly AllowedMethods As HashSet(Of String) =
            New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
                HttpMethod.Get.Method,
                HttpMethod.Post.Method,
                HttpMethod.Put.Method,
                HttpMethod.Patch.Method,
                HttpMethod.Delete.Method,
                HttpMethod.Head.Method
            }

        Public Shared Async Function HandleAsync(context As HttpContext) As Task(Of IResult)
            If Not String.Equals(context.Request.Method, HttpMethod.Post.Method, StringComparison.OrdinalIgnoreCase) Then
                Return Results.BadRequest(New With {.error = "Method not allowed"})
            End If

            Dim body As String
            Using reader As New IO.StreamReader(context.Request.Body, Text.Encoding.UTF8, True, 1024, True)
                body = Await reader.ReadToEndAsync().ConfigureAwait(False)
            End Using

            If String.IsNullOrWhiteSpace(body) Then
                Return Results.BadRequest(New With {.error = "Empty body"})
            End If

            Dim jo As JObject
            Try
                jo = JObject.Parse(body)
            Catch ex As Exception
                Return Results.BadRequest(New With {.error = "Invalid JSON", .detail = ex.Message})
            End Try

            Dim target = TryCast(jo("target"), JObject)
            If target Is Nothing Then
                Return Results.BadRequest(New With {.error = "Missing target object"})
            End If

            Dim urlStr = target.Value(Of String)("url")
            If String.IsNullOrWhiteSpace(urlStr) Then
                Return Results.BadRequest(New With {.error = "Missing target.url"})
            End If

            Dim uri As Uri = Nothing
            Try
                uri = New Uri(urlStr.Trim(), UriKind.Absolute)
            Catch
                Return Results.BadRequest(New With {.error = "Invalid target.url"})
            End Try

            If Not String.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) AndAlso
               Not String.Equals(uri.Scheme, Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase) Then
                Return Results.BadRequest(New With {.error = "Only http/https URLs are allowed"})
            End If

            Dim methodStr = If(target.Value(Of String)("method"), HttpMethod.Post.Method).Trim().ToUpperInvariant()
            If Not AllowedMethods.Contains(methodStr) Then
                Return Results.BadRequest(New With {.error = "Unsupported HTTP method"})
            End If

            Dim headersObj = TryCast(target("headers"), JObject)
            Dim forwardHeaders As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            If headersObj IsNot Nothing Then
                For Each p In headersObj.Properties()
                    Dim hv = p.Value?.ToString()
                    If hv IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(p.Name) Then
                        Dim hn = p.Name.Trim()
                        If IsHopByHopHeader(hn) Then Continue For
                        forwardHeaders(hn) = hv
                    End If
                Next
            End If

            Dim bodyJsonToken = target("bodyJson")
            Dim bodyString As String = Nothing
            If bodyJsonToken IsNot Nothing AndAlso bodyJsonToken.Type <> JTokenType.Null Then
                If bodyJsonToken.Type = JTokenType.String Then
                    bodyString = bodyJsonToken.Value(Of String)()
                Else
                    bodyString = bodyJsonToken.ToString(Formatting.None)
                End If
            End If

            If BodyMayHaveContent(methodStr) AndAlso Not String.IsNullOrEmpty(bodyString) Then
                forwardHeaders.Remove("Content-Type")
                forwardHeaders.Remove("content-type")
            End If

            Using req As New HttpRequestMessage(New HttpMethod(methodStr), uri)
                For Each kv In forwardHeaders
                    req.Headers.TryAddWithoutValidation(kv.Key, kv.Value)
                Next

                If BodyMayHaveContent(methodStr) AndAlso Not String.IsNullOrEmpty(bodyString) Then
                    req.Content = New StringContent(bodyString, Text.Encoding.UTF8, "application/json")
                End If

                Try
                    Using resp = Await Http.SendAsync(req).ConfigureAwait(False)
                        Dim respText = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
                        Return Results.Json(New With {
                            .ok = resp.IsSuccessStatusCode,
                            .status = CInt(resp.StatusCode),
                            .statusText = resp.ReasonPhrase,
                            .bodyText = respText
                        })
                    End Using
                Catch ex As Exception
                    Return Results.Json(New With {
                        .ok = False,
                        .status = 0,
                        .statusText = "ProxyError",
                        .bodyText = "",
                        .err = ex.Message
                    })
                End Try
            End Using
        End Function

        Private Shared Function BodyMayHaveContent(methodStr As String) As Boolean
            Dim m = methodStr.ToUpperInvariant()
            Return m <> HttpMethod.Get.Method AndAlso m <> HttpMethod.Head.Method
        End Function

        Private Shared Function IsHopByHopHeader(name As String) As Boolean
            Dim h = name.ToLowerInvariant()
            Return h = "host" OrElse h = "connection" OrElse h = "keep-alive" OrElse h = "proxy-authenticate" OrElse
                h = "proxy-authorization" OrElse h = "te" OrElse h = "trailers" OrElse h = "transfer-encoding" OrElse h = "upgrade"
        End Function

    End Class

End Namespace
