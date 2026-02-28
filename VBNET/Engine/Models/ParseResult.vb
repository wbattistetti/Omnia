' ParseResult.vb
' Rappresenta il risultato del parsing dell'input utente

Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta il risultato del parsing dell'input utente
''' </summary>
Public Class ParseResult
    ''' <summary>
    ''' Risultato del parsing
    ''' </summary>
    Public Property Result As ParseResultType

    ''' <summary>
    ''' Dati estratti (se result = "Match")
    ''' </summary>
    Public Property ExtractedData As Dictionary(Of String, Object)

    ''' <summary>
    ''' ID della condizione di validazione fallita (se result = "Invalid")
    ''' </summary>
    Public Property ConditionId As String

    ''' <summary>
    ''' Indica se c'è stata una correzione implicita durante la conferma
    ''' </summary>
    Public Property HasImplicitCorrection As Boolean

    ''' <summary>
    ''' Dati corretti (se HasImplicitCorrection = true)
    ''' </summary>
    Public Property CorrectedData As Dictionary(Of String, Object)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        ExtractedData = New Dictionary(Of String, Object)()
        CorrectedData = New Dictionary(Of String, Object)()
    End Sub
End Class

