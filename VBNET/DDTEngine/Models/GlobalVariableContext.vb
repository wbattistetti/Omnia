' GlobalVariableContext.vb
' Implementazione del contesto globale delle variabili

Option Strict On
Option Explicit On

Imports System.Linq

''' <summary>
''' Implementazione del contesto globale delle variabili
''' Cerca prima nel DDTInstance corrente, poi in altri contesti se disponibili
''' </summary>
Public Class GlobalVariableContext
    Implements IVariableContext

    Private ReadOnly _ddtInstance As DDTInstance
    Private ReadOnly _additionalContexts As List(Of IVariableContext)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    ''' <param name="ddtInstance">DDTInstance corrente (opzionale)</param>
    Public Sub New(Optional ddtInstance As DDTInstance = Nothing)
        Me._ddtInstance = ddtInstance
        Me._additionalContexts = New List(Of IVariableContext)()
    End Sub

    ''' <summary>
    ''' Aggiunge un contesto aggiuntivo per la ricerca variabili
    ''' </summary>
    Public Sub AddContext(context As IVariableContext)
        If context IsNot Nothing Then
            _additionalContexts.Add(context)
        End If
    End Sub

    ''' <summary>
    ''' Ottiene il valore di una variabile usando FullLabel come chiave
    ''' </summary>
    Public Function GetValue(fullLabel As String) As String Implements IVariableContext.GetValue
        If String.IsNullOrEmpty(fullLabel) Then
            Return ""
        End If

        ' 1. Cerca nel DDTInstance corrente
        If _ddtInstance IsNot Nothing Then
            Dim value As String = GetValueFromDDTInstance(fullLabel, _ddtInstance)
            If Not String.IsNullOrEmpty(value) Then
                Return value
            End If
        End If

        ' 2. Cerca nei contesti aggiuntivi
        For Each context As IVariableContext In _additionalContexts
            If context.HasVariable(fullLabel) Then
                Dim value As String = context.GetValue(fullLabel)
                If Not String.IsNullOrEmpty(value) Then
                    Return value
                End If
            End If
        Next

        Return ""
    End Function

    ''' <summary>
    ''' Verifica se una variabile esiste nel contesto
    ''' </summary>
    Public Function HasVariable(fullLabel As String) As Boolean Implements IVariableContext.HasVariable
        If String.IsNullOrEmpty(fullLabel) Then
            Return False
        End If

        ' 1. Verifica nel DDTInstance corrente
        If _ddtInstance IsNot Nothing Then
            If HasVariableInDDTInstance(fullLabel, _ddtInstance) Then
                Return True
            End If
        End If

        ' 2. Verifica nei contesti aggiuntivi
        For Each context As IVariableContext In _additionalContexts
            If context.HasVariable(fullLabel) Then
                Return True
            End If
        Next

        Return False
    End Function

    ''' <summary>
    ''' Cerca una variabile nel DDTInstance usando FullLabel
    ''' </summary>
    Private Function GetValueFromDDTInstance(fullLabel As String, ddtInstance As DDTInstance) As String
        If ddtInstance Is Nothing OrElse ddtInstance.MainDataList Is Nothing Then
            Return ""
        End If

        ' Cerca il nodo con questa FullLabel
        Dim node As DDTNode = FindNodeByFullLabel(fullLabel, ddtInstance)
        If node Is Nothing Then
            Return ""
        End If

        ' Se è un mainData composito, costruisci il valore dai subData
        If node.HasSubData() Then
            Dim valueParts As New List(Of String)()
            For Each subData As DDTNode In node.SubData
                If subData.Value IsNot Nothing Then
                    valueParts.Add(subData.Value.ToString())
                End If
            Next
            Return String.Join(" ", valueParts)
        ElseIf node.Value IsNot Nothing Then
            Return node.Value.ToString()
        End If

        Return ""
    End Function

    ''' <summary>
    ''' Verifica se una variabile esiste nel DDTInstance
    ''' </summary>
    Private Function HasVariableInDDTInstance(fullLabel As String, ddtInstance As DDTInstance) As Boolean
        Return FindNodeByFullLabel(fullLabel, ddtInstance) IsNot Nothing
    End Function

    ''' <summary>
    ''' Trova un nodo nel DDTInstance usando FullLabel
    ''' </summary>
    Private Function FindNodeByFullLabel(fullLabel As String, ddtInstance As DDTInstance) As DDTNode
        If ddtInstance Is Nothing OrElse ddtInstance.MainDataList Is Nothing Then
            Return Nothing
        End If

        ' Cerca ricorsivamente in tutti i nodi
        For Each mainData As DDTNode In ddtInstance.MainDataList
            Dim found As DDTNode = FindNodeRecursive(mainData, fullLabel)
            If found IsNot Nothing Then
                Return found
            End If
        Next

        Return Nothing
    End Function

    ''' <summary>
    ''' Cerca ricorsivamente un nodo con la FullLabel specificata
    ''' </summary>
    Private Function FindNodeRecursive(node As DDTNode, fullLabel As String) As DDTNode
        If node Is Nothing Then
            Return Nothing
        End If

        ' Verifica se questo nodo ha la FullLabel cercata
        If String.Equals(node.FullLabel, fullLabel, StringComparison.OrdinalIgnoreCase) Then
            Return node
        End If

        ' Cerca ricorsivamente nei subData
        If node.SubData IsNot Nothing Then
            For Each subData As DDTNode In node.SubData
                Dim found As DDTNode = FindNodeRecursive(subData, fullLabel)
                If found IsNot Nothing Then
                    Return found
                End If
            Next
        End If

        Return Nothing
    End Function
End Class

