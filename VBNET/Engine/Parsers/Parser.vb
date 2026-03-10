' Parser.vb
' Parses user utterances against a CompiledUtteranceTask NLP contract.
' ✅ STATELESS: Accetta CompiledUtteranceTask direttamente, senza conversione

Option Strict On
Option Explicit On
Imports System.Text.RegularExpressions
Imports TaskEngine.Models
Imports TaskEngine
Imports IParsableTask = TaskEngine.IParsableTask
Imports Compiler.DTO.Runtime

''' <summary>
''' Interprets user utterances for a given CompiledUtteranceTask.
''' ✅ STATELESS: Accetta CompiledUtteranceTask direttamente, senza conversione
''' Stateless: receives the utterance as a parameter (no blocking queue).
''' </summary>
Partial Public Class Parser

    ''' <summary>
    ''' Parses an utterance in the context of the current task.
    ''' Returns NoInput when utterance is empty or null.
    ''' ✅ STATELESS: Accetta IParsableTask per evitare dipendenza circolare
    ''' </summary>
    Public Function Parse(utterance As String, current As IParsableTask, Optional currentStepType As DialogueStepType = DialogueStepType.Start) As ParseResult
        If current Is Nothing Then
            Throw New ArgumentNullException(NameOf(current), "Current task cannot be Nothing.")
        End If

        If String.IsNullOrEmpty(utterance) Then
            Return New ParseResult() With {.Result = ParseResultType.NoInput}
        End If

        ' Handle confirmation state separately.
        If currentStepType = DialogueStepType.Confirmation Then
            Return ParseConfirmation(utterance, current)
        End If

        ' Normal extraction flow.
        If current.HasSubTasks() Then
            Return ParseComposite(utterance, current)
        End If

        Return ParseSimple(utterance, current)
    End Function

    ' -------------------------------------------------------------------------
    ' Confirmation parsing
    ' -------------------------------------------------------------------------

    Private Function ParseConfirmation(utterance As String, current As IParsableTask) As ParseResult
        Dim trimmed = utterance.Trim().ToLower()

        If IsYes(trimmed) Then
            Return New ParseResult() With {.Result = ParseResultType.Confirmed}
        End If

        If IsNo(trimmed) AndAlso trimmed.Length <= 3 Then
            Return New ParseResult() With {.Result = ParseResultType.NotConfirmed}
        End If

        ' "no <value>" or "non <value>" → try to extract a correction.
        Dim valueInput As String = Nothing
        If trimmed.StartsWith("no ") Then
            valueInput = utterance.Trim().Substring(3).Trim()
        ElseIf trimmed.StartsWith("non ") Then
            valueInput = utterance.Trim().Substring(4).Trim()
        Else
            ' Implicit correction (no negation prefix).
            valueInput = utterance.Trim()
        End If

        If Not String.IsNullOrEmpty(valueInput) Then
            ' ✅ STATELESS: Non modifica current.Value, restituisce solo i dati estratti
            Dim corrected = TryExtract(valueInput, current)
            If corrected IsNot Nothing AndAlso corrected.Count > 0 Then
                Return New ParseResult() With {
                    .Result = ParseResultType.Corrected,
                    .ExtractedData = corrected
                }
            End If
        End If

        Return New ParseResult() With {.Result = ParseResultType.NoMatch}
    End Function

    ' -------------------------------------------------------------------------
    ' Simple (leaf) extraction
    ' -------------------------------------------------------------------------

    Private Function ParseSimple(utterance As String, current As IParsableTask) As ParseResult
        Dim value = ExtractSimple(utterance, current)
        If String.IsNullOrEmpty(value) Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        ' ✅ STATELESS: Non modifica current.Value, restituisce solo i dati estratti
        Dim data As New System.Collections.Generic.Dictionary(Of String, Object)()
        ' ✅ NEW: Usa NodeId (GUID del nodo DDT) invece di Id (task instance ID)
        Dim variableId As String = GetVariableId(current)
        data(variableId) = value

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedData = data
        }
    End Function

    ' -------------------------------------------------------------------------
    ' Composite extraction
    ' -------------------------------------------------------------------------

    Private Function ParseComposite(utterance As String, current As IParsableTask) As ParseResult
        Dim data = ExtractComposite(utterance, current)
        If data Is Nothing OrElse data.Count = 0 Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        ' ✅ STATELESS: Non modifica subTask.Value, restituisce solo i dati estratti

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedData = data
        }
    End Function

    ' -------------------------------------------------------------------------
    ' Helpers
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' ✅ STATELESS: Estrae dati senza modificarli, restituisce Dictionary invece di Boolean
    ''' </summary>
    Private Function TryExtract(utterance As String, current As IParsableTask) As System.Collections.Generic.Dictionary(Of String, Object)
        If current.HasSubTasks() Then
            Return ExtractComposite(utterance, current)
        End If

        Dim value = ExtractSimple(utterance, current)
        If String.IsNullOrEmpty(value) Then Return Nothing
        Dim data As New System.Collections.Generic.Dictionary(Of String, Object)()
        ' ✅ NEW: Usa NodeId (GUID del nodo DDT) invece di Id (task instance ID)
        Dim variableId As String = GetVariableId(current)
        data(variableId) = value
        Return data
    End Function

    ''' <summary>
    ''' Helper: Ottiene l'ID della variabile (GUID del nodo DDT) da un task
    ''' Usa NodeId se disponibile (CompiledUtteranceTask), altrimenti fallback a Id
    ''' </summary>
    Private Function GetVariableId(current As IParsableTask) As String
        ' ✅ Cast a CompiledUtteranceTask per accedere a NodeId
        Dim utteranceTask = TryCast(current, Compiler.CompiledUtteranceTask)
        If utteranceTask IsNot Nothing AndAlso Not String.IsNullOrEmpty(utteranceTask.NodeId) Then
            Return utteranceTask.NodeId
        End If
        ' Fallback a Id se NodeId non disponibile
        Return current.Id
    End Function

    Private Shared Function IsYes(input As String) As Boolean
        Dim words As String() = {"sì", "si", "yes", "ok", "va bene", "corretto", "giusto", "esatto", "perfetto", "confermo"}
        Return words.Contains(input)
    End Function

    Private Shared Function IsNo(input As String) As Boolean
        Dim words As String() = {"no", "non", "sbagliato", "errato", "correggi", "modifica", "cambia"}
        Return words.Contains(input)
    End Function
End Class
