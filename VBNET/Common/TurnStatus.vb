Option Strict On
Option Explicit On

''' <summary>
''' Status di un turno di esecuzione (DialogueTurnResult o RowTurnResult)
''' </summary>
Public Enum TurnStatus
    ''' <summary>
    ''' Il turno richiede input esterno; l'esecuzione si ferma
    ''' </summary>
    WaitingForInput

    ''' <summary>
    ''' La riga/task è completata; l'esecuzione avanza al prossimo elemento
    ''' </summary>
    Completed

    ''' <summary>
    ''' Transizione automatica; l'esecuzione itera di nuovo sulla stessa riga
    ''' </summary>
    AutoAdvance
End Enum
