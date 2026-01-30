' TaskBase.vb
' Classe base astratta per tutti i task

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Classe base astratta per tutti i task
    ''' </summary>
    Public MustInherit Class TaskBase
        Implements ITask

        Public MustOverride ReadOnly Property Label As String Implements ITask.Label

        ''' <summary>
        ''' Esegue il task (implementazione di default: solleva eccezione)
        ''' </summary>
        Public MustOverride Sub Execute(taskNode As TaskNode, taskInstance As TaskInstance, onMessage As Action(Of String)) Implements ITask.Execute
    End Class

