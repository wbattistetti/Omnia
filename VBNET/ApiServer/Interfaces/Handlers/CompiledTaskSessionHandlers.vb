Option Strict On
Option Explicit On

Imports System.IO
Imports System.Threading.Tasks
Imports ApiServer.OmniaDialogStepInfra
Imports ApiServer.Logging
Imports ApiServer.Streaming
Imports Compiler
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine
Imports TaskEngine.Orchestrator

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Sessione runtime per un singolo CompiledTask (TaskExecutor, senza FlowOrchestrator).
    ''' Endpoint: /api/runtime/compiled-task/session/*
    ''' </summary>
    Public Module CompiledTaskSessionHandlers
        Private _logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
        Private ReadOnly _sseStreamManager As ApiServer.Streaming.ISseStreamManager = New ApiServer.Streaming.SseStreamManager()

        Public Sub ConfigureLogger(logger As ApiServer.Interfaces.ILogger)
            _logger = logger
        End Sub

        Private Sub LogInfo(message As String, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then _logger.LogInfo(message, data)
        End Sub

        Private Sub LogError(message As String, ex As Exception, Optional data As Object = Nothing)
            If _logger IsNot Nothing Then _logger.LogError(message, ex, data)
        End Sub

        Private Function DeserializeCompiledTask(json As String) As CompiledTask
            If String.IsNullOrWhiteSpace(json) Then
                Throw New ArgumentException("CompiledTask JSON is empty.")
            End If
            Dim settings As New JsonSerializerSettings With {
                .NullValueHandling = NullValueHandling.Ignore,
                .Converters = New List(Of JsonConverter) From {New CompiledTaskConverter()}
            }
            Dim task = JsonConvert.DeserializeObject(Of CompiledTask)(json, settings)
            If task Is Nothing Then
                Throw New InvalidOperationException("Failed to deserialize CompiledTask.")
            End If
            Return task
        End Function

        Private Function LoadCompiledTaskFromSession(session As CompiledTaskSession) As CompiledTask
            Return DeserializeCompiledTask(session.CompiledTaskJson)
        End Function

        Private Function GetOrCreateExecutionState(sessionId As String) As ExecutionState
            Dim storage = SessionManager.GetExecutionStateStorage()
            If storage Is Nothing Then
                Return New ExecutionState()
            End If
            Return storage.GetExecutionState(sessionId)
        End Function

        Private Sub SaveExecutionState(sessionId As String, state As ExecutionState)
            Dim storage = SessionManager.GetExecutionStateStorage()
            If storage Is Nothing Then
                Return
            End If
            storage.SaveExecutionState(sessionId, state)
        End Sub

        Private Sub EmitAssistantMessages(session As CompiledTaskSession, sessionId As String, messages As List(Of String))
            If messages Is Nothing OrElse messages.Count = 0 Then
                Return
            End If
            Dim emitter = SessionManager.GetOrCreateEventEmitter(sessionId)
            For Each messageText In messages
                If String.IsNullOrWhiteSpace(messageText) Then Continue For
                Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                Dim msg = SessionManager.BuildSseChatMessage(msgId, messageText, session.TaskId)
                session.Messages.Add(msg)
                emitter.Emit("message", msg)
            Next
        End Sub

        Private Async Function RunTurnAndEmit(
            session As CompiledTaskSession,
            sessionId As String,
            userInput As String
        ) As Task
            Dim compiledTask = LoadCompiledTaskFromSession(session)
            If IsKbDeterministicCompiledTask(compiledTask) Then
                Await RunKbDialogTurnAndEmit(session, sessionId, userInput).ConfigureAwait(False)
                Return
            End If

            Dim execState = GetOrCreateExecutionState(sessionId)
            Dim emitter = SessionManager.GetOrCreateEventEmitter(sessionId)

            Try
                Dim outcome = Await CompiledTaskTurnService.ExecuteTurn(
                    compiledTask,
                    execState,
                    userInput,
                    Nothing,
                    Sub(jsonText As String)
                        Try
                            Dim payload = JsonConvert.DeserializeObject(Of Object)(jsonText)
                            emitter.Emit("backendCallDiagnostic", payload)
                        Catch
                        End Try
                    End Sub
                ).ConfigureAwait(False)

                SaveExecutionState(sessionId, execState)

                Dim row = outcome.RowResult
                EmitAssistantMessages(session, sessionId, row.Messages)

                If row.Status = TurnStatus.WaitingForInput Then
                    session.IsWaitingForInput = True
                    session.WaitingForInputData = New With {
                        .taskId = session.TaskId,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                    execState.RequiresInput = True
                    execState.WaitingTaskId = session.TaskId
                    SaveExecutionState(sessionId, execState)
                    emitter.Emit("waitingForInput", session.WaitingForInputData)
                Else
                    session.IsWaitingForInput = False
                    session.WaitingForInputData = Nothing
                    session.IsCompleted = True
                    execState.RequiresInput = False
                    execState.WaitingTaskId = Nothing
                    SaveExecutionState(sessionId, execState)
                    Dim completeData = New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                    emitter.Emit("complete", completeData)
                End If

                SessionManager.SaveCompiledTaskSession(session)
            Catch ex As RuntimeConvaiException
                emitter.Emit("error", SessionManager.BuildOrchestratorSseErrorPayload(ex))
                session.IsCompleted = True
                SessionManager.SaveCompiledTaskSession(session)
                Throw
            End Try
        End Function

        Private Function ResolveAgentTaskSnapshot(session As CompiledTaskSession) As JObject
            Dim raw = If(session?.AgentTaskSnapshotJson, "").Trim()
            If raw.Length = 0 Then Return Nothing
            Try
                Return TryCast(JToken.Parse(raw), JObject)
            Catch
                Return Nothing
            End Try
        End Function

        ''' <summary>
        ''' kb_deterministic: orchestrazione unica VB (OmniaDialogStepRunner). EL non orchestra i turni slot.
        ''' </summary>
        Private Async Function RunKbDialogTurnAndEmit(
            session As CompiledTaskSession,
            sessionId As String,
            userInput As String
        ) As Task
            Dim compiledTask = LoadCompiledTaskFromSession(session)
            Dim ai = TryCast(compiledTask, CompiledAIAgentTask)
            If ai Is Nothing Then
                Throw New InvalidOperationException("KB dialog turn requires CompiledAIAgentTask.")
            End If

            Dim conversationId = If(ai.ConvaiSessionConversationId, "").Trim()
            If conversationId.Length = 0 Then
                Throw New InvalidOperationException(
                    "convaiSessionConversationId missing — run Test agente after Deploy ConvAI.")
            End If

            Dim pid = If(session.ProjectId, "").Trim()
            Dim aid = If(compiledTask.Id, "").Trim()
            Dim utterance = If(userInput, "").Trim()
            Dim started = DateTime.UtcNow

            Dim runResult = Await OmniaDialogStepRunner.ExecuteAsync(
                pid,
                aid,
                conversationId,
                New Dictionary(Of String, String)(StringComparer.OrdinalIgnoreCase),
                Nothing,
                False,
                System.Threading.CancellationToken.None,
                If(utterance.Length > 0, utterance, Nothing),
                ResolveAgentTaskSnapshot(session)
            ).ConfigureAwait(False)

            Dim cidLog = If(conversationId.Length > 12, conversationId.Substring(0, 12) & "…", conversationId)
            Console.WriteLine(
                $"[compiled-task KB turn] omnia_dialog_step status={runResult.HttpStatus} dialog={runResult.Status} conv={cidLog} ms={CInt((DateTime.UtcNow - started).TotalMilliseconds)}")

            If runResult.HttpStatus <> 200 Then
                Throw New InvalidOperationException(
                    If(String.IsNullOrWhiteSpace(runResult.Say), runResult.ErrorCode, runResult.Say))
            End If

            Dim say = If(runResult.Say, "").Trim()
            If say.Length > 0 Then
                EmitAssistantMessages(session, sessionId, New List(Of String) From {say})
            End If

            Dim terminal = OmniaDialogStepRunner.IsTerminalDialogStatus(runResult.Status)
            If OmniaDialogStepRunner.IsWaitingDialogStatus(runResult.Status) Then
                session.IsWaitingForInput = True
                session.WaitingForInputData = New With {
                    .taskId = session.TaskId,
                    .timestamp = DateTime.UtcNow.ToString("O"),
                    .source = "kb_dialog_vb",
                    .dialogStatus = runResult.Status
                }
                SessionManager.GetOrCreateEventEmitter(sessionId).Emit("waitingForInput", session.WaitingForInputData)
            Else
                session.IsWaitingForInput = False
                session.WaitingForInputData = Nothing
                session.IsCompleted = terminal
                If terminal Then
                    SessionManager.GetOrCreateEventEmitter(sessionId).Emit("complete", New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O"),
                        .dialogStatus = runResult.Status
                    })
                End If
            End If

            SessionManager.SaveCompiledTaskSession(session)
        End Function

        Private Function ResolveOpeningMessage(compiledTask As CompiledTask) As String
            Dim ai = TryCast(compiledTask, CompiledAIAgentTask)
            If ai Is Nothing Then Return ""
            Return If(ai.FirstMessage, "").Trim()
        End Function

        Private Function IsKbDeterministicCompiledTask(compiledTask As CompiledTask) As Boolean
            Dim ai = TryCast(compiledTask, CompiledAIAgentTask)
            If ai Is Nothing Then Return False
            Return ai.KbDeterministic
        End Function

        ''' <summary>
        ''' True se il primo messaggio deve arrivare da ConvAI (nessun incipit statico nel compile).
        ''' Con incipit statico, ConvAI si connette al primo input utente.
        ''' </summary>
        Private Function NeedsConvaiBootstrapOnStart(compiledTask As CompiledTask, openingMessage As String) As Boolean
            Dim ai = TryCast(compiledTask, CompiledAIAgentTask)
            If ai Is Nothing Then Return False
            Return String.IsNullOrWhiteSpace(openingMessage)
        End Function

        ''' <summary>
        ''' Policy unica di apertura sessione: incipit statico sempre emesso; bootstrap ConvAI solo se serve.
        ''' </summary>
        Private Sub ApplySessionStartPolicy(
            session As CompiledTaskSession,
            sessionId As String,
            compiledTask As CompiledTask
        )
            Dim openingMessage = ResolveOpeningMessage(compiledTask)
            Dim bootstrapConvai = NeedsConvaiBootstrapOnStart(compiledTask, openingMessage)
            Dim kbDeterministic = IsKbDeterministicCompiledTask(compiledTask)

            If Not String.IsNullOrWhiteSpace(openingMessage) Then
                EmitStaticOpeningIfPresent(session, sessionId, openingMessage)
                session.InitialTurnExecuted = True
                SessionManager.SaveCompiledTaskSession(session)
                LogInfo("Compiled task session: static opening emitted", New With {
                    .sessionId = sessionId,
                    .openingChars = openingMessage.Length
                })
            End If

            If bootstrapConvai AndAlso kbDeterministic Then
                ScheduleKbDialogBootstrap(sessionId, session.ProjectId, compiledTask)
                LogInfo("Compiled task session: KB dialog bootstrap scheduled", New With {
                    .sessionId = sessionId,
                    .taskId = session.TaskId
                })
            ElseIf bootstrapConvai Then
                ScheduleInitialTurn(sessionId)
                LogInfo("Compiled task session: ConvAI bootstrap scheduled", New With {
                    .sessionId = sessionId,
                    .taskId = session.TaskId
                })
            Else
                ScheduleElevenLabsWarmupIfNeeded(sessionId, compiledTask)
            End If
        End Sub

        ''' <summary>
        ''' kb_deterministic turno 0: OmniaDialogStepRunner (updates vuoti) — stesso percorso dei turni successivi.
        ''' </summary>
        Private Sub ScheduleKbDialogBootstrap(sessionId As String, projectId As String, compiledTask As CompiledTask)
            System.Threading.Tasks.Task.Run(
                Async Function() As System.Threading.Tasks.Task
                    Try
                        Dim session = SessionManager.GetCompiledTaskSession(sessionId)
                        If session Is Nothing Then Return
                        Await RunKbDialogTurnAndEmit(session, sessionId, "").ConfigureAwait(False)
                        session = SessionManager.GetCompiledTaskSession(sessionId)
                        If session IsNot Nothing Then
                            session.InitialTurnExecuted = True
                            SessionManager.SaveCompiledTaskSession(session)
                        End If
                        LogInfo("Compiled task session: KB dialog bootstrap OK", New With {
                            .sessionId = sessionId,
                            .taskId = session?.TaskId
                        })
                    Catch ex As Exception
                        LogError("KB dialog bootstrap failed", ex, New With {.sessionId = sessionId})
                    End Try
                End Function)
        End Sub

        ''' <summary>Legacy / non-kb: warmup WebSocket ConvAI (non usato per orchestrazione slot kb_deterministic).</summary>
        Private Sub ScheduleElevenLabsWarmupIfNeeded(sessionId As String, compiledTask As CompiledTask)
            If IsKbDeterministicCompiledTask(compiledTask) Then Return
            Dim ai = TryCast(compiledTask, CompiledAIAgentTask)
            If ai Is Nothing OrElse ai.Platform <> IAPlatform.ElevenLabs Then Return
            If String.IsNullOrWhiteSpace(ai.AgentId) Then Return

            System.Threading.Tasks.Task.Run(
                Async Function() As System.Threading.Tasks.Task
                    Try
                        Dim session = SessionManager.GetCompiledTaskSession(sessionId)
                        If session Is Nothing Then Return
                        Dim execState = GetOrCreateExecutionState(sessionId)
                        Await AIAgentTaskExecutor.EnsureElevenLabsConnectionAsync(ai, session.TaskId, execState).ConfigureAwait(False)
                        SaveExecutionState(sessionId, execState)
                        LogInfo("Compiled task session: ElevenLabs warmup OK", New With {
                            .sessionId = sessionId,
                            .taskId = session.TaskId
                        })
                    Catch ex As Exception
                        LogError("Compiled task session: ElevenLabs warmup failed", ex, New With {.sessionId = sessionId})
                    End Try
                End Function)
        End Sub

        Private Sub ScheduleInitialTurn(sessionId As String)
            System.Threading.Tasks.Task.Run(
                Async Function() As System.Threading.Tasks.Task
                    Try
                        Dim session = SessionManager.GetCompiledTaskSession(sessionId)
                        If session Is Nothing Then Return
                        Await RunTurnAndEmit(session, sessionId, "").ConfigureAwait(False)
                        session = SessionManager.GetCompiledTaskSession(sessionId)
                        If session IsNot Nothing Then
                            session.InitialTurnExecuted = True
                            SessionManager.SaveCompiledTaskSession(session)
                        End If
                    Catch ex As RuntimeConvaiException
                        LogError("Background initial compiled task turn failed (ConvAI)", ex, New With {.sessionId = sessionId})
                    Catch ex As Exception
                        LogError("Background initial compiled task turn failed", ex, New With {.sessionId = sessionId})
                    End Try
                End Function)
        End Sub

        Private Sub EmitStaticOpeningIfPresent(
            session As CompiledTaskSession,
            sessionId As String,
            openingMessage As String
        )
            If String.IsNullOrWhiteSpace(openingMessage) Then Return
            EmitAssistantMessages(session, sessionId, New List(Of String) From {openingMessage})
            session.IsWaitingForInput = True
            session.WaitingForInputData = New With {
                .taskId = session.TaskId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }
            SessionManager.SaveCompiledTaskSession(session)
            Dim emitter = SessionManager.GetOrCreateEventEmitter(sessionId)
            emitter.Emit("waitingForInput", session.WaitingForInputData)
        End Sub

        ''' <summary>POST /api/runtime/compiled-task/session/start</summary>
        Public Async Function HandleCompiledTaskSessionStart(context As HttpContext) As Task(Of IResult)
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                If String.IsNullOrWhiteSpace(body) Then
                    Return ResponseHelpers.CreateErrorResponse("Request body is empty.", 400)
                End If

                Dim requestObj = JObject.Parse(body)
                Dim projectId = If(requestObj("projectId"), "").ToString()
                Dim locale = If(requestObj("locale"), "").ToString()
                Dim compiledTaskToken = requestObj("compiledTask")

                If String.IsNullOrWhiteSpace(projectId) Then
                    Return ResponseHelpers.CreateErrorResponse("projectId is required.", 400)
                End If
                If String.IsNullOrWhiteSpace(locale) Then
                    Return ResponseHelpers.CreateErrorResponse("locale is required.", 400)
                End If
                If compiledTaskToken Is Nothing OrElse compiledTaskToken.Type = JTokenType.Null Then
                    Return ResponseHelpers.CreateErrorResponse("compiledTask is required.", 400)
                End If

                Dim compiledTaskJson = compiledTaskToken.ToString(Formatting.None)
                Dim compiledTask = DeserializeCompiledTask(compiledTaskJson)
                If String.IsNullOrWhiteSpace(compiledTask.Id) Then
                    Return ResponseHelpers.CreateErrorResponse("compiledTask.id is required.", 400)
                End If

                Dim sessionId = Guid.NewGuid().ToString()
                Dim session = SessionManager.CreateCompiledTaskSession(
                    sessionId,
                    projectId,
                    locale,
                    compiledTaskJson,
                    compiledTask.Id
                )

                Dim snapshotTok = requestObj("agentTaskSnapshot")
                If snapshotTok IsNot Nothing AndAlso snapshotTok.Type = JTokenType.Object Then
                    session.AgentTaskSnapshotJson = snapshotTok.ToString(Formatting.None)
                    SessionManager.SaveCompiledTaskSession(session)
                End If

                LogInfo("Compiled task session created", New With {
                    .sessionId = sessionId,
                    .taskId = compiledTask.Id,
                    .projectId = projectId
                })

                Dim openingMessage = ResolveOpeningMessage(compiledTask)
                Dim bootstrapConvai = NeedsConvaiBootstrapOnStart(compiledTask, openingMessage)

                ApplySessionStartPolicy(session, sessionId, compiledTask)

                Return ResponseHelpers.CreateSuccessResponse(New With {
                    .sessionId = sessionId,
                    .taskId = compiledTask.Id,
                    .projectId = projectId,
                    .locale = locale,
                    .openingMessage = openingMessage,
                    .openingEmitted = Not String.IsNullOrWhiteSpace(openingMessage),
                    .convaiBootstrapScheduled = bootstrapConvai
                })
            Catch ex As Exception
                LogError("HandleCompiledTaskSessionStart failed", ex, Nothing)
                Return ResponseHelpers.CreateErrorResponse(ex.Message, 500)
            End Try
        End Function

        ''' <summary>GET /api/runtime/compiled-task/session/{id}/stream</summary>
        Public Async Function HandleCompiledTaskSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
            Try
                Dim session = SessionManager.GetCompiledTaskSession(sessionId)
                If session Is Nothing Then
                    context.Response.StatusCode = 404
                    Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                    Return
                End If

                session.SseConnected = True
                SessionManager.SaveCompiledTaskSession(session)

                _sseStreamManager.OpenStream(sessionId, context.Response)
                Dim streamManager = DirectCast(_sseStreamManager, ApiServer.Streaming.SseStreamManager)
                streamManager.SendBufferedMessages(sessionId)

                If session.IsWaitingForInput AndAlso session.WaitingForInputData IsNot Nothing Then
                    _sseStreamManager.EmitEvent(sessionId, "waitingForInput", session.WaitingForInputData)
                End If

                Dim onMessage As Action(Of Object) = Sub(data)
                                                           _sseStreamManager.EmitEvent(sessionId, "message", data)
                                                       End Sub
                Dim onWaiting As Action(Of Object) = Sub(data)
                                                           session.IsWaitingForInput = True
                                                           session.WaitingForInputData = data
                                                           _sseStreamManager.EmitEvent(sessionId, "waitingForInput", data)
                                                       End Sub
                Dim onComplete As Action(Of Object) = Sub(data)
                                                            _sseStreamManager.EmitEvent(sessionId, "complete", data)
                                                            _sseStreamManager.CloseStream(sessionId)
                                                        End Sub
                Dim onError As Action(Of Object) = Sub(data)
                                                         _sseStreamManager.EmitEvent(sessionId, "error", data)
                                                         _sseStreamManager.CloseStream(sessionId)
                                                     End Sub
                Dim onDiagnostic As Action(Of Object) = Sub(data)
                                                              _sseStreamManager.EmitEvent(sessionId, "backendCallDiagnostic", data)
                                                          End Sub

                Dim emitter = SessionManager.GetOrCreateEventEmitter(sessionId)
                emitter.[On]("message", onMessage)
                emitter.[On]("waitingForInput", onWaiting)
                emitter.[On]("complete", onComplete)
                emitter.[On]("error", onError)
                emitter.[On]("backendCallDiagnostic", onDiagnostic)

                context.RequestAborted.Register(Sub()
                                                    Try
                                                        Dim closed = SessionManager.GetCompiledTaskSession(sessionId)
                                                        If closed IsNot Nothing Then
                                                            closed.SseConnected = False
                                                            SessionManager.SaveCompiledTaskSession(closed)
                                                        End If
                                                    Catch
                                                    End Try
                                                End Sub)

                SessionManager.SaveCompiledTaskSession(session)

                Dim heartbeatTimer As New System.Threading.Timer(
                    Sub(state)
                        Try
                            _sseStreamManager.EmitEvent(sessionId, "heartbeat", New With {.timestamp = DateTime.UtcNow.ToString("O")})
                        Catch
                        End Try
                    End Sub,
                    Nothing,
                    TimeSpan.FromSeconds(30),
                    TimeSpan.FromSeconds(30))

                Try
                    Await System.Threading.Tasks.Task.Delay(System.Threading.Timeout.Infinite, context.RequestAborted)
                Catch ex As System.Threading.Tasks.TaskCanceledException
                Finally
                    heartbeatTimer.Dispose()
                    _sseStreamManager.CloseStream(sessionId)
                End Try
            Catch ex As Exception
                LogError("HandleCompiledTaskSessionStream failed", ex, New With {.sessionId = sessionId})
            End Try
        End Function

        ''' <summary>POST /api/runtime/compiled-task/session/{id}/input</summary>
        Public Async Function HandleCompiledTaskSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
            Try
                Dim reader As New StreamReader(context.Request.Body)
                Dim body = Await reader.ReadToEndAsync()
                Dim inputObj = JObject.Parse(body)
                Dim inputText = If(inputObj("input"), "").ToString()
                If String.IsNullOrWhiteSpace(inputText) Then
                    Return Results.BadRequest(New With {.error = "Input is required"})
                End If

                Dim session = SessionManager.GetCompiledTaskSession(sessionId)
                If session Is Nothing Then
                    Return Results.NotFound(New With {.error = "Session not found"})
                End If
                If session.IsCompleted Then
                    Return Results.BadRequest(New With {.error = "Session already completed"})
                End If

                session.IsWaitingForInput = False
                SessionManager.SaveCompiledTaskSession(session)

                Try
                    Await RunTurnAndEmit(session, sessionId, inputText).ConfigureAwait(False)
                Catch ex As RuntimeConvaiException
                    Return Results.Ok(New With {.success = False, .error = ex.Message})
                End Try

                Return Results.Ok(New With {.success = True})
            Catch ex As Exception
                LogError("HandleCompiledTaskSessionInput failed", ex, New With {.sessionId = sessionId})
                Return Results.Problem(detail:=ex.Message, statusCode:=500)
            End Try
        End Function

        ''' <summary>DELETE /api/runtime/compiled-task/session/{id}</summary>
        Public Function HandleCompiledTaskSessionDelete(context As HttpContext, sessionId As String) As Task(Of IResult)
            Try
                SessionManager.DeleteCompiledTaskSession(sessionId)
                _sseStreamManager.CloseStream(sessionId)
                Return Task.FromResult(Of IResult)(Results.Ok(New With {.success = True}))
            Catch ex As Exception
                LogError("HandleCompiledTaskSessionDelete failed", ex, New With {.sessionId = sessionId})
                Return Task.FromResult(Of IResult)(Results.Problem(detail:=ex.Message, statusCode:=500))
            End Try
        End Function
    End Module
End Namespace
