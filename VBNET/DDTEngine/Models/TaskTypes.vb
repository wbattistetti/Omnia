' ActionType.vb
' Enumerato per i tipi di action

Option Strict On
Option Explicit On

''' <summary>
''' Enumerato per identificare i tipi di action disponibili
''' </summary>
Public Enum TaskTypes
    SayMessage
    CloseSession
    Transfer
    GetData
    BackendCall
    ClassifyProblem
End Enum

