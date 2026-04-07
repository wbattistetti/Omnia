Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Esito del parse GrammarFlow (regex o navigazione). Solo NLP sul testo, non esito dialogo.
''' </summary>
Public Class ParseResult

    Public Property ParseEvent As ParseEvents
    Public Property Bindings As Dictionary(Of String, Object)
    Public Property ConsumedWords As Integer
    Public Property GarbageUsed As Integer
    Public Property ErrorMessage As String
    Public Property MatchTree As MatchResult

    Public Sub New()
        Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        ParseEvent = ParseEvents.NoMatch
    End Sub

End Class
