Option Strict On
Option Explicit On
Imports Compiler
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

            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ' 1) LOGICA PURA: aggiornamento dello stato
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Select Case state.Mode

            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ' ESECUZIONE STEP (PRIMO TURNO)
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                Case DialogueMode.ExecutingStep

                    Dim stepObj = ProcessTurnHelpers.GetStep(state.CurrentTask, state.CurrentStepType)
                    If ProcessTurnHelpers.IsFilled(state.CurrentTask, state.Memory) Then
                        ' Step senza input â†’ transizione immediata allo step successivo
                        Dim nextStep = ProcessTurnHelpers.GetNextStep(state.CurrentTask, stepObj)  'OSSERVAZIONE: In realtÃ  la navigazione CioÃ¨ la decisione del prossimo step Ã¨ Implementata in questa funzione non Ã¨ esternalizzata quindi questo gap forse non serve piÃ¹

                        state.CurrentStepType = nextStep.Type
                        state.Mode = DialogueMode.ExecutingStep
                    Else
                        state.Mode = DialogueMode.WaitingForUtterance
                    End If
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ' IN ATTESA DELL'UTTERANCE (SECONDO TURNO)
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                Case DialogueMode.WaitingForUtterance

                    If String.IsNullOrEmpty(utterance) Then
                        ' Nessun input â†’ NoInput escalation
                        EnsureCounter(state, state.CurrentTask.Id)
                        state.Counters(state.CurrentTask.Id).NoInput += 1
                        state.CurrentStepType = Global.TaskEngine.DialogueStepType.NoInput
                        state.Mode = DialogueMode.ExecutingStep
                    Else
                        ' Input ricevuto â†’ parsing
                        Dim parseResult = ProcessTurnHelpers.RunContractsInCascade(
                            state.CurrentTask, utterance, state.CurrentStepType
                        )

                        Select Case parseResult.Status

                            Case ParseStatus.Match
                                ProcessTurnHelpers.FillTaskFromParseResult(parseResult, state)

                                'c'Ã¨ stato un match potrebbe essere per il task corrente o per una altro task. quindi devo: se sono in subtask tornare altask parent e rivedere qua'Ã¨ il porssimo da fillare se non c'Ã¨ nente da fillare allora devo o conferemare o andare al success .

                                Dim mainTask = ProcessTurnHelpers.MainTask(state.CurrentTask, state.RootTask)
                                If ProcessTurnHelpers.IsFilled(mainTask, state.Memory) Then
                                    ' Main task completato â†’ gestisci Confirmation o Success
                                    If state.CurrentTask.StepExists(DialogueStepType.Confirmation) Then
                                        state.CurrentStepType = DialogueStepType.Confirmation
                                    ElseIf state.CurrentTask.StepExists(DialogueStepType.Success) Then
                                        state.CurrentStepType = DialogueStepType.Success
                                    Else
                                        ' Main task completato senza Confirmation/Success â†’ completa
                                        state.IsCompleted = True
                                        state.Mode = DialogueMode.Completed
                                    End If
                                Else
                                    ' Main task non ancora completato â†’ vai al prossimo subtask non riempito
                                    state = SetStateToTheFirstUnfilledSubTask(state)
                                End If



                            Case ParseStatus.NoMatch
                                EnsureCounter(state, state.CurrentTask.Id)
                                state.Counters(state.CurrentTask.Id).NoMatch += 1
                                state.CurrentStepType = Global.TaskEngine.DialogueStepType.NoMatch
                                state.Mode = DialogueMode.ExecutingStep

                            Case ParseStatus.NoInput
                                EnsureCounter(state, state.CurrentTask.Id)
                                state.Counters(state.CurrentTask.Id).NoInput += 1
                                state.CurrentStepType = Global.TaskEngine.DialogueStepType.NoInput
                                state.Mode = DialogueMode.ExecutingStep

                            Case ParseStatus.PartialMatch, ParseStatus.MatchedButInvalid
                                ' Rimani nello stesso task/step, ma torna in ExecutingStep
                                state.Mode = DialogueMode.ExecutingStep

                        End Select
                    End If


            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ' COMPLETATO
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                Case DialogueMode.Completed
                    ' Stato terminale: nessuna logica aggiuntiva

            End Select

            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            ' 2) RENDERING UNICO: produce i task dello step corrente
            'â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            Dim renderedTasks As New List(Of String)

            If state.Mode <> DialogueMode.Completed Then
                Dim stepToRender = ProcessTurnHelpers.GetStep(state.CurrentTask, state.CurrentStepType)
                renderedTasks = ProcessTurnHelpers.RenderStepTasks(stepToRender, state.CurrentTask, state, resolveTranslation)
                If Not ProcessTurnHelpers.IsFilled(state.CurrentTask, state.Memory) OrElse state.CurrentStepType = DialogueStepType.Confirmation Then
                    state.Mode = DialogueMode.WaitingForUtterance
                End If
            End If

            Return New DialogueTurnResult(renderedTasks, state)

        End Function

        ''' <summary>
        ''' Helper: Inizializza counter per un task se non esiste
        ''' </summary>
        Private Shared Sub EnsureCounter(state As DialogueState, taskId As String)
            If state.Counters Is Nothing Then
                state.Counters = New Dictionary(Of String, Counters)()
            End If
            If Not state.Counters.ContainsKey(taskId) Then
                state.Counters(taskId) = New Counters()
            End If
        End Sub

        Private Shared Function SetStateToTheFirstUnfilledSubTask(state As DialogueState) As DialogueState
            Dim nextSubTask = ProcessTurnHelpers.GetFirstUnfilledSubTask(state.CurrentTask, state.Memory)
            If nextSubTask IsNot Nothing Then
                state.CurrentTask = nextSubTask
                state.CurrentStepType = Global.TaskEngine.DialogueStepType.Start
                state.Mode = DialogueMode.ExecutingStep
            End If
            Return state
        End Function

    End Class

End Namespace
