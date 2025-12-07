Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Runtime.CompilerServices
Imports DDTEngine

''' <summary>
''' Extension methods per navigare la struttura Flow
''' Separa la logica di navigazione dalla struttura dati
''' </summary>
Module FlowUtils
    ''' <summary>
    ''' Ottiene tutti i link entranti per un nodo
    ''' </summary>
    <Extension>
    Public Function GetIncomingLinks(flow As Flow, nodeId As String) As List(Of FlowEdge)
        Return flow.Edges.Where(Function(e) e.Target = nodeId).ToList()
    End Function

    ''' <summary>
    ''' Ottiene tutti i link uscenti per un nodo
    ''' </summary>
    <Extension>
    Public Function GetOutgoingLinks(flow As Flow, nodeId As String) As List(Of FlowEdge)
        Return flow.Edges.Where(Function(e) e.Source = nodeId).ToList()
    End Function

    ''' <summary>
    ''' Ottiene un nodo per ID
    ''' </summary>
    <Extension>
    Public Function GetNodeById(flow As Flow, nodeId As String) As FlowNode
        Return flow.Nodes.FirstOrDefault(Function(n) n.Id = nodeId)
    End Function

    ''' <summary>
    ''' Ottiene un task per ID
    ''' </summary>
    <Extension>
    Public Function GetTaskById(flow As Flow, taskId As String) As Task
        Return flow.Tasks.FirstOrDefault(Function(t) t.Id = taskId)
    End Function

    ''' <summary>
    ''' Verifica se un nodo è raggiungibile (discendente) da un altro nodo
    ''' Usa DFS per verificare se esiste un path da startNodeId a targetNodeId
    ''' </summary>
    <Extension>
    Public Function IsDescendant(flow As Flow, startNodeId As String, targetNodeId As String) As Boolean
        ' Se sono lo stesso nodo, non è discendente
        If startNodeId = targetNodeId Then Return False

        ' DFS per trovare se esiste un path da startNodeId a targetNodeId
        Dim visited As New HashSet(Of String)()
        Dim stack As New Stack(Of String)()
        stack.Push(startNodeId)

        While stack.Count > 0
            Dim currentNodeId = stack.Pop()
            If visited.Contains(currentNodeId) Then Continue While
            visited.Add(currentNodeId)

            ' Se raggiungiamo il target, è discendente
            If currentNodeId = targetNodeId Then Return True

            ' Aggiungi tutti i nodi raggiungibili da questo nodo
            Dim outgoingLinks = flow.GetOutgoingLinks(currentNodeId)
            For Each link In outgoingLinks
                If Not visited.Contains(link.Target) Then
                    stack.Push(link.Target)
                End If
            Next
        End While

        Return False
    End Function

    ''' <summary>
    ''' Verifica se un nodo è entry (non ha link in entrata esterni, solo back edges da discendenti)
    ''' Un nodo è entry se:
    ''' - Non ha link in entrata, OPPURE
    ''' - Tutti i link in entrata arrivano solo da discendenti (cicli/back edges)
    ''' </summary>
    <Extension>
    Public Function IsEntryNode(flow As Flow, nodeId As String) As Boolean
        Dim incomingLinks = flow.GetIncomingLinks(nodeId)

        ' Se non ha link in entrata, è entry
        If incomingLinks.Count = 0 Then Return True

        ' Verifica se tutti i link arrivano da discendenti (back edges)
        For Each link In incomingLinks
            Dim sourceNodeId = link.Source
            ' Se il nodo sorgente NON è discendente, allora è un link esterno → non è entry
            If Not flow.IsDescendant(nodeId, sourceNodeId) Then
                Return False
            End If
        Next

        ' Tutti i link arrivano da discendenti → è entry (ciclo)
        Return True
    End Function

    ' ParseActionType() rimosso: ora Task.Action è Integer e usiamo cast diretto CType()
    ' Se necessario per retrocompatibilità con stringhe, può essere ripristinato
End Module

