Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Node in the grammar graph
''' The VB.NET runtime reads this format directly from JSON
''' </summary>
Public Class GrammarNode
        Public Property Id As String ' UUID
        Public Property Label As String ' Main word (e.g., "voglio")
        Public Property Synonyms As List(Of String) ' List of synonyms (e.g., ["vorrei", "desidero"])
        Public Property Regex As String ' Optional regex pattern (e.g., "[Vv]oglio")

        ''' <summary>
        ''' Semantics: heterogeneous bindings list
        ''' Constraints (enforced by validateBindings):
        ''' - Maximum one slot
        ''' - Either one or more semantic sets OR one semantic value (not both)
        ''' </summary>
        Public Property Bindings As List(Of NodeBinding)

        ''' <summary>
        ''' Node properties
        ''' </summary>
        Public Property [Optional] As Boolean ' Optional node
        Public Property Repeatable As Boolean ' Repeatable node
        Public Property FreeSpeech As Boolean = True ' Free speech mode: if True, allows garbage before/after this node

        ''' <summary>
        ''' Graphical position (for editor, not used in runtime)
        ''' </summary>
        Public Property Position As Position

        ''' <summary>
        ''' Metadata
        ''' </summary>
        Public Property CreatedAt As Long
        Public Property UpdatedAt As Long

        Public Sub New()
            Synonyms = New List(Of String)()
            Bindings = New List(Of NodeBinding)()
            Position = New Position()
        End Sub
    End Class

    ''' <summary>
    ''' Position in the graph editor
    ''' </summary>
    Public Class Position
        Public Property X As Double
        Public Property Y As Double
End Class