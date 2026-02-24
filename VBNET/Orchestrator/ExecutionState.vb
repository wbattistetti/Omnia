Option Strict On
Option Explicit On

''' <summary>
''' Stato di esecuzione del flow orchestrator
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

    Public Sub New()
        ExecutedTaskIds = New HashSet(Of String)()
        ExecutedTaskGroupIds = New HashSet(Of String)()
        VariableStore = New Dictionary(Of String, Object)()
        RetrievalState = "empty"
        CurrentNodeId = Nothing
        CurrentRowIndex = 0
        DialogueContexts = New Dictionary(Of String, String)()
    End Sub
End Class

