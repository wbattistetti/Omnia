' IVariableContext.vb
' Interfaccia per il contesto globale delle variabili

Option Strict On
Option Explicit On

''' <summary>
''' Interfaccia per accedere al contesto globale delle variabili
''' Permette lookup diretto usando FullLabel come chiave (es. "Nominativo.Nome")
''' </summary>
Public Interface IVariableContext
    ''' <summary>
    ''' Ottiene il valore di una variabile usando FullLabel come chiave
    ''' </summary>
    ''' <param name="fullLabel">FullLabel del nodo (es. "Nominativo.Nome", "Data di Nascita.Giorno")</param>
    ''' <returns>Valore della variabile come stringa, o stringa vuota se non trovata</returns>
    Function GetValue(fullLabel As String) As String

    ''' <summary>
    ''' Verifica se una variabile esiste nel contesto
    ''' </summary>
    ''' <param name="fullLabel">FullLabel del nodo</param>
    ''' <returns>True se la variabile esiste, False altrimenti</returns>
    Function HasVariable(fullLabel As String) As Boolean
End Interface

