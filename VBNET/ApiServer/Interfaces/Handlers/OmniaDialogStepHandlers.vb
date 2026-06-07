Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports ApiServer.OmniaDialogStepInfra

Namespace ApiServer.Handlers
    ''' <summary>POST omnia_dialog_step — dialogo KB deterministico per ConvAI (parità Node omniaDialogStepService.js).</summary>
    Public NotInheritable Class OmniaDialogStepHandlers
        Private Shared ReadOnly JsonSettings As New JsonSerializerSettings With {
            .NullValueHandling = NullValueHandling.Ignore
        }

        Public Shared Async Function HandleOmniaDialogStep(context As HttpContext, projectId As String, agentTaskId As String) As Task
            Dim started = DateTime.UtcNow
            Dim pid = If(projectId, "").Trim()
            Dim aid = If(agentTaskId, "").Trim()
            Dim gatewayPath = context.Request.Path.Value

            Dim bodyObj As JObject = Nothing
            Try
                Using reader As New StreamReader(context.Request.Body)
                    Dim raw = Await reader.ReadToEndAsync().ConfigureAwait(False)
                    If Not String.IsNullOrWhiteSpace(raw) Then
                        bodyObj = TryCast(JToken.Parse(raw), JObject)
                    End If
                End Using
            Catch
                bodyObj = New JObject()
            End Try
            If bodyObj Is Nothing Then bodyObj = New JObject()

            ConvaiOptionalFieldSemantics.StripEmptyConvaiOptionalFieldsInPlace(bodyObj)

            Dim conversationId = ExtractConversationId(bodyObj, context)
            Dim kbDocumentId = bodyObj.Value(Of String)("kbDocumentId")
            kbDocumentId = If(kbDocumentId, "").Trim()
            Dim reset As Boolean = If(bodyObj.Value(Of Boolean?)("reset"), False)
            Dim updates = ExtractUpdates(bodyObj)
            Dim userUtterance = If(bodyObj.Value(Of String)("userUtterance"), "").Trim()

            If pid.Length = 0 OrElse aid.Length = 0 Then
                Await WriteJson(context, 400, New With {
                    .status = "error",
                    .error = "missing_project_or_agent_task"
                }).ConfigureAwait(False)
                LogInvocation(pid, aid, conversationId, gatewayPath, 400, started, "missing_project_or_agent_task")
                Return
            End If

            If conversationId.Length = 0 Then
                Await WriteJson(context, 400, New With {
                    .status = "error",
                    .error = "missing_conversation_id"
                }).ConfigureAwait(False)
                LogInvocation(pid, aid, conversationId, gatewayPath, 400, started, "missing_conversation_id")
                Return
            End If

            Dim agentTask As JObject = Nothing
            Dim loadFailed As Boolean = False
            Try
                agentTask = Await ProjectTaskHttpLoader.LoadProjectTaskAsync(pid, aid, context.RequestAborted).ConfigureAwait(False)
            Catch ex As Exception
                Console.WriteLine("[omnia-dialog-step VB] load task: " & ex.Message)
                loadFailed = True
            End Try
            If loadFailed Then
                Await WriteJson(context, 500, New With {
                    .status = "error",
                    .error = "task_load_failed"
                }).ConfigureAwait(False)
                LogInvocation(pid, aid, conversationId, gatewayPath, 500, started, "task_load_failed")
                Return
            End If

            If agentTask Is Nothing Then
                Await WriteJson(context, 404, New With {
                    .status = "error",
                    .error = "agent_task_not_found"
                }).ConfigureAwait(False)
                LogInvocation(pid, aid, conversationId, gatewayPath, 404, started, "agent_task_not_found")
                Return
            End If

            Dim runResult = Await OmniaDialogStepRunner.ExecuteAsync(
                pid,
                aid,
                conversationId,
                updates,
                If(kbDocumentId.Length > 0, kbDocumentId, Nothing),
                reset,
                context.RequestAborted,
                If(userUtterance.Length > 0, userUtterance, Nothing)
            ).ConfigureAwait(False)

            Dim errTag = If(String.IsNullOrEmpty(runResult.ErrorCode), Nothing, runResult.ErrorCode)
            Await WriteJson(context, runResult.HttpStatus, runResult.Response).ConfigureAwait(False)
            LogInvocation(pid, aid, conversationId, gatewayPath, runResult.HttpStatus, started, errTag, runResult.Status, runResult.Say)
        End Function

        Private Shared Function ExtractConversationId(body As JObject, context As HttpContext) As String
            Dim fromBody = body?.Value(Of String)("conversationId")
            fromBody = If(fromBody, "").Trim()
            If fromBody.Length > 0 Then Return fromBody
            If context.Request.Headers.TryGetValue("x-conversation-id", Nothing) Then
                Return context.Request.Headers("x-conversation-id").ToString().Trim()
            End If
            Return ""
        End Function

        Private Shared Function ExtractUpdates(body As JObject) As Dictionary(Of String, String)
            Dim tok = body("updates")
            If tok Is Nothing OrElse tok.Type = JTokenType.Null Then tok = body("slots")
            If tok Is Nothing OrElse tok.Type <> JTokenType.Object Then
                Return New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            End If
            Dim out As New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase)
            For Each prop In CType(tok, JObject).Properties()
                If prop.Value Is Nothing OrElse prop.Value.Type = JTokenType.Null Then Continue For
                out(prop.Name) = prop.Value.ToString()
            Next
            Return out
        End Function

        Private Shared Async Function WriteJson(context As HttpContext, status As Integer, payload As Object) As Task
            context.Response.StatusCode = status
            context.Response.ContentType = "application/json; charset=utf-8"
            Dim json As String
            If TypeOf payload Is JToken Then
                json = payload.ToString()
            Else
                json = JsonConvert.SerializeObject(payload, JsonSettings)
            End If
            Await context.Response.WriteAsync(json).ConfigureAwait(False)
        End Function

        Private Shared Sub LogInvocation(projectId As String, agentTaskId As String, conversationId As String, path As String, httpStatus As Integer, started As DateTime, Optional err As String = Nothing, Optional dialogStatus As String = Nothing, Optional say As String = Nothing)
            Dim ms = CInt((DateTime.UtcNow - started).TotalMilliseconds)
            Dim cid = If(conversationId, "")
            If cid.Length > 12 Then cid = cid.Substring(0, 12) & "…"
            Console.WriteLine($"[omnia-dialog-step VB] POST {path} status={httpStatus} dialog={If(dialogStatus, "-")} conv={cid} ms={ms}" & If(String.IsNullOrEmpty(err), "", $" err={err}"))
            If Not String.IsNullOrEmpty(say) AndAlso say.Length > 0 Then
                Dim preview = If(say.Length > 80, say.Substring(0, 80) & "…", say)
                Console.WriteLine($"[omnia-dialog-step VB] say={preview}")
            End If
        End Sub
    End Class
End Namespace
