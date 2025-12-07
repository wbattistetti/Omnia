Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

''' <summary>
''' Condition Builder: Constructs conditions from flowchart topology
''' Trasforma condizioni IDE (Edge) in condizioni Runtime (Condition)
''' </summary>
Public Class ConditionBuilder
    ''' <summary>
    ''' Builds condition for first row of a node
    ''' </summary>
    Public Function BuildFirstRowCondition(
        nodeId As String,
        nodes As List(Of FlowNode),
        edges As List(Of FlowEdge)
    ) As Condition
        ' Find incoming edges
        Dim incomingEdges = edges.Where(Function(e) e.Target = nodeId).ToList()

        ' Entry node: always executable
        If incomingEdges.Count = 0 Then
            Return New Condition() With {
                .Type = ConditionType.Always
            }
        End If

        ' Build conditions for each incoming link
        ' Each link condition is: (Parent.Executed AND Link.Condition)
        ' Final condition is: OR of all link conditions
        ' Special case: If an edge has isElse: true, it becomes: (Parent.Executed AND NOT(OR of all other conditions from same source))
        Dim linkConditions As New List(Of Condition)()
        Dim elseEdges As New List(Of FlowEdge)()

        ' First pass: separate Else edges from normal edges
        For Each edge In incomingEdges
            If (edge.Data IsNot Nothing AndAlso edge.Data.IsElse = True) OrElse edge.Label = "Else" Then
                elseEdges.Add(edge)
            End If
        Next

        ' Build conditions for normal (non-Else) edges
        For Each edge In incomingEdges
            ' Skip Else edges in first pass - they'll be handled separately
            If edge.Data IsNot Nothing AndAlso edge.Data.IsElse = True Then
                Continue For
            End If

            Dim parentNode = nodes.FirstOrDefault(Function(n) n.Id = edge.Source)
            If parentNode Is Nothing Then Continue For

            Dim rows = If(parentNode.Data?.Rows, New List(Of RowData)())
            If rows.Count = 0 Then Continue For

            ' Get last row's taskId
            Dim lastRow = rows(rows.Count - 1)
            Dim lastTaskId = If(Not String.IsNullOrEmpty(lastRow.TaskId), lastRow.TaskId, lastRow.Id)

            ' Build condition for this link: (Parent.Executed AND Link.Condition)
            Dim linkConditionParts As New List(Of Condition)()
            linkConditionParts.Add(New Condition() With {
                .Type = ConditionType.TaskState,
                .TaskId = lastTaskId,
                .State = TaskState.Executed
            })

            ' If edge has condition, add it (AND with parent executed)
            Dim conditionId As String = Nothing
            If edge.Data IsNot Nothing Then
                conditionId = If(Not String.IsNullOrEmpty(edge.Data.ConditionId), edge.Data.ConditionId, edge.Data.Condition)
            End If

            If Not String.IsNullOrEmpty(conditionId) Then
                linkConditionParts.Add(New Condition() With {
                    .Type = ConditionType.EdgeCondition,
                    .EdgeId = edge.Id,
                    .EdgeConditionId = conditionId
                })
            End If

            ' If link has both parts, combine with AND; otherwise use single condition
            Dim linkCondition As Condition
            If linkConditionParts.Count = 1 Then
                linkCondition = linkConditionParts(0)
            Else
                linkCondition = New Condition() With {
                    .Type = ConditionType.AndOp,
                    .Conditions = linkConditionParts
                }
            End If

            linkConditions.Add(linkCondition)
        Next

        ' Second pass: handle Else edges
        ' For each Else edge, build: (Parent.Executed AND NOT(OR of all other conditions from same source))
        For Each elseEdge In elseEdges
            Dim parentNode = nodes.FirstOrDefault(Function(n) n.Id = elseEdge.Source)
            If parentNode Is Nothing Then Continue For

            Dim rows = If(parentNode.Data?.Rows, New List(Of RowData)())
            If rows.Count = 0 Then Continue For

            ' Get last row's taskId
            Dim lastRow = rows(rows.Count - 1)
            Dim lastTaskId = If(Not String.IsNullOrEmpty(lastRow.TaskId), lastRow.TaskId, lastRow.Id)

            ' Find all edges FROM the same source node (not just incoming to target)
            ' "Gemelle" = link che condividono lo stesso nodo sorgente
            Dim otherEdgesFromSource = edges.Where(Function(e) _
                e.Source = elseEdge.Source AndAlso
                e.Id <> elseEdge.Id AndAlso
                Not (e.Data IsNot Nothing AndAlso e.Data.IsElse.GetValueOrDefault(False) = True)
            ).ToList()

            ' Extract only edge conditions (without Parent.Executed) for the NOT
            Dim otherEdgeConditions As New List(Of Condition)()
            For Each otherEdge In otherEdgesFromSource
                Dim otherConditionId As String = Nothing
                If otherEdge.Data IsNot Nothing Then
                    otherConditionId = If(Not String.IsNullOrEmpty(otherEdge.Data.ConditionId), otherEdge.Data.ConditionId, otherEdge.Data.Condition)
                End If

                If Not String.IsNullOrEmpty(otherConditionId) Then
                    otherEdgeConditions.Add(New Condition() With {
                        .Type = ConditionType.EdgeCondition,
                        .EdgeId = otherEdge.Id,
                        .EdgeConditionId = otherConditionId
                    })
                End If
            Next

            ' Build Else condition: (Parent.Executed AND NOT(OR of all other edge conditions))
            Dim elseConditionParts As New List(Of Condition)()
            elseConditionParts.Add(New Condition() With {
                .Type = ConditionType.TaskState,
                .TaskId = lastTaskId,
                .State = TaskState.Executed
            })

            If otherEdgeConditions.Count > 0 Then
                ' Create NOT(OR of all other edge conditions) - WITHOUT Parent.Executed
                Dim orOfEdgeConditions As Condition
                If otherEdgeConditions.Count = 1 Then
                    orOfEdgeConditions = otherEdgeConditions(0)
                Else
                    orOfEdgeConditions = New Condition() With {
                        .Type = ConditionType.OrOp,
                        .Conditions = otherEdgeConditions
                    }
                End If

                Dim notCondition As New Condition() With {
                    .Type = ConditionType.NotOp,
                    .Condition = orOfEdgeConditions
                }

                elseConditionParts.Add(notCondition)
            End If
            ' If no other conditions exist, Else is just (Parent.Executed)

            Dim elseLinkCondition As Condition
            If elseConditionParts.Count = 1 Then
                elseLinkCondition = elseConditionParts(0)
            Else
                elseLinkCondition = New Condition() With {
                    .Type = ConditionType.AndOp,
                    .Conditions = elseConditionParts
                }
            End If

            linkConditions.Add(elseLinkCondition)
        Next

        ' If no links, return null (should not happen as entry node is handled above)
        If linkConditions.Count = 0 Then
            Return Nothing
        End If

        ' If only one link, return its condition directly
        If linkConditions.Count = 1 Then
            Return linkConditions(0)
        End If

        ' Multiple links: OR of all link conditions
        ' Formula: (Parent1.Executed AND Link1.Condition) OR (Parent2.Executed AND Link2.Condition) OR ...
        Return New Condition() With {
            .Type = ConditionType.OrOp,
            .Conditions = linkConditions
        }
    End Function

    ''' <summary>
    ''' Builds condition for subsequent row (previous row completed)
    ''' </summary>
    Public Function BuildSequentialCondition(previousTaskId As String) As Condition
        Return New Condition() With {
            .Type = ConditionType.TaskState,
            .TaskId = previousTaskId,
            .State = TaskState.Executed
        }
    End Function

    ''' <summary>
    ''' Builds execution condition for a TaskGroup (node)
    ''' Usa TaskGroupExecuted invece di TaskState per efficienza
    ''' Trasforma condizioni IDE (Edge) in condizioni Runtime (Condition)
    ''' </summary>
    Public Function BuildTaskGroupCondition(
        nodeId As String,
        flow As Flow
    ) As Condition
        Dim incomingLinks = flow.GetIncomingLinks(nodeId)

        ' Entry node: eseguibile solo se non già eseguito
        If incomingLinks.Count = 0 Then
            Return New Condition() With {
                .Type = ConditionType.NotOp,
                .Condition = New Condition() With {
                    .Type = ConditionType.TaskGroupExecuted,
                    .NodeId = nodeId
                }
            }
        End If

        ' Build conditions for each incoming link
        Dim linkConditions As New List(Of Condition)()
        Dim elseEdges As New List(Of FlowEdge)()

        ' First pass: separate Else edges from normal edges
        For Each edge In incomingLinks
            If (edge.Data IsNot Nothing AndAlso edge.Data.IsElse = True) OrElse edge.Label = "Else" Then
                elseEdges.Add(edge)
            End If
        Next

        ' Build conditions for normal (non-Else) edges
        For Each edge In incomingLinks
            ' Skip Else edges in first pass
            If edge.Data IsNot Nothing AndAlso edge.Data.IsElse = True Then
                Continue For
            End If

            Dim sourceNodeId = edge.Source

            ' Costruisci condizione link: (TaskGroup sorgente eseguito AND link.condition)
            Dim linkConditionParts As New List(Of Condition)()

            ' Sempre: TaskGroup sorgente eseguito
            linkConditionParts.Add(New Condition() With {
                .Type = ConditionType.TaskGroupExecuted,
                .NodeId = sourceNodeId
            })

            ' Se link ha condizione, aggiungila (AND)
            Dim conditionId As String = Nothing
            If edge.Data IsNot Nothing Then
                conditionId = If(Not String.IsNullOrEmpty(edge.Data.ConditionId), edge.Data.ConditionId, edge.Data.Condition)
            End If

            If Not String.IsNullOrEmpty(conditionId) Then
                linkConditionParts.Add(New Condition() With {
                    .Type = ConditionType.EdgeCondition,
                    .EdgeId = edge.Id,
                    .EdgeConditionId = conditionId
                })
            End If

            ' Combina con AND
            Dim linkCondition As Condition
            If linkConditionParts.Count = 1 Then
                linkCondition = linkConditionParts(0)
            Else
                linkCondition = New Condition() With {
                    .Type = ConditionType.AndOp,
                    .Conditions = linkConditionParts
                }
            End If

            linkConditions.Add(linkCondition)
        Next

        ' Second pass: handle Else edges
        ' For each Else edge: (TaskGroup sorgente eseguito AND NOT(altre condizioni dello stesso sorgente))
        For Each elseEdge In elseEdges
            Dim sourceNodeId = elseEdge.Source

            ' Find all edges FROM the same source node (gemelle)
            Dim otherEdgesFromSource = flow.Edges.Where(Function(e) _
                e.Source = sourceNodeId AndAlso
                e.Id <> elseEdge.Id AndAlso
                Not (e.Data IsNot Nothing AndAlso e.Data.IsElse.GetValueOrDefault(False) = True)
            ).ToList()

            ' Extract only edge conditions (without TaskGroup.Executed) for the NOT
            Dim otherEdgeConditions As New List(Of Condition)()
            For Each otherEdge In otherEdgesFromSource
                Dim otherConditionId As String = Nothing
                If otherEdge.Data IsNot Nothing Then
                    otherConditionId = If(Not String.IsNullOrEmpty(otherEdge.Data.ConditionId), otherEdge.Data.ConditionId, otherEdge.Data.Condition)
                End If

                If Not String.IsNullOrEmpty(otherConditionId) Then
                    otherEdgeConditions.Add(New Condition() With {
                        .Type = ConditionType.EdgeCondition,
                        .EdgeId = otherEdge.Id,
                        .EdgeConditionId = otherConditionId
                    })
                End If
            Next

            ' Build Else condition: (TaskGroup sorgente eseguito AND NOT(altre condizioni))
            Dim elseConditionParts As New List(Of Condition)()
            elseConditionParts.Add(New Condition() With {
                .Type = ConditionType.TaskGroupExecuted,
                .NodeId = sourceNodeId
            })

            If otherEdgeConditions.Count > 0 Then
                ' Create NOT(OR of all other edge conditions)
                Dim orOfEdgeConditions As Condition
                If otherEdgeConditions.Count = 1 Then
                    orOfEdgeConditions = otherEdgeConditions(0)
                Else
                    orOfEdgeConditions = New Condition() With {
                        .Type = ConditionType.OrOp,
                        .Conditions = otherEdgeConditions
                    }
                End If

                Dim notCondition As New Condition() With {
                    .Type = ConditionType.NotOp,
                    .Condition = orOfEdgeConditions
                }

                elseConditionParts.Add(notCondition)
            End If
            ' If no other conditions exist, Else is just (TaskGroup sorgente eseguito)

            Dim elseLinkCondition As Condition
            If elseConditionParts.Count = 1 Then
                elseLinkCondition = elseConditionParts(0)
            Else
                elseLinkCondition = New Condition() With {
                    .Type = ConditionType.AndOp,
                    .Conditions = elseConditionParts
                }
            End If

            linkConditions.Add(elseLinkCondition)
        Next

        ' If no links, return null (should not happen as entry node is handled above)
        If linkConditions.Count = 0 Then
            Return Nothing
        End If

        ' If only one link, return its condition directly
        If linkConditions.Count = 1 Then
            Return linkConditions(0)
        End If

        ' Multiple links: OR of all link conditions
        Return New Condition() With {
            .Type = ConditionType.OrOp,
            .Conditions = linkConditions
        }
    End Function
End Class

