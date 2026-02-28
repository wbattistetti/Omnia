' TransferTask.vb
' Micro-task that transfers the conversation to a human operator.

Option Strict On
Option Explicit On

''' <summary>
''' Transfers the conversation to a human operator.
''' </summary>
Public Class TransferTask
    Inherits TaskBase

    Public Property OperatorId As String
    Public Property Department As String
    Public Property Priority As String

    Public Sub New()
        OperatorId = ""
        Department = ""
        Priority = ""
    End Sub

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Transfer to Operator"
        End Get
    End Property

    ''' <summary>
    ''' Signals the transfer via the onMessage callback.
    ''' </summary>
    Public Overrides Sub Execute(context As TaskUtterance, onMessage As Action(Of String))
        Dim info As String = "Transfer to operator"
        If Not String.IsNullOrEmpty(OperatorId) Then info &= $" (ID: {OperatorId})"
        If Not String.IsNullOrEmpty(Department) Then info &= $" — Dept: {Department}"

        If onMessage IsNot Nothing Then
            onMessage(info)
        End If
    End Sub
End Class
