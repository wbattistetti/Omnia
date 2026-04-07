Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Esito dell'estrazione NLP da un singolo motore (regex, GrammarFlow, last-word, …).
''' Non include conferme, validazioni o passi di dialogo: solo valori semantici/linguistici + testo consumato/residuo.
''' Il layer dialogo proietta questo tipo in ParseResult (motore dialogo / Engine).
''' </summary>
Public Class EngineResult

    ''' <summary>True se c'è almeno un <see cref="ParserMatch"/> utile.</summary>
    Public Property Success As Boolean

    ''' <summary>Span coperto dal match (join degli span linguistici o fallback).</summary>
    Public Property MatchedText As String

    ''' <summary>Residuo dell'utterance dopo il match (per mixed-initiative / escalation).</summary>
    Public Property UnmatchedText As String

    ''' <summary>Estrazioni per GUID canonico (CanonicalGuidTable).</summary>
    Public Property Matches As List(Of ParserMatch)

    Public Sub New()
        MatchedText = String.Empty
        UnmatchedText = String.Empty
        Matches = New List(Of ParserMatch)()
    End Sub

    ''' <summary>Nessuna estrazione: residuo = utterance trimmata.</summary>
    Public Shared Function NoMatch(Optional utterance As String = Nothing) As EngineResult
        Return New EngineResult With {
            .Success = False,
            .MatchedText = String.Empty,
            .UnmatchedText = If(utterance, String.Empty).Trim(),
            .Matches = New List(Of ParserMatch)()
        }
    End Function

End Class
