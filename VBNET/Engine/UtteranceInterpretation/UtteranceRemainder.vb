Option Strict On
Option Explicit On

Namespace UtteranceInterpretation

    ''' <summary>
    ''' Consumo deterministico dell'utterance: rimuove la prima occorrenza di matchedText (case-sensitive al testo dato).
    ''' Strategie alternative (regex, span) possono essere aggiunte in altre funzioni senza toccare il motore legacy.
    ''' </summary>
    Public Module UtteranceRemainder

        ''' <summary>
        ''' Rimuove una sola occorrenza di matched dalla stringa full, poi Trim.
        ''' Se matched non è sottostringa di full, restituisce full inalterata.
        ''' </summary>
        Public Function RemoveFirstMatchedPortion(full As String, matched As String) As String
            If String.IsNullOrEmpty(full) Then Return String.Empty
            If String.IsNullOrEmpty(matched) Then Return full.Trim()

            Dim idx = full.IndexOf(matched, StringComparison.Ordinal)
            If idx < 0 Then Return full.Trim()

            Dim before = full.Substring(0, idx)
            Dim after = full.Substring(idx + matched.Length)
            Return (before & after).Trim()
        End Function

    End Module

End Namespace
