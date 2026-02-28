' TaskBase.vb
' Abstract base class for all runtime micro-tasks.

Option Strict On
Option Explicit On

''' <summary>
''' Abstract base for all ITask implementations.
''' </summary>
Public MustInherit Class TaskBase
    Implements ITask

    Public MustOverride ReadOnly Property Label As String Implements ITask.Label

    ''' <summary>
    ''' Executes the task.
    ''' </summary>
    Public MustOverride Sub Execute(context As TaskUtterance, onMessage As Action(Of String)) Implements ITask.Execute
End Class
