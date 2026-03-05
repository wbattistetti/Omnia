Option Strict On
Option Explicit On
Imports Compiler
Imports TaskEngine
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Executor per task di tipo UtteranceInterpretation
''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
''' FASE 1: Invio messaggio iniziale (Start step)
''' FASE 2: Gestione input utente, parsing NLP, validazione, transizioni di stato
''' </summary>
Public Class TaskUtteranceStepExecutor
    Inherits TaskExecutorBase

    ''' <summary>
    ''' Risultato di ProcessTurn
    ''' </summary>
    Public Class DialogueTurnResult
        Public Property Messages As List(Of String)
        Public Property NewState As DialogueState
        Public Property Status As String ' "waiting_for_input" | "completed"

        Public Sub New()
            Messages = New List(Of String)()
            NewState = New DialogueState()
            Status = "waiting_for_input"
        End Sub

        Public Sub New(messages As List(Of String), newState As DialogueState)
            Me.Messages = messages
            Me.NewState = newState
            Me.Status = If(newState.IsCompleted, "completed", "waiting_for_input")
        End Sub
    End Class

    Public Sub New()
        MyBase.New()
    End Sub

    ''' <summary>
    ''' Esegue un task UtteranceInterpretation
    ''' ✅ STATELESS: Usa ProcessTurn (funzione pura) e emette TextKey via messageCallback.
    ''' La risoluzione dei TextKey avverrà in FlowOrchestrator.messageCallback (SINGLE POINT OF TRUTH).
    ''' </summary>
    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState) As System.Threading.Tasks.Task(Of TaskExecutionResult)
        ' ✅ Cast to CompiledUtteranceTask
        Dim utteranceTask = TryCast(task, CompiledUtteranceTask)
        If utteranceTask Is Nothing Then
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = $"Task {task.Id} is not a CompiledUtteranceTask"
            }
        End If

        ' ✅ Get or create DialogueState for this task
        ' DialogueContext è solo un wrapper (TaskId + DialogueState), ma Engine non può referenziare Orchestrator
        ' Quindi lavoriamo direttamente con DialogueState (definito in Common)
        Dim dialogueState As DialogueState = Nothing
        If state.DialogueContexts IsNot Nothing AndAlso state.DialogueContexts.ContainsKey(task.Id) Then
            ' Load existing context (task già iniziato, riprendi da dove era)
            ' Deserializza DialogueContext JSON e estrai DialogueState
            Dim existingCtxJson As String = CStr(state.DialogueContexts(task.Id))
            Try
                ' Deserializza come JObject per estrarre DialogueState
                Dim ctxObj = JsonConvert.DeserializeObject(Of JObject)(existingCtxJson)
                If ctxObj IsNot Nothing AndAlso ctxObj("DialogueState") IsNot Nothing Then
                    dialogueState = ctxObj("DialogueState").ToObject(Of DialogueState)()
                End If
            Catch ex As Exception
                ' Se fallisce, prova a deserializzare direttamente come DialogueState (per backward compatibility)
                Try
                    dialogueState = JsonConvert.DeserializeObject(Of DialogueState)(existingCtxJson)
                Catch
                    ' Ignora errore, creeremo nuovo state
                End Try
            End Try
        End If

        ' ✅ Create new DialogueState if not exists (prima esecuzione del task)
        If dialogueState Is Nothing Then
            dialogueState = New DialogueState() With {
                .CurrentTask = utteranceTask,
                .RootTask = utteranceTask,
                .CurrentStepType = DialogueStepType.Start,
                .Mode = DialogueMode.ExecutingStep
            }
            Console.WriteLine($"[TaskUtteranceStepExecutor] Created new DialogueState for task {task.Id}")
        End If

        ' ✅ STATELESS: ProcessTurn è pura, non richiede resolveTranslation
        ' I TextKey verranno risolti da FlowOrchestrator.messageCallback (SINGLE POINT OF TRUTH)
        Dim result = TaskUtteranceStepExecutor.ProcessTurn(dialogueState, "")

        ' ✅ Emit TextKey via messageCallback - FlowOrchestrator li risolverà
        If result.Messages IsNot Nothing AndAlso result.Messages.Count > 0 Then
            For Each textKey As String In result.Messages
                If _messageCallback IsNot Nothing Then
                    _messageCallback(textKey, "message", 0)
                End If
            Next
            Console.WriteLine($"[TaskUtteranceStepExecutor] Emitted {result.Messages.Count} TextKeys for task {task.Id}")
        End If

        ' ✅ Update DialogueState in state (serializza come DialogueContext per compatibilità con Orchestrator)
        ' Orchestrator si aspetta DialogueContext con TaskId e DialogueState
        Dim updatedCtx = New With {
            .TaskId = task.Id,
            .DialogueState = result.NewState
        }
        Dim updatedCtxJson = JsonConvert.SerializeObject(updatedCtx)
        If state.DialogueContexts Is Nothing Then
            state.DialogueContexts = New Dictionary(Of String, String)()
        End If
        state.DialogueContexts(task.Id) = updatedCtxJson

        ' ✅ Check if task requires input
        Dim requiresInput = result.Status = "waiting_for_input" OrElse result.NewState.Mode = DialogueMode.WaitingForUtterance

        Console.WriteLine($"[TaskUtteranceStepExecutor] Task {task.Id} execution completed: RequiresInput={requiresInput}")

        Return New TaskExecutionResult() With {
            .Success = True,
            .RequiresInput = requiresInput
        }
    End Function

    ''' <summary>
    ''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
    ''' Versione corretta con DialogueMode per separazione chiara delle fasi
    ''' ✅ STATELESS: Non richiede resolveTranslation. Restituisce TextKey, non testo risolto.
    ''' La risoluzione avverrà nei chiamanti (FlowOrchestrator.messageCallback, TaskSessionHandlers).
    ''' </summary>
    Public Shared Function ProcessTurn(state As DialogueState, utterance As String) As DialogueTurnResult

        ' Cast CurrentTask and RootTask to CompiledUtteranceTask (they are Object in DialogueState to avoid Common -> Compiler dependency)
        Dim currentTask = DirectCast(state.CurrentTask, CompiledUtteranceTask)
        If currentTask Is Nothing Then Throw New InvalidOperationException("CurrentTask must be CompiledUtteranceTask")
        Dim rootTask = DirectCast(state.RootTask, CompiledUtteranceTask)

        ' 1) LOGICA PURA: aggiornamento dello stato
        Select Case state.Mode

            ' ESECUZIONE STEP (PRIMO TURNO)
            Case DialogueMode.ExecutingStep

                Dim stepObj = ProcessTurnHelpers.GetStep(currentTask, state.CurrentStepType)
                If ProcessTurnHelpers.IsFilled(currentTask, state.Memory) Then
                    ' Step senza input → transizione immediata allo step successivo
                    Dim nextStep = ProcessTurnHelpers.GetNextStep(currentTask, stepObj)  'OSSERVAZIONE: In realtà la navigazione Cioè la decisione del prossimo step è Implementata in questa funzione non è esternalizzata quindi questo gap forse non serve più

                    state.CurrentStepType = nextStep.Type
                    state.Mode = DialogueMode.ExecutingStep
                Else
                    state.Mode = DialogueMode.WaitingForUtterance
                End If
            ' IN ATTESA DELL'UTTERANCE (SECONDO TURNO)
            Case DialogueMode.WaitingForUtterance

                If String.IsNullOrEmpty(utterance) Then
                    ' Nessun input → NoInput escalation
                    EnsureCounter(state, currentTask.Id)
                    state.Counters(currentTask.Id).NoInput += 1
                    state.CurrentStepType = DialogueStepType.NoInput
                    state.Mode = DialogueMode.ExecutingStep
                Else
                    ' Input ricevuto → parsing
                    Dim parseResult = ProcessTurnHelpers.RunContractsInCascade(
                            currentTask, utterance, state.CurrentStepType
                        )

                    Select Case parseResult.Status

                        Case ParseStatus.Match
                            ProcessTurnHelpers.FillTaskFromParseResult(parseResult, state)

                            'c'è stato un match potrebbe essere per il task corrente o per una altro task. quindi devo: se sono in subtask tornare altask parent e rivedere qua'è il porssimo da fillare se non c'è nente da fillare allora devo o conferemare o andare al success .

                            Dim mainTask = ProcessTurnHelpers.MainTask(currentTask, rootTask)
                            If ProcessTurnHelpers.IsFilled(mainTask, state.Memory) Then
                                ' Main task completato → gestisci Confirmation o Success
                                If currentTask.StepExists(DialogueStepType.Confirmation) Then
                                    state.CurrentStepType = DialogueStepType.Confirmation
                                ElseIf currentTask.StepExists(DialogueStepType.Success) Then
                                    state.CurrentStepType = DialogueStepType.Success
                                Else
                                    ' Main task completato senza Confirmation/Success → completa
                                    state.IsCompleted = True
                                    state.Mode = DialogueMode.Completed
                                End If
                            Else
                                ' Main task non ancora completato → vai al prossimo subtask non riempito
                                SetStateToTheFirstUnfilledSubTask(state)
                            End If

                        Case ParseStatus.NoMatch
                            EnsureCounter(state, currentTask.Id)
                            state.Counters(currentTask.Id).NoMatch += 1
                            state.CurrentStepType = DialogueStepType.NoMatch
                            state.Mode = DialogueMode.ExecutingStep

                        Case ParseStatus.NoInput
                            EnsureCounter(state, currentTask.Id)
                            state.Counters(currentTask.Id).NoInput += 1
                            state.CurrentStepType = DialogueStepType.NoInput
                            state.Mode = DialogueMode.ExecutingStep

                        Case ParseStatus.PartialMatch, ParseStatus.MatchedButInvalid
                            ' Rimani nello stesso task/step, ma torna in ExecutingStep
                            state.Mode = DialogueMode.ExecutingStep

                    End Select
                End If


            ' COMPLETATO
            Case DialogueMode.Completed
                ' Stato terminale: nessuna logica aggiuntiva

        End Select

        ' 2) RENDERING UNICO: produce i task dello step corrente (restituisce TextKey)
        Dim renderedTasks As New List(Of String)

        If state.Mode <> DialogueMode.Completed Then
            currentTask = DirectCast(state.CurrentTask, CompiledUtteranceTask)
            Dim stepToRender = ProcessTurnHelpers.GetStep(currentTask, state.CurrentStepType)
            ' ✅ STATELESS: RenderStepTasks restituisce TextKey, non testo risolto
            renderedTasks = ProcessTurnHelpers.RenderStepTasks(stepToRender, currentTask, state)
            If Not ProcessTurnHelpers.IsFilled(currentTask, state.Memory) OrElse state.CurrentStepType = DialogueStepType.Confirmation Then
                state.Mode = DialogueMode.WaitingForUtterance
            End If
        End If

        Return New DialogueTurnResult(renderedTasks, state)

    End Function

    ''' <summary>
    ''' Helper: Inizializza counter per un task se non esiste
    ''' </summary>
    Private Shared Sub EnsureCounter(state As DialogueState, taskId As String)
        If state.Counters Is Nothing Then
            state.Counters = New Dictionary(Of String, Counters)()
        End If
        If Not state.Counters.ContainsKey(taskId) Then
            state.Counters(taskId) = New Counters()
        End If
    End Sub

    Private Shared Sub SetStateToTheFirstUnfilledSubTask(state As DialogueState)
        ' ✅ FIX: Cerca sempre nel ROOT TASK, non nel current task
        ' Perché currentTask potrebbe essere già un subtask (es. mese),
        ' e dobbiamo trovare il prossimo subtask non riempito del main task (es. anno)
        Dim rootTask = DirectCast(state.RootTask, CompiledUtteranceTask)
        If rootTask Is Nothing Then Throw New InvalidOperationException("RootTask must be CompiledUtteranceTask")

        Dim nextSubTask = ProcessTurnHelpers.GetFirstUnfilledSubTask(rootTask, state.Memory)
        If nextSubTask IsNot Nothing Then
            state.CurrentTask = nextSubTask
            state.CurrentStepType = DialogueStepType.Start
            state.Mode = DialogueMode.ExecutingStep
        End If
    End Sub
End Class
