Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace UtteranceInterpretation

    ''' <summary>Esito completo di interpretUtterance (main + altri task).</summary>
    Public NotInheritable Class UtteranceInterpretationSessionResult

        Public Property FinalUtteranceRemainder As String
        Public Property PerTaskResults As List(Of SingleTaskExtractionResult)

        Public Sub New()
            FinalUtteranceRemainder = String.Empty
            PerTaskResults = New List(Of SingleTaskExtractionResult)()
        End Sub

    End Class

End Namespace
