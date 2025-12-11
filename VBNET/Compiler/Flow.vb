Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

''' <summary>
''' Flow structure: contiene nodes, edges, tasks, ddts
''' Helper per navigare struttura IDE durante la compilazione
''' </summary>
Public Class Flow
    ''' <summary>
    ''' Nodes del flowchart (mondo IDE)
    ''' </summary>
    Public Property Nodes As List(Of FlowNode)

    ''' <summary>
    ''' Edges del flowchart (mondo IDE)
    ''' </summary>
    Public Property Edges As List(Of FlowEdge)

    ''' <summary>
    ''' Tasks disponibili (mondo IDE)
    ''' </summary>
    Public Property Tasks As List(Of Task)

    ''' <summary>
    ''' DDTs disponibili (mondo IDE - struttura tipizzata identica al frontend)
    ''' </summary>
    Public Property DDTs As List(Of Compiler.AssembledDDT)

    Public Sub New()
        Nodes = New List(Of FlowNode)()
        Edges = New List(Of FlowEdge)()
        Tasks = New List(Of Task)()
        DDTs = New List(Of AssembledDDT)()
    End Sub
End Class


