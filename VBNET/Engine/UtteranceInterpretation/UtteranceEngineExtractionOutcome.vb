Option Strict On
Option Explicit On

''' <summary>Esito escalation motori su un singolo task (senza triple legacy).</summary>
Public NotInheritable Class UtteranceEngineExtractionOutcome

        Public Property TaskId As String
        Public Property Success As Boolean
        Public Property EngineIndexUsed As Integer
        Public Property UtteranceAfterExtraction As String
        Public Property RuntimeResult As ParseResult
        Public Property LastEngineResult As EngineResult

        Public Sub New()
            Success = False
            EngineIndexUsed = -1
            UtteranceAfterExtraction = String.Empty
            RuntimeResult = New ParseResult() With {.Result = ParseResultType.NoMatch}
        End Sub
    End Class
