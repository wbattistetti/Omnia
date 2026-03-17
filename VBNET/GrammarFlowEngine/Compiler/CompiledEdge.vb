Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports GrammarFlowEngine.Models

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

