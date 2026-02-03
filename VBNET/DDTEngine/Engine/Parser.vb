' Parser.vb
' Implementa InterpretUtterance - Esegue solo il parsing dell'input utente

Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System.Text.RegularExpressions

''' <summary>
''' Gestisce il parsing dell'input utente
''' Basata su: documentation/Motori.MD - Funzione InterpretUtterance
''' </summary>
Public Class Parser
    ' Coda thread-safe per ricevere input dall'UI
    Private Shared ReadOnly _inputQueue As New BlockingCollection(Of String)()

    ' Timeout per WaitForUserInput (30 secondi)
    Private Shared ReadOnly INPUT_TIMEOUT_SECONDS As Integer = 30

    Public Sub New()
    End Sub

    ''' <summary>
    ''' Interpreta l'input utente (solo parsing, nessuna gestione di response)
    ''' </summary>
    Public Function InterpretUtterance(currTaskNode As TaskNode) As ParseResult
        Console.WriteLine($"[DIAG] Parser.InterpretUtterance CALLED: nodeId={currTaskNode.Id}, State={currTaskNode.State}, IsSubData={currTaskNode.IsSubData}")
        Dim userInput As String = WaitForUserInput()
        Console.WriteLine($"[DIAG] Parser.InterpretUtterance: userInput received='{userInput}'")

        ' Se input vuoto o timeout → NoInput
        If String.IsNullOrEmpty(userInput) Then
            Console.WriteLine($"[DIAG] Parser.InterpretUtterance: Returning NoInput (empty or timeout)")
            Return New ParseResult() With {.Result = ParseResultType.NoInput}
        End If
        ' Se siamo in stato di conferma, gestisci sì/no o correzione implicita
        ' La forma può essere: sì/no oppure "no" + correzione
        If currTaskNode.State = DialogueState.Confirmation Then
            Dim cleanedInput As String = userInput.Trim()
            Dim trimmedInput As String = cleanedInput.ToLower()

            ' PRIMA: controlla se è una risposta sì/no pura (senza altro testo)
            If IsYes(trimmedInput) Then
                Return New ParseResult() With {.Result = ParseResultType.Confirmed}
            ElseIf IsNo(trimmedInput) AndAlso trimmedInput.Length <= 3 Then
                ' Solo "no" senza valore dopo
                Return New ParseResult() With {.Result = ParseResultType.NotConfirmed}
            End If

            ' SECONDA: se c'è "no" seguito da qualcosa, prova a estrarre il valore dopo "no"
            If trimmedInput.StartsWith("no ") Then
                Dim valueInput As String = cleanedInput.Substring(3).Trim()

                ' Prova a estrarre il valore (gestisce sia mainData semplici che compositi)
                If currTaskNode.HasSubTasks() Then
                    ' MainData composito: usa TryExtractCompositeData
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(valueInput, currTaskNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        ' Aggiorna i subData estratti
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim matchingSubTasks = currTaskNode.SubTasks.Where(Function(s) s.Id = kvp.Key).ToList()
                            If matchingSubTasks.Count = 0 Then
                                Throw New InvalidOperationException($"SubTask with Id '{kvp.Key}' not found in TaskNode '{currTaskNode.Id}'. The extracted data references a SubTask that does not exist in the task model.")
                            ElseIf matchingSubTasks.Count > 1 Then
                                Throw New InvalidOperationException($"TaskNode '{currTaskNode.Id}' has {matchingSubTasks.Count} SubTasks with Id '{kvp.Key}'. Each SubTask Id must be unique.")
                            End If
                            Dim subTaskNode = matchingSubTasks.Single()
                            subTaskNode.Value = kvp.Value
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    ' MainData semplice: usa TryExtractData
                    Dim extractedValue As String = TryExtractData(valueInput, currTaskNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currTaskNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            ElseIf trimmedInput.StartsWith("non ") Then
                Dim valueInput As String = cleanedInput.Substring(4).Trim()

                ' Stessa logica di estrazione per "non"
                If currTaskNode.HasSubTasks() Then
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(valueInput, currTaskNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim matchingSubTasks = currTaskNode.SubTasks.Where(Function(s) s.Id = kvp.Key).ToList()
                            If matchingSubTasks.Count = 0 Then
                                Throw New InvalidOperationException($"SubTask with Id '{kvp.Key}' not found in TaskNode '{currTaskNode.Id}'. The extracted data references a SubTask that does not exist in the task model.")
                            ElseIf matchingSubTasks.Count > 1 Then
                                Throw New InvalidOperationException($"TaskNode '{currTaskNode.Id}' has {matchingSubTasks.Count} SubTasks with Id '{kvp.Key}'. Each SubTask Id must be unique.")
                            End If
                            Dim subTaskNode = matchingSubTasks.Single()
                            subTaskNode.Value = kvp.Value
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    Dim extractedValue As String = TryExtractData(valueInput, currTaskNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currTaskNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            Else
                ' TERZA: se non è sì/no, prova a estrarre come correzione implicita (senza "no")
                If currTaskNode.HasSubTasks() Then
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(cleanedInput, currTaskNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim matchingSubTasks = currTaskNode.SubTasks.Where(Function(s) s.Id = kvp.Key).ToList()
                            If matchingSubTasks.Count = 0 Then
                                Throw New InvalidOperationException($"SubTask with Id '{kvp.Key}' not found in TaskNode '{currTaskNode.Id}'. The extracted data references a SubTask that does not exist in the task model.")
                            ElseIf matchingSubTasks.Count > 1 Then
                                Throw New InvalidOperationException($"TaskNode '{currTaskNode.Id}' has {matchingSubTasks.Count} SubTasks with Id '{kvp.Key}'. Each SubTask Id must be unique.")
                            End If
                            Dim subTaskNode = matchingSubTasks.Single()
                            subTaskNode.Value = kvp.Value
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    Dim extractedValue As String = TryExtractData(cleanedInput, currTaskNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currTaskNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            End If

            ' Se non è stato riconosciuto né come sì/no né come correzione
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        ' Se siamo in stato invalid, riprova estrazione e validazione
        If currTaskNode.State = DialogueState.Invalid Then
            ' TODO: Implementare ri-estrazione e validazione
            ' Per ora, riprova estrazione normale
        End If

        ' Logica normale: estrazione dati
        ' Se è un mainData composito, usa regex con gruppi opzionali per estrarre subData
        If currTaskNode.HasSubTasks() Then
            Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(userInput, currTaskNode)

            ' Se non è stato estratto nulla → NoMatch
            If extractedData Is Nothing OrElse extractedData.Count = 0 Then
                Return New ParseResult() With {.Result = ParseResultType.NoMatch}
            End If

            ' Match riuscito: popola i subTasks corrispondenti
            For Each kvp As KeyValuePair(Of String, Object) In extractedData
                Dim matchingSubTasks = currTaskNode.SubTasks.Where(Function(s) s.Id = kvp.Key).ToList()
                If matchingSubTasks.Count = 0 Then
                    Throw New InvalidOperationException($"SubTask with Id '{kvp.Key}' not found in TaskNode '{currTaskNode.Id}'. The extracted data references a SubTask that does not exist in the task model.")
                ElseIf matchingSubTasks.Count > 1 Then
                    Throw New InvalidOperationException($"TaskNode '{currTaskNode.Id}' has {matchingSubTasks.Count} SubTasks with Id '{kvp.Key}'. Each SubTask Id must be unique.")
                End If
                Dim subTaskNode = matchingSubTasks.Single()
                subTaskNode.Value = kvp.Value
            Next

            Return New ParseResult() With {
                    .Result = ParseResultType.Match,
                    .ExtractedData = extractedData
                }
        Else
            ' MainData semplice: usa regex semplice
            Dim extractedValue As String = TryExtractData(userInput, currTaskNode)

            ' Se non è stato estratto nulla → NoMatch
            If String.IsNullOrEmpty(extractedValue) Then
                Console.WriteLine($"[DIAG] Parser.InterpretUtterance: Returning NoMatch (no data extracted)")
                Return New ParseResult() With {.Result = ParseResultType.NoMatch}
            End If

            ' Match riuscito: salva il valore estratto direttamente nel nodo
            Dim extractedData As New Dictionary(Of String, Object)()
            extractedData(currTaskNode.Id) = extractedValue
            currTaskNode.Value = extractedValue

            Console.WriteLine($"[DIAG] Parser.InterpretUtterance: Returning Match, extractedValue='{extractedValue}', nodeValue set to '{currTaskNode.Value}'")
            Return New ParseResult() With {
                    .Result = ParseResultType.Match,
                    .ExtractedData = extractedData
                }
        End If

        ' TODO: Implementare logica completa:
        ' - Carica contract
        ' - Gestione validazione completa
        ' - Match su contract in primo piano
        ' - Match su contract di background (irrelevantMatch)
    End Function

    ''' <summary>
    ''' Verifica se l'input è una risposta affermativa (sì, ok, corretto, ecc.)
    ''' </summary>
    Private Function IsYes(input As String) As Boolean
        Dim yesWords As String() = {"sì", "si", "yes", "ok", "va bene", "corretto", "giusto", "esatto", "perfetto", "confermo"}
        Return yesWords.Contains(input)
    End Function

    ''' <summary>
    ''' Verifica se l'input è una risposta negativa (no, non, sbagliato, ecc.)
    ''' </summary>
    Private Function IsNo(input As String) As Boolean
        Dim noWords As String() = {"no", "non", "sbagliato", "errato", "correggi", "modifica", "cambia"}
        Return noWords.Contains(input)
    End Function

    ''' <summary>
    ''' Attende l'input dell'utente usando BlockingCollection (thread-safe)
    ''' </summary>
    Private Function WaitForUserInput() As String
        Console.WriteLine($"[DIAG] Parser.WaitForUserInput CALLED: QueueCount={_inputQueue.Count}, Timeout={INPUT_TIMEOUT_SECONDS}s")
        Try
            Dim input As String = Nothing
            ' Aspetta fino a INPUT_TIMEOUT_SECONDS per l'input
            If _inputQueue.TryTake(input, TimeSpan.FromSeconds(INPUT_TIMEOUT_SECONDS)) Then
                Console.WriteLine($"[DIAG] Parser.WaitForUserInput: Input received from queue: '{input}'")
                Return input
            Else
                ' Timeout: nessun input ricevuto
                Console.WriteLine($"[DIAG] Parser.WaitForUserInput: TIMEOUT - no input received after {INPUT_TIMEOUT_SECONDS}s")
                Return ""
            End If
        Catch ex As OperationCanceledException
            ' Operazione cancellata
            Console.WriteLine($"[DIAG] Parser.WaitForUserInput: OperationCanceledException - {ex.Message}")
            Return ""
        End Try
    End Function

    ''' <summary>
    ''' Metodo pubblico per inviare input dall'UI (thread-safe)
    ''' </summary>
    Public Shared Sub SetUserInput(input As String)
        Console.WriteLine($"[DIAG] Parser.SetUserInput CALLED: input='{input}', QueueCount before={_inputQueue.Count}")
        If Not String.IsNullOrEmpty(input) Then
            _inputQueue.TryAdd(input)
            Console.WriteLine($"[DIAG] Parser.SetUserInput: Input added to queue, QueueCount after={_inputQueue.Count}")
        Else
            Console.WriteLine($"[DIAG] Parser.SetUserInput: Input is empty, NOT added to queue")
        End If
    End Sub

    ''' <summary>
    ''' Pulisce la coda di input (utile per reset)
    ''' </summary>
    Public Shared Sub ClearInputQueue()
        While _inputQueue.Count > 0
            Dim item As String = Nothing
            _inputQueue.TryTake(item)
        End While
    End Sub

    ''' <summary>
    ''' Estrae dati dall'input usando SOLO regex pre-compilato dal contract
    ''' ❌ ZERO FALLBACK: se il contract non ha regex o non matcha → ERRORE BLOCCANTE
    ''' </summary>
    Private Function TryExtractData(input As String, taskNode As TaskNode) As String
        If taskNode Is Nothing Then
            Throw New ArgumentException("taskNode cannot be Nothing. TryExtractData requires a valid task node.")
        End If

        Dim trimmedInput As String = input.Trim()
        If String.IsNullOrEmpty(trimmedInput) Then
            Throw New ArgumentException("input cannot be empty. TryExtractData requires non-empty input.")
        End If

        ' ❌ ERRORE BLOCCANTE: contract OBBLIGATORIO
        If taskNode.NlpContract Is Nothing Then
            Throw New InvalidOperationException($"Task node '{taskNode.Id}' has no NlpContract. NlpContract is mandatory for data extraction.")
        End If

        If TypeOf taskNode.NlpContract IsNot CompiledNlpContract Then
            Throw New InvalidOperationException($"Task node '{taskNode.Id}' has invalid NlpContract type. Expected CompiledNlpContract.")
        End If

        Dim compiledContract = CType(taskNode.NlpContract, CompiledNlpContract)

        ' ❌ ERRORE BLOCCANTE: regex OBBLIGATORIA
        If compiledContract.CompiledMainRegex Is Nothing Then
            Throw New InvalidOperationException($"Task node '{taskNode.Id}' has no CompiledMainRegex in NlpContract. CompiledMainRegex is mandatory for data extraction.")
        End If

        ' ✅ Usa SOLO il regex pre-compilato dal contract
        Try
            Dim match As Match = compiledContract.CompiledMainRegex.Match(trimmedInput)
            If match.Success Then
                ' Se ci sono gruppi named, cerca il valore principale
                If match.Groups.Count > 1 Then
                    ' Preferisci il primo gruppo con valore
                    For i As Integer = 1 To match.Groups.Count - 1
                        If Not String.IsNullOrEmpty(match.Groups(i).Value) Then
                            Return match.Groups(i).Value
                        End If
                    Next
                End If
                ' Altrimenti ritorna il match completo
                Return match.Value
            Else
                ' ✅ CONVERSATIONAL FALLBACK: input non matcha → restituisci Nothing per permettere NoMatch
                ' Questo è un caso conversazionale normale, non un errore strutturale
                Return Nothing
            End If
        Catch ex As Exception
            ' ❌ ERRORE BLOCCANTE: pattern invalido o errore di matching (errore strutturale)
            Throw New InvalidOperationException($"Failed to match input '{trimmedInput}' against CompiledMainRegex for task node '{taskNode.Id}'. Error: {ex.Message}", ex)
        End Try
    End Function

    ''' <summary>
    ''' Estrae dati parziali da un mainData composito usando regex dal contract o fallback a regex hardcoded
    ''' </summary>
    Private Function TryExtractCompositeData(input As String, mainTaskNode As TaskNode) As Dictionary(Of String, Object)
        If mainTaskNode Is Nothing OrElse Not mainTaskNode.HasSubTasks() Then
            Return Nothing
        End If

        Dim trimmedInput As String = input.Trim()
        Dim extractedData As New Dictionary(Of String, Object)()

        ' PRIORITÀ 1: Usa regex dal contract se disponibile
        If mainTaskNode.NlpContract IsNot Nothing AndAlso
           TypeOf mainTaskNode.NlpContract Is CompiledNlpContract AndAlso
           mainTaskNode.NlpContract.Regex IsNot Nothing AndAlso
           mainTaskNode.NlpContract.Regex.Patterns IsNot Nothing AndAlso
           mainTaskNode.NlpContract.Regex.Patterns.Count > 0 AndAlso
           mainTaskNode.NlpContract.SubDataMapping IsNot Nothing Then

            ' Usa il main pattern (primo pattern)
            Dim mainPattern As String = mainTaskNode.NlpContract.Regex.Patterns(0)
            Try
                Dim regex As New Regex(mainPattern, RegexOptions.IgnoreCase)
                Dim match As Match = regex.Match(trimmedInput)
                If match.Success AndAlso match.Groups.Count > 0 Then
                    ' Estrai tutti i gruppi named e mappali ai subId tramite subDataMapping
                    For Each groupName As String In regex.GetGroupNames()
                        If groupName <> "0" AndAlso Not String.IsNullOrEmpty(groupName) Then
                            Dim groupValue As String = match.Groups(groupName).Value
                            If Not String.IsNullOrEmpty(groupValue) Then
                                ' Cerca il subId corrispondente al canonicalKey (groupName)
                                Dim subId As String = FindSubIdByCanonicalKey(mainTaskNode.NlpContract, groupName)
                                If Not String.IsNullOrEmpty(subId) Then
                                    extractedData(subId) = groupValue
                                End If
                            End If
                        End If
                    Next

                    ' Se abbiamo estratto almeno un valore, ritorna
                    If extractedData.Count > 0 Then
                        Return extractedData
                    End If
                End If
                ' ✅ CONVERSATIONAL FALLBACK: match non riuscito o nessun dato estratto → restituisci Nothing per permettere NoMatch
                Return Nothing
            Catch ex As Exception
                ' ❌ ERRORE BLOCCANTE: pattern invalido o errore di matching (errore strutturale)
                Throw New InvalidOperationException($"Failed to extract composite data from input '{trimmedInput}' for task node '{mainTaskNode.Id}'. NlpContract is mandatory and must have valid regex patterns with SubDataMapping. Error: {ex.Message}", ex)
            End Try
        End If

        ' ❌ ERRORE BLOCCANTE: NlpContract obbligatorio, nessun fallback (errore strutturale)
        Throw New InvalidOperationException($"Task node '{mainTaskNode.Id}' has no valid NlpContract for composite data extraction. NlpContract with regex patterns and SubDataMapping is mandatory.")
    End Function

    ''' <summary>
    ''' Estrae dati generici da un mainData composito basandosi sui nomi dei subData
    ''' </summary>
    Private Function TryExtractGenericCompositeData(input As String, mainTaskNode As TaskNode) As Dictionary(Of String, Object)
        ' TODO: Implementare estrazione generica basata sui nomi dei subData
        ' Per ora ritorna Nothing
        Return Nothing
    End Function

    ''' <summary>
    ''' Helper: Valida e ottiene SubTask per ID con validazione deterministica
    ''' </summary>
    Private Function GetSubTaskById(mainTaskNode As TaskNode, subTaskId As String) As TaskNode
        Dim matchingSubTasks = mainTaskNode.SubTasks.Where(Function(s) s.Id = subTaskId).ToList()
        If matchingSubTasks.Count = 0 Then
            Throw New InvalidOperationException($"SubTask with Id '{subTaskId}' not found in TaskNode '{mainTaskNode.Id}'. The extracted data references a SubTask that does not exist in the task model.")
        ElseIf matchingSubTasks.Count > 1 Then
            Throw New InvalidOperationException($"TaskNode '{mainTaskNode.Id}' has {matchingSubTasks.Count} SubTasks with Id '{subTaskId}'. Each SubTask Id must be unique.")
        End If
        Return matchingSubTasks.Single()
    End Function

    ''' <summary>
    ''' Trova il subId corrispondente a un canonicalKey nel contract
    ''' </summary>
    Private Function FindSubIdByCanonicalKey(contract As NLPContract, canonicalKey As String) As String
        If contract Is Nothing OrElse contract.SubDataMapping Is Nothing Then
            Return ""
        End If

        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In contract.SubDataMapping
            If String.Equals(kvp.Value.CanonicalKey, canonicalKey, StringComparison.OrdinalIgnoreCase) Then
                Return kvp.Key
            End If
        Next

        Return ""
    End Function
End Class

