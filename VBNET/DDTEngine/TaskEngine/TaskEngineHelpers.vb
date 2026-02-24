Option Strict On
Option Explicit On
Imports System.Reflection
Imports System.Linq

''' <summary>
''' Helper methods to access Compiler/Orchestrator types via reflection
''' (avoids circular dependency)
''' </summary>
Public Module TaskEngineHelpers
    ''' <summary>
    ''' Gets TaskType property from CompiledTask (Object)
    ''' </summary>
    Public Function GetTaskType(task As Object) As Object
        If task Is Nothing Then Return Nothing
        Dim prop = task.GetType().GetProperty("TaskType")
        If prop Is Nothing Then Return Nothing
        Return prop.GetValue(task)
    End Function

    ''' <summary>
    ''' Gets Id property from CompiledTask (Object)
    ''' </summary>
    Public Function GetTaskId(task As Object) As String
        If task Is Nothing Then Return Nothing
        Dim prop = task.GetType().GetProperty("Id")
        If prop Is Nothing Then Return Nothing
        Return DirectCast(prop.GetValue(task), String)
    End Function

    ''' <summary>
    ''' Gets Steps property from CompiledUtteranceTask (Object)
    ''' </summary>
    Public Function GetTaskSteps(task As Object) As Object
        If task Is Nothing Then Return Nothing
        Dim prop = task.GetType().GetProperty("Steps")
        If prop Is Nothing Then Return Nothing
        Return prop.GetValue(task)
    End Function

    ''' <summary>
    ''' Gets DialogueContexts property from ExecutionState (Object)
    ''' </summary>
    Public Function GetDialogueContexts(state As Object) As Dictionary(Of String, String)
        If state Is Nothing Then Return Nothing
        Dim prop = state.GetType().GetProperty("DialogueContexts")
        If prop Is Nothing Then Return Nothing
        Return DirectCast(prop.GetValue(state), Dictionary(Of String, String))
    End Function

    ''' <summary>
    ''' Sets DialogueContexts property in ExecutionState (Object)
    ''' </summary>
    Public Sub SetDialogueContext(state As Object, taskId As String, ctxJson As String)
        If state Is Nothing Then Return
        Dim prop = state.GetType().GetProperty("DialogueContexts")
        If prop Is Nothing Then Return
        Dim contexts = DirectCast(prop.GetValue(state), Dictionary(Of String, String))
        If contexts IsNot Nothing Then
            contexts(taskId) = ctxJson
        End If
    End Sub

    ''' <summary>
    ''' Creates TaskExecutionResult (Object) via reflection
    ''' </summary>
    Public Function CreateTaskExecutionResult(success As Boolean, requiresInput As Boolean, waitingTaskId As String, err As String) As Object
        ' Try to load TaskExecutionResult type from Orchestrator assembly
        Dim orchestratorAssembly = AppDomain.CurrentDomain.GetAssemblies().
            FirstOrDefault(Function(a) a.GetName().Name = "Orchestrator")
        If orchestratorAssembly Is Nothing Then
            Throw New InvalidOperationException("Orchestrator assembly not found")
        End If

        Dim resultType = orchestratorAssembly.GetType("TaskEngine.Orchestrator.TaskExecutionResult")
        If resultType Is Nothing Then
            Throw New InvalidOperationException("TaskExecutionResult type not found")
        End If

        Dim result = Activator.CreateInstance(resultType)
        resultType.GetProperty("Success").SetValue(result, success)
        resultType.GetProperty("RequiresInput").SetValue(result, requiresInput)
        resultType.GetProperty("WaitingTaskId").SetValue(result, waitingTaskId)
        resultType.GetProperty("Err").SetValue(result, err)
        Return result
    End Function

    ''' <summary>
    ''' Checks if task is CompiledUtteranceTask
    ''' </summary>
    Public Function IsCompiledUtteranceTask(task As Object) As Boolean
        If task Is Nothing Then Return False
        Dim taskType = task.GetType()
        Return taskType.Name = "CompiledUtteranceTask" OrElse
               taskType.FullName.Contains("CompiledUtteranceTask")
    End Function

    ''' <summary>
    ''' Gets count of Steps collection
    ''' </summary>
    Public Function GetStepsCount(steps As Object) As Integer
        If steps Is Nothing Then Return 0
        If TypeOf steps Is IEnumerable Then
            Return DirectCast(steps, IEnumerable).Cast(Of Object)().Count()
        End If
        Return 0
    End Function
End Module
