Option Strict On
Option Explicit On
Imports Compiler
Imports Newtonsoft.Json
Imports System.Linq

Namespace ApiServer.Services

    ''' <summary>
    ''' ✅ SINGLE POINT OF TRUTH: Materializza TaskDefinition completi da taskInstance + template
    '''
    ''' Responsabilità:
    ''' - Carica template da allTemplates (inviati dal frontend)
    ''' - Carica sub-template ricorsivamente
    ''' - Unisce taskInstance + template (override dell'istanza hanno priorità)
    ''' - Produce TaskDefinition completo con dataContract, constraints, ecc.
    '''
    ''' Usato da:
    ''' - HandleCompileTask (ResponseEditor)
    ''' - HandleCompileFlow (FlowCompiler)
    '''
    ''' NON fa:
    ''' - NON compila task (compito del TaskCompiler)
    ''' - NON carica template dal database (ricevuti dal frontend)
    ''' </summary>
    Public Class TaskDefinitionMaterializer

        ''' <summary>
        ''' Materializza un TaskDefinition completo da taskInstance + template
        ''' </summary>
        ''' <param name="taskInstance">Istanza del task (può essere incompleta)</param>
        ''' <param name="allTemplates">Lista di tutti i template disponibili (dal frontend)</param>
        ''' <returns>TaskDefinition completo con dataContract, constraints, ecc.</returns>
        Public Function MaterializeTaskDefinition(
            taskInstance As TaskDefinition,
            allTemplates As List(Of TaskDefinition)
        ) As TaskDefinition
            If taskInstance Is Nothing Then
                Throw New ArgumentNullException(NameOf(taskInstance), "TaskInstance cannot be Nothing")
            End If
            If allTemplates Is Nothing Then
                allTemplates = New List(Of TaskDefinition)()
            End If

            ' ✅ Se taskInstance è già completo (ha dataContract per UtteranceInterpretation), ritorna così com'è
            Dim utteranceTask = TryCast(taskInstance, UtteranceTaskDefinition)
            If utteranceTask IsNot Nothing AndAlso utteranceTask.DataContract IsNot Nothing Then
                Return taskInstance
            End If

            ' ✅ Se TemplateId è null/vuoto → task standalone, ritorna così com'è
            If String.IsNullOrEmpty(taskInstance.TemplateId) Then
                Return taskInstance
            End If

            ' ✅ CERCA TEMPLATE: taskInstance.TemplateId → template.Id in allTemplates
            ' Per costruzione, il template DEVE esistere (frontend invia tutto)
            Dim template = allTemplates.Single(Function(t) t.Id = taskInstance.TemplateId)

            ' ✅ Verifica che il template sia completo (per UtteranceInterpretation)
            Dim templateUtterance = TryCast(template, UtteranceTaskDefinition)
            If templateUtterance IsNot Nothing AndAlso templateUtterance.DataContract Is Nothing Then
                Throw New InvalidOperationException(
                    $"Template '{template.Id}' (UtteranceInterpretation) is missing required 'dataContract'. " &
                    "allTemplates should contain complete templates with dataContract. " &
                    $"Template details: Id={template.Id}, TemplateId={template.TemplateId}, Type={If(template.Type.HasValue, template.Type.Value.ToString(), "NULL")}"
                )
            End If

            ' ✅ Unisci taskInstance + template
            Dim materialized = MergeTaskInstanceWithTemplate(taskInstance, template, allTemplates)
            Return materialized
        End Function

        ''' <summary>
        ''' Materializza tutti i task di un flow
        '''
        ''' Nota: tasks può contenere sia istanze (incomplete) che template (completi).
        ''' Il materializer distingue automaticamente:
        ''' - Se task ha templateId diverso da Id → è un'istanza, cerca template e unisce
        ''' - Se task ha templateId = Id o null → è un template, ritorna così com'è
        ''' </summary>
        ''' <param name="tasks">Lista di task (istanze + template dal frontend)</param>
        ''' <param name="allTemplates">Lista di tutti i template disponibili (di solito = tasks)</param>
        ''' <returns>Lista di TaskDefinition completi + template referenziati</returns>
        Public Function MaterializeFlowTasks(
            tasks As List(Of TaskDefinition),
            allTemplates As List(Of TaskDefinition)
        ) As List(Of TaskDefinition)
            If tasks Is Nothing Then
                Return New List(Of TaskDefinition)()
            End If
            If allTemplates Is Nothing Then
                allTemplates = New List(Of TaskDefinition)()
            End If

            Dim materializedTasks As New List(Of TaskDefinition)()
            Dim collectedTemplates As New HashSet(Of String)()

            ' ✅ Materializza ogni task (istanze vengono unite con template, template restano invariati)
            For Each taskInstance In tasks
                Dim materialized = MaterializeTaskDefinition(taskInstance, allTemplates)
                materializedTasks.Add(materialized)

                ' ✅ Raccogli template referenziati (per sub-template) ricorsivamente
                CollectReferencedTemplates(materialized, allTemplates, collectedTemplates)
            Next

            ' ✅ CRITICAL: Materializza ricorsivamente anche i sub-template compositi
            ' Non basta aggiungerli così come sono da allTemplates - devono essere materializzati
            ' perché potrebbero essere compositi e avere sub-template a loro volta
            Dim newTemplates = collectedTemplates.Where(Function(id) Not materializedTasks.Any(Function(t) t.Id = id)).ToList()
            While newTemplates.Count > 0
                Dim currentNewTemplates = New List(Of String)(newTemplates)
                newTemplates.Clear()

                For Each templateId In currentNewTemplates
                    Dim template = allTemplates.FirstOrDefault(Function(t) t.Id = templateId)
                    If template IsNot Nothing Then
                        ' ✅ Materializza il sub-template (anche se è già un template completo)
                        ' Questo garantisce che tutti i suoi sub-template siano materializzati ricorsivamente
                        Dim materializedSubTemplate = MaterializeTaskDefinition(template, allTemplates)
                        materializedTasks.Add(materializedSubTemplate)

                        ' ✅ Raccogli anche i sub-template del sub-template (ricorsione profonda)
                        CollectReferencedTemplates(materializedSubTemplate, allTemplates, collectedTemplates)

                        ' ✅ Verifica se ci sono nuovi template referenziati scoperti
                        For Each newId In collectedTemplates
                            If Not materializedTasks.Any(Function(t) t.Id = newId) AndAlso Not currentNewTemplates.Contains(newId) Then
                                newTemplates.Add(newId)
                            End If
                        Next
                    End If
                Next
            End While

            Return materializedTasks
        End Function

        ''' <summary>
        ''' Unisce taskInstance + template (override dell'istanza hanno priorità)
        ''' </summary>
        Private Function MergeTaskInstanceWithTemplate(
            taskInstance As TaskDefinition,
            template As TaskDefinition,
            allTemplates As List(Of TaskDefinition)
        ) As TaskDefinition
            ' ✅ Se template è UtteranceTaskDefinition, crea UtteranceTaskDefinition materializzato
            Dim templateUtterance = TryCast(template, UtteranceTaskDefinition)
            If templateUtterance IsNot Nothing Then
                ' ✅ CRITICAL: dataContract viene SEMPRE dal template (non dall'istanza)
                ' ✅ CRITICAL: SubTasksIds viene dal template (struttura)
                ' ✅ CRITICAL: Steps vengono dall'istanza come override (se presenti)
                ' ✅ Constraints vengono dal template (validazione)
                ' ✅ Condition viene dal template (esecuzione)
                ' ✅ Calcola valori complessi prima dell'inizializzatore
                Dim labelValue As String
                If Not String.IsNullOrEmpty(taskInstance.Label) Then
                    labelValue = taskInstance.Label
                Else
                    labelValue = template.Label
                End If
                Dim parametersValue As List(Of TaskParameter)
                If taskInstance.Parameters IsNot Nothing AndAlso taskInstance.Parameters.Count > 0 Then
                    parametersValue = taskInstance.Parameters
                ElseIf template.Parameters IsNot Nothing Then
                    parametersValue = template.Parameters
                Else
                    parametersValue = New List(Of TaskParameter)()
                End If
                Dim valueValue As Dictionary(Of String, Object)
                If taskInstance.Value IsNot Nothing AndAlso taskInstance.Value.Count > 0 Then
                    valueValue = taskInstance.Value
                ElseIf template.Value IsNot Nothing Then
                    valueValue = template.Value
                Else
                    valueValue = New Dictionary(Of String, Object)()
                End If

                Dim materialized As New UtteranceTaskDefinition()
                materialized.Id = taskInstance.Id
                materialized.Type = taskInstance.Type
                materialized.TemplateId = template.Id
                materialized.Label = labelValue
                ' ❌ RIMOSSO: .Text = taskInstance.Text - task.text non deve esistere
                materialized.Parameters = parametersValue
                materialized.Value = valueValue
                materialized.DataContract = templateUtterance.DataContract
                materialized.SubTasksIds = templateUtterance.SubTasksIds
                materialized.Steps = GetStepsFromInstanceOrTemplate(taskInstance, templateUtterance)
                materialized.Constraints = templateUtterance.Constraints
                materialized.Condition = templateUtterance.Condition
                Return materialized
            End If

            ' ✅ Se template è TaskDefinition base, crea TaskDefinition materializzato
            ' ✅ Calcola valori complessi prima dell'inizializzatore
            Dim labelValueBase As String
            If Not String.IsNullOrEmpty(taskInstance.Label) Then
                labelValueBase = taskInstance.Label
            Else
                labelValueBase = template.Label
            End If
            Dim parametersValueBase As List(Of TaskParameter)
            If taskInstance.Parameters IsNot Nothing AndAlso taskInstance.Parameters.Count > 0 Then
                parametersValueBase = taskInstance.Parameters
            ElseIf template.Parameters IsNot Nothing Then
                parametersValueBase = template.Parameters
            Else
                parametersValueBase = New List(Of TaskParameter)()
            End If
            Dim valueValueBase As Dictionary(Of String, Object)
            If taskInstance.Value IsNot Nothing AndAlso taskInstance.Value.Count > 0 Then
                valueValueBase = taskInstance.Value
            ElseIf template.Value IsNot Nothing Then
                valueValueBase = template.Value
            Else
                valueValueBase = New Dictionary(Of String, Object)()
            End If

            Dim materializedBase As New TaskDefinition()
            materializedBase.Id = taskInstance.Id
            materializedBase.Type = taskInstance.Type
            materializedBase.TemplateId = template.Id
            materializedBase.Label = labelValueBase
            ' ❌ RIMOSSO: .Text = taskInstance.Text - task.text non deve esistere
            materializedBase.Parameters = parametersValueBase
            materializedBase.Value = valueValueBase
            Return materializedBase
        End Function

        ''' <summary>
        ''' Estrae steps dall'istanza (override) o dal template (default)
        ''' </summary>
        Private Function GetStepsFromInstanceOrTemplate(
            taskInstance As TaskDefinition,
            template As UtteranceTaskDefinition
        ) As Dictionary(Of String, Object)
            ' ✅ Se istanza ha steps, usali (override)
            Dim instanceUtterance = TryCast(taskInstance, UtteranceTaskDefinition)
            If instanceUtterance IsNot Nothing AndAlso instanceUtterance.Steps IsNot Nothing AndAlso instanceUtterance.Steps.Count > 0 Then
                Return instanceUtterance.Steps
            End If

            ' ✅ Altrimenti, usa steps dal template (se presente)
            If template.Steps IsNot Nothing AndAlso template.Steps.Count > 0 Then
                Return template.Steps
            End If

            ' ✅ Nessuno step disponibile
            Return New Dictionary(Of String, Object)()
        End Function

        ''' <summary>
        ''' Raccoglie template referenziati ricorsivamente (per sub-template)
        ''' </summary>
        Private Sub CollectReferencedTemplates(
            task As TaskDefinition,
            allTemplates As List(Of TaskDefinition),
            collected As HashSet(Of String)
        )
            If task Is Nothing OrElse allTemplates Is Nothing Then
                Return
            End If

            ' ✅ Se task è UtteranceTaskDefinition, raccogli sub-template
            Dim utteranceTask = TryCast(task, UtteranceTaskDefinition)
            If utteranceTask IsNot Nothing AndAlso utteranceTask.SubTasksIds IsNot Nothing Then
                For Each subTaskId In utteranceTask.SubTasksIds
                    If Not String.IsNullOrEmpty(subTaskId) AndAlso Not collected.Contains(subTaskId) Then
                        collected.Add(subTaskId)
                        ' ✅ Ricorsivamente raccogli sub-template del sub-template
                        Dim subTemplate = allTemplates.FirstOrDefault(Function(t) t.Id = subTaskId)
                        If subTemplate IsNot Nothing Then
                            CollectReferencedTemplates(subTemplate, allTemplates, collected)
                        End If
                    End If
                Next
            End If
        End Sub

    End Class

End Namespace
