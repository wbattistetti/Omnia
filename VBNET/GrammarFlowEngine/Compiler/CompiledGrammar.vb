Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports GrammarFlowEngine.Models

''' <summary>
''' Compiled grammar with optimized structures for fast interpretation
''' </summary>
Public Class CompiledGrammar
        Public Property Id As String
        Public Property Name As String
        Public Property Nodes As Dictionary(Of String, CompiledNode) ' Keyed by node ID
        Public Property Edges As Dictionary(Of String, List(Of CompiledEdge)) ' Keyed by source node ID
        Public Property Slots As Dictionary(Of String, SemanticSlot) ' Keyed by slot ID
        Public Property SemanticSets As Dictionary(Of String, SemanticSet) ' Keyed by set ID
        Public Property SemanticValues As Dictionary(Of String, SemanticValue) ' Keyed by value ID (for fast lookup)
        Public Property EntryNodes As List(Of CompiledNode) ' Nodes without incoming edges

        Public Sub New()
            Nodes = New Dictionary(Of String, CompiledNode)()
            Edges = New Dictionary(Of String, List(Of CompiledEdge))()
            Slots = New Dictionary(Of String, SemanticSlot)()
            SemanticSets = New Dictionary(Of String, SemanticSet)()
            SemanticValues = New Dictionary(Of String, SemanticValue)()
            EntryNodes = New List(Of CompiledNode)()
        End Sub
    End Class
