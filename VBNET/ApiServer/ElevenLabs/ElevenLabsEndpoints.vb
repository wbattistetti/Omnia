Option Strict On
Option Explicit On

Imports System.IO
Imports System.Text
Imports System.Threading
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json

Namespace ApiServer.ElevenLabs

''' <summary>
''' Minimal API wiring for ElevenLabs ConvAI bridge (mounted on the existing ApiServer).
''' </summary>
Public NotInheritable Class ElevenLabsEndpoints

    Private Shared ReadOnly JsonReaderSettings As New JsonSerializerSettings With {
        .NullValueHandling = NullValueHandling.Ignore
    }

    Public Shared Sub MapElevenLabsRoutes(app As WebApplication)
        app.MapPost("/elevenlabs/startAgent", AddressOf HandleStartAgent)
        app.MapPost("/elevenlabs/sendUserTurn", AddressOf HandleSendUserTurn)
        app.MapPost("/elevenlabs/agentTurn", AddressOf HandleAgentTurnWebhook)
        app.MapPost("/elevenlabs/endConversation", AddressOf HandleEndConversation)
        app.MapGet(
            "/elevenlabs/readPrompt/{conversationId}",
            Async Function(context As HttpContext, conversationId As String) As Task
                Await HandleReadPrompt(context, conversationId).ConfigureAwait(False)
            End Function)
    End Sub

    Private Shared Async Function HandleStartAgent(context As HttpContext) As Task
        Dim apiKey = Environment.GetEnvironmentVariable("ELEVENLABS_API_KEY")
        If String.IsNullOrWhiteSpace(apiKey) Then
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable
            Await context.Response.WriteAsJsonAsync(New With {.error = "ELEVENLABS_API_KEY is not configured."}).ConfigureAwait(False)
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsStartAgentRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.AgentId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "agentId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim omniaId = Guid.NewGuid().ToString("N")
        Dim session As New ElevenLabsHostedSession(omniaId)
        ElevenLabsSessionRegistry.TryRegister(session)

        Dim dyn = If(req.DynamicVariables, New Dictionary(Of String, Object)())
        Dim runner As New ElevenLabsWebSocketRunner(req.AgentId.Trim(), apiKey.Trim(), dyn, session.Queue, $"[ElevenLabs:{omniaId}]")

        Dim connectFailed As Boolean = False
        Dim failMessage As String = Nothing
        Try
            Await runner.ConnectAndRunReceiveLoopAsync(context.RequestAborted).ConfigureAwait(False)
            session.Runner = runner
        Catch ex As Exception
            ElevenLabsSessionRegistry.Remove(omniaId)
            connectFailed = True
            failMessage = ex.Message
            runner.Dispose()
        End Try

        If connectFailed Then
            context.Response.StatusCode = StatusCodes.Status502BadGateway
            Await context.Response.WriteAsJsonAsync(New With {.error = failMessage}).ConfigureAwait(False)
            Return
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.conversationId = omniaId}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleSendUserTurn(context As HttpContext) As Task
        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsSendUserTurnRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        If session.Runner Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status409Conflict
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation has no active runner."}).ConfigureAwait(False)
            Return
        End If

        Dim sendFailed As Boolean = False
        Dim sendErr As String = Nothing
        Try
            Await session.Runner.SendUserMessageAsync(If(req.Text, ""), context.RequestAborted).ConfigureAwait(False)
            session.Status = "running"
        Catch ex As Exception
            sendFailed = True
            sendErr = ex.Message
        End Try

        If sendFailed Then
            context.Response.StatusCode = StatusCodes.Status502BadGateway
            Await context.Response.WriteAsJsonAsync(New With {.error = sendErr}).ConfigureAwait(False)
            Return
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleAgentTurnWebhook(context As HttpContext) As Task
        If Not ValidateWebhookSecret(context) Then
            context.Response.StatusCode = StatusCodes.Status401Unauthorized
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsAgentTurnWebhookRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        Dim isFinal = False
        If req.IsFinal.HasValue Then
            isFinal = req.IsFinal.Value
        ElseIf Not String.IsNullOrEmpty(req.Status) Then
            isFinal = req.Status.Equals("completed", StringComparison.OrdinalIgnoreCase)
        End If

        session.Queue.Enqueue(New ElevenLabsAgentTurnPayload With {
            .Text = If(req.Text, ""),
            .Status = If(isFinal, "completed", "running")
        })
        If isFinal Then
            session.Status = "completed"
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleEndConversation(context As HttpContext) As Task
        If Not ValidateWebhookSecret(context) Then
            context.Response.StatusCode = StatusCodes.Status401Unauthorized
            Return
        End If

        Dim body As String
        Using reader As New StreamReader(context.Request.Body, Encoding.UTF8)
            body = Await reader.ReadToEndAsync().ConfigureAwait(False)
        End Using

        Dim req = JsonConvert.DeserializeObject(Of ElevenLabsEndConversationRequest)(body, JsonReaderSettings)
        If req Is Nothing OrElse String.IsNullOrWhiteSpace(req.ConversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversationId is required."}).ConfigureAwait(False)
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(req.ConversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        session.Status = "completed"
        session.Queue.Enqueue(New ElevenLabsAgentTurnPayload With {.Text = "", .Status = "completed"})
        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {.ok = True}).ConfigureAwait(False)
    End Function

    Private Shared Async Function HandleReadPrompt(context As HttpContext, conversationId As String) As Task
        If String.IsNullOrWhiteSpace(conversationId) Then
            context.Response.StatusCode = StatusCodes.Status400BadRequest
            Return
        End If

        Dim session = ElevenLabsSessionRegistry.TryGet(conversationId.Trim())
        If session Is Nothing Then
            context.Response.StatusCode = StatusCodes.Status404NotFound
            Await context.Response.WriteAsJsonAsync(New With {.error = "conversation not found."}).ConfigureAwait(False)
            Return
        End If

        Dim timeoutSeconds = 120
        Dim rawTimeout = Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_READ_PROMPT_TIMEOUT_SECONDS")
        If Not String.IsNullOrWhiteSpace(rawTimeout) Then
            Integer.TryParse(rawTimeout, timeoutSeconds)
        End If

        Dim timedOut As Boolean = False
        Dim turn As ElevenLabsAgentTurnPayload = Nothing

        Using cts = CancellationTokenSource.CreateLinkedTokenSource(context.RequestAborted)
            cts.CancelAfter(TimeSpan.FromSeconds(Math.Max(5, timeoutSeconds)))
            Try
                turn = Await session.Queue.DequeueAsync(cts.Token).ConfigureAwait(False)
            Catch ex As OperationCanceledException
                timedOut = True
            End Try
        End Using

        If timedOut Then
            context.Response.StatusCode = StatusCodes.Status408RequestTimeout
            Await context.Response.WriteAsJsonAsync(New With {.error = "timeout waiting for agent turn."}).ConfigureAwait(False)
            Return
        End If

        context.Response.StatusCode = StatusCodes.Status200OK
        Await context.Response.WriteAsJsonAsync(New With {
            .agentTurn = turn.Text,
            .status = turn.Status
        }).ConfigureAwait(False)
    End Function

    Private Shared Function ValidateWebhookSecret(context As HttpContext) As Boolean
        Dim expected = Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_WEBHOOK_SECRET")
        If String.IsNullOrWhiteSpace(expected) Then Return True
        Dim headerName = If(Environment.GetEnvironmentVariable("OMNIA_ELEVENLABS_WEBHOOK_HEADER"), "X-Omnia-Webhook-Secret")
        Dim provided = context.Request.Headers(headerName).ToString()
        Return String.Equals(provided, expected, StringComparison.Ordinal)
    End Function
End Class

End Namespace
