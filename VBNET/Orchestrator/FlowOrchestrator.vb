Option Strict On
Option Explicit On
Imports Compiler
Imports DTO.Runtime
Imports TaskEngine
Imports TaskEngine.UtteranceInterpretation
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports System.Linq
Imports System.Collections.Generic
Imports Common

''' <summary>
''' Orchestrator che esegue un flow compilato tramite un loop stateless.
'''
''' Architettura:
'''   RunUntilInput() è l'unico loop principale.
'''   Ogni iterazione esegue UN turno (ProcessCurrentTurn) e aggiorna ExecutionState.
'''   Si ferma quando un task richiede input utente o quando il flow è completato.
'''
''' Statefulness:
'''   ExecutionState è l'unica fonte di verità; viene letto/scritto su Redis tramite SaveState().
'''   L'oggetto FlowOrchestrator è ricreato per ogni richiesta HTTP (stateless per design).
''' </summary>
Public Class FlowOrchestrator

    ' ── Settings condivisi per serializzazione/deserializzazione DialogueState ─
    ' TypeNameHandling.Auto è necessario per preservare CurrentTask/RootTask
    ' come CompiledUtteranceTask attraverso i roundtrip JSON/Redis.
    Private Shared ReadOnly _dialogueStateSettings As JsonSerializerSettings =
        New JsonSerializerSettings() With {
            .TypeNameHandling = TypeNameHandling.Auto,
            .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
            .NullValueHandling = NullValueHandling.Ignore,
            .Converters = New List(Of JsonConverter) From {
                New Newtonsoft.Json.Converters.StringEnumConverter(),
                New ITaskConverter()
            }
        }

    ' ── Configurazione immutabile (passata nel costruttore) ───────────────────
    Private ReadOnly _compiledTasks As List(Of CompiledTask)
    Private ReadOnly _compilationResult As CompiledFlow
    Private ReadOnly _entryTaskGroupId As String
    Private ReadOnly _executionStateStorage As Object
    Private ReadOnly _sessionId As String
    Private ReadOnly _projectId As String
    Private ReadOnly _locale As String
    Private ReadOnly _resolveTranslation As Func(Of String, String)
    Private ReadOnly _variables As List(Of CompiledVariable) ' ✅ NEW: Variables with values for runtime

    ''' <summary>FlowId (es. "main") → risultato compilazione. Estendibile con subflow senza cambiare il main.</summary>
    Private ReadOnly _compilationByFlowId As Dictionary(Of String, CompiledFlow)

    ' ── Stato runtime caricato da Redis ──────────────────────────────────────
    Private ReadOnly _state As ExecutionState

    ' ── Events (per comunicazione con SessionManager / SSE) ──────────────────

    ''' <summary>Sollevato quando un messaggio deve essere mostrato all'utente.</summary>
    Public Event MessageToShow As EventHandler(Of String)

    ''' <summary>Sollevato quando ExecutionState viene aggiornato.</summary>
    Public Event StateUpdated As EventHandler(Of ExecutionState)

    ''' <summary>Sollevato quando il flow è completato (nessun altro TaskGroup eseguibile).</summary>
    Public Event ExecutionCompleted As EventHandler

    ''' <summary>Sollevato quando si verifica un errore fatale.</summary>
    Public Event ExecutionError As EventHandler(Of Exception)

    ''' <summary>Sollevato quando un task richiede input utente (emette taskId).</summary>
    Public Event WaitingForInput As EventHandler(Of String)

    ' ─────────────────────────────────────────────────────────────────────────
    ' Costruttori
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>Costruttore legacy (senza storage, stato solo in memoria).</summary>
    Public Sub New(compiledTasks As List(Of CompiledTask))
        _compiledTasks = compiledTasks
        _compilationResult = Nothing
        _entryTaskGroupId = Nothing
        _executionStateStorage = Nothing
        _sessionId = Nothing
        _projectId = Nothing
        _locale = Nothing
        _resolveTranslation = Nothing
        _variables = New List(Of CompiledVariable)() ' ✅ Empty variables list for legacy constructor
        _compilationByFlowId = Nothing
        _state = New ExecutionState()
    End Sub

    ''' <summary>Costruttore principale (con storage Redis e risoluzione traduzioni).</summary>
    Public Sub New(
        compilationResult As CompiledFlow,
        Optional sessionId As String = Nothing,
        Optional executionStateStorage As Object = Nothing,
        Optional projectId As String = Nothing,
        Optional locale As String = Nothing,
        Optional resolveTranslation As Func(Of String, String) = Nothing
    )
        If compilationResult Is Nothing Then
            Throw New ArgumentNullException(NameOf(compilationResult))
        End If

        If compilationResult.HasErrors Then
            Dim errors = compilationResult.Errors.Where(Function(e) e.Severity = ErrorSeverity.Error).ToList()
            Throw New InvalidOperationException(
                $"Cannot create FlowOrchestrator: {errors.Count} blocking errors. " &
                String.Join("; ", errors.Select(Function(e) e.Message)))
        End If

        _compilationResult = compilationResult
        _compiledTasks = If(compilationResult.Tasks, New List(Of CompiledTask)())
        _entryTaskGroupId = compilationResult.EntryTaskGroupId
        _executionStateStorage = executionStateStorage
        _sessionId = sessionId
        _projectId = projectId
        _locale = locale
        _resolveTranslation = resolveTranslation
        _variables = If(compilationResult.Variables, New List(Of CompiledVariable)()) ' ✅ NEW: Variables with values from compilation
        ' ✅ Initialize values list for each variable
        For Each var In _variables
            If var.Values Is Nothing Then
                var.Values = New List(Of Object)()
            End If
        Next

        ' ✅ NEW: Configure ConditionLoader for edge condition evaluation
        Dim conditionLoader As New FlowConditionLoader(compilationResult)
        ConditionEvaluator.ConditionLoader = conditionLoader
        Console.WriteLine($"[FlowOrchestrator] ✅ ConditionLoader configured with {If(compilationResult.Conditions IsNot Nothing, compilationResult.Conditions.Count, 0)} conditions")
        Console.WriteLine($"[FlowOrchestrator] ✅ Variables loaded: {_variables.Count} entries")

        ' Carica ExecutionState da Redis (o crea nuovo se non esiste)
        _state = LoadOrCreateState()
        _state.EnsureFlowStackMigrated()
        _compilationByFlowId = New Dictionary(Of String, CompiledFlow) From {{"main", _compilationResult}}
    End Sub

    ' ─────────────────────────────────────────────────────────────────────────
    ' API pubblica
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Avvia l'esecuzione del flow. Delega a RunUntilInput.
    ''' Mantenuto per compatibilità con SessionManager.
    ''' </summary>
    ''' <summary>
    ''' Associa un FlowCompilationResult a un flowId (uguale a <see cref="CompiledSubflowTask.FlowId"/>).
    ''' Il ConditionLoader globale resta quello del main; per subflow con condizioni proprie servirà estensione futura.
    ''' </summary>
    Public Sub RegisterSubflowCompilation(flowId As String, result As CompiledFlow)
        If String.IsNullOrEmpty(flowId) Then
            Throw New ArgumentException("flowId is required.", NameOf(flowId))
        End If
        If result Is Nothing Then
            Throw New ArgumentNullException(NameOf(result))
        End If
        If _compilationByFlowId Is Nothing Then
            Throw New InvalidOperationException("RegisterSubflowCompilation is only valid when the orchestrator was constructed with a main FlowCompilationResult.")
        End If
        _compilationByFlowId(flowId) = result
    End Sub

    Public Async Function ExecuteDialogueAsync() As System.Threading.Tasks.Task
        Console.WriteLine($"[FlowOrchestrator] ExecuteDialogueAsync → delegating to RunUntilInput")
        Try
            Await RunUntilInput()
        Catch ex As Exception
            Console.WriteLine($"[FlowOrchestrator] ❌ ExecuteDialogueAsync error: {ex.Message}")
            RaiseEvent ExecutionError(Me, ex)
            Throw
        End Try
    End Function

    ''' <summary>
    ''' Loop stateless principale.
    '''
    ''' Ogni iterazione:
    '''   L1 → trova TaskGroup con ExecCondition = true e non ancora eseguito
    '''   L2 → trova la prima riga eseguibile nel gruppo (relativa a CurrentRowIndex)
    '''   L3 → esegue UN turno della riga (ProcessCurrentTurn)
    '''
    ''' Si ferma quando:
    '''   - RequiresInput = True  (emette WaitingForInput)
    '''   - GetNextTaskGroup = Nothing (emette ExecutionCompleted, salvo CloseSession già fatto)
    ''' </summary>
    Public Async Function RunUntilInput() As System.Threading.Tasks.Task
        Console.WriteLine($"[FlowOrchestrator] RunUntilInput START")
        _state.EnsureFlowStackMigrated()
        Dim navInit = ActiveFlow()
        navInit.RequiresInput = False

        ' ✅ NEW: Initialize VariableStore with all variables (including manual ones)
        ' Manual variables (empty nodeId/taskInstanceId) need to be in VariableStore
        ' even if they haven't been extracted yet (they might be written by BackendCall)
        If navInit.VariableStore Is Nothing Then
            navInit.VariableStore = New Dictionary(Of String, Object)()
        End If
        If _state.VariableStore Is Nothing Then
            _state.VariableStore = navInit.VariableStore
        End If

        ' ✅ Initialize all variables in VariableStore (set to Nothing if not yet extracted)
        ' This ensures manual variables are available for BackendCall inputs/outputs
        For Each var In _variables
            If Not navInit.VariableStore.ContainsKey(var.Id) Then
                ' ✅ Initialize with Nothing (will be set when extracted or written by BackendCall)
                navInit.VariableStore(var.Id) = Nothing
                Dim isManual = String.IsNullOrEmpty(var.TaskInstanceId)
                Console.WriteLine($"[FlowOrchestrator] ✅ Initialized variable in VariableStore: id={var.Id}, isManual={isManual}")
            End If
        Next

        Const MaxIterations As Integer = 500
        Dim iterations As Integer = 0

        Do
            iterations += 1
            If iterations > MaxIterations Then
                Throw New InvalidOperationException(
                    $"[FlowOrchestrator] Max iterations ({MaxIterations}) exceeded — possible infinite loop")
            End If

            _state.EnsureFlowStackMigrated()
            ' Subflow completato: nessun altro TaskGroup nel flow attivo → pop
            While _state.FlowStack IsNot Nothing AndAlso _state.FlowStack.Count > 1 AndAlso Not _state.FlowCompleted
                Dim flowPop = ActiveFlow()
                If flowPop.RequiresInput Then Exit While
                Dim compPop = ActiveCompilation()
                Dim condPop = ConditionStateForFlow(flowPop)
                Dim nextTgPop = GetNextTaskGroupFor(flowPop, compPop, condPop)
                If nextTgPop Is Nothing Then
                    PopFlow()
                    SaveState()
                    RaiseEvent StateUpdated(Me, _state)
                Else
                    Exit While
                End If
            End While

            ' ── L1: Trova TaskGroup eseguibile ───────────────────────────────
            Dim taskGroup = GetNextTaskGroup()
            If taskGroup Is Nothing Then
                ' Flow completato naturalmente (tutti i gruppi eseguiti o non eseguibili)
                If Not _state.FlowCompleted Then
                    Console.WriteLine($"[FlowOrchestrator] ✅ No more TaskGroups — ExecutionCompleted")
                    SaveState()
                    RaiseEvent ExecutionCompleted(Me, Nothing)
                End If
                Exit Do
            End If

            ' ── L2: Trova prima riga eseguibile nel gruppo ───────────────────
            Dim rowTask = GetNextRowTask(taskGroup)
            If rowTask Is Nothing Then
                ' Gruppo completato: tutte le righe eseguite o skippate
                Console.WriteLine($"[FlowOrchestrator] ✅ TaskGroup {taskGroup.NodeId} completed (all rows done)")
                Dim navDone = ActiveFlow()
                navDone.ExecutedTaskGroupIds.Add(taskGroup.NodeId)
                navDone.LastCompletedNodeId = taskGroup.NodeId ' ✅ NEW: Traccia ultimo completato
                navDone.CurrentNodeId = Nothing
                navDone.CurrentRowIndex = 0
                SaveState()
                RaiseEvent StateUpdated(Me, _state)
                ' ✅ GetNextTaskGroup() nella prossima iterazione valuterà gli edge uscenti
                Continue Do
            End If

            ' ── L3: Esegui UN turno della riga ───────────────────────────────
            Dim result = Await ProcessCurrentTurn(rowTask)

            ' Emetti messaggi (TextKey → testo risolto)
            For Each textKey As String In result.Messages
                Dim resolved = ResolveText(textKey)
                Console.WriteLine($"[FlowOrchestrator] 💬 Message: '{resolved}'")
                RaiseEvent MessageToShow(Me, resolved)
            Next

            ' Aggiorna stato in base al risultato del turno
            Select Case result.Status

                Case TurnStatus.WaitingForInput ' ✅ Enum
                    Dim navWait = ActiveFlow()
                    navWait.RequiresInput = True
                    navWait.WaitingTaskId = result.WaitingTaskId
                    Console.WriteLine($"[FlowOrchestrator] ⏸️ WaitingForInput task={result.WaitingTaskId}")

                Case TurnStatus.Completed ' ✅ Enum
                    Dim navComp = ActiveFlow()
                    navComp.CurrentRowIndex += 1
                    navComp.WaitingTaskId = Nothing
                    Console.WriteLine($"[FlowOrchestrator] ✅ Row completed, CurrentRowIndex → {navComp.CurrentRowIndex}")

                Case TurnStatus.AutoAdvance ' ✅ Enum
                    ' Stessa riga, prossima iterazione con PendingUtterance = ""
                    Console.WriteLine($"[FlowOrchestrator] 🔄 AutoAdvance (same row)")

            End Select

            ' Un solo SaveState per iterazione
            SaveState()

        Loop Until ActiveFlow().RequiresInput

        Dim navFinal = ActiveFlow()
        If navFinal.RequiresInput Then
            If String.IsNullOrEmpty(navFinal.WaitingTaskId) Then
                Throw New InvalidOperationException(
                    "[FlowOrchestrator] RequiresInput=True but WaitingTaskId is empty")
            End If
            RaiseEvent WaitingForInput(Me, navFinal.WaitingTaskId)
            Console.WriteLine($"[FlowOrchestrator] ⏸️ WaitingForInput event raised for task {navFinal.WaitingTaskId}")
        End If
    End Function

    ''' <summary>
    ''' Fornisce input utente al task in attesa e riprende il loop.
    ''' </summary>
    Public Async Function ProvideUserInput(
        taskId As String,
        userInput As String,
        Optional resolveTranslation As Func(Of String, String) = Nothing
    ) As System.Threading.Tasks.Task(Of Boolean)

        _state.EnsureFlowStackMigrated()
        Dim nav = ActiveFlow()
        ' Verifica che il task atteso sia quello giusto
        If nav.WaitingTaskId <> taskId Then
            Console.WriteLine($"⚠️ [FlowOrchestrator] Task {taskId} is not waiting (current: {nav.WaitingTaskId})")
            Return False
        End If

        Console.WriteLine($"[FlowOrchestrator] ProvideUserInput task={taskId} input='{userInput}'")

        ' Imposta input e sblocca il loop
        nav.PendingUtterance = userInput
        nav.RequiresInput = False
        nav.WaitingTaskId = Nothing
        SaveState()

        ' Riprende il loop
        Await RunUntilInput()
        Return True
    End Function


    ' ─────────────────────────────────────────────────────────────────────────
    ' L1 — Trova TaskGroup
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Trova il prossimo TaskGroup eseguibile.
    '''
    ''' Priorità (DETERMINISTICA - NO FALLBACK):
    '''   1. Se FlowCompleted → Nothing (flow terminato)
    '''   2. Se esiste CurrentNodeId (task sospeso) → riprendi quel gruppo (solo se non già eseguito)
    '''   3. Se c'è un nodo appena completato → valuta ExecCondition di tutti i taskgroup non eseguiti
    '''   4. Prima esecuzione: entra nell'entry TaskGroup (solo se non già eseguito)
    ''' </summary>
    Private Function GetNextTaskGroup() As TaskGroup
        _state.EnsureFlowStackMigrated()
        If _state.FlowCompleted Then
            Return Nothing
        End If
        Dim flow = ActiveFlow()
        Dim comp = ActiveCompilation()
        Dim condState = ConditionStateForFlow(flow)
        Return GetNextTaskGroupFor(flow, comp, condState)
    End Function

    ''' <summary>
    ''' L1: prossimo TaskGroup per il flow e la compilazione indicati (senza cambiare la logica del main flow a profondità 1).
    ''' </summary>
    Private Function GetNextTaskGroupFor(flow As ExecutionFlow, comp As CompiledFlow, conditionState As ExecutionState) As TaskGroup
        If comp Is Nothing OrElse comp.TaskGroups Is Nothing Then
            Return Nothing
        End If

        ' Flow terminato definitivamente
        If _state.FlowCompleted Then
            Return Nothing
        End If

        ' ✅ FIX: Riprendi gruppo sospeso (RequiresInput precedente) - SOLO se non già eseguito
        If Not String.IsNullOrEmpty(flow.CurrentNodeId) Then
            ' ✅ FIX: Verifica PRIMA se è già eseguito
            If flow.ExecutedTaskGroupIds.Contains(flow.CurrentNodeId) Then
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Suspended TaskGroup {flow.CurrentNodeId} already executed, resetting")
                flow.CurrentNodeId = Nothing
                flow.CurrentRowIndex = 0
            Else
                Dim suspended = comp.TaskGroups.FirstOrDefault(
                    Function(tg) tg.NodeId = flow.CurrentNodeId)

                If suspended IsNot Nothing Then
                    ' ✅ FIX: EvaluateTaskGroupExecCondition controlla già se è eseguito
                    Dim canResume = ConditionEvaluator.EvaluateTaskGroupExecCondition(suspended.ExecCondition, conditionState, suspended.NodeId)
                    If canResume Then
                        Console.WriteLine($"[FlowOrchestrator] ▶️ Resuming suspended TaskGroup {suspended.NodeId}")
                        Return suspended
                    End If
                End If

                ' Gruppo sospeso non più eseguibile: resetta
                flow.CurrentNodeId = Nothing
                flow.CurrentRowIndex = 0
            End If
        End If

        ' ✅ FIX: Se c'è un nodo appena completato, valuta tutte le ExecCondition
        ' La ExecCondition di ogni TaskGroup è già l'OR delle condizioni degli edge entranti
        If Not String.IsNullOrEmpty(flow.LastCompletedNodeId) Then
            Console.WriteLine($"[FlowOrchestrator] 🔍 Evaluating ExecConditions after node {flow.LastCompletedNodeId} completed")

            For Each tg In comp.TaskGroups
                ' ✅ FIX: Skip taskgroup già eseguiti
                If flow.ExecutedTaskGroupIds.Contains(tg.NodeId) Then
                    Console.WriteLine($"[FlowOrchestrator] ⏭️ Skipping TaskGroup {tg.NodeId} (already executed)")
                    Continue For
                End If

                ' ✅ FIX: Valuta ExecCondition (include controllo se già eseguito per entry nodes)
                Dim canEnter = ConditionEvaluator.EvaluateTaskGroupExecCondition(tg.ExecCondition, conditionState, tg.NodeId)

                If canEnter Then
                    Console.WriteLine($"[FlowOrchestrator] ▶️ Entering TaskGroup {tg.NodeId} after node {flow.LastCompletedNodeId} completed")
                    flow.CurrentNodeId = tg.NodeId
                    flow.CurrentRowIndex = 0
                    flow.LastCompletedNodeId = Nothing ' Reset dopo uso
                    Return tg
                End If
            Next

            flow.LastCompletedNodeId = Nothing ' Reset anche se non trovato
            Console.WriteLine($"[FlowOrchestrator] ⚠️ No TaskGroup executable after node completion")
        End If

        ' ✅ FIX: Prima esecuzione: entra nell'entry TaskGroup (solo se non già eseguito)
        Dim entryId = comp.EntryTaskGroupId
        If Not String.IsNullOrEmpty(entryId) Then
            ' ✅ FIX: Verifica PRIMA se è già eseguito
            If flow.ExecutedTaskGroupIds.Contains(entryId) Then
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Entry TaskGroup {entryId} already executed")
            Else
                Dim entry = comp.TaskGroups.FirstOrDefault(
                    Function(tg) tg.NodeId = entryId)
                If entry IsNot Nothing Then
                    ' ✅ FIX: EvaluateTaskGroupExecCondition controlla già se è eseguito per entry nodes
                    Dim canEnter = ConditionEvaluator.EvaluateTaskGroupExecCondition(entry.ExecCondition, conditionState, entry.NodeId)
                    If canEnter Then
                        flow.CurrentNodeId = entry.NodeId
                        flow.CurrentRowIndex = 0
                        Console.WriteLine($"[FlowOrchestrator] ▶️ Entering entry TaskGroup {entry.NodeId}")
                        Return entry
                    End If
                End If
            End If
        End If

        ' ✅ NO FALLBACK: Se nessuna condizione è soddisfatta, il flow è completato
        Console.WriteLine($"[FlowOrchestrator] ✅ No more TaskGroups executable - flow completed")
        Return Nothing
    End Function

    ' ─────────────────────────────────────────────────────────────────────────
    ' L2 — Trova riga eseguibile nel gruppo
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Trova la prima riga eseguibile nel TaskGroup a partire da CurrentRowIndex.
    ''' CurrentRowIndex è 0-based e relativo alla lista taskGroup.Tasks.
    ''' Se la condizione di una riga non è soddisfatta, avanza automaticamente.
    ''' Restituisce Nothing se tutte le righe sono state eseguite o skippate.
    ''' </summary>
    Private Function GetNextRowTask(taskGroup As TaskGroup) As CompiledTask
        _state.EnsureFlowStackMigrated()
        Dim flow = ActiveFlow()
        Dim conditionState = ConditionStateForFlow(flow)
        Return GetNextRowTaskFor(flow, taskGroup, conditionState)
    End Function

    Private Function GetNextRowTaskFor(flow As ExecutionFlow, taskGroup As TaskGroup, conditionState As ExecutionState) As CompiledTask
        Dim i As Integer = flow.CurrentRowIndex
        While i < taskGroup.Tasks.Count
            Dim rowTask = taskGroup.Tasks(i)

            If rowTask.Condition IsNot Nothing Then
                If Not ConditionEvaluator.EvaluateCondition(rowTask.Condition, conditionState) Then
                    Console.WriteLine($"[FlowOrchestrator] ⏭️ Skipping row {i} (condition false)")
                    i += 1
                    flow.CurrentRowIndex = i
                    Continue While
                End If
            End If

            flow.CurrentRowIndex = i
            Return rowTask
        End While

        Return Nothing
    End Function

    ' ─────────────────────────────────────────────────────────────────────────
    ' L3 — Dispatcher per tipo di task
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Dispatcher: esegue UN turno del task corrente e restituisce RowTurnResult.
    ''' Chiama l'handler specifico per tipo di task.
    ''' </summary>
    Private Async Function ProcessCurrentTurn(rowTask As CompiledTask) As System.Threading.Tasks.Task(Of RowTurnResult)
        Select Case rowTask.TaskType

            Case TaskTypes.UtteranceInterpretation
                Return ProcessUtteranceTurn(DirectCast(rowTask, CompiledUtteranceTask))

            Case TaskTypes.AIAgent
                Return Await ProcessAIAgentTurn(DirectCast(rowTask, CompiledAIAgentTask))

            Case TaskTypes.SayMessage
                Return ProcessSayMessageTurn(DirectCast(rowTask, CompiledSayMessageTask))

            Case TaskTypes.BackendCall
                Return Await ProcessBackendTurn(rowTask)

            Case TaskTypes.Transfer
                Console.WriteLine($"[FlowOrchestrator] Transfer task {rowTask.Id} — auto-complete")
                Return RowTurnResult.Completed()

            Case TaskTypes.CloseSession
                Return ProcessCloseSessionTurn()

            Case TaskTypes.Subflow
                Return ProcessSubflowTurn(DirectCast(rowTask, CompiledSubflowTask))

            Case Else
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Unknown task type {rowTask.TaskType} — skipping")
                Return RowTurnResult.Completed()

        End Select
    End Function

    ''' <summary>
    ''' Handler per UtteranceInterpretation.
    ''' Chiama ProcessTurn UNA SOLA VOLTA (primitiva pura stateless).
    ''' Il loop RunUntilInput gestisce le iterazioni successive.
    ''' </summary>
    Private Function ProcessUtteranceTurn(rowTask As CompiledUtteranceTask) As RowTurnResult
        Dim flow = ActiveFlow()
        If flow.DialogueContexts Is Nothing Then
            flow.DialogueContexts = New Dictionary(Of String, String)()
        End If

        ' Carica o crea DialogueState per questa riga
        Dim dialogueState = LoadDialogueState(rowTask)

        ' Consuma PendingUtterance (input utente o stringa vuota per auto-advance)
        Dim utterance As String = flow.PendingUtterance
        flow.PendingUtterance = ""

        Console.WriteLine($"[FlowOrchestrator] ProcessUtteranceTurn task={rowTask.Id} utterance='{utterance}'")

        Dim staticCluster = GetStaticClusterForMixedInitiative()
        Dim result = TaskUtteranceStepExecutor.ProcessTurn(dialogueState, utterance, staticCluster, rowTask)

        ' Salva DialogueState aggiornato in ExecutionState.
        ' ✅ TypeNameHandling.Auto preserva CurrentTask/RootTask come CompiledUtteranceTask
        '    attraverso il roundtrip Redis, necessario per la corretta navigazione dei subtask.
        Dim updatedCtx = JsonConvert.SerializeObject(
            New With {.TaskId = rowTask.Id, .DialogueState = result.NewState},
            _dialogueStateSettings)
        flow.DialogueContexts(rowTask.Id) = updatedCtx

        ' Mixed-initiative: slot di altri task utterance nello stesso cluster → VariableStore condiviso
        ' così la riga successiva vede gli slot già riempiti e non riparte da zero.
        SyncDialogueSlotValuesToFlowStore(flow, result.NewState)

        ' Mappa DialogueTurnResult → RowTurnResult
        If result.NewState.IsCompleted Then
            If result.NewState.VariablesBySlotGuid IsNot Nothing AndAlso result.NewState.VariablesBySlotGuid.Count > 0 Then
                CommitDialogueVariablesToHistory(result.NewState)
            End If
            flow.DialogueContexts.Remove(rowTask.Id)
            Return RowTurnResult.Completed(result.Messages)
        End If

        If result.NewState.Mode = DialogueMode.WaitingForUtterance Then
            ' Task in attesa di input utente
            Return RowTurnResult.WaitingForInput(rowTask.Id, result.Messages)
        End If

        ' Stato intermedio (es. dopo un Match, prima della Confirmation)
        ' RunUntilInput itera di nuovo sulla stessa riga con PendingUtterance = ""
        Return RowTurnResult.AutoAdvance(result.Messages)
    End Function

    ''' <summary>
    ''' Handler per AI Agent: delega a <see cref="TaskExecutor.ExecuteTask"/> → <see cref="AIAgentTaskExecutor.Execute"/>
    ''' (dispatch LLM vs ElevenLabs già nell&apos;executor). Messaggi assistente raccolti dal callback <c>AIAgent</c>.
    ''' </summary>
    Private Async Function ProcessAIAgentTurn(rowTask As CompiledAIAgentTask) As System.Threading.Tasks.Task(Of RowTurnResult)
        Dim nav = ActiveFlow()
        Dim utterance = nav.PendingUtterance
        nav.PendingUtterance = ""

        Dim emittedMessages As New List(Of String)()
        Dim execState = RuntimeStateForActiveFlow()

        Dim result = Await TaskExecutor.ExecuteTask(
            rowTask,
            execState,
            Sub(text As String, stepType As String, escalationNumber As Integer)
                If String.Equals(stepType, "AIAgent", StringComparison.OrdinalIgnoreCase) AndAlso Not String.IsNullOrWhiteSpace(text) Then
                    emittedMessages.Add(text)
                End If
            End Sub,
            utterance
        ).ConfigureAwait(False)

        If Not result.Success Then
            Dim errMsg = If(String.IsNullOrEmpty(result.Err), "Unknown error", result.Err)
            ' ConvAI/startAgent: eccezione strutturata → ExecutionError SSE con payload ricco (non solo testo bubble).
            If Not String.IsNullOrWhiteSpace(result.ErrDetailJson) Then
                Throw RuntimeConvaiException.FromJsonDetail(errMsg, result.ErrDetailJson)
            End If
            Return RowTurnResult.Completed(New List(Of String) From { errMsg })
        End If

        If result.IsCompleted Then
            Return RowTurnResult.Completed(emittedMessages)
        End If

        Return RowTurnResult.WaitingForInput(rowTask.Id, emittedMessages)
    End Function

    ''' <summary>
    ''' Handler per SayMessage: emette il messaggio e completa subito.
    ''' </summary>
    Private Function ProcessSayMessageTurn(rowTask As CompiledSayMessageTask) As RowTurnResult
        If String.IsNullOrEmpty(rowTask.TextKey) Then
            Return RowTurnResult.Completed()
        End If
        Return RowTurnResult.Completed(New List(Of String) From {rowTask.TextKey})
    End Function

    ''' <summary>
    ''' Handler per BackendCall: esegue il task tramite TaskExecutor (che esegue la mockTable).
    ''' BackendCallTaskExecutor esegue la mockTable:
    '''   - Legge input dal VariableStore
    '''   - Cerca nella mockTable la riga matchante
    '''   - Scrive output nel VariableStore
    ''' </summary>
    Private Async Function ProcessBackendTurn(rowTask As CompiledTask) As System.Threading.Tasks.Task(Of RowTurnResult)
        Console.WriteLine($"[FlowOrchestrator] ProcessBackendTurn task={rowTask.Id}")

        ' ✅ Chiama TaskExecutor.ExecuteTask che:
        '    1. Identifica BackendCallTaskExecutor
        '    2. Esegue BackendCallTaskExecutor.Execute
        '    3. BackendCallTaskExecutor.Execute esegue la mockTable:
        '       - Legge input dal VariableStore
        '       - Cerca nella mockTable la riga matchante
        '       - Scrive output nel VariableStore
        Dim result = Await TaskExecutor.ExecuteTask(
            rowTask,
            RuntimeStateForActiveFlow(),
            Sub(text, stepType, escalationNumber)
                ' Callback per messaggi (BackendCall non emette messaggi, ma callback richiesto)
                Console.WriteLine($"[FlowOrchestrator] BackendCall message: {text}")
            End Sub
        )

        ' ✅ Gestisci errori
        If Not result.Success Then
            Dim errorMsg = If(String.IsNullOrEmpty(result.Err), "Unknown error", result.Err)
            Console.WriteLine($"[FlowOrchestrator] ❌ BackendCall failed: {errorMsg}")
            ' ✅ In caso di errore, completa comunque il turno (non blocca il flow)
        End If

        ' ✅ Completa il turno (BackendCall non emette messaggi, solo aggiorna VariableStore)
        Return RowTurnResult.Completed()
    End Function

    ''' <summary>
    ''' Handler per CloseSession: termina definitivamente il flow.
    ''' </summary>
    Private Function ProcessCloseSessionTurn() As RowTurnResult
        Console.WriteLine($"[FlowOrchestrator] CloseSession — setting FlowCompleted=True")
        _state.FlowCompleted = True
        SaveState()
        RaiseEvent ExecutionCompleted(Me, Nothing)
        Return RowTurnResult.Completed()
    End Function

    ' ─────────────────────────────────────────────────────────────────────────
    ' Helper privati
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>Cluster statico MI: main + subflow, dedup per Id, ordine di merge.</summary>
    Private Function GetStaticClusterForMixedInitiative() As List(Of CompiledUtteranceTask)
        If _compilationResult Is Nothing Then
            If _compiledTasks Is Nothing Then Return New List(Of CompiledUtteranceTask)()
            Return _compiledTasks.OfType(Of CompiledUtteranceTask).ToList()
        End If
        Return MixedInitiativeCluster.GetStaticCluster(_compilationResult, _compilationByFlowId)
    End Function

    ''' <summary>
    ''' Carica DialogueState dal contesto serializzato in ExecutionState,
    ''' oppure crea un nuovo stato iniziale per la prima esecuzione del task.
    ''' Dopo il caricamento, applica i valori già noti nel VariableStore del flow (es. riempiti
    ''' da mixed-initiative mentre era attivo un altro task utterance) così il task non viene
    ''' rieseguito come se gli slot fossero vuoti.
    ''' </summary>
    Private Function LoadDialogueState(task As CompiledUtteranceTask) As DialogueState
        Dim nav = ActiveFlow()
        If nav.DialogueContexts Is Nothing Then
            nav.DialogueContexts = New Dictionary(Of String, String)()
        End If

        Dim ds As DialogueState = Nothing
        If nav.DialogueContexts.ContainsKey(task.Id) Then
            Try
                ' ✅ Deserializza con TypeNameHandling.Auto + ITaskConverter per ripristinare
                '    CurrentTask/RootTask come CompiledUtteranceTask (sono Object in DialogueState).
                '    Senza TypeNameHandling.Auto, CurrentTask sarebbe sempre Nothing dopo il
                '    roundtrip Redis, con conseguente reset errato al task radice.
                Dim obj = JsonConvert.DeserializeObject(Of JObject)(nav.DialogueContexts(task.Id))
                If obj?("DialogueState") IsNot Nothing Then
                    ds = obj("DialogueState").ToObject(Of DialogueState)(
                        JsonSerializer.CreateDefault(_dialogueStateSettings))
                    If ds IsNot Nothing Then
                        ' Fallback solo se il contesto era stato scritto senza TypeNameHandling
                        ' (es. dati legacy o prima iterazione)
                        If ds.CurrentTask Is Nothing Then ds.CurrentTask = task
                        If ds.RootTask Is Nothing Then ds.RootTask = task
                        Console.WriteLine($"[FlowOrchestrator] ✅ Loaded DialogueState for task {task.Id}, Mode={ds.Mode}")
                    End If
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to load DialogueState for {task.Id}: {ex.Message}")
            End Try
        End If

        If ds Is Nothing Then
            ' Prima esecuzione: crea nuovo DialogueState
            Console.WriteLine($"[FlowOrchestrator] 🆕 Creating new DialogueState for task {task.Id}")
            ds = New DialogueState() With {
                .CurrentTask = task,
                .RootTask = task,
                .CurrentStepType = DialogueStepType.Start,
                .Mode = DialogueMode.ExecutingStep
            }
        End If

        ApplyFlowStoreSlotsToDialogueState(task, ds, nav)
        Return ds
    End Function

    ''' <summary>
    ''' Raccoglie i GUID slot foglia (subtask atomici) per un albero utterance.
    ''' </summary>
    Private Shared Sub CollectLeafSlotGuids(task As CompiledUtteranceTask, into As HashSet(Of String))
        If task Is Nothing OrElse into Is Nothing Then Return
        If task.HasSubTasks() Then
            For Each st In task.SubTasks
                CollectLeafSlotGuids(st, into)
            Next
        Else
            Dim g = task.GetPrimarySlotCanonicalGuid()
            If Not String.IsNullOrEmpty(g) Then into.Add(g)
        End If
    End Sub

    ''' <summary>
    ''' Copia nel DialogueState i valori già presenti nel VariableStore per gli slot di questo task
    ''' (mixed-initiative può aver riempito altri task nello stesso turno; lo store è la fonte condivisa).
    ''' </summary>
    Private Sub ApplyFlowStoreSlotsToDialogueState(task As CompiledUtteranceTask, ds As DialogueState, flow As ExecutionFlow)
        If ds Is Nothing OrElse flow Is Nothing Then Return
        If flow.VariableStore Is Nothing OrElse flow.VariableStore.Count = 0 Then Return

        Dim guids As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        CollectLeafSlotGuids(task, guids)
        If guids.Count = 0 Then Return

        For Each g In guids
            Dim v As Object = Nothing
            If flow.VariableStore.TryGetValue(g, v) AndAlso SlotValueIsPresentForFlowMerge(v) Then
                ds.SetVariable(g, v)
                Console.WriteLine($"[FlowOrchestrator] 🔗 MI/session: pre-filled slot {g} for task {task.Id} from VariableStore")
            End If
        Next
    End Sub

    Private Shared Function SlotValueIsPresentForFlowMerge(v As Object) As Boolean
        If v Is Nothing Then Return False
        Dim s = TryCast(v, String)
        If s IsNot Nothing Then Return Not String.IsNullOrWhiteSpace(s)
        Return True
    End Function

    ''' <summary>
    ''' Scrive tutti gli slot del DialogueState nel VariableStore del flow dopo ogni turno,
    ''' così i valori estratti con mixed-initiative restano disponibili per le righe utterance successive.
    ''' Non aggiorna la cronologia Values (quella avviene al completamento task).
    ''' </summary>
    Private Sub SyncDialogueSlotValuesToFlowStore(flow As ExecutionFlow, ds As DialogueState)
        If ds Is Nothing OrElse ds.VariablesBySlotGuid Is Nothing OrElse ds.VariablesBySlotGuid.Count = 0 Then Return
        If flow.VariableStore Is Nothing Then
            flow.VariableStore = New Dictionary(Of String, Object)()
        End If

        For Each kvp In ds.VariablesBySlotGuid
            Dim slotGuid = kvp.Key
            If String.IsNullOrEmpty(slotGuid) Then Continue For
            flow.VariableStore(slotGuid) = kvp.Value
        Next
    End Sub

    ''' <summary>Aggiorna la cronologia variabili (CompiledVariable.Values) quando un task utterance termina.</summary>
    Private Sub CommitDialogueVariablesToHistory(ds As DialogueState)
        If ds Is Nothing OrElse ds.VariablesBySlotGuid Is Nothing OrElse ds.VariablesBySlotGuid.Count = 0 Then Return
        Dim flow = ActiveFlow()
        If flow.VariableStore Is Nothing Then
            flow.VariableStore = New Dictionary(Of String, Object)()
        End If

        For Each kvp In ds.VariablesBySlotGuid
            Dim slotGuid = kvp.Key
            Dim var = TryResolveCompiledVariableForSlot(slotGuid)

            If var IsNot Nothing Then
                var.Values.Add(kvp.Value)
                flow.VariableStore(var.Id) = kvp.Value
                Console.WriteLine($"[FlowOrchestrator] ✅ Updated: id={var.Id}, slotGuid={slotGuid}, value={kvp.Value}, historyCount={var.Values.Count}")
            Else
                Dim errorMsg = $"Variable not found for slotGuid={slotGuid}. The slot was filled but not registered during compilation."
                Console.WriteLine($"[FlowOrchestrator] ❌ {errorMsg}")
                Throw New InvalidOperationException(errorMsg)
            End If
        Next
    End Sub

    ''' <summary>
    ''' Risolve un TextKey (GUID) nel testo tradotto.
    ''' Poi applica la risoluzione placeholder [token] usando il VariableStore runtime.
    ''' Se non c'è un resolver o la chiave è vuota, restituisce la chiave stessa.
    ''' </summary>
    Private Function ResolveText(textKey As String) As String
        If String.IsNullOrEmpty(textKey) Then Return textKey
        If _resolveTranslation Is Nothing Then Return textKey
        Dim translated = _resolveTranslation(textKey)
        Dim baseText = If(String.IsNullOrEmpty(translated), textKey, translated)

        Return PlaceholderUtils.ProcessPlaceholdersWithResolver(
            baseText,
            Function(token As String) ResolveRuntimePlaceholder(token),
            $"flow session '{If(_sessionId, "unknown")}', textKey '{textKey}'"
        )
    End Function

    ''' <summary>
    ''' Resolves a placeholder token against active flow runtime variables.
    ''' Supports exact lookup and case-insensitive fallback for robustness.
    ''' </summary>
    Private Function ResolveRuntimePlaceholder(token As String) As String
        Dim flow = ActiveFlow()
        If flow Is Nothing OrElse flow.VariableStore Is Nothing Then
            Return Nothing
        End If
        Return PlaceholderUtils.ResolveTokenFromVariableStore(token, flow.VariableStore)
    End Function

    ''' <summary>
    ''' Carica ExecutionState da Redis oppure crea un nuovo stato pulito.
    ''' </summary>
    Private Function LoadOrCreateState() As ExecutionState
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                Dim method = _executionStateStorage.GetType().GetMethod("GetExecutionState")
                If method IsNot Nothing Then
                    Dim loaded = DirectCast(method.Invoke(_executionStateStorage, {_sessionId}), ExecutionState)
                    If loaded IsNot Nothing Then
                        Console.WriteLine($"[FlowOrchestrator] ✅ Loaded ExecutionState from Redis for session {_sessionId}")
                        Return loaded
                    End If
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to load ExecutionState: {ex.Message}, using new state")
            End Try
        End If
        Return New ExecutionState()
    End Function

    ''' <summary>
    ''' Persiste ExecutionState su Redis.
    ''' </summary>
    Private Sub SaveState()
        _state.EnsureFlowStackMigrated()
        _state.SyncRootNavigationFromMainFlow()
        _state.SyncRootOverlayFromActiveFlow()
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                Dim method = _executionStateStorage.GetType().GetMethod("SaveExecutionState")
                If method IsNot Nothing Then
                    method.Invoke(_executionStateStorage, {_sessionId, _state})
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to save ExecutionState: {ex.Message}")
            End Try
        End If
    End Sub

    ''' <summary>Flow in cima allo stack (main o subflow attivo).</summary>
    Private Function ActiveFlow() As ExecutionFlow
        _state.EnsureFlowStackMigrated()
        If _state.FlowStack Is Nothing OrElse _state.FlowStack.Count = 0 Then
            Throw New InvalidOperationException("FlowStack is empty after EnsureFlowStackMigrated.")
        End If
        Return _state.FlowStack(_state.FlowStack.Count - 1)
    End Function

    ''' <summary>Compilazione del flow attivo (main o subflow registrato).</summary>
    Private Function ActiveCompilation() As CompiledFlow
        If _compilationResult Is Nothing Then
            Return Nothing
        End If
        If _compilationByFlowId Is Nothing Then
            Return _compilationResult
        End If
        Dim flow = ActiveFlow()
        Dim id = If(String.IsNullOrEmpty(flow.FlowId), "main", flow.FlowId)
        If _compilationByFlowId.ContainsKey(id) Then
            Return _compilationByFlowId(id)
        End If
        If id = "main" Then
            Return _compilationResult
        End If
        Throw New InvalidOperationException($"No compilation registered for flow '{id}'.")
    End Function

    ''' <summary>
    ''' Risolve <see cref="CompiledVariable"/> per uno slot GUID: prima nel <see cref="CompiledFlow"/> attivo
    ''' (main o subflow in cima allo stack), poi nella lista del costruttore (main). Necessario perché
    ''' <c>_variables</c> è popolato solo dal main <see cref="CompiledFlow"/> mentre i turni in subflow
    ''' riempiono slot definiti nella compilazione del subflow.
    ''' </summary>
    Private Function TryResolveCompiledVariableForSlot(slotGuid As String) As CompiledVariable
        If String.IsNullOrEmpty(slotGuid) Then Return Nothing
        Dim ac = ActiveCompilation()
        If ac IsNot Nothing AndAlso ac.Variables IsNot Nothing Then
            Dim fromActive = ac.Variables.FirstOrDefault(
                Function(x) x IsNot Nothing AndAlso String.Equals(x.Id, slotGuid, StringComparison.OrdinalIgnoreCase))
            If fromActive IsNot Nothing Then Return fromActive
        End If
        If _variables Is Nothing Then Return Nothing
        Return _variables.FirstOrDefault(
            Function(x) x IsNot Nothing AndAlso String.Equals(x.Id, slotGuid, StringComparison.OrdinalIgnoreCase))
    End Function

    Private Function ConditionStateForFlow(flow As ExecutionFlow) As ExecutionState
        Dim s As New ExecutionState()
        s.ExecutedTaskGroupIds = flow.ExecutedTaskGroupIds
        s.ExecutedTaskIds = flow.ExecutedTaskIds
        s.VariableStore = flow.VariableStore
        s.FlowCompleted = _state.FlowCompleted
        Return s
    End Function

    ''' <summary>Stato sessione con riferimenti al flow attivo (per TaskExecutor / condizioni di riga).</summary>
    Private Function RuntimeStateForActiveFlow() As ExecutionState
        _state.EnsureFlowStackMigrated()
        Dim f = ActiveFlow()
        Dim s As New ExecutionState()
        s.VariableStore = f.VariableStore
        s.DialogueContexts = f.DialogueContexts
        s.RetrievalState = f.RetrievalState
        s.ExecutedTaskIds = f.ExecutedTaskIds
        s.ExecutedTaskGroupIds = f.ExecutedTaskGroupIds
        s.FlowCompleted = _state.FlowCompleted
        s.RequiresInput = f.RequiresInput
        s.PendingUtterance = f.PendingUtterance
        s.WaitingTaskId = f.WaitingTaskId
        s.CurrentNodeId = f.CurrentNodeId
        s.CurrentRowIndex = f.CurrentRowIndex
        s.LastCompletedNodeId = f.LastCompletedNodeId
        Return s
    End Function

    Private Sub PushFlow(task As CompiledSubflowTask)
        _state.EnsureFlowStackMigrated()
        Dim parent = ActiveFlow()
        Dim child As New ExecutionFlow With {
            .FlowId = task.FlowId,
            .CurrentNodeId = Nothing,
            .CurrentRowIndex = 0,
            .LastCompletedNodeId = Nothing,
            .ExecutedTaskGroupIds = New HashSet(Of String)(),
            .ExecutedTaskIds = New HashSet(Of String)(),
            .VariableStore = New Dictionary(Of String, Object)(),
            .RetrievalState = "empty",
            .DialogueContexts = New Dictionary(Of String, String)(),
            .RequiresInput = False,
            .PendingUtterance = "",
            .WaitingTaskId = Nothing,
            .SubflowBindings = If(task.SubflowBindings, New List(Of SubflowBinding)())
        }
        If _compilationByFlowId IsNot Nothing AndAlso _compilationByFlowId.ContainsKey(task.FlowId) Then
            Dim subComp = _compilationByFlowId(task.FlowId)
            If subComp.Variables IsNot Nothing Then
                For Each v In subComp.Variables
                    If Not child.VariableStore.ContainsKey(v.Id) Then
                        child.VariableStore(v.Id) = Nothing
                    End If
                Next
            End If
        End If
        SubflowTaskExecutor.ApplyPushBindings(parent.VariableStore, child.VariableStore, task.SubflowBindings)
        _state.FlowStack.Add(child)
    End Sub

    Private Sub PopFlow()
        If _state.FlowStack Is Nothing OrElse _state.FlowStack.Count < 2 Then
            Return
        End If
        Dim child = _state.FlowStack(_state.FlowStack.Count - 1)
        Dim parent = _state.FlowStack(_state.FlowStack.Count - 2)
        If child.SubflowBindings IsNot Nothing AndAlso child.SubflowBindings.Count > 0 Then
            SubflowTaskExecutor.ApplyPopBindings(child.VariableStore, parent.VariableStore, child.SubflowBindings)
        End If
        _state.FlowStack.RemoveAt(_state.FlowStack.Count - 1)
        ' La riga Subflow sul parent resta "in corso" fino al pop: ora avanza alla riga successiva.
        parent.CurrentRowIndex += 1
    End Sub

    ''' <summary>Un turno: PushFlow; AutoAdvance così la riga parent non viene incrementata finché il subflow non termina (PopFlow).</summary>
    Private Function ProcessSubflowTurn(rowTask As CompiledSubflowTask) As RowTurnResult
        If String.IsNullOrEmpty(rowTask.FlowId) Then
            Throw New InvalidOperationException("CompiledSubflowTask.FlowId is required.")
        End If
        If _compilationByFlowId Is Nothing OrElse Not _compilationByFlowId.ContainsKey(rowTask.FlowId) Then
            Throw New InvalidOperationException(
                $"Subflow compilation not registered for flowId '{rowTask.FlowId}'.")
        End If
        PushFlow(rowTask)
        Return RowTurnResult.AutoAdvance()
    End Function

End Class
