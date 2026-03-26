Option Strict On
Option Explicit On

''' <summary>
''' Stato di esecuzione del flow orchestrator
''' Spostato in Common per essere condiviso tra Orchestrator e Engine
''' </summary>
Public Class ExecutionState
    ''' <summary>
    ''' Set di task ID già eseguiti
    ''' </summary>
    Public Property ExecutedTaskIds As HashSet(Of String)

    ''' <summary>
    ''' Set di TaskGroup ID già eseguiti (per valutazione TaskGroupExecuted condition)
    ''' </summary>
    Public Property ExecutedTaskGroupIds As HashSet(Of String)

    ''' <summary>
    ''' Store delle variabili globali (valori estratti dai DDT)
    ''' </summary>
    Public Property VariableStore As Dictionary(Of String, Object)

    ''' <summary>
    ''' Stato di retrieval corrente
    ''' </summary>
    Public Property RetrievalState As String

    ''' <summary>
    ''' ID del nodo corrente
    ''' </summary>
    Public Property CurrentNodeId As String

    ''' <summary>
    ''' Indice della riga corrente
    ''' </summary>
    Public Property CurrentRowIndex As Integer

    ''' <summary>
    ''' ✅ STATELESS: DialogueContext per task utterance (salvato per gestire input asincroni)
    ''' Chiave: taskId, Valore: DialogueContext serializzato (JSON)
    ''' </summary>
    Public Property DialogueContexts As Dictionary(Of String, String)

    ' ────────────────────────────────────────────────────────────────────────
    ' ✅ STATELESS LOOP: Campi per il loop RunUntilInput
    ' Questi sostituiranno session.IsWaitingForInput (flag duplicato rimosso)
    ' ────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Quando True, il loop RunUntilInput si ferma e aspetta input utente.
    ''' Unica fonte di verità per "waiting for input".
    ''' </summary>
    Public Property RequiresInput As Boolean = False

    ''' <summary>
    ''' Input utente in attesa di essere processato al prossimo turn.
    ''' Impostato da ProvideUserInput, consumato da ProcessStateTurn.
    ''' Stringa vuota = nessun input pendente.
    ''' </summary>
    Public Property PendingUtterance As String = ""

    ''' <summary>
    ''' ID del task che sta aspettando input utente.
    ''' Impostato da ProcessStateTurn quando RequiresInput = True.
    ''' </summary>
    Public Property WaitingTaskId As String = Nothing

    ''' <summary>
    ''' True quando il flow è terminato definitivamente (CloseSession eseguito).
    ''' Quando True, GetNextTaskGroup restituisce Nothing immediatamente.
    ''' </summary>
    Public Property FlowCompleted As Boolean = False

    ''' <summary>
    ''' ID dell'ultimo TaskGroup completato (per valutazione edge)
    ''' Usato per identificare quale nodo ha appena completato e valutare i suoi edge uscenti
    ''' </summary>
    Public Property LastCompletedNodeId As String

    ' ── Subflow stack (StateVersion >= 2). Dopo migrazione lazy, la navigazione usa FlowStack. ──

    ''' <summary>1 = stato legacy (solo campi root). 2 = FlowStack popolato.</summary>
    Public Property StateVersion As Integer

    ''' <summary>Stack main → subflow → … L'elemento attivo è l'ultimo.</summary>
    Public Property FlowStack As List(Of ExecutionFlow)

    ''' <summary>
    ''' Se StateVersion &lt; 2 o stack vuoto, copia i campi navigazionali correnti nel primo ExecutionFlow (main).
    ''' Chiamare all'avvio sessione / prima della navigazione. Idempotente.
    ''' </summary>
    Public Sub EnsureFlowStackMigrated()
        If StateVersion >= 2 AndAlso FlowStack IsNot Nothing AndAlso FlowStack.Count > 0 Then
            Return
        End If
        If FlowStack Is Nothing Then
            FlowStack = New List(Of ExecutionFlow)()
        Else
            FlowStack.Clear()
        End If

        Dim f As New ExecutionFlow With {
            .FlowId = "main",
            .CurrentNodeId = Me.CurrentNodeId,
            .CurrentRowIndex = Me.CurrentRowIndex,
            .LastCompletedNodeId = Me.LastCompletedNodeId,
            .ExecutedTaskGroupIds = New HashSet(Of String)(Me.ExecutedTaskGroupIds),
            .ExecutedTaskIds = New HashSet(Of String)(Me.ExecutedTaskIds),
            .VariableStore = Me.VariableStore,
            .RetrievalState = Me.RetrievalState,
            .DialogueContexts = Me.DialogueContexts,
            .RequiresInput = Me.RequiresInput,
            .PendingUtterance = Me.PendingUtterance,
            .WaitingTaskId = Me.WaitingTaskId
        }
        FlowStack.Add(f)
        StateVersion = 2
    End Sub

    ''' <summary>
    ''' Copia il primo flow (main) sui campi root per serializzazione compatibile con dati legacy in Redis.
    ''' </summary>
    Public Sub SyncRootNavigationFromMainFlow()
        If FlowStack Is Nothing OrElse FlowStack.Count = 0 Then
            Return
        End If
        Dim mainFlow = FlowStack(0)
        Me.CurrentNodeId = mainFlow.CurrentNodeId
        Me.CurrentRowIndex = mainFlow.CurrentRowIndex
        Me.LastCompletedNodeId = mainFlow.LastCompletedNodeId
        Me.ExecutedTaskGroupIds = mainFlow.ExecutedTaskGroupIds
        Me.ExecutedTaskIds = mainFlow.ExecutedTaskIds
        Me.VariableStore = mainFlow.VariableStore
        Me.RetrievalState = mainFlow.RetrievalState
        Me.DialogueContexts = mainFlow.DialogueContexts
        Me.RequiresInput = mainFlow.RequiresInput
        Me.PendingUtterance = mainFlow.PendingUtterance
        Me.WaitingTaskId = mainFlow.WaitingTaskId
    End Sub

    ''' <summary>
    ''' Copia sullo stato root variabili, dialoghi e attesa input dal flow attivo (ultimo nello stack),
    ''' così la serializzazione Redis riflette il turno corrente anche in presenza di subflow.
    ''' Chiamare dopo <see cref="SyncRootNavigationFromMainFlow"/>.
    ''' </summary>
    Public Sub SyncRootOverlayFromActiveFlow()
        If FlowStack Is Nothing OrElse FlowStack.Count = 0 Then
            Return
        End If
        Dim active = FlowStack(FlowStack.Count - 1)
        Me.VariableStore = active.VariableStore
        Me.DialogueContexts = active.DialogueContexts
        Me.RetrievalState = active.RetrievalState
        Me.RequiresInput = active.RequiresInput
        Me.PendingUtterance = active.PendingUtterance
        Me.WaitingTaskId = active.WaitingTaskId
    End Sub

    Public Sub New()
        ExecutedTaskIds = New HashSet(Of String)()
        ExecutedTaskGroupIds = New HashSet(Of String)()
        VariableStore = New Dictionary(Of String, Object)()
        RetrievalState = "empty"
        CurrentNodeId = Nothing
        CurrentRowIndex = 0
        DialogueContexts = New Dictionary(Of String, String)()
        RequiresInput = False
        PendingUtterance = ""
        WaitingTaskId = Nothing
        FlowCompleted = False
        LastCompletedNodeId = Nothing
        StateVersion = 1
        FlowStack = Nothing
    End Sub
End Class
