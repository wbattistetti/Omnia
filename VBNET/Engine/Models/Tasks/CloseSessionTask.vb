' CloseSessionTask.vb
' Micro-task that terminates the dialogue session.

Option Strict On
Option Explicit On

''' <summary>
''' Terminates the current dialogue session.
''' </summary>
Public Class CloseSessionTask
    Inherits TaskBase

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Close Session"
        End Get
    End Property

    ''' <summary>
    ''' Signals session closure via the onMessage callback.
    ''' </summary>
    Public Overrides Sub Execute(context As TaskUtterance, onMessage As Action(Of String))
        If onMessage IsNot Nothing Then
            onMessage("Session closed.")
        End If
    End Sub
End Class
