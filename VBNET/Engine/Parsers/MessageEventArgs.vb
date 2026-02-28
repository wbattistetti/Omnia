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

    Public Sub New(message As String)
        Me.Message = message
    End Sub
End Class





