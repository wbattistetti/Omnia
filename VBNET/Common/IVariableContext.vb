' IVariableContext.vb
' Interface for global variable context

Option Strict On
Option Explicit On

''' <summary>
''' Interface for accessing global variable context
''' Allows direct lookup using FullLabel as key (e.g. "Nominativo.Nome")
''' </summary>
Public Interface IVariableContext
    ''' <summary>
    ''' Gets the value of a variable using FullLabel as key
    ''' </summary>
    ''' <param name="fullLabel">FullLabel of the node (e.g. "Nominativo.Nome", "Data di Nascita.Giorno")</param>
    ''' <returns>Variable value as string, or empty string if not found</returns>
    Function GetValue(fullLabel As String) As String

    ''' <summary>
    ''' Checks if a variable exists in the context
    ''' </summary>
    ''' <param name="fullLabel">FullLabel of the node</param>
    ''' <returns>True if the variable exists, False otherwise</returns>
    Function HasVariable(fullLabel As String) As Boolean
End Interface
