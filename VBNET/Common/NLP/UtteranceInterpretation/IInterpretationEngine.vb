Option Strict On
Option Explicit On

''' <summary>
''' Motore di interpretazione: un livello nella catena di escalation.
''' Output: <see cref="EngineResult"/> (solo estrazione NLP: slot / GUID canonico, non conferme né validazioni).
''' </summary>
Public Interface IInterpretationEngine

    ''' <summary>Nome leggibile per log e diagnostica.</summary>
    ReadOnly Property DisplayName As String

    ''' <summary>
    ''' Interpreta l'utterance (residuo) corrente. Deve essere deterministica e senza effetti collaterali
    ''' su stato di dialogo o variabili runtime.
    ''' </summary>
    Function Parse(utterance As String) As EngineResult

End Interface
