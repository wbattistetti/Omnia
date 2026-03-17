Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.RegularExpressions
Imports GrammarInterpreter.Models

Namespace GrammarInterpreter.Compiler

    ''' <summary>
    ''' Compiled node with pre-compiled regex and optimized structures
    ''' </summary>
    Public Class CompiledNode
        Public Property Id As String
        Public Property Label As String
        Public Property Synonyms As HashSet(Of String) ' For fast lookup
        Public Property CompiledRegex As Regex ' Pre-compiled regex (if present)
        Public Property Bindings As List(Of NodeBinding)
        Public Property Optional As Boolean
        Public Property Repeatable As Boolean

        ''' <summary>
        ''' All words to match (label + synonyms) for quick lookup
        ''' </summary>
        Public Property AllWords As HashSet(Of String)

        Public Sub New()
            Synonyms = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
            Bindings = New List(Of NodeBinding)()
            AllWords = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        End Sub
    End Class

End Namespace
