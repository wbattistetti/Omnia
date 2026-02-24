Option Strict On
Option Explicit On

''' <summary>
''' Microtask: elementary executable action
''' </summary>
Public Class Microtask
    ''' <summary>
    ''' Index of microtask (0, 1, 2, ...)
    ''' </summary>
    Public Property Index As Integer

    ''' <summary>
    ''' Type of microtask
    ''' </summary>
    Public Property Type As MicrotaskType

    ''' <summary>
    ''' Data for microtask (varies by type)
    ''' </summary>
    Public Property Data As Object
End Class

''' <summary>
''' Types of microtasks
''' </summary>
Public Enum MicrotaskType
    SendMessage
    Log
    ' UpdateUI - REMOVED: UI project no longer exists
    CallBackend
    ' Add other types if needed
End Enum
