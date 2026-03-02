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
                Dim materialized As New UtteranceTaskDefinition() With {
                    .Id = taskInstance.Id,
                    .Type = taskInstance.Type,
                    .TemplateId = template.Id,
                    .Label = If(Not String.IsNullOrEmpty(taskInstance.Label), taskInstance.Label, template.Label),
                    .Text = taskInstance.Text,
                    .Parameters = If(taskInstance.Parameters IsNot Nothing AndAlso taskInstance.Parameters.Count > 0, taskInstance.Parameters, If(template.Parameters IsNot Nothing, template.Parameters, New List(Of TaskParameter)())),
                    .Value = If(taskInstance.Value IsNot Nothing AndAlso taskInstance.Value.Count > 0, taskInstance.Value, If(template.Value IsNot Nothing, template.Value, New Dictionary(Of String, Object)())),
                    .DataContract = templateUtterance.DataContract,
                    .SubTasksIds = templateUtterance.SubTasksIds,
                    .Steps = GetStepsFromInstanceOrTemplate(taskInstance, templateUtterance),
                    .Constraints = templateUtterance.Constraints,
                    .Condition = templateUtterance.Condition
                }
                Return materialized
            End If

            ' ✅ Se template è TaskDefinition base, crea TaskDefinition materializzato
            Dim materializedBase As New TaskDefinition() With {
                .Id = taskInstance.Id,
                .Type = taskInstance.Type,
                .TemplateId = template.Id,
                .Label = If(Not String.IsNullOrEmpty(taskInstance.Label), taskInstance.Label, template.Label),
                .Text = taskInstance.Text,
                .Parameters = If(taskInstance.Parameters IsNot Nothing AndAlso taskInstance.Parameters.Count > 0, taskInstance.Parameters, If(template.Parameters IsNot Nothing, template.Parameters, New List(Of TaskParameter)())),
                .Value = If(taskInstance.Value IsNot Nothing AndAlso taskInstance.Value.Count > 0, taskInstance.Value, If(template.Value IsNot Nothing, template.Value, New Dictionary(Of String, Object)()))
            }
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
