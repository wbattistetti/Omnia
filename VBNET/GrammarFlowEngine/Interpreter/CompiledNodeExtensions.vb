Option Strict On
Option Explicit On

Imports System.Runtime.CompilerServices
Imports GrammarFlowEngine.Compiler

''' <summary>
''' Extension methods for CompiledNode to improve code readability
''' </summary>
Public Module CompiledNodeExtensions

    ''' <summary>
    ''' Checks if this node is an end path given the context and grammar
    ''' </summary>
    <Extension()>
    Public Function IsPathEnd(node As CompiledNode, context As PathMatchState, compiledGrammar As CompiledGrammar) As Boolean
        ' End node: no outgoing edges
        If Not compiledGrammar.Edges.ContainsKey(node.Id) OrElse compiledGrammar.Edges(node.Id).Count = 0 Then
            ' Check if we're at end of text or have acceptable remaining garbage
            Dim remainingText = context.Text.Substring(context.Position).Trim()
            Dim remainingWords = If(String.IsNullOrEmpty(remainingText), 0, remainingText.Split({" "c}, StringSplitOptions.RemoveEmptyEntries).Length)
            Dim availableGarbage = context.MaxGarbage - context.GarbageUsed

            Return remainingWords <= availableGarbage
        End If

        Return False
    End Function

    ''' <summary>
    ''' Gets children nodes for this node from the compiled grammar
    ''' </summary>
    <Extension()>
    Public Function GetChildren(node As CompiledNode, compiledGrammar As CompiledGrammar) As List(Of CompiledNode)
        Dim children As New List(Of CompiledNode)()

        If compiledGrammar.Edges.ContainsKey(node.Id) Then
            For Each edge In compiledGrammar.Edges(node.Id)
                Dim childNode = compiledGrammar.Nodes.GetValueOrDefault(edge.Target)
                If childNode IsNot Nothing Then
                    children.Add(childNode)
                End If
            Next
        End If

        Return children
    End Function

End Module
