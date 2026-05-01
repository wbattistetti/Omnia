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

    ''' <summary>
    ''' Per colonna input: True se <c>inputs[].variable</c> è costante (non in knownVariableIds), non un varId.
    ''' </summary>
    Public Property InputIsLiteral As Dictionary(Of String, Boolean)

    ''' <summary>
    ''' Per colonna output: True se <c>outputs[].variable</c> è costante — in runtime non si scrive in VariableStore.
    ''' </summary>
    Public Property OutputIsLiteral As Dictionary(Of String, Boolean)

    Public Sub New()
        InputMappings = New Dictionary(Of String, String)()
        OutputMappings = New Dictionary(Of String, String)()
        InputIsLiteral = New Dictionary(Of String, Boolean)()
        OutputIsLiteral = New Dictionary(Of String, Boolean)()
    End Sub
End Class

End Namespace
