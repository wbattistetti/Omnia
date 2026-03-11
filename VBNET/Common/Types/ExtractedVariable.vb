Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta una variabile estratta dal Parser con la tripla (taskInstanceId, nodeId, value).
''' FlowOrchestrator userà questa tripla per fare lookup e aggiornare VariableStore.
''' </summary>
Public Class ExtractedVariable
    Public Property TaskInstanceId As String
    Public Property NodeId As String
    Public Property Value As Object

    Public Sub New()
    End Sub

    Public Sub New(taskInstanceId As String, nodeId As String, value As Object)
        Me.TaskInstanceId = taskInstanceId
        Me.NodeId = nodeId
        Me.Value = value
    End Sub
End Class
