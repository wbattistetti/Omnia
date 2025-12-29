Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler

''' <summary>
''' Base class astratta per tutti i task executor
''' Ogni tipo di task può avere il suo executor specifico
''' </summary>
Public MustInherit Class TaskExecutorBase
    Protected ReadOnly _ddtEngine As Motore
    Protected _messageCallback As Action(Of String, String, Integer)

    Public Sub New(ddtEngine As Motore)
        _ddtEngine = ddtEngine
    End Sub

    ''' <summary>
    ''' Imposta il callback per i messaggi
    ''' </summary>
    Public Sub SetMessageCallback(callback As Action(Of String, String, Integer))
        _messageCallback = callback
    End Sub

    ''' <summary>
    ''' Esegue un task compilato
    ''' </summary>
    Public MustOverride Function Execute(task As CompiledTask, state As ExecutionState) As TaskExecutionResult
End Class

