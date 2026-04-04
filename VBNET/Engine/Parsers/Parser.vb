' Parser.vb
' Parses user utterances against a CompiledUtteranceTask NLP contract.
' ✅ STATELESS: Accetta CompiledUtteranceTask direttamente, senza conversione

Option Strict On
Option Explicit On
Imports System.Text.RegularExpressions
Imports System.Linq
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
        Dim dict = ExtractLeafDictionary(utterance, current)
        If dict Is Nothing OrElse dict.Count = 0 Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        Dim taskInstanceId = current.Id
        Dim nodeId = GetNodeId(current)

        For Each k In dict.Keys
            If Not String.Equals(k, nodeId, StringComparison.OrdinalIgnoreCase) Then
                Throw New InvalidOperationException(
                    $"Leaf utterance task '{current.Id}': extracted subId '{k}' does not match template nodeId '{nodeId}'. " &
                    "Use a composite task (sub-tasks) when the contract maps multiple subIds.")
            End If
        Next

        Dim value = MergeLeafDictionaryToString(dict)
        If String.IsNullOrEmpty(value) Then
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedVariables = New List(Of ExtractedVariable) From {
                New ExtractedVariable(taskInstanceId, nodeId, value)
            }
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

        ' ✅ Converti Dictionary in triple (taskInstanceId, nodeId, value)
        '    Per i sub-task, i subId nel Dictionary sono i nodeId dei sub-task.
        '    Devo trovare i sub-task corrispondenti per ottenere i loro taskInstanceId.
        Dim extractedVars As New List(Of ExtractedVariable)()
        Dim utteranceTask = TryCast(current, Compiler.CompiledUtteranceTask)

        If utteranceTask IsNot Nothing AndAlso utteranceTask.SubTasks IsNot Nothing Then
            ' ✅ Mappa subId (nodeId) ai sub-task per ottenere taskInstanceId
            For Each kvp In data
                Dim subNodeId = kvp.Key  ' subId dal SubDataMapping = nodeId del sub-task
                Dim value = kvp.Value

                ' ✅ Cerca sub-task con NodeId corrispondente
                Dim subTask = utteranceTask.SubTasks.FirstOrDefault(
                    Function(st) st.NodeId = subNodeId
                )

                If subTask Is Nothing Then
                    Throw New InvalidOperationException(
                        $"Composite utterance task '{current.Id}': no sub-task with NodeId '{subNodeId}' for extracted value. " &
                        "Fix SubDataMapping keys to match CompiledUtteranceTask.SubTasks[].NodeId.")
                End If
                extractedVars.Add(New ExtractedVariable(subTask.Id, subTask.NodeId, value))
            Next
        Else
            ' ⚠️ Fallback: se non ci sono sub-task, usa current.Id per tutti
            For Each kvp In data
                Dim nodeId = kvp.Key
                Dim value = kvp.Value
                extractedVars.Add(New ExtractedVariable(current.Id, nodeId, value))
            Next
        End If

        Return New ParseResult() With {
            .Result = ParseResultType.Match,
            .ExtractedVariables = extractedVars
        }
    End Function

    ' -------------------------------------------------------------------------
    ' Helpers
    ' -------------------------------------------------------------------------

    ''' <summary>
    ''' ✅ STATELESS: Estrae dati senza modificarli, restituisce Dictionary invece di Boolean
    ''' ✅ TEMPLATE-LEVEL: Restituisce Memory[nodeId] = value (nodeId del template, non varId runtime)
    ''' </summary>
    Private Function TryExtract(utterance As String, current As IParsableTask) As System.Collections.Generic.Dictionary(Of String, Object)
        If current.HasSubTasks() Then
            Return ExtractComposite(utterance, current)
        End If

        Dim value = ExtractSimple(utterance, current)
        If String.IsNullOrEmpty(value) Then Return Nothing
        Dim data As New System.Collections.Generic.Dictionary(Of String, Object)()
        Dim nodeId As String = GetNodeId(current)
        data(nodeId) = value
        Return data
    End Function

    ''' <summary>
    ''' Helper: Ottiene il nodeId (GUID del nodo DDT del template) da un task.
    '''
    ''' IMPORTANTE: Il Parser lavora a livello TEMPLATE, non runtime.
    ''' - Restituisce nodeId (nodo del template), NON varId (variabile runtime)
    ''' - FlowOrchestrator farà il lookup (taskInstanceId, nodeId) → varId
    '''
    ''' Usa NodeId se disponibile (CompiledUtteranceTask), altrimenti fallback a Id.
    ''' </summary>
    Private Function GetNodeId(current As IParsableTask) As String
        ' ✅ Cast a CompiledUtteranceTask per accedere a NodeId
        Dim utteranceTask = TryCast(current, Compiler.CompiledUtteranceTask)
        If utteranceTask IsNot Nothing AndAlso Not String.IsNullOrEmpty(utteranceTask.NodeId) Then
            Return utteranceTask.NodeId  ' ✅ nodeId del template (dataSchema)
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
