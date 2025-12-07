' DialogueState.vb
' Enum per gli stati del dialogo

Option Strict On
Option Explicit On

''' <summary>
''' Stati del dialogo (determinano quale response mostrare)
''' Nota: Per stati dinamici come "condition1", "condition2", ecc., 
''' usare stringhe direttamente (non sono parte dell'enum)
''' </summary>
Public Enum DialogueState
    Start
    NoMatch
    IrrelevantMatch
    NoInput
    Confirmation
    NotConfirmed
    Invalid
    Success
    AcquisitionFailed
End Enum




