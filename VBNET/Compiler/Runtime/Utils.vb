Imports System.ComponentModel
Imports System.Runtime.CompilerServices
Imports System.Text.Json
Imports System.Threading

Module Utils

    <Extension>
    Public Function IncomingLinks(flow As Flow, nodeId As String) As List(Of FlowEdge)
        Return flow.Edges.Where(Function(e) e.Target = nodeId).ToList()
    End Function

    '<Extension>
    'Public Function OutgoingLinks(flow As Flow, nodeId As String) As List(Of FlowEdge)
    '    Return flow.Edges.Where(Function(e) e.Source = nodeId).ToList()
    'End Function

    '<Extension>
    'Public Function NodeById(flow As Flow, nodeId As String) As FlowNode
    '    Return flow.Nodes.FirstOrDefault(Function(n) n.Id = nodeId)
    'End Function

    '<Extension>
    'Public Function TaskById(flow As Flow, taskId As String) As Task
    '    Return flow.Tasks.FirstOrDefault(Function(t) t.Id = taskId)
    'End Function
End Module
