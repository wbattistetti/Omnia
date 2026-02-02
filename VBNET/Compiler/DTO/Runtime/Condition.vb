Option Strict On
Option Explicit On

''' <summary>
''' Condition: Defines when a task can be executed
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class Condition
    ''' <summary>
    ''' Type of condition
    ''' </summary>
    Public Property Type As ConditionType

    ''' <summary>
    ''' Task ID (for TaskState condition)
    ''' </summary>
    Public Property TaskId As String

    ''' <summary>
    ''' Task state (for TaskState condition)
    ''' </summary>
    Public Property State As TaskState?

    ''' <summary>
    ''' Edge ID (for EdgeCondition)
    ''' </summary>
    Public Property EdgeId As String

    ''' <summary>
    ''' Edge condition ID (for EdgeCondition)
    ''' </summary>
    Public Property EdgeConditionId As String

    ''' <summary>
    ''' Sub-conditions (for And/Or conditions)
    ''' </summary>
    Public Property Conditions As List(Of Condition)

    ''' <summary>
    ''' Inner condition (for Not condition)
    ''' </summary>
    Public Property Condition As Condition

    ''' <summary>
    ''' Node ID (for TaskGroupExecuted condition)
    ''' </summary>
    Public Property NodeId As String

    Public Sub New()
        Conditions = New List(Of Condition)()
    End Sub
End Class

''' <summary>
''' Condition types
''' </summary>
Public Enum ConditionType
    Always = 0
    TaskState = 1
    EdgeCondition = 2
    AndOp = 3
    OrOp = 4
    NotOp = 5
    TaskGroupExecuted = 6  ' Verifica se TaskGroup è eseguito
End Enum


