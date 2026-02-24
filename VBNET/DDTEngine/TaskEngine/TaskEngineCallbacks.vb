Option Strict On
Option Explicit On

''' <summary>
''' Implementation of ITaskEngineCallbacks that adapts to Action callbacks
''' </summary>
Public Class TaskEngineCallbacks
    Implements ITaskEngineCallbacks

    Private ReadOnly _messageCallback As Action(Of String, String, Integer)

    Public Sub New(messageCallback As Action(Of String, String, Integer))
        _messageCallback = messageCallback
    End Sub

    Public Function OnMessage(text As String) As System.Threading.Tasks.Task Implements ITaskEngineCallbacks.OnMessage
        If _messageCallback IsNot Nothing Then
            _messageCallback(text, "", 0)
        End If
        Return System.Threading.Tasks.Task.CompletedTask
    End Function

    Public Function OnLog(message As String) As System.Threading.Tasks.Task Implements ITaskEngineCallbacks.OnLog
        Console.WriteLine($"[TaskEngine] {message}")
        Return System.Threading.Tasks.Task.CompletedTask
    End Function

    ' OnUIUpdate - REMOVED: UI project no longer exists

    Public Function OnBackendCall(endpoint As String, params As Dictionary(Of String, Object)) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnBackendCall
        ' TODO: Implement backend call callback
        Return System.Threading.Tasks.Task.FromResult(Of Object)(Nothing)
    End Function

    Public Function OnProblemClassify(intents As List(Of String)) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnProblemClassify
        ' TODO: Implement problem classify callback
        Return System.Threading.Tasks.Task.FromResult(Of Object)(Nothing)
    End Function

    Public Function OnAIAgent(config As Object) As System.Threading.Tasks.Task(Of Object) Implements ITaskEngineCallbacks.OnAIAgent
        ' TODO: Implement AI agent callback
        Return System.Threading.Tasks.Task.FromResult(Of Object)(Nothing)
    End Function
End Class
