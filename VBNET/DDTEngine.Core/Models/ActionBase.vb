' ActionBase.vb
' Classe base astratta per tutte le actions

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Classe base astratta per tutte le actions
    ''' </summary>
    Public MustInherit Class ActionBase
        Implements IAction

        Public MustOverride ReadOnly Property ActionId As String Implements IAction.ActionId
        Public MustOverride ReadOnly Property Label As String Implements IAction.Label

        ''' <summary>
        ''' Esegue l'azione (implementazione di default: solleva eccezione)
        ''' </summary>
        Public MustOverride Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String)) Implements IAction.Execute
    End Class


