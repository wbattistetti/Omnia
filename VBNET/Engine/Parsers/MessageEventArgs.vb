' MessageEventArgs.vb
' Argomenti per l'evento MessageToShow

Option Strict On
Option Explicit On

''' <summary>
''' Argomenti per l'evento MessageToShow
''' </summary>
Public Class MessageEventArgs
    Inherits EventArgs
    Public Property Message As String
    ''' <summary>Orchestrator row task id that emitted this bubble (for debugger tooling).</summary>
    Public Property TaskId As String

    Public Sub New(message As String, Optional taskId As String = Nothing)
        Me.Message = message
        Me.TaskId = If(String.IsNullOrWhiteSpace(taskId), "", taskId.Trim())
    End Sub
End Class





