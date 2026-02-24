Option Strict On
Option Explicit On
' NOTE: Cannot import Orchestrator due to circular dependency
Imports Newtonsoft.Json
Imports System.Reflection

''' <summary>
''' Implementation of ITaskEngineStateStorage using ExecutionState (Object)
''' </summary>
Public Class TaskEngineStateStorage
    Implements ITaskEngineStateStorage

    Private ReadOnly _executionState As Object

    Public Sub New(executionState As Object)
        If executionState Is Nothing Then Throw New ArgumentNullException(NameOf(executionState))
        _executionState = executionState
    End Sub

    Public Async Function SaveDialogueContext(taskId As String, ctx As DialogueContext) As System.Threading.Tasks.Task Implements ITaskEngineStateStorage.SaveDialogueContext
        ' Save DialogueContext in ExecutionState (serialized as JSON)
        Dim ctxJson = JsonConvert.SerializeObject(ctx)
        Dim dialogueContextsProp = _executionState.GetType().GetProperty("DialogueContexts")
        If dialogueContextsProp IsNot Nothing Then
            Dim dialogueContexts = DirectCast(dialogueContextsProp.GetValue(_executionState), Dictionary(Of String, String))
            If dialogueContexts IsNot Nothing Then
                dialogueContexts(taskId) = ctxJson
            End If
        End If
        Await System.Threading.Tasks.Task.CompletedTask
    End Function
End Class
