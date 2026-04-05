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
    ''' Dati estratti come triple (taskInstanceId, nodeId, value)
    ''' ✅ NEW: Struttura esplicita per lookup runtime
    ''' </summary>
    Public Property ExtractedVariables As List(Of ExtractedVariable)

    ''' <summary>
    ''' Porzione di utterance considerata coperta dal match (UtteranceInterpretation / telemetria).
    ''' Opzionale: il vecchio Parser non la imposta.
    ''' </summary>
    Public Property MatchedText As String

    ''' <summary>
    ''' Residuo dopo consumo del match (UtteranceInterpretation).
    ''' </summary>
    Public Property UnmatchedText As String

    ''' <summary>
    ''' Confidenza 0..1 se nota; altrimenti 0.
    ''' </summary>
    Public Property Confidence As Double

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        ExtractedData = New Dictionary(Of String, Object)()
        CorrectedData = New Dictionary(Of String, Object)()
        ExtractedVariables = New List(Of ExtractedVariable)()
        MatchedText = String.Empty
        UnmatchedText = String.Empty
        Confidence = 0R
    End Sub

    ''' <summary>Nessun match: residuo opzionale dell'utterance.</summary>
    Public Shared Function NoMatch(Optional utteranceRemainder As String = "") As ParseResult
        Dim u = If(utteranceRemainder, String.Empty).Trim()
        Return New ParseResult() With {
            .Result = ParseResultType.NoMatch,
            .UnmatchedText = u,
            .Confidence = 0R,
            .MatchedText = String.Empty
        }
    End Function
End Class

