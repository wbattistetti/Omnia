Option Strict On
Option Explicit On
Imports System.Linq
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports TaskEngine

''' <summary>
''' Condition Builder: Constructs conditions from flowchart topology
''' Trasforma condizioni IDE (Edge) in condizioni Runtime (Condition)
''' qui dovrebe in realta costruite la condizione per il taskgrupo che contiente tutte le righe di flownode ciasucna delle quali punta ad un istnza di task. Il nome piu corretto non dovrebbe essere TaskGroupConditionBuilder?
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
        ' ✅ Read isElse from top-level
        For Each edge In incomingEdges
            If edge.IsElse = True Then
                elseEdges.Add(edge)
            End If
        Next

        ' Build conditions for normal (non-Else) edges
        For Each edge In incomingEdges
            ' Skip Else edges in first pass - they'll be handled separately
            ' ✅ Read isElse from top-level
            If edge.IsElse = True Then
                Continue For
            End If

            Dim matchingNodes = nodes.Where(Function(n) n.Id = edge.Source).ToList()
            If matchingNodes.Count = 0 Then
                Throw New InvalidOperationException($"Edge '{edge.Id}' references Source node '{edge.Source}' that does not exist in the flow. Every edge must reference a valid source node.")
            ElseIf matchingNodes.Count > 1 Then
                Throw New InvalidOperationException($"Edge '{edge.Id}' references Source node '{edge.Source}' that appears {matchingNodes.Count} times. Each node ID must be unique.")
            End If
            Dim parentNode = matchingNodes.Single()

            Dim rows = If(parentNode.Rows, New List(Of TaskRow)())
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
            ' ✅ Read conditionId from top-level
            Dim conditionId As String = edge.ConditionId

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
            Dim matchingNodes = nodes.Where(Function(n) n.Id = elseEdge.Source).ToList()
            If matchingNodes.Count = 0 Then
                Throw New InvalidOperationException($"ElseEdge '{elseEdge.Id}' references Source node '{elseEdge.Source}' that does not exist in the flow. Every edge must reference a valid source node.")
            ElseIf matchingNodes.Count > 1 Then
                Throw New InvalidOperationException($"ElseEdge '{elseEdge.Id}' references Source node '{elseEdge.Source}' that appears {matchingNodes.Count} times. Each node ID must be unique.")
            End If
            Dim parentNode = matchingNodes.Single()

            Dim rows = If(parentNode.Rows, New List(Of TaskRow)())
            If rows.Count = 0 Then Continue For

            ' Get last row's taskId
            Dim lastRow = rows(rows.Count - 1)
            Dim lastTaskId = If(Not String.IsNullOrEmpty(lastRow.TaskId), lastRow.TaskId, lastRow.Id)

            ' Find all edges FROM the same source node (not just incoming to target)
            ' "Gemelle" = link che condividono lo stesso nodo sorgente
            ' ✅ Read isElse from top-level
            Dim otherEdgesFromSource = edges.Where(Function(e) _
                e.Source = elseEdge.Source AndAlso
                e.Id <> elseEdge.Id AndAlso
                Not (e.IsElse.GetValueOrDefault(False) = True)
            ).ToList()

            ' Extract only edge conditions (without Parent.Executed) for the NOT
            Dim otherEdgeConditions As New List(Of Condition)()
            For Each otherEdge In otherEdgesFromSource
                ' ✅ Read conditionId from top-level
                Dim otherConditionId As String = otherEdge.ConditionId

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
    ''' Nuova struttura semplificata: lista piatta di EdgeCondition invece di albero ricorsivo
    ''' </summary>
    Public Function BuildTaskGroupCondition(
        nodeId As String,
        flow As Flow
    ) As TaskGroupExecCondition
        Dim incomingLinks = flow.GetIncomingLinks(nodeId)
        Dim result As New TaskGroupExecCondition()

        ' Entry node: eseguibile solo se non già eseguito
        ' Crea una condizione speciale per entry node
        If incomingLinks.Count = 0 Then
            ' Entry node: condizione che verifica che il nodo stesso NON sia stato eseguito
            ' Questo viene gestito come un EdgeCondition speciale con TaskGroupId = nodeId
            ' e Expression che valuta NOT(executed)
            ' Per semplicità, usiamo una struttura che verrà valutata come:
            ' "Se nodeId NON è in ExecutedTaskGroupIds"
            ' Questo viene gestito nell'evaluator
            Return result ' Entry node: lista vuota = sempre eseguibile se non già eseguito
        End If

        ' Build EdgeCondition per ogni edge entrante
        For Each edge In incomingLinks
            Dim sourceNodeId = edge.Source
            Dim conditionId As String = edge.ConditionId
            Dim isElse = edge.IsElse.GetValueOrDefault(False)

            ' Ottieni AST dalla condizione se presente
            Dim expressionAst As String = Nothing
            ' ✅ FASE 2: Use expression.* instead of data.*
            If Not String.IsNullOrEmpty(conditionId) AndAlso flow.Conditions IsNot Nothing Then
                Dim condition = flow.Conditions.FirstOrDefault(Function(c) c.Id = conditionId)
                If condition IsNot Nothing AndAlso condition.Expression IsNot Nothing Then
                    expressionAst = condition.Expression.Ast
                End If
            End If

            ' Crea EdgeCondition
            Dim edgeCondition As New EdgeCondition() With {
                .TaskGroupId = sourceNodeId,
                .Expression = expressionAst,
                .IsElse = isElse,
                .EdgeId = edge.Id
            }

            result.EdgeConditions.Add(edgeCondition)
        Next

        Return result
    End Function
End Class

