Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Result of matching a single node
    ''' </summary>
    Public Class MatchResult
        Public Property Success As Boolean
        Public Property ConsumedWords As Integer ' Number of words consumed
        Public Property ConsumedChars As Integer ' Number of characters consumed
        Public Property Bindings As Dictionary(Of String, Object) ' Extracted bindings from this match
        Public Property GarbageUsed As Integer ' Garbage words used
        Public Property Skipped As Boolean ' True if this was a skip (optional node)

        Public Sub New()
            Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            Success = False
        End Sub
    End Class

End Namespace
