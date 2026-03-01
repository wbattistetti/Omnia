' TaskTypes.vb
' Enumeration for task types - moved to Shared to avoid circular dependency

Option Strict On
Option Explicit On

Namespace TaskEngine

''' <summary>
''' Enumerato per identificare i tipi di action disponibili
''' </summary>
Public Enum TaskTypes
    SayMessage
    CloseSession
    Transfer
    UtteranceInterpretation    ' ✅ Rinominato da DataRequest (interpreta utterance utente per estrarre dati)
    BackendCall
    ClassifyProblem
End Enum

End Namespace
