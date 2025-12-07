' DDTInstance.vb
' Rappresenta un'istanza di un DataDialogueTemplate

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Rappresenta un'istanza di un DataDialogueTemplate (DDT)
    ''' </summary>
    Public Class DDTInstance
        ''' <summary>
        ''' Indica se il DDT è aggregato (ha introduction e successResponse)
        ''' </summary>
        Public Property IsAggregate As Boolean

        ''' <summary>
        ''' Response di introduzione (opzionale, mostrato all'inizio)
        ''' </summary>
        Public Property Introduction As Response

        ''' <summary>
        ''' Response di success (opzionale, mostrato alla fine)
        ''' </summary>
        Public Property SuccessResponse As Response

        ''' <summary>
        ''' Lista dei mainData da raccogliere
        ''' </summary>
        Public Property MainDataList As List(Of DDTNode)

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        Public Sub New()
            MainDataList = New List(Of DDTNode)()
        End Sub

        ''' <summary>
        ''' Resetta tutti i nodi del DDT
        ''' </summary>
        Public Sub Reset()
            If MainDataList IsNot Nothing Then
                For Each mainData As DDTNode In MainDataList
                    mainData.Reset()
                Next
            End If
        End Sub
    End Class

