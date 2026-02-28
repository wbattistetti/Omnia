Option Strict On
Option Explicit On
Imports Compiler
Imports System.Linq
Imports Newtonsoft.Json
Imports DDTEngine.Engine
Namespace TaskEngine

    ''' <summary>
    ''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
    ''' FASE 1: Invio messaggio iniziale (Start step)
    ''' FASE 2: Gestione input utente, parsing NLP, validazione, transizioni di stato
    ''' </summary>
    Public Class ProcessTurnEngine

        ''' <summary>
        ''' Risultato di ProcessTurn
        ''' </summary>
        Public Class DialogueTurnResult
            Public Property Messages As List(Of String)
            Public Property NewState As DialogueState
            Public Property Status As String ' "waiting_for_input" | "completed"

            Public Sub New()
                Messages = New List(Of String)()
                NewState = New DialogueState()
                Status = "waiting_for_input"
            End Sub

            Public Sub New(messages As List(Of String), newState As DialogueState)
                Me.Messages = messages
                Me.NewState = newState
                Me.Status = If(newState.IsCompleted, "completed", "waiting_for_input")
            End Sub
        End Class

        ''' <summary>
        ''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
        ''' Versione corretta con DialogueMode per separazione chiara delle fasi
        ''' </summary>
        Public Shared Function ProcessTurn(state As DialogueState, utterance As String, resolveTranslation As Func(Of String, String)) As DialogueTurnResult

            Dim output As New List(Of String)
            Dim currentTask As UtteranceTaskInstance = state.CurrentTask
            Dim currentStep As Global.TaskEngine.DialogueStep = currentTask.GetStep(state.CurrentStepType)

            ' ✅ resolveTranslation: funzione che risolve textKey → translatedText (on-demand, più efficiente)

            Select Case state.Mode

            '────────────────────────────────────────────
            ' 1) ESECUZIONE DELLO STEP (PRIMO TURNO)
            '────────────────────────────────────────────
                Case DialogueMode.ExecutingStep

                    ' Esegui lo step e produci messaggi
                    output.AddRange(ProcessTurnHelpers.ExecuteStepStateless(currentTask, currentStep, resolveTranslation))

                    ' Se lo step richiede input → passa in attesa
                    Dim requiresUtterance = (currentStep.Type = Global.TaskEngine.DialogueStepType.Start OrElse
                                         currentStep.Type = Global.TaskEngine.DialogueStepType.Confirmation OrElse
                                         currentStep.Type = Global.TaskEngine.DialogueStepType.Invalid)
                    If requiresUtterance Then
                        state.Mode = DialogueMode.WaitingForUtterance
                        Return New DialogueTurnResult(output, state)
                    End If

                    ' Step senza input → transizione immediata
                    Dim nextStep = currentTask.GetNextStep(currentStep)
                    state.CurrentStepType = nextStep.Type
                    state.Mode = DialogueMode.ExecutingStep
                    Return New DialogueTurnResult(output, state)


            '────────────────────────────────────────────
            ' 2) IN ATTESA DELL'UTTERANCE (SECONDO TURNO)
            '────────────────────────────────────────────
                Case DialogueMode.WaitingForUtterance

                    ' Nessun input → rimani in attesa
                    If String.IsNullOrEmpty(utterance) Then
                        Return New DialogueTurnResult(output, state)
                    End If

                    ' Input ricevuto → analizza direttamente
                    Dim parseResult As ParseResultWithStatus = ProcessTurnHelpers.RunContractsInCascade(currentTask, utterance)

                    Select Case parseResult.Status

                        Case ParseStatus.Match

                            ProcessTurnHelpers.FillTaskFromParseResult(currentTask, parseResult)

                            ' Task parzialmente riempito → vai al prossimo subtask
                            If ProcessTurnHelpers.IsPartiallyFilled(currentTask) Then
                                state.CurrentTask = ProcessTurnHelpers.GetFirstUnfilledSubTask(currentTask)
                                state.CurrentStepType = Global.TaskEngine.DialogueStepType.Start
                                state.Mode = DialogueMode.ExecutingStep
                                Return New DialogueTurnResult(output, state)
                            End If

                            ' Task principale completato
                            If ProcessTurnHelpers.IsMainTask(currentTask) Then

                                Dim successStep = currentTask.GetStepOrNull(Global.TaskEngine.DialogueStepType.Success)
                                If successStep IsNot Nothing Then
                                    output.AddRange(ProcessTurnHelpers.ExecuteStepStateless(currentTask, successStep, resolveTranslation))
                                End If

                                state.IsCompleted = True
                                state.Mode = DialogueMode.Completed
                                Return New DialogueTurnResult(output, state)

                            Else
                                ' Task figlio completato → torna al parent
                                Dim parent = currentTask.Parent

                                Dim nextSub = parent.SubTasks _
                                .Where(Function(t) Not t.IsFilled()) _
                                .FirstOrDefault()

                                If nextSub IsNot Nothing Then
                                    state.CurrentTask = nextSub
                                    state.CurrentStepType = Global.TaskEngine.DialogueStepType.Start
                                    state.Mode = DialogueMode.ExecutingStep
                                    Return New DialogueTurnResult(output, state)
                                End If

                                state.CurrentTask = parent

                                Dim confirmationStep = parent.GetStepOrNull(Global.TaskEngine.DialogueStepType.Confirmation)
                                If confirmationStep IsNot Nothing Then
                                    state.CurrentStepType = Global.TaskEngine.DialogueStepType.Confirmation
                                    state.Mode = DialogueMode.ExecutingStep
                                    Return New DialogueTurnResult(output, state)
                                End If

                                Dim validationStep = parent.GetStepOrNull(Global.TaskEngine.DialogueStepType.Invalid)
                                If validationStep IsNot Nothing Then
                                    state.CurrentStepType = Global.TaskEngine.DialogueStepType.Invalid
                                    state.Mode = DialogueMode.ExecutingStep
                                    Return New DialogueTurnResult(output, state)
                                End If

                                Dim successStep = parent.GetStepOrNull(Global.TaskEngine.DialogueStepType.Success)
                                If successStep IsNot Nothing Then
                                    state.CurrentStepType = Global.TaskEngine.DialogueStepType.Success
                                    state.Mode = DialogueMode.ExecutingStep
                                    Return New DialogueTurnResult(output, state)
                                End If

                                state.IsCompleted = True
                                state.Mode = DialogueMode.Completed
                                Return New DialogueTurnResult(output, state)

                            End If


                        Case ParseStatus.NoInput

                            currentTask.NoInputCounter += 1
                            currentStep = currentTask.GetStep(Global.TaskEngine.DialogueStepType.NoInput)

                            Dim maxIndex = currentStep.Escalations.Count - 1
                            Dim escalationIndex = Math.Min(currentTask.NoInputCounter - 1, maxIndex)

                            output.AddRange(ProcessTurnHelpers.ExecuteEscalationStateless(currentTask, currentStep, escalationIndex, resolveTranslation))

                            state.CurrentTask = currentTask
                            state.CurrentStepType = Global.TaskEngine.DialogueStepType.NoInput
                            state.Mode = DialogueMode.ExecutingStep
                            Return New DialogueTurnResult(output, state)


                        Case ParseStatus.NoMatch

                            currentTask.NoMatchCounter += 1
                            currentStep = currentTask.GetStep(Global.TaskEngine.DialogueStepType.NoMatch)

                            Dim maxIndex = currentStep.Escalations.Count - 1
                            Dim escalationIndex = Math.Min(currentTask.NoMatchCounter - 1, maxIndex)

                            output.AddRange(ProcessTurnHelpers.ExecuteEscalationStateless(currentTask, currentStep, escalationIndex, resolveTranslation))

                            state.CurrentTask = currentTask
                            state.CurrentStepType = Global.TaskEngine.DialogueStepType.NoMatch
                            state.Mode = DialogueMode.ExecutingStep
                            Return New DialogueTurnResult(output, state)


                        Case ParseStatus.PartialMatch, ParseStatus.MatchedButInvalid
                            state.Mode = DialogueMode.ExecutingStep
                            Return New DialogueTurnResult(output, state)

                    End Select


            '────────────────────────────────────────────
            ' 4) COMPLETATO
            '────────────────────────────────────────────
                Case DialogueMode.Completed
                    Return New DialogueTurnResult(output, state)

            End Select

            Throw New InvalidOperationException("Invalid dialogue state.")

        End Function

        ''' <summary>
        ''' FASE 1: Processa lo step Start e invia il messaggio iniziale
        ''' </summary>
        Private Shared Sub ProcessStartStep(
            state As DialogueState,
            task As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            If task.Steps IsNot Nothing AndAlso task.Steps.Count > 0 Then
                Dim startStateValue As Global.TaskEngine.DialogueStepType = Global.TaskEngine.DialogueStepType.Start
                Dim startStep As Global.TaskEngine.DialogueStep = Nothing
                Try
                    Dim stepObj = task.Steps.SingleOrDefault(Function(s) s.Type = startStateValue)
                    If stepObj IsNot Nothing Then
                        startStep = stepObj
                    End If
                Catch ex As InvalidOperationException
                    Throw New InvalidOperationException($"Invalid task model: Task {task.Id} has duplicate steps with Type=Start. Each Type must appear exactly once.", ex)
                End Try

                If startStep IsNot Nothing Then
                    If startStep.Escalations IsNot Nothing AndAlso startStep.Escalations.Count > 0 Then
                        Dim firstEscalation = startStep.Escalations(0)
                        ExtractMessagesFromEscalation(firstEscalation, translations, result)
                    End If
                End If
            End If

            ' ✅ Aggiorna stato: rimane in Start ma ora abbiamo inviato il messaggio
            result.NewState = state
            result.Status = "waiting_for_input"
        End Sub

        ''' <summary>
        ''' FASE 2: Processa l'input dell'utente
        ''' </summary>
        Private Shared Sub ProcessUserInput(
            state As DialogueState,
            utterance As String,
            task As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Inizializza Memory e Counters se necessario
            If state.Memory Is Nothing Then
                state.Memory = New Dictionary(Of String, Object)()
            End If
            If state.Counters Is Nothing Then
                state.Counters = New Dictionary(Of String, Counters)()
            End If

            ' ✅ Inizializza counter per il task corrente se non esiste
            If Not state.Counters.ContainsKey(task.Id) Then
                state.Counters(task.Id) = New Counters()
            End If
            Dim currentCounters = state.Counters(task.Id)

            ' ✅ Gestisci conferma se siamo in stato Confirmation
            If state.TurnState = TurnState.Confirmation Then
                ProcessConfirmation(state, utterance, task, translations, result)
                Return
            End If

            ' ✅ Estrai dati usando NLP Contract
            Dim extractedData As Dictionary(Of String, Object) = Nothing
            If task.NlpContract IsNot Nothing Then
                extractedData = ExtractDataFromUtterance(utterance, task)
            End If

            ' ✅ Se non abbiamo estratto dati, è NoMatch
            If extractedData Is Nothing OrElse extractedData.Count = 0 Then
                ProcessNoMatch(state, task, currentCounters, translations, result)
                Return
            End If

            ' ✅ Valida i dati estratti usando Constraints
            Dim validationResult = ValidateExtractedData(extractedData, task)
            If Not validationResult.IsValid Then
                ProcessInvalid(state, task, validationResult.ErrorMessage, translations, result)
                Return
            End If

            ' ✅ Salva i dati estratti in Memory
            For Each kvp In extractedData
                state.Memory(kvp.Key) = kvp.Value
            Next

            ' ✅ Aggiorna CurrentDataId se necessario
            If String.IsNullOrEmpty(state.CurrentDataId) Then
                state.CurrentDataId = task.Id
            End If

            ' ✅ Verifica se ci sono sub-task da raccogliere
            If task.HasSubTasks() Then
                ' ✅ Verifica quali sub-task sono ancora da raccogliere
                Dim missingSubTasks = GetMissingSubTasks(task, state.Memory)
                If missingSubTasks.Count > 0 Then
                    ' ✅ Passa a CollectingSub per raccogliere il prossimo sub-task
                    state.TurnState = TurnState.CollectingSub
                    state.Context = "CollectingSub"
                    state.CurrentDataId = missingSubTasks(0).Id
                    ' ✅ Invia messaggio per il prossimo sub-task
                    SendMessageForSubTask(missingSubTasks(0), translations, result)
                Else
                    ' ✅ Tutti i sub-task sono stati raccolti, passa a Success
                    state.TurnState = TurnState.Success
                    ProcessSuccess(state, task, translations, result)
                End If
            Else
                ' ✅ Task atomico completato, passa a Success
                state.TurnState = TurnState.Success
                ProcessSuccess(state, task, translations, result)
            End If

            result.NewState = state
            result.Status = "waiting_for_input"
        End Sub

        ''' <summary>
        ''' FASE 2: Estrae dati dall'utterance usando il NLP Contract
        ''' </summary>
        Private Shared Function ExtractDataFromUtterance(
            utterance As String,
            task As CompiledUtteranceTask
        ) As Dictionary(Of String, Object)
            If task.NlpContract Is Nothing Then
                Return Nothing
            End If

            Dim contract = task.NlpContract
            Dim extractedData As New Dictionary(Of String, Object)()

            ' ✅ Estrai usando il regex principale se disponibile
            If contract.CompiledMainRegex IsNot Nothing Then
                Dim match = contract.CompiledMainRegex.Match(utterance.Trim())
                If match.Success Then
                    ' ✅ Preferisci il primo named group con un valore
                    For i As Integer = 1 To match.Groups.Count - 1
                        If Not String.IsNullOrEmpty(match.Groups(i).Value) Then
                            extractedData(task.Id) = match.Groups(i).Value
                            Return extractedData
                        End If
                    Next
                    ' ✅ Se non ci sono named groups, usa il valore completo
                    If match.Value IsNot Nothing Then
                        extractedData(task.Id) = match.Value
                        Return extractedData
                    End If
                End If
            End If

            ' ✅ Se il task ha sub-task, prova a estrarre dati compositi
            If task.HasSubTasks() Then
                Return ExtractCompositeData(utterance, task)
            End If

            Return Nothing
        End Function

        ''' <summary>
        ''' FASE 2: Estrae dati compositi per task con sub-task
        ''' </summary>
        Private Shared Function ExtractCompositeData(
            utterance As String,
            task As CompiledUtteranceTask
        ) As Dictionary(Of String, Object)
            Dim extractedData As New Dictionary(Of String, Object)()

            If task.NlpContract Is Nothing OrElse task.SubTasks Is Nothing Then
                Return extractedData
            End If

            Dim contract = task.NlpContract

            ' ✅ Prova a estrarre dati per ogni sub-task usando i regex compilati
            For Each subTask In task.SubTasks
                If subTask.NlpContract IsNot Nothing AndAlso subTask.NlpContract.CompiledMainRegex IsNot Nothing Then
                    Dim match = subTask.NlpContract.CompiledMainRegex.Match(utterance.Trim())
                    If match.Success Then
                        For i As Integer = 1 To match.Groups.Count - 1
                            If Not String.IsNullOrEmpty(match.Groups(i).Value) Then
                                extractedData(subTask.Id) = match.Groups(i).Value
                                Exit For
                            End If
                        Next
                        If Not extractedData.ContainsKey(subTask.Id) AndAlso match.Value IsNot Nothing Then
                            extractedData(subTask.Id) = match.Value
                        End If
                    End If
                End If
            Next

            Return extractedData
        End Function

        ''' <summary>
        ''' FASE 2: Valida i dati estratti usando i Constraints
        ''' </summary>
        Private Shared Function ValidateExtractedData(
            extractedData As Dictionary(Of String, Object),
            task As CompiledUtteranceTask
        ) As ValidationResult
            Dim result As New ValidationResult() With {.IsValid = True}

            If task.Constraints Is Nothing OrElse task.Constraints.Count = 0 Then
                Return result
            End If

            ' ✅ Valida ogni constraint
            For Each constraint In task.Constraints
                Dim constraintResult = ValidateConstraint(extractedData, constraint, task)
                If Not constraintResult.IsValid Then
                    result.IsValid = False
                    result.ErrorMessage = constraintResult.ErrorMessage
                    Return result
                End If
            Next

            Return result
        End Function

        ''' <summary>
        ''' FASE 2: Valida un singolo constraint
        ''' </summary>
        Private Shared Function ValidateConstraint(
            extractedData As Dictionary(Of String, Object),
            constraint As ValidationCondition,
            task As CompiledUtteranceTask
        ) As ValidationResult
            Dim result As New ValidationResult() With {.IsValid = True}

            ' ✅ Per ora supportiamo solo validazione regex base
            ' TODO: Estendi per supportare altri tipi di validazione (range, custom, ecc.)
            If constraint.Type = "regex" AndAlso constraint.Parameters IsNot Nothing AndAlso constraint.Parameters.ContainsKey("pattern") Then
                Dim pattern = constraint.Parameters("pattern").ToString()
                Dim regex As New System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase)

                ' ✅ Valida ogni valore estratto
                For Each kvp In extractedData
                    If kvp.Value IsNot Nothing Then
                        Dim valueStr = kvp.Value.ToString()
                        If Not regex.IsMatch(valueStr) Then
                            result.IsValid = False
                            result.ErrorMessage = If(Not String.IsNullOrEmpty(constraint.ErrorMessage), constraint.ErrorMessage, $"Value '{valueStr}' does not match pattern '{pattern}'")
                            Return result
                        End If
                    End If
                Next
            End If

            Return result
        End Function

        ''' <summary>
        ''' FASE 2: Gestisce NoMatch (input non riconosciuto)
        ''' </summary>
        Private Shared Sub ProcessNoMatch(
            state As DialogueState,
            task As CompiledUtteranceTask,
            counters As Counters,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Incrementa counter NoMatch
            counters.NoMatch += 1

            ' ✅ Trova lo step NoMatch
            Dim noMatchStep = FindStepByType(task, Global.TaskEngine.DialogueStepType.NoMatch)
            If noMatchStep IsNot Nothing Then
                ' ✅ Seleziona escalation basata sul counter
                Dim escalationIndex = Math.Min(counters.NoMatch - 1, If(noMatchStep.Escalations IsNot Nothing, noMatchStep.Escalations.Count - 1, 0))
                If noMatchStep.Escalations IsNot Nothing AndAlso escalationIndex >= 0 AndAlso escalationIndex < noMatchStep.Escalations.Count Then
                    Dim escalation = noMatchStep.Escalations(escalationIndex)
                    ExtractMessagesFromEscalation(escalation, translations, result)
                End If
            End If

            ' ✅ Aggiorna stato
            state.TurnState = TurnState.NoMatch
            result.NewState = state
            result.Status = "waiting_for_input"
        End Sub

        ''' <summary>
        ''' FASE 2: Gestisce NoInput (input vuoto o timeout)
        ''' </summary>
        Private Shared Sub ProcessNoInput(
            state As DialogueState,
            task As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Inizializza counter se necessario
            If state.Counters Is Nothing Then
                state.Counters = New Dictionary(Of String, Counters)()
            End If
            If Not state.Counters.ContainsKey(task.Id) Then
                state.Counters(task.Id) = New Counters()
            End If
            Dim counters = state.Counters(task.Id)

            ' ✅ Incrementa counter NoInput
            counters.NoInput += 1

            ' ✅ Trova lo step NoInput
            Dim noInputStep = FindStepByType(task, Global.TaskEngine.DialogueStepType.NoInput)
            If noInputStep IsNot Nothing Then
                ' ✅ Seleziona escalation basata sul counter
                Dim escalationIndex = Math.Min(counters.NoInput - 1, If(noInputStep.Escalations IsNot Nothing, noInputStep.Escalations.Count - 1, 0))
                If noInputStep.Escalations IsNot Nothing AndAlso escalationIndex >= 0 AndAlso escalationIndex < noInputStep.Escalations.Count Then
                    Dim escalation = noInputStep.Escalations(escalationIndex)
                    ExtractMessagesFromEscalation(escalation, translations, result)
                End If
            End If

            ' ✅ Aggiorna stato
            state.TurnState = TurnState.NoInput
            result.NewState = state
            result.Status = "waiting_for_input"
        End Sub

        ''' <summary>
        ''' FASE 2: Gestisce Invalid (validazione fallita)
        ''' </summary>
        Private Shared Sub ProcessInvalid(
            state As DialogueState,
            task As CompiledUtteranceTask,
            errorMessage As String,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Trova lo step Invalid
            Dim invalidStep = FindStepByType(task, Global.TaskEngine.DialogueStepType.Invalid)
            If invalidStep IsNot Nothing Then
                ' ✅ Seleziona la prima escalation
                If invalidStep.Escalations IsNot Nothing AndAlso invalidStep.Escalations.Count > 0 Then
                    Dim escalation = invalidStep.Escalations(0)
                    ExtractMessagesFromEscalation(escalation, translations, result)
                End If
            End If

            ' ✅ Aggiorna stato
            state.TurnState = TurnState.NoMatch ' Invalid viene gestito come NoMatch per ora
            result.NewState = state
            result.Status = "waiting_for_input"
        End Sub

        ''' <summary>
        ''' FASE 2: Gestisce Success (task completato)
        ''' </summary>
        Private Shared Sub ProcessSuccess(
            state As DialogueState,
            task As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Trova lo step Success
            Dim successStep = FindStepByType(task, Global.TaskEngine.DialogueStepType.Success)
            If successStep IsNot Nothing Then
                ' ✅ Seleziona la prima escalation
                If successStep.Escalations IsNot Nothing AndAlso successStep.Escalations.Count > 0 Then
                    Dim escalation = successStep.Escalations(0)
                    ExtractMessagesFromEscalation(escalation, translations, result)
                End If
            End If

            ' ✅ Aggiorna stato
            state.TurnState = TurnState.Success
            result.NewState = state
            result.Status = "completed"
        End Sub

        ''' <summary>
        ''' FASE 2: Gestisce Confirmation (richiesta conferma)
        ''' </summary>
        Private Shared Sub ProcessConfirmation(
        state As DialogueState,
        utterance As String,
        task As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            Dim trimmed = utterance.Trim().ToLower()
            Dim confirmed As Boolean = False

            ' ✅ Verifica se è una conferma positiva
            Dim yesWords As String() = {"sì", "si", "yes", "ok", "va bene", "corretto", "giusto", "esatto", "perfetto", "confermo"}
            If yesWords.Contains(trimmed) Then
                confirmed = True
            End If

            ' ✅ Inizializza counter se necessario
            If state.Counters Is Nothing Then
                state.Counters = New Dictionary(Of String, Counters)()
            End If
            If Not state.Counters.ContainsKey(task.Id) Then
                state.Counters(task.Id) = New Counters()
            End If
            Dim counters = state.Counters(task.Id)

            If confirmed Then
                ' ✅ Conferma positiva, passa a Success
                counters.Confirmation += 1
                state.TurnState = TurnState.Success
                ProcessSuccess(state, task, translations, result)
            Else
                ' ✅ Conferma negativa, incrementa counter e gestisci
                counters.NotConfirmed += 1
                state.TurnState = TurnState.NotConfirmed
                ' ✅ Invia messaggio di errore o richiesta di correzione
                Dim noMatchStep = FindStepByType(task, Global.TaskEngine.DialogueStepType.NoMatch)
                If noMatchStep IsNot Nothing AndAlso noMatchStep.Escalations IsNot Nothing AndAlso noMatchStep.Escalations.Count > 0 Then
                    Dim escalation = noMatchStep.Escalations(0)
                    ExtractMessagesFromEscalation(escalation, translations, result)
                End If
                result.NewState = state
                result.Status = "waiting_for_input"
            End If
        End Sub

        ''' <summary>
        ''' Helper: Estrae messaggi da una escalation
        ''' </summary>
        Private Shared Sub ExtractMessagesFromEscalation(
            escalation As Escalation,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            If escalation.Tasks IsNot Nothing Then
                For Each taskObj In escalation.Tasks
                    If TypeOf taskObj Is MessageTask Then
                        Dim msgTask = DirectCast(taskObj, MessageTask)
                        Dim messageText As String = Nothing
                        If translations IsNot Nothing AndAlso translations.ContainsKey(msgTask.TextKey) Then
                            messageText = translations(msgTask.TextKey)
                        Else
                            messageText = msgTask.TextKey
                        End If
                        If Not String.IsNullOrEmpty(messageText) Then
                            result.Messages.Add(messageText)
                        End If
                    End If
                Next
            End If
        End Sub

        ''' <summary>
        ''' Helper: Trova uno step per tipo
        ''' </summary>
        Private Shared Function FindStepByType(
            task As CompiledUtteranceTask,
            stepType As Global.TaskEngine.DialogueStepType
        ) As Global.TaskEngine.DialogueStep
            If task.Steps Is Nothing Then
                Return Nothing
            End If
            Return task.Steps.FirstOrDefault(Function(s) s.Type = stepType)
        End Function

        ''' <summary>
        ''' Helper: Ottiene i sub-task mancanti
        ''' </summary>
        Private Shared Function GetMissingSubTasks(
            task As CompiledUtteranceTask,
            memory As Dictionary(Of String, Object)
        ) As List(Of CompiledUtteranceTask)
            Dim missing As New List(Of CompiledUtteranceTask)()
            If task.SubTasks IsNot Nothing Then
                For Each subTask In task.SubTasks
                    If Not memory.ContainsKey(subTask.Id) Then
                        missing.Add(subTask)
                    End If
                Next
            End If
            Return missing
        End Function

        ''' <summary>
        ''' Helper: Invia messaggio per un sub-task
        ''' </summary>
        Private Shared Sub SendMessageForSubTask(
            subTask As CompiledUtteranceTask,
            translations As Dictionary(Of String, String),
            result As DialogueTurnResult
        )
            ' ✅ Trova lo step Start del sub-task
            Dim startStep = FindStepByType(subTask, Global.TaskEngine.DialogueStepType.Start)
            If startStep IsNot Nothing AndAlso startStep.Escalations IsNot Nothing AndAlso startStep.Escalations.Count > 0 Then
                Dim escalation = startStep.Escalations(0)
                ExtractMessagesFromEscalation(escalation, translations, result)
            End If
        End Sub

        ''' <summary>
        ''' Risultato di validazione
        ''' </summary>
        Private Class ValidationResult
            Public Property IsValid As Boolean
            Public Property ErrorMessage As String
        End Class

    End Class

End Namespace
