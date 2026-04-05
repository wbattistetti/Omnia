Option Strict On
Option Explicit On

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Estrazione uniforme da un motore: GUID allineati al contratto/compilatore (nessun mapping runtime).
    ''' TaskInstanceId e NodeId sono i GUID usati da ExtractedVariable / runtime.
    ''' </summary>
    Public NotInheritable Class UniformExtraction

        ''' <summary>GUID istanza task (variabile runtime).</summary>
        Public Property TaskInstanceId As String

        ''' <summary>GUID nodo template (dataSchema / nodeId).</summary>
        Public Property NodeId As String

        ''' <summary>Valore interpretato (es. "Milano").</summary>
        Public Property SemanticValue As Object

        ''' <summary>Porzione di frase coperta (span linguistico).</summary>
        Public Property LinguisticSpan As String

        Public Sub New()
            TaskInstanceId = String.Empty
            NodeId = String.Empty
            LinguisticSpan = String.Empty
        End Sub

    End Class

End Namespace
