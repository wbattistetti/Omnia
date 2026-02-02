Option Strict On
Option Explicit On
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
        If _listeners.ContainsKey(eventName) Then
            For Each handler In _listeners(eventName)
                Try
                    handler(data)
                Catch ex As Exception
                    Console.WriteLine($"[API] ERROR: EventEmitter handler error for {eventName}: {ex.Message}")
                End Try
            Next
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
            Dim taskEngine As New Motore()
            Dim session As New OrchestratorSession() With {
                .SessionId = sessionId,
                .CompilationResult = compilationResult,
                .Tasks = tasks,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }
            session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(compilationResult, taskEngine)

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

            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function()
                                                                     Try
                                                                         Await System.Threading.Tasks.Task.Delay(100)
                                                                         If session.Orchestrator IsNot Nothing Then
                                                                             Await session.Orchestrator.ExecuteDialogueAsync()
                                                                         End If
                                                                     Catch ex As Exception
                                                                         Console.WriteLine($"[API] ERROR: Execution error for session {sessionId}: {ex.GetType().Name} - {ex.Message}")
                                                                         Dim errorData = New With {
                                                                             .error = ex.Message,
                                                                             .timestamp = DateTime.UtcNow.ToString("O")
                                                                         }
                                                                         session.EventEmitter.Emit("error", errorData)
                                                                     End Try
                                                                 End Function)

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
            Console.WriteLine($"[API] CreateTaskSession CALLED: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"[API] CreateTaskSession CALLED: {sessionId}")
            Console.Out.Flush()
            Dim taskEngine As New Motore()
            Dim session As New TaskSession() With {
                .SessionId = sessionId,
                .RuntimeTask = runtimeTask,
                .Translations = translations,
                .EventEmitter = New EventEmitter(),
                .TaskEngine = taskEngine,
                .IsWaitingForInput = False
            }

            AddHandler taskEngine.MessageToShow, Sub(sender, e)
                                                     Dim msgId = $"{sessionId}-{DateTime.UtcNow.Ticks}-{Guid.NewGuid().ToString().Substring(0, 8)}"
                                                     Dim msg = New With {
                           .id = msgId,
                           .text = e.Message,
                           .stepType = "ask",
                           .timestamp = DateTime.UtcNow.ToString("O")
                       }
                                                     session.Messages.Add(msg)
                                                     session.EventEmitter.Emit("message", msg)

                                                     session.IsWaitingForInput = True
                                                     Dim firstNodeId As String = ""
                                                     If session.RuntimeTask IsNot Nothing Then
                                                         If session.RuntimeTask.SubTasks IsNot Nothing AndAlso session.RuntimeTask.SubTasks.Count > 0 Then
                                                             firstNodeId = session.RuntimeTask.SubTasks(0).Id
                                                         Else
                                                             firstNodeId = session.RuntimeTask.Id
                                                         End If
                                                     End If
                                                     session.WaitingForInputData = New With {.nodeId = firstNodeId}
                                                     session.EventEmitter.Emit("waitingForInput", session.WaitingForInputData)
                                                 End Sub

            _taskSessions(sessionId) = session

            Console.WriteLine($"[API] Starting runtime execution for session: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"[API] Starting runtime execution for session: {sessionId}")
            Console.Out.Flush()
            Dim backgroundTask = System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                                     Try
                                                                         Await System.Threading.Tasks.Task.Delay(100)
                                                                         Dim taskInstance = ConvertRuntimeTaskToTaskInstance(session.RuntimeTask, session.Translations)
                                                                         Console.WriteLine($"[RUNTIME] Executing task for session: {sessionId}, TaskList.Count={taskInstance.TaskList.Count}")
                                                                         System.Diagnostics.Debug.WriteLine($"[RUNTIME] Executing task for session: {sessionId}, TaskList.Count={taskInstance.TaskList.Count}")
                                                                         Console.Out.Flush()
                                                                         taskEngine.ExecuteTask(taskInstance)

                                                                         Dim allCompleted = False
                                                                         If allCompleted Then
                                                                             Dim completeData = New With {
                                                                                 .success = True,
                                                                                 .timestamp = DateTime.UtcNow.ToString("O")
                                                                             }
                                                                             session.EventEmitter.Emit("complete", completeData)
                                                                         End If
                                                                     Catch ex As Exception
                                                                         Console.WriteLine($"[API] ERROR: Runtime execution error for session {sessionId}: {ex.GetType().Name} - {ex.Message}")
                                                                         Console.WriteLine($"[API] ERROR: Stack trace: {ex.StackTrace}")
                                                                         System.Diagnostics.Debug.WriteLine($"[API] ERROR: Runtime execution error for session {sessionId}: {ex.GetType().Name} - {ex.Message}")
                                                                         System.Diagnostics.Debug.WriteLine($"[API] ERROR: Stack trace: {ex.StackTrace}")
                                                                         Console.Out.Flush()
                                                                         Dim errorData = New With {
                                                                             .error = ex.Message,
                                                                             .timestamp = DateTime.UtcNow.ToString("O")
                                                                         }
                                                                         session.EventEmitter.Emit("error", errorData)
                                                                     End Try
                                                                 End Function)

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
            End If
        End SyncLock
    End Sub

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in TaskInstance per compatibilità con ExecuteTask
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskInstance(runtimeTask As Compiler.RuntimeTask, translations As Dictionary(Of String, String)) As TaskEngine.TaskInstance
        Dim taskInstance As New TaskEngine.TaskInstance() With {
            .Id = runtimeTask.Id,
            .Label = "",
            .Translations = If(translations, New Dictionary(Of String, String)()),
            .IsAggregate = False,
            .Introduction = Nothing,
            .SuccessResponse = Nothing,
            .TaskList = New List(Of TaskEngine.TaskNode)()
        }

        Dim rootNode = ConvertRuntimeTaskToTaskNode(runtimeTask)
        taskInstance.TaskList.Add(rootNode)

        Return taskInstance
    End Function

    ''' <summary>
    ''' ✅ Helper: Converte RuntimeTask in TaskNode (ricorsivo)
    ''' </summary>
    Private Shared Function ConvertRuntimeTaskToTaskNode(runtimeTask As Compiler.RuntimeTask) As TaskEngine.TaskNode
        Dim taskNode As New TaskEngine.TaskNode() With {
            .Id = runtimeTask.Id,
            .Name = "",
            .Steps = If(runtimeTask.Steps, New List(Of TaskEngine.DialogueStep)()),
            .ValidationConditions = If(runtimeTask.Constraints, New List(Of TaskEngine.ValidationCondition)()),
            .NlpContract = runtimeTask.NlpContract,
            .State = TaskEngine.DialogueState.Start,
            .Value = Nothing,
            .SubTasks = New List(Of TaskEngine.TaskNode)()
        }

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

