Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Net.Http
Imports System.Threading.Tasks
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler

''' <summary>
''' Service for accessing task data from Node.js backend
''' </summary>
Namespace Services

    ''' <summary>
    ''' Fetches all tasks (project tasks + referenced factory templates) from the Node.js backend API.
    ''' </summary>
    ''' <param name="projectId">The project identifier to load tasks for.</param>
    ''' <returns>A tuple containing: (Success As Boolean, TasksArray As JArray, ErrorMessage As String)</returns>
    Public Module TaskDataService

        Public Async Function FetchTasksFromNodeJs(projectId As String) As Task(Of (Success As Boolean, TasksArray As JArray, ErrorMessage As String))
            Try
                Using httpClient As New HttpClient()
                    httpClient.Timeout = TimeSpan.FromSeconds(30)

                    Dim tasksUrl = $"http://localhost:3100/api/projects/{Uri.EscapeDataString(projectId)}/tasks"
                    Dim response = Await httpClient.GetAsync(tasksUrl)

                    If Not response.IsSuccessStatusCode Then
                        Return (False, Nothing, $"Node.js API returned error status {response.StatusCode} when fetching tasks for project '{projectId}'. URL: {tasksUrl}")
                    End If

                    Dim responseJson = Await response.Content.ReadAsStringAsync()
                    Dim responseObj = JsonConvert.DeserializeObject(Of JObject)(responseJson)
                    Dim itemsToken = responseObj("items")
                    Dim tasksArray As JArray = If(itemsToken IsNot Nothing AndAlso TypeOf itemsToken Is JArray, CType(itemsToken, JArray), New JArray())

                    Return (True, tasksArray, Nothing)
                End Using
            Catch ex As Exception
                Return (False, Nothing, $"Failed to fetch tasks from Node.js API for project '{projectId}'. Error: {ex.Message}")
            End Try
        End Function

        ''' <summary>
        ''' Finds a task object by its ID within a JArray of tasks.
        ''' </summary>
        ''' <param name="tasksArray">The array of tasks to search in.</param>
        ''' <param name="taskId">The task identifier to find.</param>
        ''' <returns>The JObject representing the task, or Nothing if not found.</returns>
        Public Function FindTaskById(tasksArray As JArray, taskId As String) As JObject
            For Each item In tasksArray
                Dim idToken = item("id")
                If idToken IsNot Nothing AndAlso idToken.ToString() = taskId Then
                    Return CType(item, JObject)
                End If
            Next
            Return Nothing
        End Function

        ''' <summary>
        ''' Finds the template object for a given task. If the task has a templateId, searches for that template.
        ''' Otherwise, uses the task itself as the template.
        ''' </summary>
        ''' <param name="tasksArray">The array of tasks to search in.</param>
        ''' <param name="taskObj">The task object to find the template for.</param>
        ''' <param name="taskId">The task identifier (used as fallback if templateId is missing).</param>
        ''' <returns>A tuple containing: (TemplateObj As JObject, TemplateId As String)</returns>
        Public Function FindTemplateForTask(tasksArray As JArray, taskObj As JObject, taskId As String) As (TemplateObj As JObject, TemplateId As String)
            Dim templateIdToken = taskObj("templateId")
            Dim templateId = If(templateIdToken IsNot Nothing, templateIdToken.ToString(), taskId)

            If String.IsNullOrEmpty(templateId) OrElse templateId = taskId Then
                ' Task is standalone, use itself as template
                Return (taskObj, taskId)
            End If

            ' Search for template in tasks array
            Dim templateObj = FindTaskById(tasksArray, templateId)
            If templateObj IsNot Nothing Then
                Return (templateObj, templateId)
            End If

            ' Template not found, fallback to task itself
            Return (taskObj, taskId)
        End Function

        ''' <summary>
        ''' Recursively loads all sub-templates referenced by a template's subTasksIds field.
        ''' </summary>
        ''' <param name="tasksArray">The array of all available tasks (project + factory).</param>
        ''' <param name="rootTemplate">The root template to start loading from.</param>
        ''' <param name="loadedTemplateIds">A set of already loaded template IDs to avoid duplicates.</param>
        ''' <param name="allTemplatesList">The list to accumulate all loaded templates.</param>
        Public Sub LoadSubTemplatesRecursively(tasksArray As JArray, rootTemplate As JObject, ByRef loadedTemplateIds As HashSet(Of String), ByRef allTemplatesList As List(Of JObject))
            If rootTemplate Is Nothing Then Return

            Dim subTasksIds = rootTemplate("subTasksIds")
            If subTasksIds Is Nothing OrElse Not TypeOf subTasksIds Is JArray Then Return

            For Each subTaskIdToken In CType(subTasksIds, JArray)
                Dim subTaskId = If(subTaskIdToken IsNot Nothing, subTaskIdToken.ToString(), Nothing)
                If String.IsNullOrEmpty(subTaskId) OrElse loadedTemplateIds.Contains(subTaskId) Then
                    Continue For
                End If

                Dim subTemplateObj = FindTaskById(tasksArray, subTaskId)
                If subTemplateObj IsNot Nothing Then
                    allTemplatesList.Add(subTemplateObj)
                    loadedTemplateIds.Add(subTaskId)
                    ' Recursively load sub-templates of this sub-template
                    LoadSubTemplatesRecursively(tasksArray, subTemplateObj, loadedTemplateIds, allTemplatesList)
                Else
                    Dim rootTemplateIdToken = rootTemplate("id")
                    Dim rootTemplateId = If(rootTemplateIdToken IsNot Nothing, rootTemplateIdToken.ToString(), "unknown")
                    Console.WriteLine($"⚠️ [LoadSubTemplatesRecursively] Sub-template with ID '{subTaskId}' referenced by template '{rootTemplateId}' was not found in tasks array. This may cause compilation errors.")
                End If
            Next
        End Sub

        ''' <summary>
        ''' Deserializes a list of JObject tasks into Compiler.Task objects.
        ''' </summary>
        ''' <param name="templatesList">The list of JObject templates to deserialize.</param>
        ''' <returns>A tuple containing: (Success As Boolean, Tasks As List(Of Compiler.Task), ErrorMessage As String)</returns>
        Public Function DeserializeTasks(templatesList As List(Of JObject)) As (Success As Boolean, Tasks As List(Of Compiler.Task), ErrorMessage As String)
            Console.WriteLine("═══════════════════════════════════════════════════════════════")
            Console.WriteLine($"🔍 [DeserializeTasks] START - Deserializing {templatesList.Count} templates")
            Console.WriteLine("═══════════════════════════════════════════════════════════════")
            Console.Out.Flush()

            Dim settings As New JsonSerializerSettings() With {
                .NullValueHandling = NullValueHandling.Ignore,
                .MissingMemberHandling = MissingMemberHandling.Ignore
            }
            settings.Converters.Add(New DialogueStepListConverter())

            Dim deserializedTasks As New List(Of Compiler.Task)()

            For Each templateObj In templatesList
                Dim templateIdToken = templateObj("id")
                Dim templateId = If(templateIdToken IsNot Nothing, templateIdToken.ToString(), "unknown")

                Console.WriteLine($"🔍 [DeserializeTasks] About to deserialize template '{templateId}'...")
                Console.Out.Flush()

                Try
                    Dim task = JsonConvert.DeserializeObject(Of Compiler.Task)(templateObj.ToString(), settings)
                    If task IsNot Nothing Then
                        deserializedTasks.Add(task)
                        Console.WriteLine($"✅ [DeserializeTasks] Template '{templateId}' deserialized successfully")
                        Console.Out.Flush()
                    Else
                        Console.WriteLine($"⚠️ [DeserializeTasks] Template '{templateId}' deserialized to Nothing")
                        Console.Out.Flush()
                    End If
                Catch ex As Exception
                    Console.WriteLine("═══════════════════════════════════════════════════════════════")
                    Console.WriteLine($"❌ [DeserializeTasks] UNHANDLED EXCEPTION for template '{templateId}'")
                    Console.WriteLine($"   Type: {ex.GetType().FullName}")
                    Console.WriteLine($"   Message: {ex.Message}")
                    Console.WriteLine($"   StackTrace: {ex.StackTrace}")

                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine("   ── Inner Exception ──")
                        Console.WriteLine($"   Type: {ex.InnerException.GetType().FullName}")
                        Console.WriteLine($"   Message: {ex.InnerException.Message}")
                        Console.WriteLine($"   StackTrace: {ex.InnerException.StackTrace}")
                    End If

                    ' ✅ Se è JsonSerializationException, logga dettagli aggiuntivi
                    Dim jsonEx = TryCast(ex, JsonSerializationException)
                    If jsonEx IsNot Nothing Then
                        Console.WriteLine("   ── JSON Exception Details ──")
                        Console.WriteLine($"   JSON Path: {jsonEx.Path}")
                        Console.WriteLine($"   LineNumber: {jsonEx.LineNumber}")
                        Console.WriteLine($"   LinePosition: {jsonEx.LinePosition}")
                        Dim templateJson = templateObj.ToString()
                        Console.WriteLine($"   JSON that failed (first 2000 chars): {templateJson.Substring(0, Math.Min(2000, templateJson.Length))}")
                    End If

                    Console.WriteLine("═══════════════════════════════════════════════════════════════")
                    Console.Out.Flush()

                    Return (False, Nothing, $"Failed to deserialize template with ID '{templateId}'. Error: {ex.Message}")
                End Try
            Next

            Console.WriteLine($"✅ [DeserializeTasks] END - Successfully deserialized {deserializedTasks.Count} templates")
            Console.Out.Flush()
            Return (True, deserializedTasks, Nothing)
        End Function

    End Module

End Namespace
