Option Strict On
Option Explicit On

''' <summary>
''' Edge data
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class EdgeData
    ''' <summary>
    ''' Condition ID (GUID)
    ''' </summary>
    Public Property Condition As String

    ''' <summary>
    ''' Condition ID (alternative name)
    ''' </summary>
    Public Property ConditionId As String

    ''' <summary>
    ''' Is this an Else edge?
    ''' </summary>
    Public Property IsElse As Boolean?
End Class


