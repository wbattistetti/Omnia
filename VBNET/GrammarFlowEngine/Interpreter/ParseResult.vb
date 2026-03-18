Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Final result of parsing text with grammar
''' Contains hierarchical match tree for UI display
''' </summary>
Public Class ParseResult
        Public Property Success As Boolean
        Public Property Bindings As Dictionary(Of String, Object) ' All extracted bindings
        Public Property ConsumedWords As Integer ' Total words consumed
        Public Property GarbageUsed As Integer ' Total garbage words used
        Public Property ErrorMessage As String ' Error message if failed

        ' ✅ NUOVO: Risultato gerarchico completo per ricostruire la struttura UI
        Public Property MatchTree As MatchResult ' Albero completo del match

        Public Sub New()
            Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            Success = False
        End Sub
    End Class
