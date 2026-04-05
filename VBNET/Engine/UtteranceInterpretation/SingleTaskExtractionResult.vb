Option Strict On
Option Explicit On

Namespace UtteranceInterpretation

    ''' <summary>Risultato dell'estrazione per un singolo task dopo escalation motori (runtime ParseResult).</summary>
    Public NotInheritable Class SingleTaskExtractionResult

        Public Property TaskId As String
        Public Property Success As Boolean
        ''' <summary>Risultato compatibile con FillTaskFromParseResult / ProcessTurnHelpers (non nominare "Result": riservato in VB).</summary>
        Public Property RuntimeResult As TaskEngine.ParseResult
        Public Property EngineIndexUsed As Integer
        Public Property UtteranceAfterExtraction As String

        Public Sub New()
            Success = False
            RuntimeResult = New TaskEngine.ParseResult() With {.Result = ParseResultType.NoMatch}
            EngineIndexUsed = -1
            UtteranceAfterExtraction = String.Empty
        End Sub

    End Class

End Namespace
