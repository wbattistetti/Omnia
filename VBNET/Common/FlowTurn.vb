Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Rappresenta "cosa fare adesso" nello stato corrente del flow.
''' È una vista calcolata dello stato - contiene solo dati, nessuna logica.
''' Usata da RunUntilInput per guidare il loop stateless.
''' </summary>
Public Class FlowTurn

    ''' <summary>
    ''' TaskGroup attivo (Nothing se il flow è completato o il gruppo è finito)
    ''' </summary>
    Public Property TaskGroup As TaskGroup

    ''' <summary>
    ''' Task corrente da eseguire (Nothing se il gruppo è finito o flow completato)
    ''' </summary>
    Public Property Task As CompiledTask

    ''' <summary>
    ''' True quando tutti i TaskGroup eseguibili sono terminati
    ''' </summary>
    Public Property IsFlowCompleted As Boolean = False

    ''' <summary>
    ''' True quando tutti i task del TaskGroup corrente sono stati eseguiti
    ''' (il gruppo deve essere marcato come Executed e si cerca il prossimo)
    ''' </summary>
    Public Property IsTaskGroupDone As Boolean = False

    ' ────────────────────────────────────────────────────────────────────────
    ' Factory methods per casi speciali
    ' ────────────────────────────────────────────────────────────────────────

    ''' <summary>
    ''' Singleton per il caso "flow completato"
    ''' </summary>
    Public Shared ReadOnly Property FlowCompleted As FlowTurn
        Get
            Return New FlowTurn() With {.IsFlowCompleted = True}
        End Get
    End Property

    ''' <summary>
    ''' Costruttore vuoto (usato da factory properties)
    ''' </summary>
    Public Sub New()
    End Sub

    ''' <summary>
    ''' Costruttore per turn normale (task da eseguire)
    ''' </summary>
    Public Sub New(taskGroup As TaskGroup, task As CompiledTask)
        Me.TaskGroup = taskGroup
        Me.Task = task
    End Sub

End Class
