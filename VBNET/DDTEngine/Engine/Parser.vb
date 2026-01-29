' Parser.vb
' Implementa InterpretUtterance - Esegue solo il parsing dell'input utente

Option Strict On
Option Explicit On

Imports System.Collections.Concurrent
Imports System.Text.RegularExpressions
Imports System.Threading
Imports System.Linq

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
    Public Function InterpretUtterance(currDataNode As DDTNode) As ParseResult
        Dim userInput As String = WaitForUserInput()

        ' Se input vuoto o timeout → NoInput
        If String.IsNullOrEmpty(userInput) Then
            Return New ParseResult() With {.Result = ParseResultType.NoInput}
        End If
        ' Se siamo in stato di conferma, gestisci sì/no o correzione implicita
        ' La forma può essere: sì/no oppure "no" + correzione
        If currDataNode.State = DialogueState.Confirmation Then
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
                If currDataNode.HasSubTasks() Then
                    ' MainData composito: usa TryExtractCompositeData
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(valueInput, currDataNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        ' Aggiorna i subData estratti
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim subDataNode As DDTNode = currDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = kvp.Key)
                            If subDataNode IsNot Nothing Then
                                subDataNode.Value = kvp.Value
                            End If
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    ' MainData semplice: usa TryExtractData
                    Dim extractedValue As String = TryExtractData(valueInput, currDataNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currDataNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            ElseIf trimmedInput.StartsWith("non ") Then
                Dim valueInput As String = cleanedInput.Substring(4).Trim()

                ' Stessa logica di estrazione per "non"
                If currDataNode.HasSubTasks() Then
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(valueInput, currDataNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim subDataNode As DDTNode = currDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = kvp.Key)
                            If subDataNode IsNot Nothing Then
                                subDataNode.Value = kvp.Value
                            End If
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    Dim extractedValue As String = TryExtractData(valueInput, currDataNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currDataNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            Else
                ' TERZA: se non è sì/no, prova a estrarre come correzione implicita (senza "no")
                If currDataNode.HasSubTasks() Then
                    Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(cleanedInput, currDataNode)
                    If extractedData IsNot Nothing AndAlso extractedData.Count > 0 Then
                        For Each kvp As KeyValuePair(Of String, Object) In extractedData
                            Dim subDataNode As DDTNode = currDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = kvp.Key)
                            If subDataNode IsNot Nothing Then
                                subDataNode.Value = kvp.Value
                            End If
                        Next
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                Else
                    Dim extractedValue As String = TryExtractData(cleanedInput, currDataNode)
                    If Not String.IsNullOrEmpty(extractedValue) Then
                        currDataNode.Value = extractedValue
                        Return New ParseResult() With {.Result = ParseResultType.Corrected}
                    End If
                End If
            End If

            ' Se non è stato riconosciuto né come sì/no né come correzione
            Return New ParseResult() With {.Result = ParseResultType.NoMatch}
        End If

        ' Se siamo in stato invalid, riprova estrazione e validazione
        If currDataNode.State = DialogueState.Invalid Then
            ' TODO: Implementare ri-estrazione e validazione
            ' Per ora, riprova estrazione normale
        End If

        ' Logica normale: estrazione dati
        ' Se è un mainData composito, usa regex con gruppi opzionali per estrarre subData
        If currDataNode.HasSubData() Then
            Dim extractedData As Dictionary(Of String, Object) = TryExtractCompositeData(userInput, currDataNode)

            ' Se non è stato estratto nulla → NoMatch
            If extractedData Is Nothing OrElse extractedData.Count = 0 Then
                Return New ParseResult() With {.Result = ParseResultType.NoMatch}
            End If

            ' Match riuscito: popola i subData corrispondenti
            For Each kvp As KeyValuePair(Of String, Object) In extractedData
                Dim subDataNode As DDTNode = currDataNode.SubData.FirstOrDefault(Function(s) s.Id = kvp.Key)
                If subDataNode IsNot Nothing Then
                    subDataNode.Value = kvp.Value
                End If
            Next

            Return New ParseResult() With {
                    .Result = ParseResultType.Match,
                    .ExtractedData = extractedData
                }
        Else
            ' MainData semplice: usa regex semplice
            Dim extractedValue As String = TryExtractData(userInput, currDataNode)

            ' Se non è stato estratto nulla → NoMatch
            If String.IsNullOrEmpty(extractedValue) Then
                Return New ParseResult() With {.Result = ParseResultType.NoMatch}
            End If

            ' Match riuscito: salva il valore estratto direttamente nel nodo
            Dim extractedData As New Dictionary(Of String, Object)()
            extractedData(currDataNode.Id) = extractedValue
            currDataNode.Value = extractedValue

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
        Try
            Dim input As String = Nothing
            ' Aspetta fino a INPUT_TIMEOUT_SECONDS per l'input
            If _inputQueue.TryTake(input, TimeSpan.FromSeconds(INPUT_TIMEOUT_SECONDS)) Then
                Return input
            Else
                ' Timeout: nessun input ricevuto
                Return ""
            End If
        Catch ex As OperationCanceledException
            ' Operazione cancellata
            Return ""
        End Try
    End Function

    ''' <summary>
    ''' Metodo pubblico per inviare input dall'UI (thread-safe)
    ''' </summary>
    Public Shared Sub SetUserInput(input As String)
        If Not String.IsNullOrEmpty(input) Then
            _inputQueue.TryAdd(input)
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
    ''' Prova a estrarre dati dall'input usando regex dal contract o fallback a regex hardcoded
    ''' </summary>
    Private Function TryExtractData(input As String, dataNode As DDTNode) As String
        If dataNode Is Nothing OrElse String.IsNullOrEmpty(dataNode.Name) Then
            Return ""
        End If

        Dim trimmedInput As String = input.Trim()

        ' PRIORITÀ 1: Usa regex pre-compilato dal contract se disponibile
        If dataNode.NlpContract IsNot Nothing AndAlso
           TypeOf dataNode.NlpContract Is CompiledNlpContract Then
            Dim compiledContract = CType(dataNode.NlpContract, CompiledNlpContract)

            ' Usa il main regex pre-compilato
            If compiledContract.CompiledMainRegex IsNot Nothing Then
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
                    End If
                Catch
                    ' Pattern invalido, fallback a regex hardcoded
                End Try
            End If
        End If

        ' PRIORITÀ 2: Fallback a regex hardcoded (retrocompatibilità)
        Dim nodeName As String = dataNode.Name.ToLower().Trim()

        ' Regex per diversi tipi di dati basati sul nome del nodo
        Select Case nodeName
            Case "nome", "cognome", "nominativo"
                ' Regex "passa tutto" per nome/cognome (almeno 2 caratteri)
                If Regex.IsMatch(trimmedInput, "^.{2,}$") Then
                    Return trimmedInput
                End If

            Case "telefono"
                ' Regex per telefono: solo numeri, 10-15 cifre
                Dim phoneMatch As Match = Regex.Match(trimmedInput, "(\d{10,15})")
                If phoneMatch.Success Then
                    Return phoneMatch.Groups(1).Value
                End If
                ' Fallback: qualsiasi sequenza di numeri
                Dim numbersOnly As String = Regex.Replace(trimmedInput, "[^\d]", "")
                If numbersOnly.Length >= 10 Then
                    Return numbersOnly
                End If

            Case "data di nascita", "data"
                ' Regex per data: formato giorno/mese/anno o giorno-mese-anno
                Dim dateMatch As Match = Regex.Match(trimmedInput, "(\d{1,2})[/-](\d{1,2})[/-](\d{4})")
                If dateMatch.Success Then
                    Return dateMatch.Value
                End If
                ' Fallback: qualsiasi sequenza di numeri che sembra una data
                If Regex.IsMatch(trimmedInput, "\d{1,2}[/-]\d{1,2}[/-]\d{4}") Then
                    Return trimmedInput
                End If

            Case "giorno"
                ' Regex per giorno: numero 1-31
                Dim dayMatch As Match = Regex.Match(trimmedInput, "(\d{1,2})")
                If dayMatch.Success Then
                    Dim day As Integer = Integer.Parse(dayMatch.Groups(1).Value)
                    If day >= 1 AndAlso day <= 31 Then
                        Return dayMatch.Groups(1).Value
                    End If
                End If

            Case "mese"
                ' Regex per mese: numero 1-12
                Dim monthMatch As Match = Regex.Match(trimmedInput, "(\d{1,2})")
                If monthMatch.Success Then
                    Dim month As Integer = Integer.Parse(monthMatch.Groups(1).Value)
                    If month >= 1 AndAlso month <= 12 Then
                        Return monthMatch.Groups(1).Value
                    End If
                End If

            Case "anno"
                ' Regex per anno: 4 cifre
                Dim yearMatch As Match = Regex.Match(trimmedInput, "(\d{4})")
                If yearMatch.Success Then
                    Return yearMatch.Groups(1).Value
                End If

            Case "indirizzo", "tipo via", "nome via", "numero civico"
                ' Regex "passa tutto" per indirizzo (almeno 2 caratteri)
                If Regex.IsMatch(trimmedInput, "^.{2,}$") Then
                    Return trimmedInput
                End If

            Case Else
                ' Default: regex "passa tutto" per dati generici (almeno 1 carattere)
                If Regex.IsMatch(trimmedInput, "^.+$") Then
                    Return trimmedInput
                End If
        End Select

        ' Nessun match trovato
        Return ""
    End Function

    ''' <summary>
    ''' Estrae dati parziali da un mainData composito usando regex dal contract o fallback a regex hardcoded
    ''' </summary>
    Private Function TryExtractCompositeData(input As String, mainDataNode As DDTNode) As Dictionary(Of String, Object)
        If mainDataNode Is Nothing OrElse Not mainDataNode.HasSubTasks() Then
            Return Nothing
        End If

        Dim trimmedInput As String = input.Trim()
        Dim extractedData As New Dictionary(Of String, Object)()

        ' PRIORITÀ 1: Usa regex dal contract se disponibile
        If mainDataNode.NlpContract IsNot Nothing AndAlso
           TypeOf mainDataNode.NlpContract Is CompiledNlpContract AndAlso
           mainDataNode.NlpContract.Regex IsNot Nothing AndAlso
           mainDataNode.NlpContract.Regex.Patterns IsNot Nothing AndAlso
           mainDataNode.NlpContract.Regex.Patterns.Count > 0 AndAlso
           mainDataNode.NlpContract.SubDataMapping IsNot Nothing Then

            ' Usa il main pattern (primo pattern)
            Dim mainPattern As String = mainDataNode.NlpContract.Regex.Patterns(0)
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
                                Dim subId As String = FindSubIdByCanonicalKey(mainDataNode.NlpContract, groupName)
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
            Catch
                ' Pattern invalido, fallback a regex hardcoded
            End Try
        End If

        ' PRIORITÀ 2: Fallback a regex hardcoded (retrocompatibilità)
        Dim nodeName As String = mainDataNode.Name.ToLower().Trim()

        ' Costruisci regex basata sul tipo di mainData
        Select Case nodeName
            Case "data di nascita", "data"
                ' Regex migliorata per riconoscere:
                ' - Formati numerici: "15/03/1990", "15/03", "03/1990", "15", "03", "1990"
                ' - Formati testuali: "dicembre 1980", "12 1980", "1980"
                ' - Nomi di mesi in italiano

                ' Pattern 1: formato numerico con separatori (giorno/mese/anno o varianti)
                Dim datePattern1 As String = "^(?:(\d{1,2})[/-])?(?:(\d{1,2})[/-])?(\d{4})?$|^(\d{1,2})[/-](\d{1,2})$|^(\d{1,2})$"
                Dim dateMatch1 As Match = Regex.Match(trimmedInput, datePattern1)

                ' Pattern 2: formato "giorno mese anno" con spazi (giorno + nome mese + anno o giorno + numero mese + anno)
                Dim monthNames As String = "gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre"
                Dim monthNumbers As String = "(?:0?[1-9]|1[0-2])"
                Dim datePattern2 As String = $"^(\d{{1,2}})\s+({monthNames}|{monthNumbers})\s+(\d{{4}})$"
                Dim dateMatch2 As Match = Regex.Match(trimmedInput, datePattern2, RegexOptions.IgnoreCase)

                ' Pattern 3: formato "mese anno" o "anno" (senza giorno)
                Dim datePattern3 As String = $"^({monthNames}|{monthNumbers})\s+(\d{{4}})$|^(\d{{4}})$"
                Dim dateMatch3 As Match = Regex.Match(trimmedInput, datePattern3, RegexOptions.IgnoreCase)

                ' Pattern 4: formato "giorno mese" senza anno
                Dim datePattern4 As String = $"^(\d{{1,2}})\s+({monthNames}|{monthNumbers})$"
                Dim dateMatch4 As Match = Regex.Match(trimmedInput, datePattern4, RegexOptions.IgnoreCase)

                Dim matched As Boolean = False

                ' Prova Pattern 1 (formato numerico)
                If dateMatch1.Success Then
                    matched = True
                    ' Pattern 1: giorno/mese/anno o varianti
                    If Not String.IsNullOrEmpty(dateMatch1.Groups(1).Value) Then
                        Dim giornoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "giorno")
                        If giornoNode IsNot Nothing Then
                            extractedData("giorno") = dateMatch1.Groups(1).Value
                        End If
                    End If

                    If Not String.IsNullOrEmpty(dateMatch1.Groups(2).Value) Then
                        Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                        If meseNode IsNot Nothing Then
                            extractedData("mese") = dateMatch1.Groups(2).Value
                        End If
                    End If

                    If Not String.IsNullOrEmpty(dateMatch1.Groups(3).Value) Then
                        Dim annoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "anno")
                        If annoNode IsNot Nothing Then
                            extractedData("anno") = dateMatch1.Groups(3).Value
                        End If
                    End If

                    ' Pattern 2: mese/anno (gruppi 4 e 5)
                    If Not String.IsNullOrEmpty(dateMatch1.Groups(4).Value) AndAlso String.IsNullOrEmpty(dateMatch1.Groups(1).Value) Then
                        Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                        If meseNode IsNot Nothing Then
                            extractedData("mese") = dateMatch1.Groups(4).Value
                        End If
                    End If

                    If Not String.IsNullOrEmpty(dateMatch1.Groups(5).Value) AndAlso String.IsNullOrEmpty(dateMatch1.Groups(3).Value) Then
                        Dim annoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "anno")
                        If annoNode IsNot Nothing Then
                            extractedData("anno") = dateMatch1.Groups(5).Value
                        End If
                    End If

                    ' Pattern 3: solo numero (può essere giorno, mese o anno - prova in ordine)
                    If Not String.IsNullOrEmpty(dateMatch1.Groups(6).Value) AndAlso
                       String.IsNullOrEmpty(dateMatch1.Groups(1).Value) AndAlso
                       String.IsNullOrEmpty(dateMatch1.Groups(4).Value) Then
                        Dim numValue As String = dateMatch1.Groups(6).Value
                        Dim num As Integer = Integer.Parse(numValue)

                        ' Prova giorno (1-31)
                        If num >= 1 AndAlso num <= 31 Then
                            Dim giornoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "giorno")
                            If giornoNode IsNot Nothing Then
                                extractedData("giorno") = numValue
                            End If
                            ' Prova mese (1-12)
                        ElseIf num >= 1 AndAlso num <= 12 Then
                            Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                            If meseNode IsNot Nothing Then
                                extractedData("mese") = numValue
                            End If
                        End If
                    End If
                End If

                ' Prova Pattern 2 (formato "giorno mese anno" con spazi)
                If dateMatch2.Success Then
                    matched = True
                    ' Giorno (gruppo 1)
                    If Not String.IsNullOrEmpty(dateMatch2.Groups(1).Value) Then
                        Dim giornoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "giorno")
                        If giornoNode IsNot Nothing Then
                            extractedData("giorno") = dateMatch2.Groups(1).Value
                        End If
                    End If

                    ' Mese (nome o numero, gruppo 2)
                    If Not String.IsNullOrEmpty(dateMatch2.Groups(2).Value) Then
                        Dim meseValue As String = dateMatch2.Groups(2).Value
                        ' Se è un nome di mese, convertilo in numero
                        Dim monthMap As New Dictionary(Of String, String) From {
                            {"gennaio", "1"}, {"febbraio", "2"}, {"marzo", "3"}, {"aprile", "4"},
                            {"maggio", "5"}, {"giugno", "6"}, {"luglio", "7"}, {"agosto", "8"},
                            {"settembre", "9"}, {"ottobre", "10"}, {"novembre", "11"}, {"dicembre", "12"}
                        }
                        Dim meseLower As String = meseValue.ToLower()
                        If monthMap.ContainsKey(meseLower) Then
                            meseValue = monthMap(meseLower)
                        End If

                        Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                        If meseNode IsNot Nothing Then
                            extractedData("mese") = meseValue
                        End If
                    End If

                    ' Anno (gruppo 3)
                    If Not String.IsNullOrEmpty(dateMatch2.Groups(3).Value) Then
                        Dim annoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "anno")
                        If annoNode IsNot Nothing Then
                            extractedData("anno") = dateMatch2.Groups(3).Value
                        End If
                    End If
                End If

                ' Prova Pattern 3 (formato "mese anno" o "anno" senza giorno)
                If dateMatch3.Success AndAlso Not matched Then
                    matched = True
                    ' Mese (nome o numero, gruppo 1)
                    If Not String.IsNullOrEmpty(dateMatch3.Groups(1).Value) Then
                        Dim meseValue As String = dateMatch3.Groups(1).Value
                        ' Se è un nome di mese, convertilo in numero
                        Dim monthMap As New Dictionary(Of String, String) From {
                            {"gennaio", "1"}, {"febbraio", "2"}, {"marzo", "3"}, {"aprile", "4"},
                            {"maggio", "5"}, {"giugno", "6"}, {"luglio", "7"}, {"agosto", "8"},
                            {"settembre", "9"}, {"ottobre", "10"}, {"novembre", "11"}, {"dicembre", "12"}
                        }
                        Dim meseLower As String = meseValue.ToLower()
                        If monthMap.ContainsKey(meseLower) Then
                            meseValue = monthMap(meseLower)
                        End If

                        Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                        If meseNode IsNot Nothing Then
                            extractedData("mese") = meseValue
                        End If
                    End If

                    ' Anno (gruppo 2 o 3)
                    Dim annoValue As String = ""
                    If Not String.IsNullOrEmpty(dateMatch3.Groups(2).Value) Then
                        annoValue = dateMatch3.Groups(2).Value
                    ElseIf Not String.IsNullOrEmpty(dateMatch3.Groups(3).Value) Then
                        annoValue = dateMatch3.Groups(3).Value
                    End If

                    If Not String.IsNullOrEmpty(annoValue) Then
                        Dim annoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "anno")
                        If annoNode IsNot Nothing Then
                            extractedData("anno") = annoValue
                        End If
                    End If
                End If

                ' Prova Pattern 4 (formato "giorno mese" senza anno)
                If dateMatch4.Success AndAlso Not matched Then
                    matched = True
                    ' Giorno (gruppo 1)
                    If Not String.IsNullOrEmpty(dateMatch4.Groups(1).Value) Then
                        Dim giornoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "giorno")
                        If giornoNode IsNot Nothing Then
                            extractedData("giorno") = dateMatch4.Groups(1).Value
                        End If
                    End If

                    ' Mese (nome o numero, gruppo 2)
                    If Not String.IsNullOrEmpty(dateMatch4.Groups(2).Value) Then
                        Dim meseValue As String = dateMatch4.Groups(2).Value
                        ' Se è un nome di mese, convertilo in numero
                        Dim monthMap As New Dictionary(Of String, String) From {
                            {"gennaio", "1"}, {"febbraio", "2"}, {"marzo", "3"}, {"aprile", "4"},
                            {"maggio", "5"}, {"giugno", "6"}, {"luglio", "7"}, {"agosto", "8"},
                            {"settembre", "9"}, {"ottobre", "10"}, {"novembre", "11"}, {"dicembre", "12"}
                        }
                        Dim meseLower As String = meseValue.ToLower()
                        If monthMap.ContainsKey(meseLower) Then
                            meseValue = monthMap(meseLower)
                        End If

                        Dim meseNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "mese")
                        If meseNode IsNot Nothing Then
                            extractedData("mese") = meseValue
                        End If
                    End If
                End If

            Case "nominativo"
                ' Regex per nominativo: (nome) (cognome)? (terza parola opzionale)?
                ' Esempi: "Mario", "Mario Rossi", "Mario Rossi Bianchi"
                ' Almeno 2 parole, terza opzionale
                Dim namePattern As String = "^(\w+)(?:\s+(\w+))?(?:\s+(\w+))?$"
                Dim nameMatch As Match = Regex.Match(trimmedInput, namePattern, RegexOptions.IgnoreCase)

                If nameMatch.Success Then
                    ' Nome (sempre presente)
                    If Not String.IsNullOrEmpty(nameMatch.Groups(1).Value) Then
                        Dim nomeNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "nome")
                        If nomeNode IsNot Nothing Then
                            extractedData("nome") = nameMatch.Groups(1).Value
                        End If
                    End If

                    ' Cognome (opzionale)
                    If Not String.IsNullOrEmpty(nameMatch.Groups(2).Value) Then
                        Dim cognomeNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "cognome")
                        If cognomeNode IsNot Nothing Then
                            extractedData("cognome") = nameMatch.Groups(2).Value
                        End If
                    End If

                    ' Terza parola (opzionale, ignorata per ora)
                End If

            Case "indirizzo"
                ' Regex migliorata per riconoscere indirizzi con subData opzionali
                ' Pattern 1: tipoVia + nomeVia + numeroCivico + (CAP)? + (città)? + (stato)?
                ' Pattern 2: tipoVia + nomeVia + (città)? (senza numero civico)
                ' Pattern 3: nomeVia + numeroCivico + (CAP)? + (città)? + (stato)? (senza tipo via)
                ' Pattern 4: nomeVia + (città)? (senza tipo via e numero civico)

                Dim tipoViaPattern As String = "(Via|Viale|Piazza|Corso|Largo|Piazzale|Strada|Vicolo)"
                Dim nomeViaPattern As String = "([A-Za-z]+(?:\s+[A-Za-z]+)*)"
                Dim numeroCivicoPattern As String = "(\d+)"
                Dim capPattern As String = "(\d{5})"
                Dim cittaPattern As String = "([A-Za-z]+(?:\s+[A-Za-z]+)*)"

                ' Pattern 1: tipoVia + nomeVia + numeroCivico + (CAP)? + (città)? + (stato)?
                Dim addressPattern1 As String = $"^({tipoViaPattern})\s+{nomeViaPattern}\s+{numeroCivicoPattern}(?:\s+{capPattern})?(?:\s+{cittaPattern})?(?:\s+{cittaPattern})?$"
                Dim addressMatch1 As Match = Regex.Match(trimmedInput, addressPattern1, RegexOptions.IgnoreCase)

                ' Pattern 2: tipoVia + nomeVia + (città)? (senza numero civico)
                Dim addressPattern2 As String = $"^({tipoViaPattern})\s+{nomeViaPattern}(?:\s+{cittaPattern})?$"
                Dim addressMatch2 As Match = Regex.Match(trimmedInput, addressPattern2, RegexOptions.IgnoreCase)

                ' Pattern 3: nomeVia + numeroCivico + (CAP)? + (città)? + (stato)? (senza tipo via)
                Dim addressPattern3 As String = $"^{nomeViaPattern}\s+{numeroCivicoPattern}(?:\s+{capPattern})?(?:\s+{cittaPattern})?(?:\s+{cittaPattern})?$"
                Dim addressMatch3 As Match = Regex.Match(trimmedInput, addressPattern3, RegexOptions.IgnoreCase)

                ' Pattern 4: nomeVia + (città)? (senza tipo via e numero civico)
                Dim addressPattern4 As String = $"^{nomeViaPattern}(?:\s+{cittaPattern})?$"
                Dim addressMatch4 As Match = Regex.Match(trimmedInput, addressPattern4, RegexOptions.IgnoreCase)

                Dim matched As Boolean = False

                ' Prova Pattern 1 (tipoVia + nomeVia + numeroCivico + opzionali)
                If addressMatch1.Success Then
                    matched = True
                    ' Tipo via (gruppo 1)
                    If Not String.IsNullOrEmpty(addressMatch1.Groups(1).Value) Then
                        Dim tipoViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "tipoVia")
                        If tipoViaNode IsNot Nothing Then
                            extractedData("tipoVia") = addressMatch1.Groups(1).Value
                        End If
                    End If
                    ' Nome via (gruppo 2)
                    If Not String.IsNullOrEmpty(addressMatch1.Groups(2).Value) Then
                        Dim nomeViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "nomeVia")
                        If nomeViaNode IsNot Nothing Then
                            extractedData("nomeVia") = addressMatch1.Groups(2).Value
                        End If
                    End If
                    ' Numero civico (gruppo 3)
                    If Not String.IsNullOrEmpty(addressMatch1.Groups(3).Value) Then
                        Dim numeroCivicoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "numeroCivico")
                        If numeroCivicoNode IsNot Nothing Then
                            extractedData("numeroCivico") = addressMatch1.Groups(3).Value
                        End If
                    End If
                    ' CAP (gruppo 4)
                    If Not String.IsNullOrEmpty(addressMatch1.Groups(4).Value) Then
                        Dim capNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "cap")
                        If capNode IsNot Nothing Then
                            extractedData("cap") = addressMatch1.Groups(4).Value
                        End If
                    End If
                    ' Città (gruppo 5 o 6)
                    Dim cittaValue As String = ""
                    If Not String.IsNullOrEmpty(addressMatch1.Groups(5).Value) Then
                        cittaValue = addressMatch1.Groups(5).Value
                    ElseIf Not String.IsNullOrEmpty(addressMatch1.Groups(6).Value) Then
                        cittaValue = addressMatch1.Groups(6).Value
                    End If
                    If Not String.IsNullOrEmpty(cittaValue) Then
                        Dim cittaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "citta")
                        If cittaNode IsNot Nothing Then
                            extractedData("citta") = cittaValue
                        End If
                    End If
                End If

                ' Prova Pattern 2 (tipoVia + nomeVia + città, senza numero civico)
                If addressMatch2.Success AndAlso Not matched Then
                    matched = True
                    ' Tipo via (gruppo 1)
                    If Not String.IsNullOrEmpty(addressMatch2.Groups(1).Value) Then
                        Dim tipoViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "tipoVia")
                        If tipoViaNode IsNot Nothing Then
                            extractedData("tipoVia") = addressMatch2.Groups(1).Value
                        End If
                    End If
                    ' Nome via (gruppo 2)
                    If Not String.IsNullOrEmpty(addressMatch2.Groups(2).Value) Then
                        Dim nomeViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "nomeVia")
                        If nomeViaNode IsNot Nothing Then
                            extractedData("nomeVia") = addressMatch2.Groups(2).Value
                        End If
                    End If
                    ' Città (gruppo 3)
                    If Not String.IsNullOrEmpty(addressMatch2.Groups(3).Value) Then
                        Dim cittaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "citta")
                        If cittaNode IsNot Nothing Then
                            extractedData("citta") = addressMatch2.Groups(3).Value
                        End If
                    End If
                End If

                ' Prova Pattern 3 (nomeVia + numeroCivico + opzionali, senza tipo via)
                If addressMatch3.Success AndAlso Not matched Then
                    matched = True
                    ' Nome via (gruppo 1)
                    If Not String.IsNullOrEmpty(addressMatch3.Groups(1).Value) Then
                        Dim nomeViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "nomeVia")
                        If nomeViaNode IsNot Nothing Then
                            extractedData("nomeVia") = addressMatch3.Groups(1).Value
                        End If
                    End If
                    ' Numero civico (gruppo 2)
                    If Not String.IsNullOrEmpty(addressMatch3.Groups(2).Value) Then
                        Dim numeroCivicoNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "numeroCivico")
                        If numeroCivicoNode IsNot Nothing Then
                            extractedData("numeroCivico") = addressMatch3.Groups(2).Value
                        End If
                    End If
                    ' CAP (gruppo 3)
                    If Not String.IsNullOrEmpty(addressMatch3.Groups(3).Value) Then
                        Dim capNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "cap")
                        If capNode IsNot Nothing Then
                            extractedData("cap") = addressMatch3.Groups(3).Value
                        End If
                    End If
                    ' Città (gruppo 4 o 5)
                    Dim cittaValue As String = ""
                    If Not String.IsNullOrEmpty(addressMatch3.Groups(4).Value) Then
                        cittaValue = addressMatch3.Groups(4).Value
                    ElseIf Not String.IsNullOrEmpty(addressMatch3.Groups(5).Value) Then
                        cittaValue = addressMatch3.Groups(5).Value
                    End If
                    If Not String.IsNullOrEmpty(cittaValue) Then
                        Dim cittaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "citta")
                        If cittaNode IsNot Nothing Then
                            extractedData("citta") = cittaValue
                        End If
                    End If
                End If

                ' Prova Pattern 4 (nomeVia + città, senza tipo via e numero civico)
                If addressMatch4.Success AndAlso Not matched Then
                    matched = True
                    ' Nome via (gruppo 1)
                    If Not String.IsNullOrEmpty(addressMatch4.Groups(1).Value) Then
                        Dim nomeViaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "nomeVia")
                        If nomeViaNode IsNot Nothing Then
                            extractedData("nomeVia") = addressMatch4.Groups(1).Value
                        End If
                    End If
                    ' Città (gruppo 2)
                    If Not String.IsNullOrEmpty(addressMatch4.Groups(2).Value) Then
                        Dim cittaNode As DDTNode = mainDataNode.SubTasks.FirstOrDefault(Function(s) s.Id = "citta")
                        If cittaNode IsNot Nothing Then
                            extractedData("citta") = addressMatch4.Groups(2).Value
                        End If
                    End If
                End If

            Case Else
                ' Per altri tipi compositi, usa regex generica basata sui subData
                Return TryExtractGenericCompositeData(trimmedInput, mainDataNode)
        End Select

        ' Ritorna i dati estratti (anche se parziali)
        Return If(extractedData.Count > 0, extractedData, Nothing)
    End Function

    ''' <summary>
    ''' Estrae dati generici da un mainData composito basandosi sui nomi dei subData
    ''' </summary>
    Private Function TryExtractGenericCompositeData(input As String, mainDataNode As DDTNode) As Dictionary(Of String, Object)
        ' TODO: Implementare estrazione generica basata sui nomi dei subData
        ' Per ora ritorna Nothing
        Return Nothing
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

