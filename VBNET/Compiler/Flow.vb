Option Strict On
Option Explicit On

''' <summary>
''' Flow structure: contiene nodes, edges, tasks
''' Helper per navigare struttura IDE durante la compilazione
''' ❌ RIMOSSO: ddts - struttura costruita da template usando templateId
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

    ' ❌ RIMOSSO: DDTs property - non più usato, struttura costruita da template usando templateId
    ' Public Property DDTs As List(Of Compiler.AssembledDDT)

    Public Sub New()
        Nodes = New List(Of FlowNode)()
        Edges = New List(Of FlowEdge)()
        Tasks = New List(Of Task)()
        ' ❌ RIMOSSO: DDTs initialization - non più usato
    End Sub
End Class


