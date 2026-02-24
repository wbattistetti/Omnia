Option Strict On
Option Explicit On

''' <summary>
''' Storage for state persistence
''' </summary>
Public Interface ITaskEngineStateStorage
    Function SaveDialogueContext(taskId As String, ctx As DialogueContext) As System.Threading.Tasks.Task
End Interface
