Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports GrammarInterpreter.Models

Namespace GrammarInterpreter.Compiler

    ''' <summary>
    ''' Compiled edge with optimized navigation
    ''' </summary>
    Public Class CompiledEdge
        Public Property Id As String
        Public Property Source As String
        Public Property Target As String
        Public Property Type As String ' "sequential" | "alternative" | "optional"
        Public Property Label As String
        Public Property Order As Integer ' For sequential edges
    End Class

End Namespace
