Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' TaskGroup Execution Condition: Simplified structure for TaskGroup execution
''' Replaces complex recursive Condition tree with flat list of edge conditions
''' </summary>
Public Class TaskGroupExecCondition
    ''' <summary>
    ''' Lista di condizioni degli edge entranti
    ''' Se esattamente una è vera, il TaskGroup può essere eseguito
    ''' Se più di una è vera → ERRORE (ambiguità)
    ''' Se nessuna è vera E c'è Else → attiva Else
    ''' </summary>
    <JsonProperty("edgeConditions")>
    Public Property EdgeConditions As List(Of EdgeCondition)

    Public Sub New()
        EdgeConditions = New List(Of EdgeCondition)()
    End Sub
End Class

''' <summary>
''' Edge Condition: Condition for a single incoming edge
''' </summary>
Public Class EdgeCondition
    ''' <summary>
    ''' ID del TaskGroup sorgente che deve essere completato
    ''' </summary>
    <JsonProperty("taskGroupId")>
    Public Property TaskGroupId As String

    ''' <summary>
    ''' Espressione AST della condizione edge (JSON serializzato)
    ''' Se null/vuota, considera solo TaskGroupId.completed
    ''' Valutata usando DSLInterpreter
    ''' </summary>
    <JsonProperty("expression")>
    Public Property Expression As String

    ''' <summary>
    ''' True se è una condizione Else
    ''' Else viene attivata solo se TUTTE le altre condizioni sono false
    ''' </summary>
    <JsonProperty("isElse")>
    Public Property IsElse As Boolean

    ''' <summary>
    ''' ID dell'edge (opzionale, per logging/debug)
    ''' </summary>
    <JsonProperty("edgeId")>
    Public Property EdgeId As String
End Class
