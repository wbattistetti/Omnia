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
    End Sub
End Class
