Option Strict On
Option Explicit On

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Motore di interpretazione: un livello nella catena di escalation.
    ''' Output: UtteranceParseResult con Extractions (UniformExtraction), non dizionari legacy.
    ''' </summary>
    Public Interface IUtteranceInterpretationEngine

        ''' <summary>Nome leggibile per log e diagnostica.</summary>
        ReadOnly Property DisplayName As String

        ''' <summary>
        ''' Interpreta l'utterance (residuo) corrente. Deve essere deterministica e senza effetti collaterali
        ''' su stato di dialogo o variabili runtime.
        ''' </summary>
        Function Parse(utterance As String) As UtteranceParseResult

    End Interface

End Namespace
