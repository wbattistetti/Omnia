Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Result of matching a single node
''' Contains hierarchical structure with children results
''' </summary>
Public Class MatchResult
    Public Property Success As Boolean
    Public Property ConsumedWords As Integer ' Number of words consumed
    Public Property ConsumedChars As Integer ' Number of characters consumed
    Public Property Bindings As Dictionary(Of String, Object) ' Extracted bindings from this match
    Public Property GarbageUsed As Integer ' Garbage words used
    Public Property Skipped As Boolean ' True if this was a skip (optional node)

    ' ✅ Informazioni sul nodo matchato per ricostruire la struttura gerarchica
    Public Property NodeId As String
    Public Property NodeLabel As String
    Public Property MatchedText As String ' Testo linguistico effettivamente matchato (es. "no")
    Public Property MatchType As String ' "regex", "label", "semantic-set", "semantic-value"

    ' ✅ Informazioni sui bindings estratti per questo nodo
    Public Property SlotBinding As NodeBindingInfo ' Se il nodo ha uno slot
    Public Property SemanticValueBinding As NodeBindingInfo ' Se il nodo ha un semantic value

    ' ✅ Struttura gerarchica - risultati dei figli
    Public Property Children As List(Of MatchResult)

    Public Sub New()
        Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        Children = New List(Of MatchResult)()
        Success = False
    End Sub
End Class

''' <summary>
''' Informazioni su un binding estratto da un nodo
''' </summary>
Public Class NodeBindingInfo
    Public Property Type As String ' "slot", "semantic-set", "semantic-value"
    Public Property Id As String ' ID dello slot/semantic-set/semantic-value
    Public Property Name As String ' Nome dello slot/semantic-set/semantic-value
    Public Property Value As String ' Valore estratto
End Class
