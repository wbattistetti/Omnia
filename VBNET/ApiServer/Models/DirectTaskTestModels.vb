Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Modello di richiesta per test diretto di un task
''' </summary>
Public Class DirectTaskTestRequest
    ''' <summary>
    ''' Task da testare (può essere RuntimeTask JSON o task tree)
    ''' </summary>
    Public Property Task As Object

    ''' <summary>
    ''' Input utente (opzionale, per primo turno è vuoto)
    ''' </summary>
    Public Property Input As String

    ''' <summary>
    ''' DialogueContext serializzato (opzionale, per turni successivi)
    ''' Se fornito, viene usato invece di creare un nuovo context
    ''' </summary>
    Public Property Context As String
End Class

''' <summary>
''' Modello di risposta per test diretto di un task
''' </summary>
Public Class DirectTaskTestResponse
    ''' <summary>
    ''' Indica se l'operazione è riuscita
    ''' </summary>
    Public Property Success As Boolean

    ''' <summary>
    ''' Messaggio da mostrare all'utente (se presente)
    ''' </summary>
    Public Property Message As String

    ''' <summary>
    ''' Tipo di step del dialogo
    ''' </summary>
    Public Property StepType As String

    ''' <summary>
    ''' ID del prossimo task da processare
    ''' </summary>
    Public Property NextTaskId As String

    ''' <summary>
    ''' Indica se il task richiede input utente
    ''' </summary>
    Public Property RequiresInput As Boolean

    ''' <summary>
    ''' DialogueContext aggiornato (serializzato, per turni successivi)
    ''' </summary>
    Public Property Context As String

    ''' <summary>
    ''' Eventuali errori
    ''' </summary>
    Public Property ErrorMessage As String
End Class
