Option Strict On
Option Explicit On
Namespace TaskEngine

''' <summary>
''' Storage for state persistence
''' </summary>
Public Interface ITaskEngineStateStorage
    Function SaveDialogueContext(taskId As String, ctx As DialogueContext) As System.Threading.Tasks.Task
End Interface
End Namespace
