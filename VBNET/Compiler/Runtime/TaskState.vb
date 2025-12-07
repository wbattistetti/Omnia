Option Strict On
Option Explicit On

''' <summary>
''' Task State: Execution state of a task
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Enum TaskState
    UnExecuted = 0
    Executed = 1
    WaitingUserInput = 2
End Enum


