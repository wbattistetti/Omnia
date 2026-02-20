' ExecutionState.vb
' Stato completo dell'esecuzione del motore (stateless)

Option Strict On
Option Explicit On
Imports TaskEngine

''' <summary>
''' Stato completo dell'esecuzione del motore
''' Contiene tutti i campi che nel motore attuale (Motore.vb) sono stati interni
''' Permette al motore di essere completamente stateless
''' </summary>
Public Class ExecutionState
    ''' <summary>
    ''' Contatori escalation per ogni DialogueState
    ''' Corrisponde a _counters nel motore attuale (Motore.vb, riga 18)
    ''' </summary>
    Public Property Counters As New Dictionary(Of DialogueState, Integer)()

    ''' <summary>
    ''' Max recovery per ogni DialogueState (attualmente non usato nel motore attuale)
    ''' Corrisponde a _maxRecovery nel motore attuale (Motore.vb, riga 19)
    ''' </summary>
    Public Property MaxRecovery As New Dictionary(Of DialogueState, Integer)()

    ''' <summary>
    ''' TaskUtterance corrente in esecuzione
    ''' Corrisponde a currTaskNode nel loop ExecuteTask
    ''' </summary>
    Public Property CurrentTaskNode As TaskUtterance

    ''' <summary>
    ''' Indice del task corrente in ExecuteResponse
    ''' Corrisponde a taskIndex in ExecuteResponse (Motore.vb, riga 165)
    ''' </summary>
    Public Property TaskIndex As Integer = 0

    ''' <summary>
    ''' Contatore iterazioni del loop principale
    ''' Corrisponde a iterationCount in ExecuteTask (Motore.vb, riga 54)
    ''' </summary>
    Public Property IterationCount As Integer = 0

    ''' <summary>
    ''' Indica se è stata rilevata una termination response
    ''' Corrisponde a isAterminationResponse in ExecuteTask (Motore.vb, riga 71)
    ''' </summary>
    Public Property HasTerminationResponse As Boolean = False

    ''' <summary>
    ''' Indica se tutti i task sono completati
    ''' Corrisponde a allCompleted in ExecuteTask (Motore.vb, riga 82)
    ''' </summary>
    Public Property IsCompleted As Boolean = False

    ''' <summary>
    ''' Indica se l'introduction è stata eseguita
    ''' Corrisponde alla condizione in ExecuteTask (Motore.vb, riga 50)
    ''' </summary>
    Public Property IntroductionExecuted As Boolean = False

    ''' <summary>
    ''' Indica se il SuccessResponse è stato eseguito
    ''' Corrisponde alla condizione in ExecuteTask (Motore.vb, riga 85)
    ''' </summary>
    Public Property SuccessResponseExecuted As Boolean = False

    ''' <summary>
    ''' Lista dei messaggi emessi durante l'esecuzione
    ''' Utile per il golden test
    ''' </summary>
    Public Property Messages As New List(Of String)()

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Counters = New Dictionary(Of DialogueState, Integer)()
        MaxRecovery = New Dictionary(Of DialogueState, Integer)()
        Messages = New List(Of String)()
    End Sub

    ''' <summary>
    ''' Resetta lo stato
    ''' </summary>
    Public Sub Reset()
        Counters.Clear()
        MaxRecovery.Clear()
        CurrentTaskNode = Nothing ' TaskUtterance
        TaskIndex = 0
        IterationCount = 0
        HasTerminationResponse = False
        IsCompleted = False
        IntroductionExecuted = False
        SuccessResponseExecuted = False
        Messages.Clear()
    End Sub
End Class
