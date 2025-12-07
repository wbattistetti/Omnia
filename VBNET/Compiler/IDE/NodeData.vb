Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Node data
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class NodeData
    ''' <summary>
    ''' Rows in the node
    ''' </summary>
    Public Property Rows As List(Of RowData)

    ''' <summary>
    ''' Node label
    ''' </summary>
    Public Property Label As String

    ''' <summary>
    ''' Node title
    ''' </summary>
    Public Property Title As String

    Public Sub New()
        Rows = New List(Of RowData)()
    End Sub
End Class


