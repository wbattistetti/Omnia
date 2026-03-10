Option Strict On
Option Explicit On

''' <summary>
''' Risultato di un singolo turno di esecuzione per una riga di nodo.
'''
''' Interfaccia uniforme per tutti i tipi di task:
'''   ProcessUtteranceTurn, ProcessSayMessageTurn, ProcessBackendTurn, ecc.
'''
''' Status:
'''   "waiting_for_input"  — il turno richiede input esterno; RunUntilInput si ferma
'''   "auto_advance"       — transizione automatica; RunUntilInput itera sulla stessa riga
'''   "completed"          — la riga è terminata; RunUntilInput avanza alla riga successiva
''' </summary>
Public Class RowTurnResult

    Public Property Messages As List(Of String)
    Public Property Status As String
    Public Property WaitingTaskId As String

    Private Sub New()
        Messages = New List(Of String)()
        WaitingTaskId = Nothing
    End Sub

    ''' <summary>
    ''' Il turno ha emesso messaggi e ora aspetta input utente.
    ''' </summary>
    Public Shared Function WaitingForInput(
        taskId As String,
        Optional messages As List(Of String) = Nothing
    ) As RowTurnResult
        Return New RowTurnResult() With {
            .Status = "waiting_for_input",
            .WaitingTaskId = taskId,
            .Messages = If(messages, New List(Of String)())
        }
    End Function

    ''' <summary>
    ''' La riga è completata; RunUntilInput avanza a CurrentRowIndex + 1.
    ''' </summary>
    Public Shared Function Completed(
        Optional messages As List(Of String) = Nothing
    ) As RowTurnResult
        Return New RowTurnResult() With {
            .Status = "completed",
            .Messages = If(messages, New List(Of String)())
        }
    End Function

    ''' <summary>
    ''' Transizione automatica; RunUntilInput itera di nuovo sulla stessa riga
    ''' con PendingUtterance = "" (es. dopo un Match prima della Confirmation).
    ''' </summary>
    Public Shared Function AutoAdvance(
        Optional messages As List(Of String) = Nothing
    ) As RowTurnResult
        Return New RowTurnResult() With {
            .Status = "auto_advance",
            .Messages = If(messages, New List(Of String)())
        }
    End Function

End Class
