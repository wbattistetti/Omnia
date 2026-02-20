' TaskInstance.vb
' Rappresenta un'istanza di un Task (runtime)

Option Strict On
Option Explicit On
Imports System.Collections.Generic

    ''' <summary>
    ''' Rappresenta un'istanza di un Task - Struttura Runtime
    ''' Contiene sia i campi design-time (dal frontend TaskTreeExpanded) che i campi runtime
    ''' </summary>
    Public Class TaskInstance
        ' ============================================================
        ' CAMPI DESIGN-TIME (dal frontend TaskTreeExpanded - AST montato)
        ' ============================================================

        ''' <summary>
        ''' ID univoco del Task
        ''' </summary>
        Public Property Id As String

        ''' <summary>
        ''' Label/nome del Task
        ''' </summary>
        Public Property Label As String

        ''' <summary>
        ''' Traduzioni (chiave → testo tradotto)
        ''' </summary>
        Public Property Translations As Dictionary(Of String, String)

        ' ============================================================
        ' CAMPI RUNTIME
        ' ============================================================

        ''' <summary>
        ''' Indica se il Task è aggregato (ha introduction)
        ''' </summary>
        Public Property IsAggregate As Boolean

        ''' <summary>
        ''' Tasks di introduzione (opzionale, mostrato all'inizio)
        ''' </summary>
        Public Property Introduction As IEnumerable(Of ITask)

        ''' <summary>
        ''' Tasks di success (opzionale, mostrato alla fine)
        ''' </summary>
        Public Property SuccessResponse As IEnumerable(Of ITask)

        ''' <summary>
        ''' Lista dei task da eseguire
        ''' </summary>
        Public Property TaskList As List(Of TaskNode)

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        Public Sub New()
            Translations = New Dictionary(Of String, String)()
            TaskList = New List(Of TaskNode)()
        End Sub

        ''' <summary>
        ''' Resetta tutti i nodi del Task
        ''' </summary>
        Public Sub Reset()
            If TaskList IsNot Nothing Then
                For Each taskNode As TaskNode In TaskList
                    taskNode.Reset()
                Next
            End If
        End Sub
    End Class

