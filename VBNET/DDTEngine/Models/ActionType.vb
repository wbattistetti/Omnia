' ActionType.vb
' Enumerato per i tipi di action

Option Strict On
Option Explicit On

''' <summary>
''' Enumerato per identificare i tipi di action disponibili
''' </summary>
Public Enum ActionType
    SayMessage = 1
    CloseSession = 2
    Transfer = 3
    GetData = 4
    BackendCall = 5
    ClassifyProblem = 6
End Enum

