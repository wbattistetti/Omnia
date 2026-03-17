Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace GrammarInterpreter.Models

    ''' <summary>
    ''' Set of semantic values
    ''' Example: CITY with values [MILANO, ROMA, TORINO, ...]
    ''' </summary>
    Public Class SemanticSet
        Public Property Id As String ' UUID
        Public Property Name As String ' Set name (e.g., "CITY")
        Public Property Values As List(Of SemanticValue) ' Values in the set

        Public Sub New()
            Values = New List(Of SemanticValue)()
        End Sub
    End Class

End Namespace
