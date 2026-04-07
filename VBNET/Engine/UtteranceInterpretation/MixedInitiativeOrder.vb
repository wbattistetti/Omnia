Option Strict On
Option Explicit On

''' <summary>Ordine di applicazione tra task principale e altri task attivi (mixed-initiative).</summary>
Public Enum MixedInitiativeOrder
        ''' <summary>Prima main, poi altri con la stessa utterance residua aggiornata.</summary>
        MainFirstThenOthers = 0
        ''' <summary>Prima gli altri, poi main.</summary>
        OthersFirstThenMain = 1
    End Enum
