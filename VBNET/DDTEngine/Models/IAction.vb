' IAction.vb
' Interfaccia comune per tutte le actions (runtime)

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Interfaccia comune per tutte le actions nel runtime engine
    ''' </summary>
    Public Interface IAction
    ReadOnly Property ActionId As String

    ReadOnly Property Label As String

    ''' <summary>
    ''' Esegue l'azione
    ''' </summary>
    ''' <param name="dataNode">Il nodo dati corrente</param>
    ''' <param name="ddtInstance">L'istanza DDT completa</param>
    ''' <param name="onMessage">Handler per mostrare messaggi (per MessageAction) comunica all'UI se va mostrato qualcosa (serve non a runtime ma design time nel debugger </param>
    Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
    End Interface


