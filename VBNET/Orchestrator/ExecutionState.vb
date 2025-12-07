Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Stato di esecuzione del flow orchestrator
''' </summary>
Public Class ExecutionState
    ''' <summary>
    ''' Set di task ID già eseguiti
    ''' </summary>
    Public Property ExecutedTaskIds As HashSet(Of String)

    ''' <summary>
    ''' Store delle variabili globali (valori estratti dai DDT)
    ''' </summary>
    Public Property VariableStore As Dictionary(Of String, Object)

    ''' <summary>
    ''' Stato di retrieval corrente
    ''' </summary>
    Public Property RetrievalState As String

    ''' <summary>
    ''' ID del nodo corrente
    ''' </summary>
    Public Property CurrentNodeId As String

    ''' <summary>
    ''' Indice della riga corrente
    ''' </summary>
    Public Property CurrentRowIndex As Integer

    Public Sub New()
        ExecutedTaskIds = New HashSet(Of String)()
        VariableStore = New Dictionary(Of String, Object)()
        RetrievalState = "empty"
        CurrentNodeId = Nothing
        CurrentRowIndex = 0
    End Sub
End Class

