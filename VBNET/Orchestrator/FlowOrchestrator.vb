Option Strict On
Option Explicit On
Imports Compiler
Imports DTO.Runtime
Imports TaskEngine
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports System.Linq
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
    Private ReadOnly _compilationResult As FlowCompilationResult
    Private ReadOnly _entryTaskGroupId As String
    Private ReadOnly _executionStateStorage As Object
    Private ReadOnly _sessionId As String
    Private ReadOnly _projectId As String
    Private ReadOnly _locale As String
    Private ReadOnly _resolveTranslation As Func(Of String, String)
    Private ReadOnly _variables As List(Of CompiledVariable) ' ✅ NEW: Variables with values for runtime

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
        _state = New ExecutionState()
    End Sub

    ''' <summary>Costruttore principale (con storage Redis e risoluzione traduzioni).</summary>
    Public Sub New(
        compilationResult As FlowCompilationResult,
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
    End Sub

    ' ─────────────────────────────────────────────────────────────────────────
    ' API pubblica
    ' ─────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Avvia l'esecuzione del flow. Delega a RunUntilInput.
    ''' Mantenuto per compatibilità con SessionManager.
    ''' </summary>
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
        _state.RequiresInput = False

        Const MaxIterations As Integer = 500
        Dim iterations As Integer = 0

        Do
            iterations += 1
            If iterations > MaxIterations Then
                Throw New InvalidOperationException(
                    $"[FlowOrchestrator] Max iterations ({MaxIterations}) exceeded — possible infinite loop")
            End If

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
                _state.ExecutedTaskGroupIds.Add(taskGroup.NodeId)
                _state.LastCompletedNodeId = taskGroup.NodeId ' ✅ NEW: Traccia ultimo completato
                _state.CurrentNodeId = Nothing
                _state.CurrentRowIndex = 0
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
                    _state.RequiresInput = True
                    _state.WaitingTaskId = result.WaitingTaskId
                    Console.WriteLine($"[FlowOrchestrator] ⏸️ WaitingForInput task={result.WaitingTaskId}")

                Case TurnStatus.Completed ' ✅ Enum
                    _state.CurrentRowIndex += 1
                    _state.WaitingTaskId = Nothing
                    Console.WriteLine($"[FlowOrchestrator] ✅ Row completed, CurrentRowIndex → {_state.CurrentRowIndex}")

                Case TurnStatus.AutoAdvance ' ✅ Enum
                    ' Stessa riga, prossima iterazione con PendingUtterance = ""
                    Console.WriteLine($"[FlowOrchestrator] 🔄 AutoAdvance (same row)")

            End Select

            ' Un solo SaveState per iterazione
            SaveState()

        Loop Until _state.RequiresInput

        If _state.RequiresInput Then
            If String.IsNullOrEmpty(_state.WaitingTaskId) Then
                Throw New InvalidOperationException(
                    "[FlowOrchestrator] RequiresInput=True but WaitingTaskId is empty")
            End If
            RaiseEvent WaitingForInput(Me, _state.WaitingTaskId)
            Console.WriteLine($"[FlowOrchestrator] ⏸️ WaitingForInput event raised for task {_state.WaitingTaskId}")
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

        ' Verifica che il task atteso sia quello giusto
        If _state.WaitingTaskId <> taskId Then
            Console.WriteLine($"⚠️ [FlowOrchestrator] Task {taskId} is not waiting (current: {_state.WaitingTaskId})")
            Return False
        End If

        Console.WriteLine($"[FlowOrchestrator] ProvideUserInput task={taskId} input='{userInput}'")

        ' Imposta input e sblocca il loop
        _state.PendingUtterance = userInput
        _state.RequiresInput = False
        _state.WaitingTaskId = Nothing
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
        If _compilationResult Is Nothing OrElse _compilationResult.TaskGroups Is Nothing Then
            Return Nothing
        End If

        ' Flow terminato definitivamente
        If _state.FlowCompleted Then
            Return Nothing
        End If

        ' ✅ FIX: Riprendi gruppo sospeso (RequiresInput precedente) - SOLO se non già eseguito
        If Not String.IsNullOrEmpty(_state.CurrentNodeId) Then
            ' ✅ FIX: Verifica PRIMA se è già eseguito
            If _state.ExecutedTaskGroupIds.Contains(_state.CurrentNodeId) Then
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Suspended TaskGroup {_state.CurrentNodeId} already executed, resetting")
                _state.CurrentNodeId = Nothing
                _state.CurrentRowIndex = 0
            Else
                Dim suspended = _compilationResult.TaskGroups.FirstOrDefault(
                    Function(tg) tg.NodeId = _state.CurrentNodeId)

                If suspended IsNot Nothing Then
                    ' ✅ FIX: EvaluateTaskGroupExecCondition controlla già se è eseguito
                    Dim canResume = ConditionEvaluator.EvaluateTaskGroupExecCondition(suspended.ExecCondition, _state, suspended.NodeId)
                    If canResume Then
                        Console.WriteLine($"[FlowOrchestrator] ▶️ Resuming suspended TaskGroup {suspended.NodeId}")
                        Return suspended
                    End If
                End If

                ' Gruppo sospeso non più eseguibile: resetta
                _state.CurrentNodeId = Nothing
                _state.CurrentRowIndex = 0
            End If
        End If

        ' ✅ FIX: Se c'è un nodo appena completato, valuta tutte le ExecCondition
        ' La ExecCondition di ogni TaskGroup è già l'OR delle condizioni degli edge entranti
        If Not String.IsNullOrEmpty(_state.LastCompletedNodeId) Then
            Console.WriteLine($"[FlowOrchestrator] 🔍 Evaluating ExecConditions after node {_state.LastCompletedNodeId} completed")

            For Each tg In _compilationResult.TaskGroups
                ' ✅ FIX: Skip taskgroup già eseguiti
                If _state.ExecutedTaskGroupIds.Contains(tg.NodeId) Then
                    Console.WriteLine($"[FlowOrchestrator] ⏭️ Skipping TaskGroup {tg.NodeId} (already executed)")
                    Continue For
                End If

                ' ✅ FIX: Valuta ExecCondition (include controllo se già eseguito per entry nodes)
                Dim canEnter = ConditionEvaluator.EvaluateTaskGroupExecCondition(tg.ExecCondition, _state, tg.NodeId)

                If canEnter Then
                    Console.WriteLine($"[FlowOrchestrator] ▶️ Entering TaskGroup {tg.NodeId} after node {_state.LastCompletedNodeId} completed")
                    _state.CurrentNodeId = tg.NodeId
                    _state.CurrentRowIndex = 0
                    _state.LastCompletedNodeId = Nothing ' Reset dopo uso
                    Return tg
                End If
            Next

            _state.LastCompletedNodeId = Nothing ' Reset anche se non trovato
            Console.WriteLine($"[FlowOrchestrator] ⚠️ No TaskGroup executable after node completion")
        End If

        ' ✅ FIX: Prima esecuzione: entra nell'entry TaskGroup (solo se non già eseguito)
        If Not String.IsNullOrEmpty(_entryTaskGroupId) Then
            ' ✅ FIX: Verifica PRIMA se è già eseguito
            If _state.ExecutedTaskGroupIds.Contains(_entryTaskGroupId) Then
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Entry TaskGroup {_entryTaskGroupId} already executed")
            Else
                Dim entry = _compilationResult.TaskGroups.FirstOrDefault(
                    Function(tg) tg.NodeId = _entryTaskGroupId)
                If entry IsNot Nothing Then
                    ' ✅ FIX: EvaluateTaskGroupExecCondition controlla già se è eseguito per entry nodes
                    Dim canEnter = ConditionEvaluator.EvaluateTaskGroupExecCondition(entry.ExecCondition, _state, entry.NodeId)
                    If canEnter Then
                        _state.CurrentNodeId = entry.NodeId
                        _state.CurrentRowIndex = 0
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
        Dim i As Integer = _state.CurrentRowIndex
        While i < taskGroup.Tasks.Count
            Dim rowTask = taskGroup.Tasks(i)

            If rowTask.Condition IsNot Nothing Then
                If Not ConditionEvaluator.EvaluateCondition(rowTask.Condition, _state) Then
                    Console.WriteLine($"[FlowOrchestrator] ⏭️ Skipping row {i} (condition false)")
                    i += 1
                    _state.CurrentRowIndex = i
                    Continue While
                End If
            End If

            _state.CurrentRowIndex = i
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

            Case TaskTypes.SayMessage
                Return ProcessSayMessageTurn(DirectCast(rowTask, CompiledSayMessageTask))

            Case TaskTypes.BackendCall
                Return Await ProcessBackendTurn(rowTask)

            Case TaskTypes.Transfer
                Console.WriteLine($"[FlowOrchestrator] Transfer task {rowTask.Id} — auto-complete")
                Return RowTurnResult.Completed()

            Case TaskTypes.CloseSession
                Return ProcessCloseSessionTurn()

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
        ' Carica o crea DialogueState per questa riga
        Dim ds = LoadDialogueState(rowTask)

        ' Consuma PendingUtterance (input utente o stringa vuota per auto-advance)
        Dim utterance As String = _state.PendingUtterance
        _state.PendingUtterance = ""

        Console.WriteLine($"[FlowOrchestrator] ProcessUtteranceTurn task={rowTask.Id} utterance='{utterance}'")

        ' UNA SOLA chiamata a ProcessTurn (primitiva pura)
        Dim result = TaskUtteranceStepExecutor.ProcessTurn(ds, utterance)

        ' Salva DialogueState aggiornato in ExecutionState.
        ' ✅ TypeNameHandling.Auto preserva CurrentTask/RootTask come CompiledUtteranceTask
        '    attraverso il roundtrip Redis, necessario per la corretta navigazione dei subtask.
        Dim updatedCtx = JsonConvert.SerializeObject(
            New With {.TaskId = rowTask.Id, .DialogueState = result.NewState},
            _dialogueStateSettings)
        _state.DialogueContexts(rowTask.Id) = updatedCtx

        ' Mappa DialogueTurnResult → RowTurnResult
        If result.NewState.IsCompleted Then
            ' ✅ NEW: Usa ExtractedVariables (triple esplicite) invece di Memory
            '    Le triple contengono (taskInstanceId, nodeId, value) - nessuna assunzione necessaria.
            If result.NewState.ExtractedVariables IsNot Nothing AndAlso result.NewState.ExtractedVariables.Count > 0 Then
                If _state.VariableStore Is Nothing Then
                    _state.VariableStore = New Dictionary(Of String, Object)()
                End If

                For Each extractedVar In result.NewState.ExtractedVariables
                    ' ✅ Lookup diretto con dati espliciti (taskInstanceId, nodeId) → varId
                    Dim var = _variables.SingleOrDefault(
                        Function(v) v.TaskInstanceId = extractedVar.TaskInstanceId AndAlso
                                   v.NodeId = extractedVar.NodeId
                    )

                    If var IsNot Nothing Then
                        ' ✅ Aggiorna storico runtime
                        var.Values.Add(extractedVar.Value)

                        ' ✅ Aggiorna VariableStore per DSLInterpreter (valore corrente)
                        '    DSLInterpreter usa varId come chiave (non nodeId)
                        _state.VariableStore(var.VarId) = extractedVar.Value
                        Console.WriteLine($"[FlowOrchestrator] ✅ Updated: varId={var.VarId}, taskInstanceId={extractedVar.TaskInstanceId}, nodeId={extractedVar.NodeId}, value={extractedVar.Value}, historyCount={var.Values.Count}")
                    Else
                        ' ✅ Fail fast: variabile non trovata
                        Dim errorMsg = $"Variable not found for taskInstanceId={extractedVar.TaskInstanceId}, nodeId={extractedVar.NodeId}. This indicates a configuration error: the variable was extracted but not registered during compilation."
                        Console.WriteLine($"[FlowOrchestrator] ❌ {errorMsg}")
                        Throw New InvalidOperationException(errorMsg)
                    End If
                Next
            End If
            _state.DialogueContexts.Remove(rowTask.Id)
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
    ''' Handler per SayMessage: emette il messaggio e completa subito.
    ''' </summary>
    Private Function ProcessSayMessageTurn(rowTask As CompiledSayMessageTask) As RowTurnResult
        If String.IsNullOrEmpty(rowTask.TextKey) Then
            Return RowTurnResult.Completed()
        End If
        Return RowTurnResult.Completed(New List(Of String) From {rowTask.TextKey})
    End Function

    ''' <summary>
    ''' Handler per BackendCall (placeholder — completa automaticamente per ora).
    ''' </summary>
    Private Async Function ProcessBackendTurn(rowTask As CompiledTask) As System.Threading.Tasks.Task(Of RowTurnResult)
        Console.WriteLine($"[FlowOrchestrator] BackendCall {rowTask.Id} — not yet implemented, auto-complete")
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

    ''' <summary>
    ''' Carica DialogueState dal contesto serializzato in ExecutionState,
    ''' oppure crea un nuovo stato iniziale per la prima esecuzione del task.
    ''' </summary>
    Private Function LoadDialogueState(task As CompiledUtteranceTask) As DialogueState
        If _state.DialogueContexts.ContainsKey(task.Id) Then
            Try
                ' ✅ Deserializza con TypeNameHandling.Auto + ITaskConverter per ripristinare
                '    CurrentTask/RootTask come CompiledUtteranceTask (sono Object in DialogueState).
                '    Senza TypeNameHandling.Auto, CurrentTask sarebbe sempre Nothing dopo il
                '    roundtrip Redis, con conseguente reset errato al task radice.
                Dim obj = JsonConvert.DeserializeObject(Of JObject)(_state.DialogueContexts(task.Id))
                If obj?("DialogueState") IsNot Nothing Then
                    Dim ds = obj("DialogueState").ToObject(Of DialogueState)(
                        JsonSerializer.CreateDefault(_dialogueStateSettings))
                    If ds IsNot Nothing Then
                        ' Fallback solo se il contesto era stato scritto senza TypeNameHandling
                        ' (es. dati legacy o prima iterazione)
                        If ds.CurrentTask Is Nothing Then ds.CurrentTask = task
                        If ds.RootTask Is Nothing Then ds.RootTask = task
                        Console.WriteLine($"[FlowOrchestrator] ✅ Loaded DialogueState for task {task.Id}, Mode={ds.Mode}")
                        Return ds
                    End If
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to load DialogueState for {task.Id}: {ex.Message}")
            End Try
        End If

        ' Prima esecuzione: crea nuovo DialogueState
        Console.WriteLine($"[FlowOrchestrator] 🆕 Creating new DialogueState for task {task.Id}")
        Return New DialogueState() With {
            .CurrentTask = task,
            .RootTask = task,
            .CurrentStepType = DialogueStepType.Start,
            .Mode = DialogueMode.ExecutingStep
        }
    End Function

    ''' <summary>
    ''' Risolve un TextKey (GUID) nel testo tradotto.
    ''' Se non c'è un resolver o la chiave è vuota, restituisce la chiave stessa.
    ''' </summary>
    Private Function ResolveText(textKey As String) As String
        If String.IsNullOrEmpty(textKey) Then Return textKey
        If _resolveTranslation Is Nothing Then Return textKey
        Dim resolved = _resolveTranslation(textKey)
        Return If(String.IsNullOrEmpty(resolved), textKey, resolved)
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

End Class
