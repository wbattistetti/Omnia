Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace GrammarInterpreter.Models

    ''' <summary>
    ''' Single semantic value
    ''' Example: MILANO with synonyms ["Milano", "città del Duomo", ...]
    ''' </summary>
    Public Class SemanticValue
        Public Property Id As String ' UUID
        Public Property Value As String ' Semantic value (e.g., "MILANO")
        Public Property Synonyms As List(Of String) ' Linguistic synonyms
        Public Property Regex As String ' Optional regex pattern

        Public Sub New()
            Synonyms = New List(Of String)()
        End Sub
    End Class

End Namespace
