Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Runtime.CompilerServices
Imports Compiler
Imports TaskEngine
Imports IParsableTask = TaskEngine.IParsableTask

''' <summary>
''' Helper functions per ProcessTurn
''' </summary>
Public Module ProcessTurnHelpers

        ''' <summary>
        ''' Esegue i contratti NLP in cascata e restituisce ParseResult con ParseStatus
        ''' ✅ STATELESS: Usa CompiledUtteranceTask direttamente
        ''' </summary>
        Public Function RunContractsInCascade(currentTask As CompiledUtteranceTask, utterance As String, currentStepType As DialogueStepType) As ParseResultWithStatus
            If currentTask Is Nothing Then
                Return New ParseResultWithStatus() With {.Status = ParseStatus.NoMatch}
            End If

            ' ✅ STATELESS: Usa CompiledUtteranceTask direttamente
            Dim parser As New Parser()
            Dim parseResult = parser.Parse(utterance, currentTask, currentStepType)

            ' ✅ Converti ParseResultType in ParseStatus
            Dim status As ParseStatus
            Select Case parseResult.Result
                Case ParseResultType.Match
                    status = ParseStatus.Match
                Case ParseResultType.NoMatch
                    status = ParseStatus.NoMatch
                Case ParseResultType.NoInput
                    status = ParseStatus.NoInput
                Case ParseResultType.Corrected
                    status = ParseStatus.PartialMatch
                Case Else
                    status = ParseStatus.NoMatch
            End Select

            ' ✅ Verifica se è MatchedButInvalid (validazione fallita)
            If status = ParseStatus.Match AndAlso Not String.IsNullOrEmpty(parseResult.ConditionId) Then
                status = ParseStatus.MatchedButInvalid
            End If

            Return New ParseResultWithStatus() With {
            .Status = status,
            .ExtractedData = parseResult.ExtractedData,
            .ExtractedVariables = parseResult.ExtractedVariables,  ' ✅ NEW: Passa triple esplicite
            .ConditionId = parseResult.ConditionId
        }
        End Function

    ''' <summary>
    ''' Salva i dati estratti in state.ExtractedVariables (persistente)
    ''' ✅ Usa solo ExtractedVariables (triple esplicite)
    ''' </summary>
    Public Sub FillTaskFromParseResult(
        parseResult As ParseResultWithStatus,
        state As DialogueState
    )
        ' ✅ Usa solo ExtractedVariables
        If parseResult.ExtractedVariables IsNot Nothing AndAlso parseResult.ExtractedVariables.Count > 0 Then
            If state.ExtractedVariables Is Nothing Then
                state.ExtractedVariables = New List(Of ExtractedVariable)()
            End If
            ' ✅ Aggiungi tutte le triple estratte
            state.ExtractedVariables.AddRange(parseResult.ExtractedVariables)
        End If
    End Sub

    ''' <summary>
    ''' Esegue uno step stateless e restituisce i messaggi
    ''' </summary>
    Public Function ExecuteStepStateless(currentTask As CompiledUtteranceTask, currentStep As CompiledDialogueStep, resolveTranslation As Func(Of String, String)) As List(Of String)
        Dim output As New List(Of String)()

        If currentStep Is Nothing OrElse currentStep.Escalations Is Nothing OrElse currentStep.Escalations.Count = 0 Then
            Return output
        End If

        ' ✅ Esegui la prima escalation
        Dim escalation = currentStep.Escalations(0)
        output.AddRange(ExecuteEscalationStateless(currentTask, currentStep, 0, resolveTranslation))

        Return output
    End Function

    ''' <summary>
    ''' Esegue un'escalation stateless e restituisce i messaggi
    ''' </summary>
    Public Function ExecuteEscalationStateless(currentTask As CompiledUtteranceTask, currentStep As CompiledDialogueStep, escalationIndex As Integer, resolveTranslation As Func(Of String, String)) As List(Of String)
        Dim output As New List(Of String)()

        If currentStep Is Nothing OrElse currentStep.Escalations Is Nothing OrElse escalationIndex < 0 OrElse escalationIndex >= currentStep.Escalations.Count Then
            Return output
        End If

        Dim escalation = currentStep.Escalations(escalationIndex)
        If escalation.Tasks IsNot Nothing Then
            For Each taskObj In escalation.Tasks
                If TypeOf taskObj Is MessageTask Then
                    Dim msgTask = DirectCast(taskObj, MessageTask)
                    Dim messageText As String = Nothing
                    If resolveTranslation IsNot Nothing Then
                        Dim translated = resolveTranslation(msgTask.TextKey)
                        messageText = If(String.IsNullOrEmpty(translated), msgTask.TextKey, translated)
                    Else
                        messageText = msgTask.TextKey
                    End If
                    If Not String.IsNullOrEmpty(messageText) Then
                        output.Add(messageText)
                    End If
                End If
            Next
        End If

        Return output
    End Function

    ''' <summary>
    ''' Ottiene uno step per tipo (restituisce Nothing se non trovato)
    ''' </summary>
    Public Function GetStepOrNull(task As CompiledUtteranceTask, stepType As DialogueStepType) As CompiledDialogueStep
        If task Is Nothing OrElse task.Steps Is Nothing Then
            Return Nothing
        End If
        Return task.Steps.FirstOrDefault(Function(s) s.Type = stepType)
    End Function

    ''' <summary>
    ''' Ottiene il prossimo step (per ora restituisce lo stesso step)
    ''' TODO: Implementare logica di navigazione
    ''' </summary>
    Public Function GetNextStep(task As CompiledUtteranceTask, currentStep As CompiledDialogueStep) As CompiledDialogueStep
        ' Per ora restituisce lo stesso step
        ' TODO: Implementare logica di navigazione tra step
        Return currentStep
    End Function

    ''' <summary>
    ''' Verifica se il task è riempito (ha valore in ExtractedVariables o tutti i sub-task sono riempiti)
    ''' ✅ Usa ExtractedVariables (triple esplicite) invece di Memory
    ''' </summary>
    <Extension>
    Public Function IsFilled(task As CompiledUtteranceTask, extractedVariables As List(Of ExtractedVariable)) As Boolean
        If task Is Nothing Then
            Return False
        End If

        If task.SubTasks IsNot Nothing AndAlso task.SubTasks.Count > 0 Then
            Return task.SubTasks.All(Function(st) IsFilled(st, extractedVariables))
        End If

        ' ✅ Cerca variabile con (taskInstanceId = task.Id, nodeId = task.NodeId)
        If extractedVariables Is Nothing Then
            Return False
        End If

        Return extractedVariables.Any(
                Function(ev) ev.TaskInstanceId = task.Id AndAlso ev.NodeId = task.NodeId
            )
    End Function

    ''' <summary>
    ''' Verifica se il task è parzialmente riempito (alcuni sub-task sono riempiti ma non tutti)
    ''' ✅ Usa ExtractedVariables invece di Memory
    ''' </summary>
    <Extension>
    Public Function IsPartiallyFilled(task As CompiledUtteranceTask, extractedVariables As List(Of ExtractedVariable)) As Boolean
        If task Is Nothing OrElse task.SubTasks Is Nothing OrElse task.SubTasks.Count = 0 Then
            Return False
        End If
        Dim filledCount = task.SubTasks.Where(Function(st) IsFilled(st, extractedVariables)).Count()
        Return filledCount > 0 AndAlso filledCount < task.SubTasks.Count
    End Function

    ''' <summary>
    ''' Ottiene il primo sub-task non riempito
    ''' ✅ Usa ExtractedVariables invece di Memory
    ''' </summary>
    <Extension>
    Public Function GetFirstUnfilledSubTask(currentTask As CompiledUtteranceTask, extractedVariables As List(Of ExtractedVariable)) As CompiledUtteranceTask
        If currentTask Is Nothing OrElse currentTask.SubTasks Is Nothing OrElse currentTask.SubTasks.Count = 0 Then
            Return Nothing
        End If

        Return currentTask.SubTasks.FirstOrDefault(Function(st) Not IsFilled(st, extractedVariables))
    End Function

        ''' <summary>
        ''' Verifica se il task è il task principale (confronta con rootTask)
        ''' </summary>
        <Extension>
        Public Function IsMainTask(task As CompiledUtteranceTask, rootTask As CompiledUtteranceTask) As Boolean
            If task Is Nothing OrElse rootTask Is Nothing Then
                Return False
            End If
            Return task.Id = rootTask.Id
        End Function

        ''' <summary>
        ''' Restituisce il main task (rootTask)
        ''' </summary>
        <Extension>
        Public Function MainTask(task As CompiledUtteranceTask, rootTask As CompiledUtteranceTask) As CompiledUtteranceTask
            Return rootTask
        End Function

        ''' <summary>
        ''' Trova il parent di un subtask nella gerarchia (ricorsivo)
        ''' </summary>
        <Extension>
        Public Function FindParent(subTask As CompiledUtteranceTask, rootTask As CompiledUtteranceTask) As CompiledUtteranceTask
            If rootTask Is Nothing OrElse subTask Is Nothing Then
                Return Nothing
            End If

            ' Se il subtask è il root stesso, non ha parent
            If subTask.Id = rootTask.Id Then
                Return Nothing
            End If

            ' Cerca ricorsivamente nel root e nei suoi subtask
            Return FindParentRecursive(subTask, rootTask)
        End Function

        ''' <summary>
        ''' Helper ricorsivo per trovare il parent
        ''' </summary>
        Private Function FindParentRecursive(subTask As CompiledUtteranceTask, parent As CompiledUtteranceTask) As CompiledUtteranceTask
            If parent Is Nothing OrElse parent.SubTasks Is Nothing Then
                Return Nothing
            End If

            ' Verifica se è un subtask diretto
            If parent.SubTasks.Any(Function(st) st.Id = subTask.Id) Then
                Return parent
            End If

            ' Cerca ricorsivamente nei sub-subTasks
            For Each child In parent.SubTasks
                Dim found = FindParentRecursive(subTask, child)
                If found IsNot Nothing Then
                    Return found
                End If
            Next

            Return Nothing
        End Function


        ''' <summary>
        ''' RenderStepTasks:
        ''' Seleziona l'escalation corretta (in base a NoMatch/NoInput counters)
        ''' e converte i task "renderizzabili" in TextKey da mostrare in chat.
        ''' ✅ STATELESS: Restituisce TextKey, non testo risolto.
        ''' La risoluzione avverrà nei chiamanti (FlowOrchestrator.messageCallback, TaskSessionHandlers).
        ''' </summary>
        Public Function RenderStepTasks(
        stepObj As CompiledDialogueStep,
        currentTask As CompiledUtteranceTask,
        state As DialogueState
    ) As List(Of String)

            Dim messages As New List(Of String)

            If stepObj Is Nothing OrElse stepObj.Escalations Is Nothing OrElse stepObj.Escalations.Count = 0 Then
                Return messages
            End If

            ' Determina l'indice di escalation in base al tipo di step e ai counters
            Dim escalationIndex As Integer = 0

            ' ✅ Usa counters da state.Counters
            If state.Counters Is Nothing Then
                state.Counters = New Dictionary(Of String, Counters)()
            End If
            If Not state.Counters.ContainsKey(currentTask.Id) Then
                state.Counters(currentTask.Id) = New Counters()
            End If
            Dim taskCounters = state.Counters(currentTask.Id)

            If stepObj.Type = DialogueStepType.NoMatch Then
                Dim maxIndex = stepObj.Escalations.Count - 1
                escalationIndex = Math.Min(Math.Max(taskCounters.NoMatch - 1, 0), maxIndex)

            ElseIf stepObj.Type = DialogueStepType.NoInput Then
                Dim maxIndex = stepObj.Escalations.Count - 1
                escalationIndex = Math.Min(Math.Max(taskCounters.NoInput - 1, 0), maxIndex)
            End If

            ' Seleziona l'escalation corretta
            Dim escalation = stepObj.Escalations(escalationIndex)

            If escalation.Tasks Is Nothing Then
                Return messages
            End If

            ' ✅ STATELESS: Renderizza solo i task che hanno una rappresentazione testuale in chat
            ' Restituisce TextKey direttamente, senza risoluzione
            ' La risoluzione avverrà nei chiamanti (SINGLE POINT OF TRUTH)
            For Each taskObj In escalation.Tasks
                If TypeOf taskObj Is MessageTask Then
                    Dim msgTask = DirectCast(taskObj, MessageTask)
                    ' ✅ Restituisci TextKey direttamente
                    If Not String.IsNullOrEmpty(msgTask.TextKey) Then
                        messages.Add(msgTask.TextKey)
                    End If
                ElseIf TypeOf taskObj Is CloseSessionTask Then
                    messages.Add("[Chiusura chiamata]")
                    ' FUTURO: gestire altri tipi di task se necessario
                    ' ElseIf TypeOf taskObj Is SendSmsTask Then
                    '     Dim smsTask = DirectCast(taskObj, SendSmsTask)
                    '     messages.Add($"[SMS inviato al numero {smsTask.PhoneNumber}]")
                End If
            Next

            Return messages
        End Function

        ''' <summary>
        ''' Ottiene uno step per tipo
        ''' </summary>
        ''' <Extension>
        <Extension>
        Public Function GetStep(task As CompiledUtteranceTask, stepType As DialogueStepType) As CompiledDialogueStep
            If task Is Nothing OrElse task.Steps Is Nothing Then
                Throw New InvalidOperationException($"Task '{If(task IsNot Nothing, task.Id, "null")}' has no steps")
            End If
            Return task.Steps.SingleOrDefault(Function(s) s.Type = stepType)
        End Function


        <Extension>
        Public Function StepExists(task As CompiledUtteranceTask, stepType As DialogueStepType) As Boolean
            If task.Steps Is Nothing Then Return False
        Return task.Steps.SingleOrDefault(Function(s) s.Type = stepType) IsNot Nothing
    End Function

End Module
''' <summary>
''' ParseResult con ParseStatus invece di ParseResultType
''' </summary>
Public Class ParseResultWithStatus
    Public Property Status As ParseStatus
    Public Property ExtractedData As Dictionary(Of String, Object)
    Public Property ExtractedVariables As List(Of ExtractedVariable)  ' ✅ NEW: Triple esplicite
    Public Property ConditionId As String

    Public Sub New()
        ExtractedData = New Dictionary(Of String, Object)()
        ExtractedVariables = New List(Of ExtractedVariable)()
    End Sub
End Class
