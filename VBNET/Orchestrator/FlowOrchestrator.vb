Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports System.Linq
Imports System.Reflection

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
    ' ✅ SINGLE POINT OF TRUTH: Campi per risoluzione traduzioni
    Private ReadOnly _projectId As String
    Private ReadOnly _locale As String
    Private ReadOnly _resolveTranslation As Func(Of String, String)

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
    ''' ✅ UNIFIED: Evento sollevato quando un task richiede input utente
    ''' Allinea il comportamento con TaskSessionHandlers per unificare l'approccio
    ''' </summary>
    Public Event WaitingForInput As EventHandler(Of String) ' taskId

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
        _projectId = Nothing
        _locale = Nothing
        _resolveTranslation = Nothing
        _state = New ExecutionState()
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Costruttore con storage per salvare/caricare ExecutionState da Redis
    ''' </summary>
    Public Sub New(
        compilationResult As FlowCompilationResult,
        Optional sessionId As String = Nothing,
        Optional executionStateStorage As Object = Nothing,
        Optional projectId As String = Nothing,
        Optional locale As String = Nothing,
        Optional resolveTranslation As Func(Of String, String) = Nothing
    )
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
        ' ✅ SINGLE POINT OF TRUTH: Salva parametri per risoluzione traduzioni
        _projectId = projectId
        _locale = locale
        _resolveTranslation = resolveTranslation

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
        Console.WriteLine($"🔵 [FlowOrchestrator] ExecuteDialogueAsync CALLED - _isRunning={_isRunning}")
        System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] ExecuteDialogueAsync CALLED")
        If _isRunning Then
            Console.WriteLine($"🔵 [FlowOrchestrator] Already running, returning")
            System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] Already running")
            Return
        End If

        _isRunning = True

        Try
            Console.WriteLine($"🚀 [FlowOrchestrator] Starting dialogue with {If(_compilationResult IsNot Nothing AndAlso _compilationResult.TaskGroups IsNot Nothing, _compilationResult.TaskGroups.Count, 0)} task groups")
            System.Diagnostics.Debug.WriteLine($"🚀 [FlowOrchestrator] Starting dialogue")
            RaiseEvent StateUpdated(Me, _state)

            Dim iterationCount As Integer = 0
            While _isRunning
                iterationCount += 1

                ' ✅ Trova prossimo TaskGroup eseguibile (usa solo ExecCondition, NON naviga Edges)
                Dim taskGroup = GetNextTaskGroup()

                If taskGroup Is Nothing Then
                    Console.WriteLine($"🔵 [FlowOrchestrator] No more executable TaskGroups")
                    System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] No more executable TaskGroups")
                    Exit While
                End If

                Console.WriteLine($"🔵 [FlowOrchestrator] Executing TaskGroup {taskGroup.NodeId} (iteration {iterationCount})")
                System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] Executing TaskGroup {taskGroup.NodeId} (iteration {iterationCount})")

                ' ✅ SINGLE POINT OF TRUTH: Risolvi TextKey nel messageCallback
                ' Questo è l'unico punto dove TUTTI i messaggi passano prima di arrivare al frontend
                Dim messageCallback As Action(Of String, String, Integer) = Sub(text, stepType, escalationNumber)
                                                                                ' ✅ DEBUG: Log TextKey ricevuto
                                                                                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Received message")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback]   text: '{text}'")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback]   stepType: '{stepType}'")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback]   text.Length: {If(text IsNot Nothing, text.Length, 0)}")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback]   _resolveTranslation IsNot Nothing: {_resolveTranslation IsNot Nothing}")
                                                                                System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Received: text='{text}', stepType='{stepType}'")

                                                                                ' ✅ Se text è un GUID (TextKey), risolvilo tramite resolveTranslation
                                                                                ' ✅ Se text è già testo tradotto, usalo così com'è
                                                                                Dim resolvedText As String = text

                                                                                If _resolveTranslation IsNot Nothing AndAlso Not String.IsNullOrEmpty(text) Then
                                                                                    ' Verifica se è un GUID (TextKey) - formato: 8-4-4-4-12 caratteri esadecimali
                                                                                    Dim isGuid As Boolean = False
                                                                                    Try
                                                                                        ' Pattern GUID: 8-4-4-4-12 caratteri esadecimali separati da trattini
                                                                                        If text.Length = 36 AndAlso text.Count(Function(c) c = "-"c) = 4 Then
                                                                                            Dim guid = New Guid(text)
                                                                                            isGuid = True
                                                                                            Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] ✅ TextKey detected as GUID: {text}")
                                                                                            System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] TextKey detected as GUID: {text}")
                                                                                        Else
                                                                                            Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] ❌ TextKey NOT detected as GUID: length={text.Length}, dashes={text.Count(Function(c) c = "-"c)}")
                                                                                            System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] TextKey NOT detected as GUID: length={text.Length}")
                                                                                        End If
                                                                                    Catch ex As Exception
                                                                                        ' Non è un GUID, probabilmente è già testo tradotto
                                                                                        Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] ⚠️ Exception checking GUID: {ex.Message}")
                                                                                        System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Exception checking GUID: {ex.Message}")
                                                                                    End Try

                                                                                    If isGuid Then
                                                                                        ' ✅ Risolvi TextKey → testo tradotto
                                                                                        Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] 🔍 Resolving TextKey: {text}")
                                                                                        System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Resolving TextKey: {text}")
                                                                                        resolvedText = _resolveTranslation(text)
                                                                                        Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] ✅ Resolved text: '{resolvedText}'")
                                                                                        System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Resolved text: '{resolvedText}'")
                                                                                        ' Se risoluzione fallisce (traduzione non trovata), usa TextKey stesso come fallback
                                                                                        If String.IsNullOrEmpty(resolvedText) Then
                                                                                            Console.WriteLine($"⚠️ [FlowOrchestrator.messageCallback] ⚠️ Translation not found for TextKey: {text}, using TextKey as fallback")
                                                                                            System.Diagnostics.Debug.WriteLine($"⚠️ [FlowOrchestrator.messageCallback] Translation not found for TextKey: {text}")
                                                                                            resolvedText = text
                                                                                        End If
                                                                                    Else
                                                                                        Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] ℹ️ Text is not a GUID, using as-is: '{text}'")
                                                                                        System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator.messageCallback] Text is not a GUID, using as-is")
                                                                                    End If
                                                                                    ' Se non è un GUID, text è già testo tradotto, usalo così com'è
                                                                                Else
                                                                                    Console.WriteLine($"⚠️ [FlowOrchestrator.messageCallback] ⚠️ _resolveTranslation is Nothing or text is empty")
                                                                                    System.Diagnostics.Debug.WriteLine($"⚠️ [FlowOrchestrator.messageCallback] _resolveTranslation is Nothing or text is empty")
                                                                                End If

                                                                                ' ✅ DEBUG: Log messaggio prima di emettere evento
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator.messageCallback] 📤 Final resolvedText: '{resolvedText}'")
                                                                                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                                                Console.WriteLine($"🔵 [FlowOrchestrator] MessageToShow event raised: {resolvedText}")
                                                                                System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] MessageToShow: {resolvedText}")

                                                                                ' ✅ DEBUG: Verifica se ci sono listener registrati
                                                                                Dim hasListeners = Me.MessageToShowEvent IsNot Nothing
                                                                                Dim listenerCount = 0
                                                                                If hasListeners Then
                                                                                    ' Conta i listener usando reflection
                                                                                    Dim eventField = Me.GetType().GetField("MessageToShowEvent", Reflection.BindingFlags.NonPublic Or Reflection.BindingFlags.Instance)
                                                                                    If eventField IsNot Nothing Then
                                                                                        Dim eventDelegate = TryCast(eventField.GetValue(Me), EventHandler(Of String))
                                                                                        If eventDelegate IsNot Nothing Then
                                                                                            listenerCount = eventDelegate.GetInvocationList().Length
                                                                                        End If
                                                                                    End If
                                                                                End If

                                                                                Console.WriteLine($"🔴 [FlowOrchestrator] BREAKPOINT: About to raise MessageToShow")
                                                                                Console.WriteLine($"🔴 [FlowOrchestrator] Has listeners: {hasListeners}, Count: {listenerCount}")
                                                                                Console.WriteLine($"🔴 [FlowOrchestrator] Orchestrator instance: {Me.GetHashCode()}")
                                                                                Console.WriteLine($"🔴 [FlowOrchestrator] Message text: {resolvedText}")
                                                                                System.Diagnostics.Debug.WriteLine($"🔴 [FlowOrchestrator] BREAKPOINT: Has listeners: {hasListeners}, Count: {listenerCount}, Instance: {Me.GetHashCode()}")
                                                                                Console.Out.Flush()

                                                                                RaiseEvent MessageToShow(Me, resolvedText)
                                                                            End Sub
                Console.WriteLine($"🔵 [FlowOrchestrator] About to execute TaskGroup {taskGroup.NodeId} with messageCallback")
                System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] About to execute TaskGroup {taskGroup.NodeId}")
                Dim result = Await _taskGroupExecutor.ExecuteTaskGroup(taskGroup, _state, messageCallback)
                Console.WriteLine($"🔵 [FlowOrchestrator] TaskGroup {taskGroup.NodeId} execution completed: Success={result.Success}, RequiresInput={result.RequiresInput}")
                System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] TaskGroup {taskGroup.NodeId} completed: Success={result.Success}")

                If Not result.Success Then
                    Throw New Exception($"TaskGroup execution failed: {result.Err}")
                End If

                ' ✅ Se task richiede input asincrono, sospendi esecuzione
                If result.RequiresInput Then
                    Console.WriteLine($"[FlowOrchestrator] ⏸️ TaskGroup {taskGroup.NodeId} suspended (task {result.WaitingTaskId} requires input)")
                    SaveState()
                    ' ✅ UNIFIED: Emetti evento WaitingForInput (come TaskSessionHandlers)
                    ' Questo allinea il comportamento con il test del task singolo
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                    Console.WriteLine($"🔵 [FlowOrchestrator] 🔍 BREAKPOINT: About to raise WaitingForInput event")
                    Console.WriteLine($"🔵 [FlowOrchestrator] 🔍 TaskId: {result.WaitingTaskId}")
                    System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] Raising WaitingForInput for task {result.WaitingTaskId}")
                    Console.Out.Flush()

                    ' ✅ DEBUG: Verifica se ci sono listener registrati
                    Dim hasListeners = Me.WaitingForInputEvent IsNot Nothing
                    Console.WriteLine($"🔵 [FlowOrchestrator] 🔍 Has WaitingForInput listeners: {hasListeners}")
                    System.Diagnostics.Debug.WriteLine($"🔵 [FlowOrchestrator] Has listeners: {hasListeners}")
                    Console.Out.Flush()

                    RaiseEvent WaitingForInput(Me, result.WaitingTaskId)

                    Console.WriteLine($"✅ [FlowOrchestrator] 🔍 BREAKPOINT: WaitingForInput event raised for task {result.WaitingTaskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [FlowOrchestrator] WaitingForInput event raised")
                    Console.Out.Flush()
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
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

            ' ✅ STATELESS: Call TaskUtteranceStepExecutor.ProcessTurn (restituisce TextKey)
            Dim result = TaskUtteranceStepExecutor.ProcessTurn(ctx.DialogueState, userInput)

            ' ✅ Emit messages via MessageToShow event (risolvi TextKey qui)
            ' Il messageCallback in FlowOrchestrator risolverà i TextKey prima di emettere
            If result.Messages IsNot Nothing Then
                For Each textKey As String In result.Messages
                    ' ✅ Risolvi TextKey usando _resolveTranslation prima di emettere
                    Dim resolvedText = If(_resolveTranslation IsNot Nothing, _resolveTranslation(textKey), textKey)
                    RaiseEvent MessageToShow(Me, resolvedText)
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

