' TransferTask.vb
' Task per trasferire all'operatore

Option Strict On
Option Explicit On

''' <summary>
''' Task per trasferire la conversazione a un operatore umano
''' </summary>
Public Class TransferTask
    Inherits TaskBase

    ''' <summary>
    ''' ID dell'operatore (opzionale)
    ''' </summary>
    Public Property OperatorId As String

    ''' <summary>
    ''' Dipartimento (opzionale)
    ''' </summary>
    Public Property Department As String

    ''' <summary>
    ''' Priorità (opzionale)
    ''' </summary>
    Public Property Priority As String

    ''' <summary>
    ''' Costruttore
    ''' </summary>
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
    ''' Esegue il task: trasferisce all'operatore
    ''' </summary>
    Public Overrides Sub Execute(taskNode As TaskNode, taskInstance As TaskInstance, onMessage As Action(Of String))
        ' TODO: Implementare logica per trasferire all'operatore
        Dim transferInfo As String = "Trasferimento all'operatore"
        If Not String.IsNullOrEmpty(Me.OperatorId) Then
            transferInfo &= " (ID: " & Me.OperatorId & ")"
        End If
        If Not String.IsNullOrEmpty(Me.Department) Then
            transferInfo &= " - Dipartimento: " & Me.Department
        End If

        If onMessage IsNot Nothing Then
            onMessage(transferInfo)
        End If
        ' TODO: Implementare logica di trasferimento effettivo (API call, ecc.)
    End Sub
End Class

