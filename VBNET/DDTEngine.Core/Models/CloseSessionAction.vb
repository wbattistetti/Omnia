' CloseSessionAction.vb
' Action per chiudere la conversazione

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Action per chiudere la conversazione/sessione
    ''' </summary>
    Public Class CloseSessionAction
        Inherits ActionBase

        Public Overrides ReadOnly Property ActionId As String
            Get
                Return "closeSession"
            End Get
        End Property

        Public Overrides ReadOnly Property Label As String
            Get
                Return "Close Session"
            End Get
        End Property

        ''' <summary>
        ''' Esegue l'azione: chiude la sessione
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


