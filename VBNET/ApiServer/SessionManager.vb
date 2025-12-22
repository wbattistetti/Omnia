Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Threading.Tasks
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
            Console.WriteLine($"🔧 [SessionManager] Creating session: {sessionId}")
            Console.WriteLine($"   CompilationResult: {If(compilationResult IsNot Nothing, "NOT NULL", "NULL")}")
            If compilationResult IsNot Nothing Then
                Console.WriteLine($"   TaskGroups count: {compilationResult.TaskGroups.Count}")
                Console.WriteLine($"   Tasks count: {If(compilationResult.Tasks IsNot Nothing, compilationResult.Tasks.Count, 0)}")
                Console.WriteLine($"   EntryTaskGroupId: {compilationResult.EntryTaskGroupId}")
            End If
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

            ' Crea DDT Engine
            Dim ddtEngine As New Motore()
            Console.WriteLine($"✅ [SessionManager] DDT Engine created")

            ' Crea session
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .DDTs = ddts,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .IsWaitingForInput = False
            }
            Console.WriteLine($"✅ [SessionManager] Session object created")

            ' Crea FlowOrchestrator con il CompilationResult
            Console.WriteLine($"🔄 [SessionManager] Creating FlowOrchestrator...")
            session.Orchestrator = New DDTEngine.Orchestrator.FlowOrchestrator(compilationResult, ddtEngine)
            Console.WriteLine($"✅ [SessionManager] FlowOrchestrator created")

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
                Console.WriteLine($"📨 [SessionManager] Message added to session {sessionId}: {text.Substring(0, Math.Min(100, text.Length))}")
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

            _sessions(sessionId) = session
            Console.WriteLine($"✅ [SessionManager] Session stored in dictionary: {sessionId}")

            ' Avvia orchestrator in background (con piccolo delay per permettere al SSE stream di connettersi)
            Console.WriteLine($"🚀 [SessionManager] Starting orchestrator in background for session: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"🚀 [SessionManager] Starting orchestrator in background for session: {sessionId}")
            Console.Out.Flush()
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function()
                Try
                    ' Piccolo delay per permettere al SSE stream handler di connettersi e registrare i listener
                    Console.WriteLine($"⏳ [SessionManager] Waiting 500ms for SSE stream to connect...")
                    System.Diagnostics.Debug.WriteLine($"⏳ [SessionManager] Waiting 500ms for SSE stream to connect...")
                    Console.Out.Flush()
                    Await System.Threading.Tasks.Task.Delay(500)

                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🚀 [SessionManager] Background task started for session: {sessionId}")
                    System.Diagnostics.Debug.WriteLine($"🚀 [SessionManager] Background task started for session: {sessionId}")
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
                        Console.WriteLine($"✅ [SessionManager] Orchestrator.ExecuteDialogueAsync() completed for session: {sessionId}")
                        System.Diagnostics.Debug.WriteLine($"✅ [SessionManager] Orchestrator.ExecuteDialogueAsync() completed for session: {sessionId}")
                        Console.Out.Flush()
                    Else
                        Console.WriteLine($"❌ [SessionManager] Orchestrator is Nothing, cannot start!")
                        System.Diagnostics.Debug.WriteLine($"❌ [SessionManager] Orchestrator is Nothing, cannot start!")
                        Console.Out.Flush()
                    End If
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                Catch ex As Exception
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"❌ [SessionManager] Orchestrator error for session {sessionId}: {ex.Message}")
                    Console.WriteLine($"Stack trace: {ex.StackTrace}")
                    System.Diagnostics.Debug.WriteLine($"❌ [SessionManager] Orchestrator error for session {sessionId}: {ex.Message}")
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
            Console.WriteLine($"✅ [SessionManager] Background task scheduled for session: {sessionId}, Task ID: {backgroundTask.Id}")
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
                Console.WriteLine($"🗑️ [SessionManager] Session deleted: {sessionId}")
            End If
        End SyncLock
    End Sub
End Class

