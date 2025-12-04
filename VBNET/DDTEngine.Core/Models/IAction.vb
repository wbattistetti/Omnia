' IAction.vb
' Interfaccia comune per tutte le actions (runtime)

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Interfaccia comune per tutte le actions nel runtime engine
    ''' </summary>
    Public Interface IAction
        ''' <summary>
        ''' ID univoco del tipo di action (es. "sayMessage", "closeSession", "transfer")
        ''' </summary>
        ReadOnly Property ActionId As String

        ''' <summary>
        ''' Etichetta dell'action per logging/debugging
        ''' </summary>
        ReadOnly Property Label As String

        ''' <summary>
        ''' Esegue l'azione
        ''' </summary>
        ''' <param name="dataNode">Il nodo dati corrente</param>
        ''' <param name="ddtInstance">L'istanza DDT completa</param>
        ''' <param name="onMessage">Handler per mostrare messaggi (per MessageAction)</param>
        Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
    End Interface


