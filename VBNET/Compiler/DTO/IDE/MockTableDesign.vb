Option Strict On
Option Explicit On

Namespace Compiler.DTO.IDE

''' <summary>
''' ✅ Column definition: definisce una colonna della mockTable
''' </summary>
Public Class ColumnDefinition
    ''' <summary>
    ''' Nome della colonna (internalName)
    ''' </summary>
    Public Property Name As String

    ''' <summary>
    ''' Tipo di colonna: Input o Output
    ''' </summary>
    Public Property Type As ColumnType

    ''' <summary>
    ''' True = colonna attiva (parte della signature attuale)
    ''' False = colonna parcheggiata (rimossa dalla signature ma dati preservati)
    ''' </summary>
    Public Property IsActive As Boolean

    Public Sub New()
        Name = ""
        Type = ColumnType.Input
        IsActive = True
    End Sub

    Public Sub New(name As String, type As ColumnType, isActive As Boolean)
        Me.Name = name
        Me.Type = type
        Me.IsActive = isActive
    End Sub
End Class

''' <summary>
''' ✅ Tipo di colonna nella mockTable
''' </summary>
Public Enum ColumnType
    Input
    Output
End Enum

''' <summary>
''' ✅ MockTable design: struttura dati tabellare pura
''' Indipendente dal mapping, senza varId
''' Agganciata al singolo BackendCall, non globale
''' Supporta colonne attive e parcheggiate
''' </summary>
Public Class MockTableDesign
    ''' <summary>
    ''' Tutte le colonne (attive + parcheggiate)
    ''' </summary>
    Public Property Columns As List(Of ColumnDefinition)

    ''' <summary>
    ''' Righe della tabella
    ''' </summary>
    Public Property Rows As List(Of RowDesign)

    Public Sub New()
        Columns = New List(Of ColumnDefinition)()
        Rows = New List(Of RowDesign)()
    End Sub
End Class

''' <summary>
''' ✅ Riga della mockTable
''' </summary>
Public Class RowDesign
    ''' <summary>
    ''' ID univoco della riga
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Celle della riga
    ''' </summary>
    Public Property Cells As List(Of CellDesign)

    Public Sub New()
        Id = ""
        Cells = New List(Of CellDesign)()
    End Sub

    Public Sub New(id As String)
        Me.Id = id
        Cells = New List(Of CellDesign)()
    End Sub
End Class

''' <summary>
''' ✅ Cella della mockTable
''' </summary>
Public Class CellDesign
    ''' <summary>
    ''' Nome della colonna (es: "Numero ticket", "Stato")
    ''' Il tipo è nella ColumnDefinition, non più qui
    ''' </summary>
    Public Property ColumnName As String

    ''' <summary>
    ''' Valore della cella
    ''' </summary>
    Public Property Value As Object

    Public Sub New()
        ColumnName = ""
        Value = Nothing
    End Sub

    Public Sub New(columnName As String, value As Object)
        Me.ColumnName = columnName
        Me.Value = value
    End Sub
End Class

End Namespace
