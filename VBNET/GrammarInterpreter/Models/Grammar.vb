Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace GrammarInterpreter.Models

    ''' <summary>
    ''' Complete grammar structure
    ''' This is the format that the VB.NET runtime reads directly from JSON
    ''' </summary>
    Public Class Grammar
        Public Property Id As String
        Public Property Name As String
        Public Property Nodes As List(Of GrammarNode)
        Public Property Edges As List(Of GrammarEdge)
        Public Property Slots As List(Of SemanticSlot) ' Available semantic slots
        Public Property SemanticSets As List(Of SemanticSet) ' Available semantic sets
        Public Property Metadata As GrammarMetadata

        Public Sub New()
            Nodes = New List(Of GrammarNode)()
            Edges = New List(Of GrammarEdge)()
            Slots = New List(Of SemanticSlot)()
            SemanticSets = New List(Of SemanticSet)()
            Metadata = New GrammarMetadata()
        End Sub
    End Class

    ''' <summary>
    ''' Grammar metadata
    ''' </summary>
    Public Class GrammarMetadata
        Public Property CreatedAt As Long
        Public Property UpdatedAt As Long
        Public Property Version As String
    End Class

End Namespace
