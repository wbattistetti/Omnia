' ParseResult.vb
' Esito del parsing lato dialogo (turno): match/no match, conferme, validazioni, slot.
' L'estrazione NLP pura usa EngineResult (Common); ParseResultBuilder proietta EngineResult in questo tipo.

Option Strict On
Option Explicit On

Imports System.Collections.Generic

''' <summary>
''' Risultato del parsing dell'input nel contesto del task (dialogo), non solo estrazione NLP.
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
    ''' Valori estratti per GUID slot (CanonicalGuidTable / Match.Guid).
    ''' </summary>
    Public Property SlotValues As Dictionary(Of String, Object)

    ''' <summary>
    ''' Porzione di utterance considerata coperta dal match (UtteranceInterpretation / telemetria).
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
        SlotValues = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
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
