' CloseSessionTask.vb
' Task per chiudere la conversazione

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Task per chiudere la conversazione/sessione
    ''' </summary>
    Public Class CloseSessionTask
        Inherits TaskBase

        Public Overrides ReadOnly Property Label As String
            Get
                Return "Close Session"
            End Get
        End Property

        ''' <summary>
        ''' Esegue il task: chiude la sessione
        ''' </summary>
        Public Overrides Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
            ' TODO: Implementare logica per chiudere sessione
            ' Esempio: onMessage("Sessione chiusa")
            ' Oppure: sollevare evento specifico per chiusura sessione
            If onMessage IsNot Nothing Then
                onMessage("Sessione chiusa")
            End If
        End Sub
    End Class

