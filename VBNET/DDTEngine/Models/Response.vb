' Response.vb
' Rappresenta un response del dialogo

Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta un response del dialogo
''' </summary>
Public Class Response
    ''' <summary>
    ''' Indica se questo response ha una exit condition
    ''' </summary>

    ''' <summary>
    ''' Tasks da eseguire (opzionale)
    ''' Ora è una lista di ITask invece di List(Of String)
    ''' </summary>
    Public Property Tasks As List(Of ITask)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Tasks = New List(Of ITask)()
    End Sub
End Class

