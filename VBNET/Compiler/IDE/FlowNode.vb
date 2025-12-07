Option Strict On
Option Explicit On

''' <summary>
''' Flow node (equivalent to reactflow Node)
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class FlowNode
    ''' <summary>
    ''' Node ID
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Node data (rows, label, etc.)
    ''' </summary>
    Public Property Data As NodeData

    ''' <summary>
    ''' Node position (optional)
    ''' </summary>
    Public Property Position As Object

    ''' <summary>
    ''' Node type (optional)
    ''' </summary>
    Public Property Type As String
End Class


