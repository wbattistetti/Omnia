Option Strict On
Option Explicit On

''' <summary>
''' Stato di navigazione e variabili per un singolo flow (main o subflow) nello stack.
''' Coerente con i campi già presenti su ExecutionState, senza FlowCompleted (resta sullo stato sessione).
''' </summary>
Public Class ExecutionFlow
    ''' <summary>Identificativo del grafo compilato (es. "main", "subflow_...").</summary>
    Public Property FlowId As String

    Public Property CurrentNodeId As String
    Public Property CurrentRowIndex As Integer
    Public Property LastCompletedNodeId As String

    Public Property ExecutedTaskGroupIds As HashSet(Of String)
    Public Property ExecutedTaskIds As HashSet(Of String)

    Public Property VariableStore As Dictionary(Of String, Object)
    Public Property RetrievalState As String

    Public Property DialogueContexts As Dictionary(Of String, String)

    Public Property RequiresInput As Boolean
    Public Property PendingUtterance As String
    Public Property WaitingTaskId As String

    ''' <summary>Valorizzato solo sul flow figlio creato da PushFlow: binding per ApplyOutputMapping al PopFlow.</summary>
    Public Property SubflowOutputBindings As List(Of SubflowIoBinding)

    Public Sub New()
        FlowId = "main"
        ExecutedTaskGroupIds = New HashSet(Of String)()
        ExecutedTaskIds = New HashSet(Of String)()
        VariableStore = New Dictionary(Of String, Object)()
        RetrievalState = "empty"
        DialogueContexts = New Dictionary(Of String, String)()
        RequiresInput = False
        PendingUtterance = ""
        WaitingTaskId = Nothing
    End Sub
End Class
