Option Strict On
Option Explicit On
Imports TaskEngine
Imports Newtonsoft.Json
Imports System.Linq

''' <summary>
''' CompiledTask: Base class astratta per tutti i task compilati
''' Ogni tipo di task ha la sua classe specifica type-safe
''' </summary>
Public MustInherit Class CompiledTask
    ''' <summary>
    ''' Task ID (GUID) - same as row.id for flowchart tasks
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Execution condition (opzionale - può essere Nothing)
    ''' Se presente, viene valutata insieme alla condizione del TaskGroup (AND logico)
    ''' </summary>
    Public Property Condition As Condition

    ''' <summary>
    ''' Current execution state
    ''' </summary>
    Public Property State As TaskState

    ''' <summary>
    ''' Debug information (opzionale - solo per sviluppo/debugging)
    ''' </summary>
    Public Property Debug As TaskDebugInfo

    ''' <summary>
    ''' Tipo di task (derivato dalla classe specifica)
    ''' </summary>
    Public MustOverride ReadOnly Property TaskType As TaskTypes

    ''' <summary>
    ''' Indica se il task richiede input dall'utente
    ''' ✅ FASE 2.2: HFSM - Livello 2 (micro-step)
    ''' </summary>
    Public MustOverride ReadOnly Property RequiresInput As Boolean

    Public Sub New()
        State = TaskState.UnExecuted
    End Sub
End Class

''' <summary>
''' Task per inviare un messaggio all'utente
''' </summary>
Public Class CompiledSayMessageTask
    Inherits CompiledTask

    ''' <summary>
    ''' Chiave di traduzione (GUID) per il messaggio da inviare
    ''' Il testo viene risolto a runtime tramite TranslationRepository
    ''' </summary>
    <Newtonsoft.Json.JsonProperty("text")>
    Public Property TextKey As String

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.SayMessage
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return False ' SayMessage non richiede input
        End Get
    End Property
End Class

''' <summary>
''' Task compilato per interpretazione utterance (richiesta dati ricorsiva)
''' Contiene direttamente le proprietà runtime senza wrapper
''' ✅ Implementa IParsableTask per evitare dipendenza circolare
''' </summary>
Public Class CompiledUtteranceTask
    Inherits CompiledTask
    Implements TaskEngine.IParsableTask

    ''' <summary>
    ''' Steps di dialogo (solo se il task è atomico o aggregato)
    ''' Provengono SOLO dall'istanza, non dal template
    ''' </summary>
    Public Property Steps As List(Of TaskEngine.CompiledDialogueStep)

    ''' <summary>
    ''' Constraints per validazione input
    ''' Provengono dal template
    ''' </summary>
    Public Property Constraints As List(Of ValidationCondition)

    ''' <summary>
    ''' NLP Contract per match/retrieval/interpretazione input
    ''' Opzionale, ma necessario per task che richiedono estrazione dati
    ''' </summary>
    Public Property NlpContract As CompiledNlpContract

    ''' <summary>
    ''' Lista di CompiledUtteranceTask figli (ricorsivo)
    ''' Solo se il task è composito o aggregato
    ''' </summary>
    Public Property SubTasks As List(Of CompiledUtteranceTask)

    ''' <summary>
    ''' ID del nodo DDT originale (GUID puro)
    ''' Usato come chiave per salvare variabili in Memory/VariableStore
    ''' Deve corrispondere al GUID usato nell'AST delle condizioni
    ''' </summary>
    Public Property NodeId As String

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.UtteranceInterpretation
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return True ' UtteranceInterpretation richiede input
        End Get
    End Property

    Public Sub New()
        MyBase.New()
        Steps = Nothing ' ✅ Inizializzato solo se necessario
        Constraints = Nothing ' ✅ Inizializzato solo se necessario
        SubTasks = Nothing ' ✅ Inizializzato solo se necessario
    End Sub

    ''' <summary>
    ''' Verifica se il task ha subTasks
    ''' </summary>
    Public Function HasSubTasks() As Boolean
        Return SubTasks IsNot Nothing AndAlso SubTasks.Count > 0
    End Function

    ''' <summary>
    ''' Verifica se il task è atomico (ha steps ma non subTasks)
    ''' </summary>
    Public Function IsAtomic() As Boolean
        Return Steps IsNot Nothing AndAlso Steps.Count > 0 AndAlso Not HasSubTasks()
    End Function

    ' ✅ Implementazione IParsableTask per evitare dipendenza circolare
    Private ReadOnly Property IParsableTask_Id As String Implements TaskEngine.IParsableTask.Id
        Get
            Return Id
        End Get
    End Property


    Private ReadOnly Property IParsableTask_SubTasks As List(Of TaskEngine.IParsableTask) Implements TaskEngine.IParsableTask.SubTasks
        Get
            If SubTasks Is Nothing Then
                Return Nothing
            End If
            ' ✅ Cast implicito: CompiledUtteranceTask implementa IParsableTask
            Return SubTasks.Cast(Of TaskEngine.IParsableTask)().ToList()
        End Get
    End Property

    Private ReadOnly Property IParsableTask_NlpContract As CompiledNlpContract Implements IParsableTask.NlpContract
        Get
            Return NlpContract
        End Get
    End Property

    Private Function IParsableTask_HasSubTasks() As Boolean Implements TaskEngine.IParsableTask.HasSubTasks
        Return HasSubTasks()
    End Function
End Class

''' <summary>
''' Task per classificare il problema/intent dell'utente
''' </summary>
Public Class CompiledClassifyProblemTask
    Inherits CompiledTask

    ''' <summary>
    ''' Lista degli intent possibili
    ''' </summary>
    Public Property Intents As List(Of String)

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.ClassifyProblem
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return True ' ClassifyProblem richiede input
        End Get
    End Property

    Public Sub New()
        MyBase.New()
        Intents = New List(Of String)()
    End Sub
End Class

''' <summary>
''' Task per chiamare un backend API
''' </summary>
Public Class CompiledBackendCallTask
    Inherits CompiledTask

    ''' <summary>
    ''' Endpoint URL
    ''' </summary>
    Public Property Endpoint As String

    ''' <summary>
    ''' HTTP Method (GET, POST, ecc.)
    ''' </summary>
    Public Property Method As String

    ''' <summary>
    ''' Payload della richiesta
    ''' </summary>
    Public Property Payload As Dictionary(Of String, Object)

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.BackendCall
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return False ' BackendCall non richiede input utente
        End Get
    End Property

    Public Sub New()
        MyBase.New()
        Payload = New Dictionary(Of String, Object)()
    End Sub
End Class

''' <summary>
''' Task per chiudere la sessione
''' </summary>
Public Class CompiledCloseSessionTask
    Inherits CompiledTask

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.CloseSession
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return False ' CloseSession non richiede input
        End Get
    End Property
End Class

''' <summary>
''' Task per trasferire la conversazione
''' </summary>
Public Class CompiledTransferTask
    Inherits CompiledTask

    ''' <summary>
    ''' Target del trasferimento (agent name o system id)
    ''' </summary>
    Public Property Target As String

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.Transfer
        End Get
    End Property

    Public Overrides ReadOnly Property RequiresInput As Boolean
        Get
            Return False ' Transfer non richiede input
        End Get
    End Property
End Class
