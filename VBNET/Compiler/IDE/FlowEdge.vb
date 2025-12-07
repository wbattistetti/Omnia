Option Strict On
Option Explicit On

''' <summary>
''' Flow edge (equivalent to reactflow Edge)
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class FlowEdge
    ''' <summary>
    ''' Edge ID
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Source node ID
    ''' </summary>
    Public Property Source As String

    ''' <summary>
    ''' Target node ID
    ''' </summary>
    Public Property Target As String

    ''' <summary>
    ''' Edge data (condition, isElse, etc.)
    ''' </summary>
    Public Property Data As EdgeData

    ''' <summary>
    ''' Edge label (optional)
    ''' </summary>
    Public Property Label As String
End Class


