Option Strict On
Option Explicit On

Imports System.Net.Http
Imports System.Threading
Imports System.Threading.Tasks
Imports Newtonsoft.Json.Linq

Namespace OmniaDialogStepInfra
    ''' <summary>Carica task progetto da Express (Mongo) per omnia_dialog_step.</summary>
    Public NotInheritable Class ProjectTaskHttpLoader
        Private Shared ReadOnly Http As New HttpClient With {.Timeout = TimeSpan.FromSeconds(30)}

        Public Shared Function ResolveExpressBaseUrl() As String
            Dim fromEnv = Environment.GetEnvironmentVariable("OMNIA_EXPRESS_BASE_URL")
            If Not String.IsNullOrWhiteSpace(fromEnv) Then Return fromEnv.Trim().TrimEnd("/"c)
            Dim port = Environment.GetEnvironmentVariable("PORT")
            If Not String.IsNullOrWhiteSpace(port) Then Return "http://127.0.0.1:" & port.Trim()
            Return "http://127.0.0.1:3100"
        End Function

        Public Shared Async Function LoadProjectTaskAsync(projectId As String, taskId As String, Optional ct As CancellationToken = Nothing) As Task(Of JObject)
            Dim pid = If(projectId, "").Trim()
            Dim tid = If(taskId, "").Trim()
            If pid.Length = 0 OrElse tid.Length = 0 Then Return Nothing

            Dim baseUrl = ResolveExpressBaseUrl()
            Dim url = baseUrl & "/api/runtime/project-task/" & Uri.EscapeDataString(pid) & "/" & Uri.EscapeDataString(tid)
            Using resp = Await Http.GetAsync(url, ct).ConfigureAwait(False)
                If resp.StatusCode = System.Net.HttpStatusCode.NotFound Then Return Nothing
                resp.EnsureSuccessStatusCode()
                Dim json = Await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(False)
                Return TryCast(JToken.Parse(json), JObject)
            End Using
        End Function
    End Class
End Namespace
