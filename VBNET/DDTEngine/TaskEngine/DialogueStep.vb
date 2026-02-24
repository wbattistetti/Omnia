Option Strict On
Option Explicit On

''' <summary>
''' Step of the dialogue (for TaskEngine execution)
''' </summary>
Public Class TaskStep
    ''' <summary>
    ''' Name of the step
    ''' </summary>
    Public Property Name As String

    ''' <summary>
    ''' Indicates if step requires user input
    ''' </summary>
    Public Property RequiresUserInput As Boolean

    ''' <summary>
    ''' List of microtasks in this step
    ''' </summary>
    Public Property Microtasks As List(Of Microtask)
End Class
