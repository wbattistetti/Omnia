' StepResult.vb
' Output di un singolo step dell'esecuzione

Option Strict On
Option Explicit On
Imports TaskEngine

''' <summary>
''' Risultato di un singolo step dell'esecuzione
''' </summary>
Public Class StepResult
    ''' <summary>
    ''' Tipo di step eseguito
    ''' Valori possibili:
    ''' - "Introduction": Esecuzione introduction
    ''' - "FindNextTask": Ricerca prossimo task
    ''' - "GetResponse": Recupero response per task corrente
    ''' - "ExecuteResponse": Esecuzione response
    ''' - "CheckCompletion": Verifica completamento
    ''' - "Complete": Esecuzione completata
    ''' </summary>
    Public Property StepType As String

    ''' <summary>
    ''' Prossimo TaskUtterance da eseguire (se StepType = "FindNextTask")
    ''' Nothing se non ci sono più task
    ''' </summary>
    Public Property NextTaskNode As TaskUtterance

    ''' <summary>
    ''' Tasks da eseguire (se StepType = "GetResponse" o "ExecuteResponse")
    ''' </summary>
    Public Property Tasks As IEnumerable(Of ITask)

    ''' <summary>
    ''' Messaggi emessi durante l'esecuzione
    ''' </summary>
    Public Property Messages As New List(Of String)()

    ''' <summary>
    ''' Indica se è stata rilevata una termination response
    ''' (se StepType = "ExecuteResponse")
    ''' </summary>
    Public Property HasTerminationResponse As Boolean = False

    ''' <summary>
    ''' Indica se tutti i task sono completati
    ''' (se StepType = "CheckCompletion")
    ''' </summary>
    Public Property IsCompleted As Boolean = False

    ''' <summary>
    ''' Indica se l'esecuzione deve continuare
    ''' False se l'esecuzione deve fermarsi (es. waiting for input, completed, termination)
    ''' </summary>
    Public Property ContinueExecution As Boolean = True

    ''' <summary>
    ''' Errore se lo step ha fallito
    ''' </summary>
    Public Property ErrorMessage As String

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Messages = New List(Of String)()
        ContinueExecution = True
    End Sub
End Class
