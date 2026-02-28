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
    ''' </summary>
    Public Function RunContractsInCascade(currentTask As UtteranceTaskInstance, utterance As String) As ParseResultWithStatus
        If currentTask Is Nothing OrElse currentTask.CompiledTask Is Nothing Then
            Return New ParseResultWithStatus() With {.Status = ParseStatus.NoMatch}
        End If

        ' ✅ Converti CompiledUtteranceTask in TaskUtterance per usare il Parser esistente
        Dim taskUtterance = ConvertToTaskUtterance(currentTask.CompiledTask)
        If taskUtterance Is Nothing Then
            Return New ParseResultWithStatus() With {.Status = ParseStatus.NoMatch}
        End If

        ' ✅ Usa il Parser esistente
        Dim parser As New Parser()
        Dim parseResult = parser.Parse(utterance, taskUtterance)

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
    ''' Popola il task con i dati estratti dal ParseResult
    ''' </summary>
    Public Sub FillTaskFromParseResult(currentTask As UtteranceTaskInstance, parseResult As ParseResultWithStatus)
        If parseResult.ExtractedData Is Nothing OrElse parseResult.ExtractedData.Count = 0 Then
            Return
        End If

        ' ✅ Se il task ha sub-task, popola i sub-task
        If currentTask.SubTasks IsNot Nothing AndAlso currentTask.SubTasks.Count > 0 Then
            For Each kvp In parseResult.ExtractedData
                Dim subTask = currentTask.SubTasks.FirstOrDefault(Function(st) st.CompiledTask.Id = kvp.Key)
                If subTask IsNot Nothing Then
                    subTask.Value = kvp.Value
                End If
            Next
        Else
            ' ✅ Task atomico: popola direttamente il valore
            If parseResult.ExtractedData.ContainsKey(currentTask.CompiledTask.Id) Then
                currentTask.Value = parseResult.ExtractedData(currentTask.CompiledTask.Id)
            ElseIf parseResult.ExtractedData.Count = 1 Then
                ' ✅ Se c'è un solo valore, usalo
                currentTask.Value = parseResult.ExtractedData.Values.First()
            End If
        End If
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
    ''' </summary>
    Public Function GetFirstUnfilledSubTask(currentTask As UtteranceTaskInstance) As UtteranceTaskInstance
        If currentTask.SubTasks Is Nothing OrElse currentTask.SubTasks.Count = 0 Then
            Return Nothing
        End If

        Return currentTask.SubTasks.FirstOrDefault(Function(st) Not st.IsFilled())
    End Function

    ''' <summary>
    ''' Verifica se il task è parzialmente riempito
    ''' </summary>
    Public Function IsPartiallyFilled(currentTask As UtteranceTaskInstance) As Boolean
        Return currentTask.IsPartiallyFilled()
    End Function

    ''' <summary>
    ''' Verifica se il task è il task principale
    ''' </summary>
    Public Function IsMainTask(currentTask As UtteranceTaskInstance) As Boolean
        Return currentTask.IsMainTask()
    End Function

    ''' <summary>
    ''' Converte CompiledUtteranceTask in TaskUtterance per usare il Parser
    ''' TODO: Implementare conversione completa
    ''' </summary>
    Private Function ConvertToTaskUtterance(compiledTask As CompiledUtteranceTask) As TaskUtterance
        ' ✅ Per ora crea un TaskUtterance minimale
        ' TODO: Implementare conversione completa con Steps, NlpContract, SubTasks, ecc.
        Dim taskUtterance As New TaskUtterance() With {
            .Id = compiledTask.Id,
            .Steps = compiledTask.Steps,
            .NlpContract = compiledTask.NlpContract,
            .SubTasks = New List(Of TaskUtterance)()
        }

        ' ✅ Converti SubTasks
        If compiledTask.SubTasks IsNot Nothing Then
            For Each subTask In compiledTask.SubTasks
                Dim subTaskUtterance = ConvertToTaskUtterance(subTask)
                subTaskUtterance.ParentData = taskUtterance
                taskUtterance.SubTasks.Add(subTaskUtterance)
            Next
        End If

        Return taskUtterance
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
