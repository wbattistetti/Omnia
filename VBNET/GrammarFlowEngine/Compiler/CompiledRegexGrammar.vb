Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Text.RegularExpressions

''' <summary>
''' Compiled regex grammar - single regex pattern representing entire grammar graph
''' </summary>
Public Class CompiledRegexGrammar
    ''' <summary>
    ''' Full compiled regex for entire grammar
    ''' </summary>
    Public Property FullRegex As Regex

    ''' <summary>
    ''' Regex pattern as string (for debugging)
    ''' </summary>
    Public Property RegexPattern As String

    ''' <summary>
    ''' Maps GroupName → RegexGroupInfo to reconstruct bindings after match
    ''' </summary>
    Public Property GroupMapping As Dictionary(Of String, RegexGroupInfo)

    ''' <summary>
    ''' Original compiled grammar (for lookup semantic values, slots, etc.)
    ''' </summary>
    Public Property OriginalGrammar As CompiledGrammar

    ''' <summary>
    ''' Garbage pattern (pattern for irrelevant words)
    ''' </summary>
    Public Property GarbagePattern As String

    ''' <summary>
    ''' Entry points (pattern for each entry node)
    ''' </summary>
    Public Property EntryPatterns As List(Of String)

    Public Sub New()
        GroupMapping = New Dictionary(Of String, RegexGroupInfo)()
        EntryPatterns = New List(Of String)()
    End Sub
End Class

''' <summary>
''' Information about a regex group for mapping back to original node
''' </summary>
Public Class RegexGroupInfo
    ''' <summary>
    ''' Original node ID
    ''' </summary>
    Public Property NodeId As String

    ''' <summary>
    ''' Node label (for display)
    ''' </summary>
    Public Property NodeLabel As String

    ''' <summary>
    ''' Binding type: "slot", "semantic-value", "semantic-set", "linguistic", "none"
    ''' </summary>
    Public Property BindingType As String

    ''' <summary>
    ''' Slot ID (if BindingType = "slot")
    ''' </summary>
    Public Property SlotId As String

    ''' <summary>
    ''' Semantic value ID (if BindingType = "semantic-value")
    ''' </summary>
    Public Property SemanticValueId As String

    ''' <summary>
    ''' Semantic set ID (if BindingType = "semantic-set")
    ''' </summary>
    Public Property SemanticSetId As String

    ''' <summary>
    ''' Whether node is optional
    ''' </summary>
    Public Property IsOptional As Boolean

    ''' <summary>
    ''' Whether node is repeatable
    ''' </summary>
    Public Property IsRepeatable As Boolean

    ''' <summary>
    ''' Order in which this node appears in the match (for highlighting sequence)
    ''' </summary>
    Public Property MatchOrder As Integer
End Class
