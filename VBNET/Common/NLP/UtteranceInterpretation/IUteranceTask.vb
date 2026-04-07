Option Strict On
Option Explicit On

''' <summary>Task interpretabile: Parse → <see cref="EngineResult"/> e filled check.</summary>
Public Interface IUtteranceTask
    Function Parse(utterance As String) As EngineResult
    Function IsFilled(state As DialogueState) As Boolean
    ReadOnly Property TaskId As String
End Interface
