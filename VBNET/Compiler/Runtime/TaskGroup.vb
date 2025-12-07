Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' TaskGroup: rappresenta un nodo con tutte le sue righe (task)
''' Tipi del mondo Runtime - usati durante l'esecuzione
''' </summary>
Public Class TaskGroup
    ''' <summary>
    ''' ID del nodo associato
    ''' </summary>
    Public Property NodeId As String

    ''' <summary>
    ''' Condizione di esecuzione del nodo (calcolata UNA volta)
    ''' </summary>
    Public Property ExecCondition As Condition

    ''' <summary>
    ''' Lista di task (righe) da eseguire in sequenza
    ''' </summary>
    Public Property Tasks As List(Of CompiledTask)

    ''' <summary>
    ''' Indica se il TaskGroup è stato eseguito (valorizzato a runtime)
    ''' </summary>
    Public Property Executed As Boolean

    Public Sub New()
        Tasks = New List(Of CompiledTask)()
        Executed = False
    End Sub
End Class


