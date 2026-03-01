Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports System.Linq

''' <summary>
''' Orchestrator che esegue un flow compilato
''' - Trova task eseguibili (condizione = true)
''' - Esegue task
''' - Chiama Task Engine per task GetData
''' - Gestisce stato globale
''' ✅ STATELESS: ExecutionState viene salvato/caricato da Redis
''' </summary>
Public Class FlowOrchestrator
    Private ReadOnly _compiledTasks As List(Of CompiledTask)
    Private ReadOnly _compilationResult As FlowCompilationResult
    ' ✅ REMOVED: _taskEngine (Motore) - use StatelessDialogueEngine instead when needed
    ' ✅ REMOVED: _taskExecutor (ora TaskExecutor è statico)
    Private ReadOnly _taskGroupExecutor As TaskGroupExecutor
    Private ReadOnly _state As ExecutionState
    Private _isRunning As Boolean = False
    Private _entryTaskGroupId As String
    ' ✅ STATELESS: Storage per ExecutionState (opzionale per retrocompatibilità)
    ' Nota: Usa Object invece di IExecutionStateStorage per evitare dipendenza circolare
    Private ReadOnly _executionStateStorage As Object
    Private ReadOnly _sessionId As String

    ''' <summary>
    ''' Evento sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of String)

    ''' <summary>
    ''' Evento sollevato quando lo stato viene aggiornato
    ''' </summary>
    Public Event StateUpdated As EventHandler(Of ExecutionState)

    ''' <summary>
    ''' Evento sollevato quando l'esecuzione è completata
    ''' </summary>
    Public Event ExecutionCompleted As EventHandler

    ''' <summary>
    ''' Evento sollevato quando c'è un errore
    ''' </summary>
    Public Event ExecutionError As EventHandler(Of Exception)

    ''' <summary>
    ''' Costruttore per retrocompatibilità (senza storage - stato solo in memoria)
    ''' </summary>
    Public Sub New(compiledTasks As List(Of CompiledTask))
        _compiledTasks = compiledTasks
        _compilationResult = Nothing
        ' ✅ REMOVED: taskEngine parameter - use StatelessDialogueEngine when needed
        ' ✅ REMOVED: _taskExecutor (ora TaskExecutor è statico)
        _taskGroupExecutor = New TaskGroupExecutor()
        _executionStateStorage = Nothing
        _sessionId = Nothing
        _state = New ExecutionState()
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Costruttore con storage per salvare/caricare ExecutionState da Redis
    ''' </summary>
    Public Sub New(compilationResult As FlowCompilationResult, Optional sessionId As String = Nothing, Optional executionStateStorage As Object = Nothing)
        _compilationResult = compilationResult
        If compilationResult IsNot Nothing AndAlso compilationResult.Tasks IsNot Nothing Then
            _compiledTasks = compilationResult.Tasks
            _entryTaskGroupId = compilationResult.EntryTaskGroupId
        Else
            _compiledTasks = New List(Of CompiledTask)()
            _entryTaskGroupId = Nothing
        End If
        ' ✅ REMOVED: taskEngine parameter - use StatelessDialogueEngine when needed
        ' ✅ REMOVED: _taskExecutor (ora TaskExecutor è statico)
        _taskGroupExecutor = New TaskGroupExecutor()
        _executionStateStorage = executionStateStorage
        _sessionId = sessionId

        ' ✅ STATELESS: Carica ExecutionState da Redis se storage disponibile
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                ' Usa reflection per chiamare GetExecutionState senza dipendenza diretta
                Dim getExecutionStateMethod = _executionStateStorage.GetType().GetMethod("GetExecutionState")
                If getExecutionStateMethod IsNot Nothing Then
                    _state = DirectCast(getExecutionStateMethod.Invoke(_executionStateStorage, {_sessionId}), ExecutionState)
                    Console.WriteLine($"[FlowOrchestrator] ✅ Loaded ExecutionState from Redis for session: {_sessionId}")
                Else
                    _state = New ExecutionState()
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to load ExecutionState from Redis: {ex.Message}, using new state")
                _state = New ExecutionState()
            End Try
        Else
            _state = New ExecutionState()
        End If
    End Sub

    ''' <summary>
    ''' Executes the entire dialogue flow
    ''' Trova TaskGroup eseguibili e delega esecuzione a TaskGroupExecutor
    ''' NON naviga Edges a runtime - usa solo ExecCondition
    ''' </summary>
    Public Async Function ExecuteDialogueAsync() As System.Threading.Tasks.Task
        If _isRunning Then
            Return
        End If

        _isRunning = True

        Try
            Console.WriteLine($"🚀 [FlowOrchestrator] Starting dialogue with {If(_compilationResult IsNot Nothing AndAlso _compilationResult.TaskGroups IsNot Nothing, _compilationResult.TaskGroups.Count, 0)} task groups")
            RaiseEvent StateUpdated(Me, _state)

            Dim iterationCount As Integer = 0
            While _isRunning
                iterationCount += 1

                ' ✅ Trova prossimo TaskGroup eseguibile (usa solo ExecCondition, NON naviga Edges)
                Dim taskGroup = GetNextTaskGroup()

                If taskGroup Is Nothing Then
                    Console.WriteLine($"[FlowOrchestrator] No more executable TaskGroups")
                    Exit While
                End If

                Console.WriteLine($"[FlowOrchestrator] Executing TaskGroup {taskGroup.NodeId} (iteration {iterationCount})")

                ' ✅ Delega esecuzione a TaskGroupExecutor (callback passato internamente)
                Dim messageCallback As Action(Of String, String, Integer) = Sub(text, stepType, escalationNumber)
                                                                                RaiseEvent MessageToShow(Me, text)
                                                                            End Sub
                Dim result = Await _taskGroupExecutor.ExecuteTaskGroup(taskGroup, _state, messageCallback)

                If Not result.Success Then
                    Throw New Exception($"TaskGroup execution failed: {result.Err}")
                End If

                ' ✅ Se task richiede input asincrono, sospendi esecuzione
                If result.RequiresInput Then
                    Console.WriteLine($"[FlowOrchestrator] ⏸️ TaskGroup {taskGroup.NodeId} suspended (task {result.WaitingTaskId} requires input)")
                    SaveState()
                    Exit While  ' Sospendi, attendi input
                End If

                ' ✅ Marca TaskGroup come eseguito
                taskGroup.Executed = True
                _state.ExecutedTaskGroupIds.Add(taskGroup.NodeId)
                Console.WriteLine($"[FlowOrchestrator] ✅ TaskGroup {taskGroup.NodeId} completed")

                ' ✅ STATELESS: Salva ExecutionState su Redis dopo ogni modifica
                SaveState()

                RaiseEvent StateUpdated(Me, _state)

                ' ✅ STATELESS: Nessun delay artificiale - il loop è guidato da stato, non da timing
            End While

            Console.WriteLine($"✅ [FlowOrchestrator] Dialogue completed after {iterationCount} iterations")
            RaiseEvent ExecutionCompleted(Me, Nothing)

        Catch ex As Exception
            Console.WriteLine($"❌ [FlowOrchestrator] Error: {ex.Message}")
            RaiseEvent ExecutionError(Me, ex)
            Throw
        Finally
            _isRunning = False
        End Try
    End Function

    ''' <summary>
    ''' ✅ Trova il prossimo TaskGroup eseguibile usando solo ExecCondition
    ''' NON naviga Edges a runtime - la navigazione è già "baked" in ExecCondition
    ''' </summary>
    Private Function GetNextTaskGroup() As TaskGroup
        If _compilationResult Is Nothing OrElse _compilationResult.TaskGroups Is Nothing Then
            ' Fallback: flat list search (retrocompatibilità)
            Return Nothing
        End If

        ' ✅ Inizializza con entry TaskGroup se necessario
        If String.IsNullOrEmpty(_state.CurrentNodeId) Then
            If Not String.IsNullOrEmpty(_entryTaskGroupId) Then
                Dim entryTaskGroup = _compilationResult.TaskGroups.FirstOrDefault(Function(tg) tg.NodeId = _entryTaskGroupId)
                If entryTaskGroup IsNot Nothing Then
                    _state.CurrentNodeId = _entryTaskGroupId
                    _state.CurrentRowIndex = entryTaskGroup.StartTaskIndex
                    SaveState()
                    Return entryTaskGroup
                End If
            End If
            Return Nothing
        End If

        ' ✅ Itera su tutti i TaskGroups e trova il primo con ExecCondition = TRUE
        For Each taskGroup In _compilationResult.TaskGroups
            ' Salta TaskGroup già eseguiti
            If taskGroup.Executed Then
                Continue For
            End If

            ' ✅ Valuta ExecCondition (include già "padre eseguito AND link condizione")
            Dim canExecute As Boolean = True
            If taskGroup.ExecCondition IsNot Nothing Then
                canExecute = ConditionEvaluator.EvaluateCondition(taskGroup.ExecCondition, _state)
            End If

            If canExecute Then
                ' ✅ TaskGroup eseguibile trovato
                Return taskGroup
            End If
        Next

        ' ✅ Nessun TaskGroup eseguibile
        Return Nothing
    End Function


    ' ✅ REMOVED: OnTaskEngineMessage handler - no longer needed without Motore

    ''' <summary>
    ''' Ferma l'esecuzione
    ''' </summary>
    Public Sub [Stop]()
        _isRunning = False
    End Sub

    ''' <summary>
    ''' ✅ NEW: Fornisce input utente a un task utterance in attesa usando ProcessTurnEngine
    ''' </summary>
    Public Async Function ProvideUserInput(taskId As String, userInput As String, resolveTranslation As Func(Of String, String)) As System.Threading.Tasks.Task(Of Boolean)
        If Not _state.DialogueContexts.ContainsKey(taskId) Then
            Console.WriteLine($"⚠️ [FlowOrchestrator] No DialogueContext found for task {taskId}")
            Return False
        End If

        Try
            ' Find the task
            Dim task = _compiledTasks.FirstOrDefault(Function(t) t.Id = taskId)
            If task Is Nothing Then
                Console.WriteLine($"⚠️ [FlowOrchestrator] Task {taskId} not found")
                Return False
            End If

            ' Load DialogueContext from state
            Dim ctxJson As String = CStr(_state.DialogueContexts(taskId))
            Dim ctx = JsonConvert.DeserializeObject(Of TaskEngine.Orchestrator.DialogueContext)(ctxJson)
            If ctx Is Nothing OrElse ctx.DialogueState Is Nothing Then
                Console.WriteLine($"⚠️ [FlowOrchestrator] Invalid DialogueContext for task {taskId}")
                Return False
            End If

            ' Cast task to CompiledUtteranceTask
            Dim utteranceTask = TryCast(task, CompiledUtteranceTask)
            If utteranceTask Is Nothing Then
                Console.WriteLine($"⚠️ [FlowOrchestrator] Task {taskId} is not an UtteranceInterpretation task")
                Return False
            End If

            ' Ensure CurrentTask and RootTask are set
            If ctx.DialogueState.CurrentTask Is Nothing Then
                ctx.DialogueState.CurrentTask = utteranceTask
            End If
            If ctx.DialogueState.RootTask Is Nothing Then
                ctx.DialogueState.RootTask = utteranceTask
            End If

            ' Call TaskUtteranceStepExecutor.ProcessTurn (executor in Engine/TaskExecutors/)
            Dim result = TaskUtteranceStepExecutor.ProcessTurn(ctx.DialogueState, userInput, resolveTranslation)

            ' Emit messages via MessageToShow event
            If result.Messages IsNot Nothing Then
                For Each msg As String In result.Messages
                    RaiseEvent MessageToShow(Me, msg)
                Next
            End If

            ' Update DialogueState
            ctx.DialogueState = result.NewState

            ' Save updated DialogueContext to state
            Dim updatedCtxJson = JsonConvert.SerializeObject(ctx)
            _state.DialogueContexts(taskId) = updatedCtxJson

            ' Save state
            SaveState()

            ' Check if task is completed
            Dim isCompleted = result.Status = "completed" OrElse result.NewState.IsCompleted

            ' If task completed, remove DialogueContext and resume execution
            If isCompleted Then
                _state.DialogueContexts.Remove(taskId)
                SaveState()

                ' Resume execution
                If Not _isRunning Then
                    Await ExecuteDialogueAsync()
                End If
            End If

            Console.WriteLine("✅ [FlowOrchestrator] Processed user input for task {0}. Completed: {1}", taskId, isCompleted)
            Return True

        Catch ex As Exception
            Console.WriteLine($"❌ [FlowOrchestrator] Error processing user input for task {taskId}: {ex.Message}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Salva ExecutionState su Redis
    ''' </summary>
    Private Sub SaveState()
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                ' Usa reflection per chiamare SaveExecutionState senza dipendenza diretta
                Dim saveExecutionStateMethod = _executionStateStorage.GetType().GetMethod("SaveExecutionState")
                If saveExecutionStateMethod IsNot Nothing Then
                    saveExecutionStateMethod.Invoke(_executionStateStorage, {_sessionId, _state})
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to save ExecutionState to Redis: {ex.Message}")
                ' Non solleviamo eccezione per non interrompere l'esecuzione, ma loggiamo l'errore
            End Try
        End If
    End Sub
End Class

