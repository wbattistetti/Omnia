Option Strict On
Option Explicit On
Imports Compiler
Imports System.Linq
Imports Newtonsoft.Json
Imports TaskEngine
Namespace TaskEngine

    ''' <summary>
    ''' ProcessTurn: Funzione pura stateless per processare un turno di dialogo
    ''' FASE 1: Invio messaggio iniziale (Start step)
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
        End Class

        ''' <summary>
        ''' ProcessTurn: Funzione pura stateless
        ''' FASE 1: Gestisce solo l'invio del messaggio iniziale (Start step)
        ''' </summary>
        Public Shared Function ProcessTurn(
        state As DialogueState,
        utterance As String,
        task As CompiledUtteranceTask,
        translations As Dictionary(Of String, String)
    ) As DialogueTurnResult

            Dim result As New DialogueTurnResult()

            ' ✅ Validazione parametri
            If task Is Nothing Then
                Throw New ArgumentNullException(NameOf(task), "CompiledUtteranceTask cannot be null")
            End If

            ' ✅ FASE 1: Se state è vuoto o TurnState = Start, invia messaggio iniziale
            If state Is Nothing OrElse state.TurnState = TurnState.Start Then
                ' ✅ Inizializza nuovo state se vuoto
                If state Is Nothing Then
                    state = New DialogueState()
                End If

                ' ✅ Trova lo step di tipo Start usando SingleOrDefault per rilevare duplicati
                ' ✅ task.Steps è List(Of TaskEngine.DialogueStep) dove TaskEngine.DialogueStep è da DDTEngine
                ' ✅ DialogueStepType enum è nel namespace TaskEngine (da DDTEngine) - usiamo Global per evitare ambiguità
                If task.Steps IsNot Nothing AndAlso task.Steps.Count > 0 Then
                    ' ✅ Validazione: translations può essere Nothing
                    If translations Is Nothing Then
                        translations = New Dictionary(Of String, String)()
                    End If
                    ' ✅ Estrai il valore enum prima del lambda per evitare problemi di risoluzione namespace
                    ' ✅ Usa Global.TaskEngine per riferirsi al namespace root (da DDTEngine), non al namespace corrente
                    Dim startStateValue As Global.TaskEngine.DialogueStepType = Global.TaskEngine.DialogueStepType.Start
                    Dim startStep As Global.TaskEngine.DialogueStep = Nothing
                    Try
                        ' ✅ Usa SingleOrDefault per rilevare duplicati (dovrebbe essere 0 o 1)
                        Dim stepObj = task.Steps.SingleOrDefault(Function(s) s.Type = startStateValue)
                        If stepObj IsNot Nothing Then
                            startStep = stepObj
                        End If
                    Catch ex As InvalidOperationException
                        ' Se ci sono duplicati, SingleOrDefault lancia InvalidOperationException
                        Throw New InvalidOperationException($"Invalid task model: Task {task.Id} has duplicate steps with Type=Start. Each Type must appear exactly once.", ex)
                    End Try

                    If startStep IsNot Nothing Then
                        ' ✅ Seleziona la prima escalation (counter = 0)
                        If startStep.Escalations IsNot Nothing AndAlso startStep.Escalations.Count > 0 Then
                            Dim firstEscalation = startStep.Escalations(0)

                            ' ✅ Estrai tutti i MessageTask dalla escalation
                            If firstEscalation.Tasks IsNot Nothing Then
                                For Each taskObj In firstEscalation.Tasks
                                    ' ✅ MessageTask è accessibile tramite Imports TaskEngine
                                    If TypeOf taskObj Is MessageTask Then
                                        Dim msgTask = DirectCast(taskObj, MessageTask)

                                        ' ✅ Risolvi TextKey → testo usando translations
                                        Dim messageText As String = Nothing
                                        If translations IsNot Nothing AndAlso translations.ContainsKey(msgTask.TextKey) Then
                                            messageText = translations(msgTask.TextKey)
                                        Else
                                            ' Fallback: usa TextKey se traduzione non trovata
                                            messageText = msgTask.TextKey
                                        End If

                                        If Not String.IsNullOrEmpty(messageText) Then
                                            result.Messages.Add(messageText)
                                        End If
                                    End If
                                Next
                            End If
                        End If
                    End If
                End If

                ' ✅ Aggiorna stato: rimane in Start ma ora abbiamo inviato il messaggio
                ' Per ora non cambiamo TurnState (lo faremo in Fase 2 quando gestiamo l'input)
                result.NewState = state
                result.Status = "waiting_for_input"
            Else
                ' ✅ FASE 1: Se non siamo in Start, per ora restituiamo stato invariato
                ' (Fase 2 gestirà input e transizioni)
                result.NewState = state
                result.Status = "waiting_for_input"
            End If

            Return result

        End Function

    End Class

End Namespace
