Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Esito di un singolo motore (un livello di escalation). Lista tipizzata, nessun Dictionary legacy.
    ''' </summary>
    Public NotInheritable Class UtteranceParseResult

        Public Property Success As Boolean

        ''' <summary>Estrazioni con GUID già coerenti con il contratto (compilatore).</summary>
        Public Property Extractions As List(Of UniformExtraction)

        Public Property MatchedText As String

        ''' <summary>0..1 quando il motore la fornisce; default 1 se Success.</summary>
        Public Property Confidence As Double

        Public Sub New()
            Success = False
            Extractions = New List(Of UniformExtraction)()
            MatchedText = String.Empty
            Confidence = 0R
        End Sub

        Public Shared Function NoMatch() As UtteranceParseResult
            Return New UtteranceParseResult() With {.Success = False, .MatchedText = String.Empty}
        End Function

    End Class

End Namespace
