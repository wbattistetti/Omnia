Option Strict On
Option Explicit On
Imports Compiler
Imports System.Linq
Imports DDTEngine.Engine
Imports TaskEngine

Namespace TaskEngine

    ''' <summary>
    ''' Helper functions per ProcessTurn
    ''' </summary>
    Public Module ProcessTurnHelpers

    ''' <summary>
    ''' Esegue i contratti NLP in cascata e restituisce ParseResult con ParseStatus
    ''' ✅ STATELESS: Usa CompiledUtteranceTask direttamente, senza conversione
    ''' </summary>
    Public Function RunContractsInCascade(currentTask As UtteranceTaskInstance, utterance As String, currentStepType As Global.TaskEngine.DialogueStepType) As ParseResultWithStatus
        If currentTask Is Nothing OrElse currentTask.CompiledTask Is Nothing Then
            Return New ParseResultWithStatus() With {.Status = ParseStatus.NoMatch}
        End If

        ' ✅ STATELESS: Usa CompiledUtteranceTask direttamente, senza conversione
        Dim parser As New Parser()
        Dim parseResult = parser.Parse(utterance, currentTask.CompiledTask, currentStepType)

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
            .ConditionId = parseResult.ConditionId
        }
    End Function

    ''' <summary>
    ''' Salva i dati estratti in state.Memory (persistente)
    ''' ✅ STATELESS: Salva solo in state.Memory, non in currentTask.Value
    ''' </summary>
    Public Sub FillTaskFromParseResult(
        parseResult As ParseResultWithStatus,
        state As DialogueState
    )
        If parseResult.ExtractedData Is Nothing OrElse parseResult.ExtractedData.Count = 0 Then
            Return
        End If

        ' ✅ STATELESS: Inizializza Memory se necessario
        If state.Memory Is Nothing Then
            state.Memory = New Dictionary(Of String, Object)()
        End If

        ' ✅ STATELESS: Salva tutti i valori estratti in Memory (persistente)
        For Each kvp In parseResult.ExtractedData
            state.Memory(kvp.Key) = kvp.Value
        Next
    End Sub

        ''' <summary>
        ''' Esegue uno step stateless e restituisce i messaggi
        ''' </summary>
        Public Function ExecuteStepStateless(currentTask As UtteranceTaskInstance, currentStep As Global.TaskEngine.DialogueStep, resolveTranslation As Func(Of String, String)) As List(Of String)
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
        Public Function ExecuteEscalationStateless(currentTask As UtteranceTaskInstance, currentStep As Global.TaskEngine.DialogueStep, escalationIndex As Integer, resolveTranslation As Func(Of String, String)) As List(Of String)
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
    ''' Ottiene il primo sub-task non riempito
    ''' ✅ STATELESS: Usa memory per verificare se è riempito
    ''' </summary>
    Public Function GetFirstUnfilledSubTask(currentTask As UtteranceTaskInstance, memory As Dictionary(Of String, Object)) As UtteranceTaskInstance
        If currentTask.SubTasks Is Nothing OrElse currentTask.SubTasks.Count = 0 Then
            Return Nothing
        End If

        Return currentTask.SubTasks.FirstOrDefault(Function(st) Not st.IsFilled(memory))
    End Function

    ''' <summary>
    ''' Verifica se il task è parzialmente riempito
    ''' ✅ STATELESS: Usa memory per verificare se è riempito
    ''' </summary>
    Public Function IsPartiallyFilled(currentTask As UtteranceTaskInstance, memory As Dictionary(Of String, Object)) As Boolean
        Return currentTask.IsPartiallyFilled(memory)
    End Function

    ''' <summary>
    ''' Verifica se il task è il task principale
    ''' </summary>
    Public Function IsMainTask(currentTask As UtteranceTaskInstance) As Boolean
        Return currentTask.IsMainTask()
    End Function


    ''' <summary>
    ''' Crea UtteranceTaskInstance da CompiledUtteranceTask con struttura ricorsiva
    ''' </summary>
    Public Function CreateTaskInstance(compiledTask As CompiledUtteranceTask) As UtteranceTaskInstance
        Dim instance As New UtteranceTaskInstance(compiledTask)

        ' ✅ Crea sub-task instances
        If compiledTask.SubTasks IsNot Nothing Then
            For Each subTask In compiledTask.SubTasks
                Dim subInstance = CreateTaskInstance(subTask)
                subInstance.Parent = instance
                instance.SubTasks.Add(subInstance)
            Next
        End If

        Return instance
    End Function

    End Module

    ''' <summary>
    ''' ParseResult con ParseStatus invece di ParseResultType
    ''' </summary>
    Public Class ParseResultWithStatus
        Public Property Status As ParseStatus
        Public Property ExtractedData As Dictionary(Of String, Object)
        Public Property ConditionId As String

        Public Sub New()
            ExtractedData = New Dictionary(Of String, Object)()
        End Sub
    End Class

End Namespace
