Option Strict On
Option Explicit On

Namespace Compiler.DTO.IDE

''' <summary>
''' ✅ Mapping colonne → variabili (varId)
''' Separato dalla tabella, ma parte del BackendCall
''' </summary>
Public Class ColumnMapping
    ''' <summary>
    ''' Mapping colonne input → varId
    ''' </summary>
    Public Property InputMappings As Dictionary(Of String, String)

    ''' <summary>
    ''' Mapping colonne output → varId
    ''' </summary>
    Public Property OutputMappings As Dictionary(Of String, String)

    Public Sub New()
        InputMappings = New Dictionary(Of String, String)()
        OutputMappings = New Dictionary(Of String, String)()
    End Sub
End Class

End Namespace
