Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Result of matching text against compiled regex grammar
''' Contains bindings, matched nodes, and highlighting information
''' </summary>
Public Class RegexMatchResult
    Public Property Success As Boolean
    Public Property MatchedText As String
    Public Property Bindings As Dictionary(Of String, Object)
    Public Property MatchedNodes As List(Of String) ' NodeIds matched (in order of appearance)
    Public Property SlotValues As Dictionary(Of String, String) ' SlotId → Value
    Public Property SemanticValues As List(Of String) ' SemanticValueIds activated
    Public Property ConsumedWords As Integer
    Public Property GarbageUsed As Integer

    ''' <summary>
    ''' Detailed match information for each matched node (for highlighting)
    ''' </summary>
    Public Property NodeMatches As List(Of NodeMatchInfo)

    Public Sub New()
        Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        MatchedNodes = New List(Of String)()
        SlotValues = New Dictionary(Of String, String)()
        SemanticValues = New List(Of String)()
        NodeMatches = New List(Of NodeMatchInfo)()
        Success = False
    End Sub
End Class

''' <summary>
''' Information about a single matched node (for highlighting)
''' </summary>
Public Class NodeMatchInfo
    Public Property NodeId As String
    Public Property NodeLabel As String
    Public Property MatchedText As String
    Public Property BindingType As String ' "slot", "semantic-value", "semantic-set", "linguistic", "none"
    Public Property SlotId As String
    Public Property SemanticValueId As String
    Public Property SemanticSetId As String
    Public Property MatchOrder As Integer ' Order in which this node was matched
    Public Property StartIndex As Integer ' Start position in original text
    Public Property EndIndex As Integer ' End position in original text
End Class
