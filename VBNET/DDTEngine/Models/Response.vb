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
    ''' Azioni da eseguire (opzionale)
    ''' Ora è una lista di IAction invece di List(Of String)
    ''' </summary>
    Public Property Actions As List(Of IAction)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Actions = New List(Of IAction)()
    End Sub
End Class

