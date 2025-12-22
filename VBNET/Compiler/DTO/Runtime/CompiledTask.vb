Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports DDTEngine

''' <summary>
''' CompiledTask: Base class astratta per tutti i task compilati
''' Ogni tipo di task ha la sua classe specifica type-safe
''' </summary>
Public MustInherit Class CompiledTask
    ''' <summary>
    ''' Task ID (GUID) - same as row.id for flowchart tasks
    ''' </summary>
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

    Public Sub New()
        State = TaskState.UnExecuted
    End Sub
End Class

''' <summary>
''' Task per inviare un messaggio all'utente
''' </summary>
Public Class CompiledTaskSayMessage
    Inherits CompiledTask

    ''' <summary>
    ''' Testo del messaggio da inviare
    ''' </summary>
    Public Property Text As String

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.SayMessage
        End Get
    End Property
End Class

''' <summary>
''' Task per richiedere dati dall'utente usando un DDT
''' </summary>
Public Class CompiledTaskGetData
    Inherits CompiledTask

    ''' <summary>
    ''' DDT instance da eseguire
    ''' </summary>
    Public Property DDT As DDTInstance

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.GetData
        End Get
    End Property
End Class

''' <summary>
''' Task per classificare il problema/intent dell'utente
''' </summary>
Public Class CompiledTaskClassifyProblem
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

    Public Sub New()
        MyBase.New()
        Intents = New List(Of String)()
    End Sub
End Class

''' <summary>
''' Task per chiamare un backend API
''' </summary>
Public Class CompiledTaskBackendCall
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

    Public Sub New()
        MyBase.New()
        Payload = New Dictionary(Of String, Object)()
    End Sub
End Class

''' <summary>
''' Task per chiudere la sessione
''' </summary>
Public Class CompiledTaskCloseSession
    Inherits CompiledTask

    Public Overrides ReadOnly Property TaskType As TaskTypes
        Get
            Return TaskTypes.CloseSession
        End Get
    End Property
End Class

''' <summary>
''' Task per trasferire la conversazione
''' </summary>
Public Class CompiledTaskTransfer
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
End Class
