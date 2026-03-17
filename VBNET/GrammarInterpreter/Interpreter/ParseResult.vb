Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace GrammarInterpreter.Interpreter

    ''' <summary>
    ''' Final result of parsing text with grammar
    ''' </summary>
    Public Class ParseResult
        Public Property Success As Boolean
        Public Property Bindings As Dictionary(Of String, Object) ' All extracted bindings
        Public Property ConsumedWords As Integer ' Total words consumed
        Public Property GarbageUsed As Integer ' Total garbage words used
        Public Property ErrorMessage As String ' Error message if failed

        Public Sub New()
            Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            Success = False
        End Sub
    End Class

End Namespace
