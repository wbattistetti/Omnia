' ITask.vb
' Common interface for all runtime micro-tasks.

Option Strict On
Option Explicit On

''' <summary>
''' Defines a single executable micro-task within a dialogue escalation
''' (e.g. send a message, close the session, transfer to an operator).
''' </summary>
Public Interface ITask
    ReadOnly Property Label As String

    ''' <summary>
    ''' Executes the task.
    ''' </summary>
    ''' <param name="context">
    ''' The TaskUtterance currently being processed.
    ''' Provides ProjectId, Locale and TranslationResolver for message resolution.
    ''' </param>
    ''' <param name="onMessage">Callback to surface text messages to the UI.</param>
    Sub Execute(context As TaskUtterance, onMessage As Action(Of String))
End Interface
