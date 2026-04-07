Option Strict On
Option Explicit On


''' <summary>Esito interpretUtterance (main + altri task).</summary>
Public NotInheritable Class UtteranceInterpretationSessionResult

        Public Property FinalUtteranceRemainder As String
        Public Property PerTaskResults As List(Of UtteranceEngineExtractionOutcome)

        Public Sub New()
            FinalUtteranceRemainder = String.Empty
            PerTaskResults = New List(Of UtteranceEngineExtractionOutcome)()
        End Sub

    End Class
