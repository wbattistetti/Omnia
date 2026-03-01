' DialogueStepType.vb
' Enum per i tipi di step di dialogo

Option Strict On
Option Explicit On

Namespace TaskEngine

''' <summary>
''' Tipi di step di dialogo (determinano quale response mostrare)
''' Nota: Per stati dinamici come "condition1", "condition2", ecc.,
''' usare stringhe direttamente (non sono parte dell'enum)
''' </summary>
Public Enum DialogueStepType
    Start
    NoMatch
    NoInput
    Confirmation
    NotConfirmed
    Invalid
    Success
    ' IrrelevantMatch - rimosso temporaneamente, da rimettere quando presente nel frontend
    ' AcquisitionFailed - rimosso: è uno stato del dato, non uno step type
End Enum

End Namespace
