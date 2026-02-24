Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports TaskEngine
Namespace TaskEngine

''' <summary>
''' Implementation of ITaskEngineStateStorage using ExecutionState
''' Also saves DialogueContext via callback if provided
''' </summary>
Public Class TaskEngineStateStorage
    Implements ITaskEngineStateStorage

    Private ReadOnly _executionState As ExecutionState
    Private ReadOnly _saveToSessionCallback As Action(Of DialogueContext)

    ''' <summary>
    ''' Costruttore con solo ExecutionState (legacy)
    ''' </summary>
    Public Sub New(executionState As ExecutionState)
        If executionState Is Nothing Then Throw New ArgumentNullException(NameOf(executionState))
        _executionState = executionState
        _saveToSessionCallback = Nothing
    End Sub

    ''' <summary>
    ''' Nuovo costruttore con callback per salvare nella sessione
    ''' </summary>
    Public Sub New(executionState As ExecutionState, saveToSessionCallback As Action(Of DialogueContext))
        If executionState Is Nothing Then Throw New ArgumentNullException(NameOf(executionState))
        _executionState = executionState
        _saveToSessionCallback = saveToSessionCallback
    End Sub

    Public Async Function SaveDialogueContext(taskId As String, ctx As DialogueContext) As System.Threading.Tasks.Task Implements ITaskEngineStateStorage.SaveDialogueContext
        ' ✅ Save DialogueContext in ExecutionState (serialized as JSON)
        Dim ctxJson = JsonConvert.SerializeObject(ctx)
        _executionState.DialogueContexts(taskId) = ctxJson

        ' ✅ Save DialogueContext anche nella sessione se callback disponibile
        If _saveToSessionCallback IsNot Nothing Then
            _saveToSessionCallback(ctx)
        End If

        Await System.Threading.Tasks.Task.CompletedTask
    End Function
End Class
End Namespace
