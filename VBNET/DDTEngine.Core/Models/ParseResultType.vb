' ParseResultType.vb
' Enum per i tipi di risultato del parsing

Option Strict On
Option Explicit On

Public Enum ParseResultType
    Match        'si riferisce al riempimento di dati
    IrrelevantMatch
    NoMatch
    NoInput
    Confirmed     'si riferisce alla rispsota sì/no di conferma
    NotConfirmed  'si riferisce alla rispsota sì/no di conferma
    Corrected     'correzione implicita: nuovo valore estratto, ma richiede conferma
End Enum
