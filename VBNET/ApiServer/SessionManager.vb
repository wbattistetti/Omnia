Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports System.Runtime.CompilerServices
Imports Newtonsoft.Json
Imports Compiler
Imports DDTEngine

''' <summary>
''' Orchestrator Session: contiene tutto lo stato di una sessione di esecuzione
''' </summary>
Public Class OrchestratorSession
    Public Property SessionId As String
    Public Property CompilationResult As FlowCompilationResult
    Public Property Tasks As List(Of Object)
    Public Property DDTs As List(Of Compiler.AssembledDDT)
    Public Property Translations As Dictionary(Of String, String)
    Public Property Orchestrator As DDTEngine.Orchestrator.FlowOrchestrator
    Public Property DDTEngine As Motore  ' ✅ DDT Engine per esecuzione diretta
    Public Property Messages As New List(Of Object)
    Public Property EventEmitter As EventEmitter
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
End Class

''' <summary>
''' EventEmitter: gestisce eventi per SSE
''' </summary>
Public Class EventEmitter
    Private ReadOnly _listeners As New Dictionary(Of String, List(Of Action(Of Object)))

    Public Sub [On](eventName As String, handler As Action(Of Object))
        If Not _listeners.ContainsKey(eventName) Then
            _listeners(eventName) = New List(Of Action(Of Object))
        End If
        _listeners(eventName).Add(handler)
    End Sub

    Public Sub Emit(eventName As String, data As Object)
        Console.WriteLine($"📢 [EventEmitter] Emitting event: {eventName}, Listeners count: {If(_listeners.ContainsKey(eventName), _listeners(eventName).Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"📢 [EventEmitter] Emitting event: {eventName}, Listeners count: {If(_listeners.ContainsKey(eventName), _listeners(eventName).Count, 0)}")
        Console.Out.Flush()
        If _listeners.ContainsKey(eventName) Then
            For Each handler In _listeners(eventName)
                Try
                    Console.WriteLine($"   [EventEmitter] Calling handler for {eventName}...")
                    System.Diagnostics.Debug.WriteLine($"   [EventEmitter] Calling handler for {eventName}...")
                    Console.Out.Flush()
                    handler(data)
                    Console.WriteLine($"   [EventEmitter] Handler for {eventName} completed")
                    System.Diagnostics.Debug.WriteLine($"   [EventEmitter] Handler for {eventName} completed")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"❌ [EventEmitter] Error in handler for {eventName}: {ex.Message}")
                    Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                    System.Diagnostics.Debug.WriteLine($"❌ [EventEmitter] Error in handler for {eventName}: {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"   Stack trace: {ex.StackTrace}")
                    Console.Out.Flush()
                End Try
            Next
        Else
            Console.WriteLine($"⚠️ [EventEmitter] No listeners registered for event: {eventName}")
            System.Diagnostics.Debug.WriteLine($"⚠️ [EventEmitter] No listeners registered for event: {eventName}")
            Console.Out.Flush()
        End If
    End Sub

    Public Sub RemoveListener(eventName As String, handler As Action(Of Object))
        If _listeners.ContainsKey(eventName) Then
            _listeners(eventName).Remove(handler)
        End If
    End Sub

    Public Function ListenerCount(eventName As String) As Integer
        If _listeners.ContainsKey(eventName) Then
            Return _listeners(eventName).Count
        End If
        Return 0
    End Function
End Class

''' <summary>
''' SessionManager: gestisce tutte le sessioni attive
''' </summary>
Public Class SessionManager
    Private Shared ReadOnly _sessions As New Dictionary(Of String, OrchestratorSession)
    Private Shared ReadOnly _lock As New Object

    ''' <summary>
    ''' Crea una nuova sessione e avvia l'orchestrator
    ''' </summary>
    Public Shared Function CreateSession(
        sessionId As String,
        compilationResult As FlowCompilationResult,
        tasks As List(Of Object),
        ddts As List(Of Compiler.AssembledDDT),
        translations As Dictionary(Of String, String)
    ) As OrchestratorSession
        SyncLock _lock
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
            Console.WriteLine($"🔧 [RUNTIME][SessionManager] Creating session: {sessionId}")
            Console.WriteLine($"   CompilationResult: {If(compilationResult IsNot Nothing, "NOT NULL", "NULL")}")
            If compilationResult IsNot Nothing Then
                Console.WriteLine($"   TaskGroups count: {compilationResult.TaskGroups.Count}")
                Console.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")
                Console.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
            End If
            Console.WriteLine($"   DDTs count: {If(ddts IsNot Nothing, ddts.Count, 0)}")
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

            ' Crea DDT Engine
            Dim ddtEngine As New Motore()
            Console.WriteLine($"✅ [RUNTIME][SessionManager] DDT Engine created")

            ' ✅ Verifica se è Chat Simulator nel Response Editor (solo DDT, senza flow)
            Dim isDirectDDTMode = (compilationResult Is Nothing OrElse compilationResult.TaskGroups.Count = 0) AndAlso
                                   ddts IsNot Nothing AndAlso ddts.Count > 0

            ' Crea session
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .DDTs = ddts,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .DDTEngine = ddtEngine,  ' ✅ Salva DDT Engine per esecuzione diretta
                .IsWaitingForInput = False
            }
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Session object created")
            Console.WriteLine($"   Mode: {If(isDirectDDTMode, "🎯 Direct DDT (Chat Simulator)", "🔄 Flow Orchestrator")}")
            System.Diagnostics.Debug.WriteLine($"   Mode: {If(isDirectDDTMode, "Direct DDT", "Flow Orchestrator")}")
            Console.Out.Flush()

            If isDirectDDTMode Then
                ' ✅ Modalità DDT diretto (Chat Simulator nel Response Editor)
                Console.WriteLine($"🎯 [RUNTIME][SessionManager] Direct DDT mode: Chat Simulator in Response Editor")
                System.Diagnostics.Debug.WriteLine($"🎯 [RUNTIME][SessionManager] Direct DDT mode")
                Console.Out.Flush()

                ' Non creare FlowOrchestrator per DDT diretto
                session.Orchestrator = Nothing

                ' Registra eventi DDT Engine direttamente
                AddHandler ddtEngine.MessageToShow, Sub(sender, e)
                                                        Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                        Dim msg = New With {
                        .id = msgId,
                        .text = e.Message,
                        .stepType = "message",
                        .timestamp = DateTime.UtcNow.ToString("O"),
                        .taskId = ""
                    }
                                                        session.Messages.Add(msg)
                                                        Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Message generated: '{e.Message}'")
                                                        session.EventEmitter.Emit("message", msg)
                                                    End Sub
            Else
                ' ✅ Modalità FlowOrchestrator (flow completo)
                Console.WriteLine($"🔄 [RUNTIME][SessionManager] Flow mode: creating FlowOrchestrator...")
                System.Diagnostics.Debug.WriteLine($"🔄 [RUNTIME][SessionManager] Flow mode: creating FlowOrchestrator...")
                Console.Out.Flush()
                session.Orchestrator = New DDTEngine.Orchestrator.FlowOrchestrator(compilationResult, ddtEngine)
                Console.WriteLine($"✅ [RUNTIME][SessionManager] FlowOrchestrator created")

                ' Registra eventi orchestrator
                AddHandler session.Orchestrator.MessageToShow, Sub(sender, text)
                                                                   Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                                   Dim msg = New With {
                        .id = msgId,
                        .text = text,
                        .stepType = "message",
                        .timestamp = DateTime.UtcNow.ToString("O"),
                        .taskId = ""
                    }
                                                                   session.Messages.Add(msg)
                                                                   Console.WriteLine($"📨 [RUNTIME][SessionManager] Message added to session {sessionId}: {text.Substring(0, Math.Min(100, text.Length))}")
                                                                   session.EventEmitter.Emit("message", msg)
                                                               End Sub

                AddHandler session.Orchestrator.StateUpdated, Sub(sender, state)
                                                                  Dim stateData = New With {
                        .currentNodeId = state.CurrentNodeId,
                        .executedTaskIds = state.ExecutedTaskIds.ToList(),
                        .variableStore = state.VariableStore
                    }
                                                                  session.EventEmitter.Emit("stateUpdate", stateData)
                                                              End Sub

                AddHandler session.Orchestrator.ExecutionCompleted, Sub(sender, e)
                                                                        Dim completeData = New With {
                        .success = True,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                                                                        session.EventEmitter.Emit("complete", completeData)
                                                                    End Sub

                AddHandler session.Orchestrator.ExecutionError, Sub(sender, ex)
                                                                    Dim errorData = New With {
                        .error = ex.Message,
                        .timestamp = DateTime.UtcNow.ToString("O")
                    }
                                                                    session.EventEmitter.Emit("error", errorData)
                                                                End Sub
            End If

            _sessions(sessionId) = session
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Session stored in dictionary: {sessionId}")

            ' Avvia esecuzione in background (con piccolo delay per permettere al SSE stream di connettersi)
            Console.WriteLine($"🚀 [RUNTIME][SessionManager] Starting execution in background for session: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"🚀 [RUNTIME][SessionManager] Starting execution in background for session: {sessionId}")
            Console.Out.Flush()
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function()
                                                                     Try
                                                                         ' Piccolo delay per permettere al SSE stream handler di connettersi e registrare i listener
                                                                         Console.WriteLine($"⏳ [RUNTIME][SessionManager] Waiting 500ms for SSE stream to connect...")
                                                                         System.Diagnostics.Debug.WriteLine($"⏳ [RUNTIME][SessionManager] Waiting 500ms for SSE stream to connect...")
                                                                         Console.Out.Flush()
                                                                         Await System.Threading.Tasks.Task.Delay(500)

                                                                         Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                         Console.WriteLine($"🚀 [RUNTIME][SessionManager] Background task started for session: {sessionId}")
                                                                         System.Diagnostics.Debug.WriteLine($"🚀 [RUNTIME][SessionManager] Background task started for session: {sessionId}")
                                                                         Console.Out.Flush()

                                                                         If isDirectDDTMode Then
                                                                             ' ✅ Esegui DDT direttamente (Chat Simulator nel Response Editor)
                                                                             Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Starting DDT execution for session: {sessionId}")
                                                                             Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] isDirectDDTMode=True, ddts.Count={If(ddts IsNot Nothing, ddts.Count, 0)}")
                                                                             Console.Out.Flush()

                                                                             If ddts IsNot Nothing AndAlso ddts.Count > 0 Then
                                                                                 ' ✅ DEBUG: Verifica contenuto di ddts(0) PRIMA della conversione
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Console.WriteLine($"🔍 [RUNTIME][RUNTIME][SessionManager] DEBUG: Analyzing ddts(0) BEFORE ToRuntime conversion")
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Dim assembledDDT = ddts(0)
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT IsNot Nothing={assembledDDT IsNot Nothing}")
                                                                                 If assembledDDT IsNot Nothing Then
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT.Id={If(String.IsNullOrEmpty(assembledDDT.Id), "NULL/EMPTY", assembledDDT.Id)}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT.Label={If(String.IsNullOrEmpty(assembledDDT.Label), "NULL/EMPTY", assembledDDT.Label)}")
                                                                                     Console.WriteLine($"[RUNTIME][SessionManager] assembledDDT.Data IsNot Nothing={assembledDDT.Data IsNot Nothing}")
                                                                                     If assembledDDT.Data IsNot Nothing Then
                                                                                         Console.WriteLine($"[RUNTIME][SessionManager] assembledDDT.Data.Count={assembledDDT.Data.Count}")
                                                                                         If assembledDDT.Data.Count > 0 Then
                                                                                             Dim firstData = assembledDDT.Data(0)
                                                                                             Console.WriteLine($"[RUNTIME][SessionManager] First Data: Id={If(firstData IsNot Nothing AndAlso Not String.IsNullOrEmpty(firstData.Id), firstData.Id, "NULL")}, Name={If(firstData IsNot Nothing AndAlso Not String.IsNullOrEmpty(firstData.Name), firstData.Name, "NULL")}")
                                                                                             If firstData IsNot Nothing Then
                                                                                                 Console.WriteLine($"[RUNTIME][SessionManager] First Data.Steps IsNot Nothing={firstData.Steps IsNot Nothing}")
                                                                                                 If firstData.Steps IsNot Nothing Then
                                                                                                     Console.WriteLine($"[RUNTIME][SessionManager] First Data.Steps.Count={firstData.Steps.Count}")
                                                                                                 End If
                                                                                             End If
                                                                                         Else
                                                                                             Console.WriteLine($"[RUNTIME][SessionManager] ⚠️ WARNING: assembledDDT.Data.Count = 0 (EMPTY!)")
                                                                                         End If
                                                                                     Else
                                                                                         Console.WriteLine($"[RUNTIME][SessionManager] ⚠️ WARNING: assembledDDT.Data is Nothing!")
                                                                                     End If
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT.Introduction IsNot Nothing={assembledDDT.Introduction IsNot Nothing}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT.Translations IsNot Nothing={assembledDDT.Translations IsNot Nothing}")
                                                                                     If assembledDDT.Translations IsNot Nothing Then
                                                                                         Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] assembledDDT.Translations.Count={assembledDDT.Translations.Count}")
                                                                                     End If
                                                                                 Else
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ❌ CRITICAL ERROR: ddts(0) is Nothing!")
                                                                                 End If
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Console.Out.Flush()

                                                                                 ' Converti AssembledDDT in DDTInstance
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Converting DDT to runtime instance...")
                                                                                 Dim assembler As New Compiler.DDTAssembler()
                                                                                 If translations IsNot Nothing Then
                                                                                     assembler.SetTranslations(translations)
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Translations set: {translations.Count} keys")
                                                                                 Else
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] WARNING: No translations provided")
                                                                                 End If

                                                                                 Dim ddtInstance = assembler.Compile(ddts(0))
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Console.WriteLine($"🔍 [RUNTIME][RUNTIME][SessionManager] DEBUG: Analyzing ddtInstance AFTER ToRuntime conversion")
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance IsNot Nothing={ddtInstance IsNot Nothing}")
                                                                                 If ddtInstance IsNot Nothing Then
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.Id={If(String.IsNullOrEmpty(ddtInstance.Id), "NULL/EMPTY", ddtInstance.Id)}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.MainDataList IsNot Nothing={ddtInstance.MainDataList IsNot Nothing}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.MainDataList.Count={If(ddtInstance.MainDataList IsNot Nothing, ddtInstance.MainDataList.Count, 0)}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.IsAggregate={ddtInstance.IsAggregate}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.Introduction IsNot Nothing={ddtInstance.Introduction IsNot Nothing}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.SuccessResponse IsNot Nothing={ddtInstance.SuccessResponse IsNot Nothing}")
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.Translations IsNot Nothing={ddtInstance.Translations IsNot Nothing}")
                                                                                     If ddtInstance.Translations IsNot Nothing Then
                                                                                         Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ddtInstance.Translations.Count={ddtInstance.Translations.Count}")
                                                                                     End If
                                                                                     If ddtInstance.MainDataList IsNot Nothing AndAlso ddtInstance.MainDataList.Count = 0 Then
                                                                                         Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ⚠️ WARNING: ddtInstance.MainDataList.Count = 0 (EMPTY after conversion!)")
                                                                                     End If
                                                                                 Else
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ❌ CRITICAL ERROR: ddtInstance is Nothing after ToRuntime!")
                                                                                 End If
                                                                                 Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                 Console.Out.Flush()

                                                                                 ' Verifica stato iniziale del primo nodo
                                                                                 If ddtInstance.MainDataList.Count > 0 Then
                                                                                     Dim firstNode = ddtInstance.MainDataList(0)
                                                                                     ' Calcola IsEmpty direttamente (evita problemi con extension methods tra progetti)
                                                                                     Dim firstNodeIsEmpty As Boolean
                                                                                     If firstNode.SubTasks.Any Then
                                                                                         firstNodeIsEmpty = Not firstNode.SubTasks.Any(Function(sd) sd.Value IsNot Nothing)
                                                                                     Else
                                                                                         firstNodeIsEmpty = firstNode.Value Is Nothing
                                                                                     End If
                                                                                     Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] First node: Id={firstNode.Id}, State={firstNode.State}, IsEmpty={firstNodeIsEmpty}, Steps.Count={firstNode.Steps.Count}")
                                                                                     If firstNode.Steps.Count > 0 Then
                                                                                         Dim startStep = firstNode.Steps.FirstOrDefault(Function(s) s.Type = DialogueState.Start)
                                                                                         If startStep IsNot Nothing Then
                                                                                             Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Start step found: Escalations.Count={startStep.Escalations.Count}")
                                                                                             If startStep.Escalations.Count > 0 Then
                                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] First escalation: Tasks.Count={startStep.Escalations(0).Tasks.Count}")
                                                                                             End If
                                                                                         End If
                                                                                     End If
                                                                                 End If

                                                                                 ' Esegui DDT direttamente (sincrono, ma in background task)
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Calling ddtEngine.ExecuteDDT...")
                                                                                 Console.Out.Flush()
                                                                                 ddtEngine.ExecuteDDT(ddtInstance)
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ExecuteDDT completed")
                                                                                 Console.Out.Flush()

                                                                                 ' Emetti evento complete
                                                                                 Dim completeData = New With {
                                                                                     .success = True,
                                                                                     .timestamp = DateTime.UtcNow.ToString("O")
                                                                                 }
                                                                                 session.EventEmitter.Emit("complete", completeData)
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] Complete event emitted")
                                                                             Else
                                                                                 Console.WriteLine($"[RUNTIME][RUNTIME][SessionManager] ERROR: No DDTs to execute! ddts Is Nothing={ddts Is Nothing}, Count={If(ddts IsNot Nothing, ddts.Count, 0)}")
                                                                             End If
                    Else
                        ' ✅ Esegui FlowOrchestrator (flow completo)
                        Console.WriteLine($"   Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
                        Console.WriteLine($"   EventEmitter listeners - message: {session.EventEmitter.ListenerCount("message")}, stateUpdate: {session.EventEmitter.ListenerCount("stateUpdate")}")
                        System.Diagnostics.Debug.WriteLine($"   Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
                        System.Diagnostics.Debug.WriteLine($"   EventEmitter listeners - message: {session.EventEmitter.ListenerCount("message")}, stateUpdate: {session.EventEmitter.ListenerCount("stateUpdate")}")
                        Console.Out.Flush()

                        If session.Orchestrator IsNot Nothing Then
                            Console.WriteLine($"   Calling session.Orchestrator.ExecuteDialogueAsync()...")
                            System.Diagnostics.Debug.WriteLine($"   Calling session.Orchestrator.ExecuteDialogueAsync()...")
                            Console.Out.Flush()
                            Await session.Orchestrator.ExecuteDialogueAsync()
                            Console.WriteLine($"✅ [RUNTIME][SessionManager] Orchestrator.ExecuteDialogueAsync() completed for session: {sessionId}")
                            System.Diagnostics.Debug.WriteLine($"✅ [RUNTIME][SessionManager] Orchestrator.ExecuteDialogueAsync() completed for session: {sessionId}")
                            Console.Out.Flush()
                        Else
                            Console.WriteLine($"❌ [RUNTIME][SessionManager] Orchestrator is Nothing, cannot start!")
                            System.Diagnostics.Debug.WriteLine($"❌ [RUNTIME][SessionManager] Orchestrator is Nothing, cannot start!")
                            Console.Out.Flush()
                        End If
                    End If
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"❌ [RUNTIME][SessionManager] Execution error for session {sessionId}: {ex.Message}")
                    Console.WriteLine($"Stack trace: {ex.StackTrace}")
                    System.Diagnostics.Debug.WriteLine($"❌ [RUNTIME][SessionManager] Execution error for session {sessionId}: {ex.Message}")
                    System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine($"Inner exception: {ex.InnerException.Message}")
                        Console.WriteLine($"Inner stack trace: {ex.InnerException.StackTrace}")
                        System.Diagnostics.Debug.WriteLine($"Inner exception: {ex.InnerException.Message}")
                        System.Diagnostics.Debug.WriteLine($"Inner stack trace: {ex.InnerException.StackTrace}")
                    End If
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                End Try
            End Function)
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Background task scheduled for session: {sessionId}, Task ID: {backgroundTask.Id}")
            Console.Out.Flush()

            Return session
        End SyncLock
    End Function

    ''' <summary>
    ''' Recupera una sessione esistente
    ''' </summary>
    Public Shared Function GetSession(sessionId As String) As OrchestratorSession
        SyncLock _lock
            If _sessions.ContainsKey(sessionId) Then
                Return _sessions(sessionId)
            End If
            Return Nothing
        End SyncLock
    End Function

    ''' <summary>
    ''' Elimina una sessione
    ''' </summary>
    Public Shared Sub DeleteSession(sessionId As String)
        SyncLock _lock
            If _sessions.ContainsKey(sessionId) Then
                Dim session = _sessions(sessionId)
                If session.Orchestrator IsNot Nothing Then
                    session.Orchestrator.Stop()
                End If
                _sessions.Remove(sessionId)
                Console.WriteLine($"🗑️ [RUNTIME][SessionManager] Session deleted: {sessionId}")
            End If
        End SyncLock
    End Sub
End Class

