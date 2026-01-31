Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports System.Runtime.CompilerServices
Imports Newtonsoft.Json
Imports Compiler
Imports TaskEngine

''' <summary>
''' Orchestrator Session: contiene tutto lo stato di una sessione di esecuzione
''' </summary>
Public Class OrchestratorSession
    Public Property SessionId As String
    Public Property CompilationResult As FlowCompilationResult
    Public Property Tasks As List(Of Object)
    ' ❌ RIMOSSO: DDTs property - non più usato, struttura costruita da template
    Public Property Translations As Dictionary(Of String, String)
    Public Property Orchestrator As TaskEngine.Orchestrator.FlowOrchestrator
    Public Property TaskEngine As Motore
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
''' Task Session: sessione per Chat Simulator diretto (solo UtteranceInterpretation)
''' Più semplice di OrchestratorSession, usa solo DDTEngine
''' </summary>
Public Class TaskSession
    Public Property SessionId As String
    Public Property RuntimeTask As Compiler.RuntimeTask
    Public Property Translations As Dictionary(Of String, String)
    Public Property TaskEngine As Motore
    Public Property Messages As New List(Of Object)
    Public Property EventEmitter As EventEmitter
    Public Property IsWaitingForInput As Boolean
    Public Property WaitingForInputData As Object
End Class

''' <summary>
''' SessionManager: gestisce tutte le sessioni attive
''' </summary>
Public Class SessionManager
    Private Shared ReadOnly _sessions As New Dictionary(Of String, OrchestratorSession)
    Private Shared ReadOnly _taskSessions As New Dictionary(Of String, TaskSession)
    Private Shared ReadOnly _lock As New Object

    ''' <summary>
    ''' Crea una nuova sessione e avvia l'orchestrator
    ''' </summary>
    Public Shared Function CreateSession(
        sessionId As String,
        compilationResult As FlowCompilationResult,
        tasks As List(Of Object),
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
            Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

            ' Crea Task Engine
            Dim taskEngine As New Motore()
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Task Engine created")

            ' TODO: Reimplementare Chat Simulator usando TaskTree invece di ddts array (quando necessario)

            ' Crea session
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Session object created")
            Console.WriteLine($"   Mode: Flow Orchestrator")
            System.Diagnostics.Debug.WriteLine($"   Mode: Flow Orchestrator")
            Console.Out.Flush()

            ' ✅ Modalità FlowOrchestrator (flow completo)
            Console.WriteLine($"🔄 [RUNTIME][SessionManager] Flow mode: creating FlowOrchestrator...")
            System.Diagnostics.Debug.WriteLine($"🔄 [RUNTIME][SessionManager] Flow mode: creating FlowOrchestrator...")
            Console.Out.Flush()
            session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(compilationResult, taskEngine)
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

    ''' <summary>
    ''' Crea una nuova TaskSession per Chat Simulator diretto
    ''' </summary>
    Public Shared Function CreateTaskSession(
        sessionId As String,
        runtimeTask As Compiler.RuntimeTask,
        translations As Dictionary(Of String, String)
    ) As TaskSession
        SyncLock _lock
            Console.WriteLine($"🔧 [RUNTIME][SessionManager] Creating TaskSession: {sessionId}")

            ' Crea Task Engine
            Dim taskEngine As New Motore()
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Task Engine created for TaskSession")

            ' Crea session
            Dim session As New TaskSession() With {
                .SessionId = sessionId,
                .RuntimeTask = runtimeTask,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }
            Console.WriteLine($"✅ [RUNTIME][SessionManager] TaskSession object created")

            ' Registra eventi TaskEngine
            AddHandler taskEngine.MessageToShow, Sub(sender, e)
                                                      Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                      Dim msg = New With {
                            .id = msgId,
                            .text = e.Message,
                            .stepType = "ask",
                            .timestamp = DateTime.UtcNow.ToString("O")
                        }
                                                      session.Messages.Add(msg)
                                                      Console.WriteLine($"📨 [RUNTIME][SessionManager] Message added to TaskSession {sessionId}: {e.Message.Substring(0, Math.Min(100, e.Message.Length))}")
                                                      session.EventEmitter.Emit("message", msg)

                                                      ' Dopo ogni messaggio, TaskEngine si ferma aspettando input
                                                      session.IsWaitingForInput = True
                                                      ' TODO: Aggiornare per usare RuntimeTask invece di DDTInstance.MainDataList
                                                      ' Per ora usa il primo subTask se presente, altrimenti il root task
                                                      Dim firstNodeId As String = ""
                                                      If session.RuntimeTask IsNot Nothing Then
                                                          If session.RuntimeTask.SubTasks IsNot Nothing AndAlso session.RuntimeTask.SubTasks.Count > 0 Then
                                                              firstNodeId = session.RuntimeTask.SubTasks(0).Id
                                                          Else
                                                              firstNodeId = session.RuntimeTask.Id
                                                          End If
                                                      End If
                                                      session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                      Console.WriteLine($"⏳ [RUNTIME][SessionManager] TaskSession {sessionId} waiting for input")
                                                      session.EventEmitter.Emit("waitingForInput", session.WaitingForInputData)
                                                  End Sub

            _taskSessions(sessionId) = session
            Console.WriteLine($"✅ [RUNTIME][SessionManager] TaskSession stored in dictionary: {sessionId}")

            ' Avvia esecuzione in background
            Console.WriteLine($"🚀 [RUNTIME][SessionManager] Starting Task execution in background for TaskSession: {sessionId}")
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                      Try
                                                                          ' Piccolo delay per permettere al SSE stream handler di connettersi
                                                                          Await System.Threading.Tasks.Task.Delay(500)

                                                                          Console.WriteLine($"🚀 [RUNTIME][SessionManager] Background task started for TaskSession: {sessionId}")
                                                                          ' ✅ NUOVO: Converte RuntimeTask in TaskInstance e esegue
                                                                          Dim taskInstance = ConvertRuntimeTaskToTaskInstance(session.RuntimeTask, session.Translations)
                                                                          taskEngine.ExecuteTask(taskInstance)
                                                                          Console.WriteLine($"✅ [RUNTIME][SessionManager] Task execution completed for TaskSession: {sessionId}")

                                                                          ' TODO: Verifica se tutti i task sono completati (ricorsivo su RuntimeTask)
                                                                          ' Per ora commentato - il runtime deve essere aggiornato
                                                                          ' Dim allCompleted = CheckAllTasksCompleted(session.RuntimeTask)
                                                                          Dim allCompleted = False

                                                                          If allCompleted Then
                                                                              Dim completeData = New With {
                                                                                  .success = True,
                                                                                  .timestamp = DateTime.UtcNow.ToString("O")
                                                                              }
                                                                              session.EventEmitter.Emit("complete", completeData)
                                                                          End If
                                                                      Catch ex As Exception
                                                                          Console.WriteLine($"❌ [RUNTIME][SessionManager] DDT execution error for TaskSession {sessionId}: {ex.Message}")
                                                                          Console.WriteLine($"Stack trace: {ex.StackTrace}")
                                                                          Dim errorData = New With {
                                                                              .error = ex.Message,
                                                                              .timestamp = DateTime.UtcNow.ToString("O")
                                                                          }
                                                                          session.EventEmitter.Emit("error", errorData)
                                                                      End Try
                                                                  End Function)
            Console.WriteLine($"✅ [RUNTIME][SessionManager] Background task scheduled for TaskSession: {sessionId}")

            Return session
        End SyncLock
    End Function

    ''' <summary>
    ''' Recupera una TaskSession esistente
    ''' </summary>
    Public Shared Function GetTaskSession(sessionId As String) As TaskSession
        SyncLock _lock
            If _taskSessions.ContainsKey(sessionId) Then
                Return _taskSessions(sessionId)
            End If
            Return Nothing
        End SyncLock
    End Function

    ''' <summary>
    ''' Elimina una TaskSession
    ''' </summary>
    Public Shared Sub DeleteTaskSession(sessionId As String)
        SyncLock _lock
            If _taskSessions.ContainsKey(sessionId) Then
                _taskSessions.Remove(sessionId)
                Console.WriteLine($"🗑️ [RUNTIME][SessionManager] TaskSession deleted: {sessionId}")
            End If
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in TaskInstance per compatibilità con ExecuteTask
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskInstance(runtimeTask As Compiler.RuntimeTask, translations As Dictionary(Of String, String)) As TaskEngine.TaskInstance
        Dim taskInstance As New TaskEngine.TaskInstance() With {
            .Id = runtimeTask.Id,
            .Label = "", ' Label non è disponibile in RuntimeTask
            .Translations = If(translations, New Dictionary(Of String, String)()),
            .IsAggregate = False, ' TODO: Determinare da RuntimeTask se è aggregato
            .Introduction = Nothing, ' TODO: Estrarre da RuntimeTask.Steps se presente
            .SuccessResponse = Nothing, ' TODO: Estrarre da RuntimeTask.Steps se presente
            .TaskList = New List(Of TaskEngine.TaskNode)()
        }

        ' ✅ Converti RuntimeTask in TaskNode e aggiungi a TaskList
        ' Se RuntimeTask ha SubTasks, crea un TaskNode per ogni SubTask
        ' Se RuntimeTask ha solo Steps, crea un TaskNode root con Steps
        If runtimeTask.HasSubTasks() Then
            ' ✅ Caso composito: crea TaskNode per ogni SubTask
            For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                Dim taskNode = ConvertRuntimeTaskToTaskNode(subTask)
                taskInstance.TaskList.Add(taskNode)
            Next
        ElseIf runtimeTask.Steps IsNot Nothing AndAlso runtimeTask.Steps.Count > 0 Then
            ' ✅ Caso atomico: crea un TaskNode root con Steps
            Dim rootNode = ConvertRuntimeTaskToTaskNode(runtimeTask)
            taskInstance.TaskList.Add(rootNode)
        Else
            ' ✅ Task vuoto: crea un TaskNode vuoto
            Dim emptyNode As New TaskEngine.TaskNode() With {
                .Id = runtimeTask.Id,
                .Name = "",
                .Steps = New List(Of TaskEngine.DialogueStep)(),
                .State = TaskEngine.DialogueState.Start
            }
            taskInstance.TaskList.Add(emptyNode)
        End If

        Console.WriteLine($"[RUNTIME][SessionManager] ConvertRuntimeTaskToTaskInstance: Created TaskInstance with {taskInstance.TaskList.Count} nodes")
        Return taskInstance
    End Function

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in TaskNode (ricorsivo)
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskNode(runtimeTask As Compiler.RuntimeTask) As TaskEngine.TaskNode
        Dim taskNode As New TaskEngine.TaskNode() With {
            .Id = runtimeTask.Id,
            .Name = "", ' Name non è disponibile in RuntimeTask
            .Steps = If(runtimeTask.Steps, New List(Of TaskEngine.DialogueStep)()),
            .ValidationConditions = If(runtimeTask.Constraints, New List(Of TaskEngine.ValidationCondition)()),
            .NlpContract = runtimeTask.NlpContract,
            .State = TaskEngine.DialogueState.Start,
            .Value = Nothing,
            .SubTasks = New List(Of TaskEngine.TaskNode)()
        }

        ' ✅ Converti SubTasks ricorsivamente
        If runtimeTask.HasSubTasks() Then
            For Each subTask As Compiler.RuntimeTask In runtimeTask.SubTasks
                Dim subNode = ConvertRuntimeTaskToTaskNode(subTask)
                subNode.ParentData = taskNode
                taskNode.SubTasks.Add(subNode)
            Next
        End If

        Return taskNode
    End Function
End Class

