' TaskTypes.vb
' Enumeration for task types - moved to Common to avoid circular dependency

Option Strict On
Option Explicit On

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
    ''' <summary>
    ''' Task guidato da LLM con stato JSON serializzato in ExecutionState.DialogueContexts
    ''' </summary>
    AIAgent
    ''' <summary>Invoca un sotto-flow compilato (stack ExecutionFlow).</summary>
    Subflow
End Enum
