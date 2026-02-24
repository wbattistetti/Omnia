Option Strict On
Option Explicit On
Namespace TaskEngine

''' <summary>
''' Step execution state (fine granularity for crash resilience)
''' </summary>
Public Class StepExecutionState
    ''' <summary>
    ''' Name of the step
    ''' </summary>
    Public Property StepName As String

    ''' <summary>
    ''' Index of last executed microtask (-1 = no microtask executed)
    ''' </summary>
    Public Property MicrotaskIndex As Integer
End Class
End Namespace
