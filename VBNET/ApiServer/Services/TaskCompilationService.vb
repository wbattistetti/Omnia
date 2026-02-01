Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports Newtonsoft.Json.Linq
Imports Compiler
Imports ApiServer.Models
Imports ApiServer.Converters
Imports ApiServer.Validators

''' <summary>
''' Service for task compilation logic
''' </summary>
Namespace Services

    ''' <summary>
    ''' Compiles a task into a CompiledTaskUtteranceInterpretation using the UtteranceInterpretationTaskCompiler.
    ''' Requires all referenced templates to be available in the Flow object.
    ''' </summary>
    ''' <param name="task">The task instance to compile.</param>
    ''' <param name="allTemplates">All templates (main + sub-templates) needed for compilation.</param>
    ''' <returns>Result of compilation</returns>
    Public Module TaskCompilationService

        Public Function CompileTaskToRuntime(task As Compiler.Task, allTemplates As List(Of Compiler.Task)) As CompileTaskResult
            Try
                Dim flow As New Compiler.Flow() With {
                    .Tasks = allTemplates
                }

                ' Compile task (Chat Simulator: no flowchart metadata needed)
                Dim compiler As New UtteranceInterpretationTaskCompiler()
                Dim compiledTask = compiler.Compile(task, task.Id, flow)

                If compiledTask Is Nothing Then
                    Return New CompileTaskResult(False, Nothing, $"Task compiler returned null for task '{task.Id}'. The task may be malformed or missing required fields.")
                End If

                If TypeOf compiledTask IsNot Compiler.CompiledTaskUtteranceInterpretation Then
                    Dim actualType = compiledTask.GetType().Name
                    Return New CompileTaskResult(False, Nothing, $"Task compiler returned unexpected type '{actualType}' for task '{task.Id}'. Expected CompiledTaskUtteranceInterpretation.")
                End If

                Dim utteranceTask = DirectCast(compiledTask, Compiler.CompiledTaskUtteranceInterpretation)
                If (utteranceTask.Steps Is Nothing OrElse utteranceTask.Steps.Count = 0) AndAlso
                   Not utteranceTask.HasSubTasks() Then
                    Return New CompileTaskResult(False, Nothing, $"Compiled task for '{task.Id}' has no Steps or SubTasks. The compilation may have failed silently.")
                End If

                Return New CompileTaskResult(True, utteranceTask, Nothing)
            Catch ex As Exception
                Return New CompileTaskResult(False, Nothing, $"Failed to compile task '{task.Id}' into CompiledTaskUtteranceInterpretation. Error: {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' ✅ CORRETTO: Compila TaskTreeExpanded in CompiledTaskUtteranceInterpretation
        ''' Usa UtteranceInterpretationTaskCompiler per compilazione completa:
        ''' - Estrae templateId da TaskTreeExpanded
        ''' - Carica task e template dal database
        ''' - Costruisce Task dall'istanza con steps override
        ''' - Carica tutti i template necessari ricorsivamente
        ''' - Chiama UtteranceInterpretationTaskCompiler.Compile (compilazione completa)
        ''' </summary>
        ''' <param name="taskTreeExpanded">Il TaskTreeExpanded (AST montato) da compilare</param>
        ''' <param name="translations">Le traduzioni per la risoluzione dei GUID</param>
        ''' <param name="projectId">Il project ID per caricare i template dal database</param>
        ''' <param name="taskId">Il task ID dell'istanza</param>
        ''' <returns>Risultato della compilazione</returns>
        Public Async Function CompileTaskTreeExpandedToCompiledTask(
            taskTreeExpanded As Compiler.TaskTreeExpanded,
            translations As Dictionary(Of String, String),
            projectId As String,
            taskId As String
        ) As Task(Of CompileTaskResult)
            Try
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                Console.WriteLine($"🔍 [CompileTaskTreeExpandedToCompiledTask] START - Using UtteranceInterpretationTaskCompiler")
                Console.WriteLine($"   taskTreeExpanded.Id: {taskTreeExpanded.Id}")
                Console.WriteLine($"   projectId: {projectId}")
                Console.WriteLine($"   taskId: {taskId}")
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                ' 1. Estrai templateId dal primo nodo di TaskTreeExpanded
                Dim templateId = TaskTreeConverter.ExtractTemplateIdFromTaskTreeExpanded(taskTreeExpanded, taskId)
                If String.IsNullOrEmpty(templateId) Then
                    Return New CompileTaskResult(False, Nothing, $"Cannot extract templateId from TaskTreeExpanded '{taskTreeExpanded.Id}'. The TaskTree may be malformed.")
                End If
                Console.WriteLine($"✅ [CompileTaskTreeExpandedToCompiledTask] Extracted templateId: {templateId}")

                ' 2. Carica task e template dal database
                Dim fetchResult = Await TaskDataService.FetchTasksFromNodeJs(projectId)
                If Not fetchResult.Success Then
                    Return New CompileTaskResult(False, Nothing, fetchResult.ErrorMessage)
                End If
                Dim tasksArray = fetchResult.TasksArray

                ' 3. Trova task e template
                Dim taskObj = TaskDataService.FindTaskById(tasksArray, taskId)
                If taskObj Is Nothing Then
                    Return New CompileTaskResult(False, Nothing, $"Task with ID '{taskId}' was not found in project '{projectId}'.")
                End If

                Dim templateObj = TaskDataService.FindTaskById(tasksArray, templateId)
                If templateObj Is Nothing Then
                    Return New CompileTaskResult(False, Nothing, $"Template with ID '{templateId}' was not found in project '{projectId}'.")
                End If

                ' 4. Carica tutti i template necessari ricorsivamente
                Dim loadedTemplateIds As New HashSet(Of String)()
                Dim allTemplatesList As New List(Of JObject)()

                If templateObj IsNot Nothing Then
                    allTemplatesList.Add(templateObj)
                    loadedTemplateIds.Add(templateId)
                End If

                If taskObj IsNot Nothing AndAlso Not loadedTemplateIds.Contains(taskId) Then
                    allTemplatesList.Add(taskObj)
                    loadedTemplateIds.Add(taskId)
                End If

                If templateObj IsNot Nothing Then
                    TaskDataService.LoadSubTemplatesRecursively(tasksArray, templateObj, loadedTemplateIds, allTemplatesList)
                End If

                ' 5. Deserializza tutti i template
                Dim deserializeResult = TaskDataService.DeserializeTasks(allTemplatesList)
                If Not deserializeResult.Success Then
                    Return New CompileTaskResult(False, Nothing, deserializeResult.ErrorMessage)
                End If
                Dim allTemplates = deserializeResult.Tasks

                ' 6. Trova task e template nella lista deserializzata
                Dim task = allTemplates.FirstOrDefault(Function(t) t.Id = taskId)
                Dim template = allTemplates.FirstOrDefault(Function(t) t.Id = templateId)

                If task Is Nothing Then
                    Return New CompileTaskResult(False, Nothing, $"Failed to deserialize task with ID '{taskId}'.")
                End If

                If template Is Nothing Then
                    Return New CompileTaskResult(False, Nothing, $"Failed to deserialize template with ID '{templateId}'.")
                End If

                ' 7. Assicura che task abbia templateId
                If String.IsNullOrEmpty(task.TemplateId) Then
                    task.TemplateId = templateId
                End If

                ' 8. Costruisci steps override da TaskTreeExpanded
                Dim stepsOverride = TaskTreeConverter.BuildStepsOverrideFromTaskTreeExpanded(taskTreeExpanded)
                If stepsOverride IsNot Nothing AndAlso stepsOverride.Count > 0 Then
                    task.Steps = stepsOverride
                    Console.WriteLine($"✅ [CompileTaskTreeExpandedToCompiledTask] Built steps override with {stepsOverride.Count} entries")
                End If

                ' 9. Valida tipo task
                Dim typeValidationResult = RequestValidators.ValidateTaskType(task)
                If Not typeValidationResult.IsValid Then
                    Return New CompileTaskResult(False, Nothing, typeValidationResult.ErrorMessage)
                End If

                ' 10. Compila usando UtteranceInterpretationTaskCompiler
                Dim compileResult = CompileTaskToRuntime(task, allTemplates)
                If Not compileResult.Success Then
                    Return New CompileTaskResult(False, Nothing, compileResult.ErrorMessage)
                End If

                Console.WriteLine($"✅ [CompileTaskTreeExpandedToCompiledTask] Compiled successfully using UtteranceInterpretationTaskCompiler")
                Console.WriteLine($"   Steps count: {If(compileResult.Result.Steps IsNot Nothing, compileResult.Result.Steps.Count, 0)}")
                Console.WriteLine($"   HasSubTasks: {compileResult.Result.HasSubTasks()}")
                Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

                Return New CompileTaskResult(True, compileResult.Result, Nothing)
            Catch ex As Exception
                Console.WriteLine($"❌ [CompileTaskTreeExpandedToCompiledTask] Error: {ex.Message}")
                Console.WriteLine($"   Stack trace: {ex.StackTrace}")
                If ex.InnerException IsNot Nothing Then
                    Console.WriteLine($"   Inner exception: {ex.InnerException.Message}")
                End If
                Return New CompileTaskResult(False, Nothing, $"Failed to compile TaskTreeExpanded. Error: {ex.Message}")
            End Try
        End Function

    End Module

End Namespace
