Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' API Data Models - Request and Response classes for API endpoints
''' </summary>
Namespace Models

    ''' <summary>
    ''' Compile Flow Request
    ''' </summary>
    Public Class CompileFlowRequest
        <JsonProperty("nodes")>
        Public Property Nodes As List(Of Compiler.FlowNode)

        <JsonProperty("edges")>
        Public Property Edges As List(Of Compiler.FlowEdge)

        <JsonProperty("tasks")>
        Public Property Tasks As List(Of Compiler.Task)

        <JsonProperty("translations")>
        Public Property Translations As Dictionary(Of String, String)
    End Class

    ''' <summary>
    ''' Compile Flow Response
    ''' </summary>
    Public Class CompileFlowResponse
        Public Property TaskGroups As List(Of Compiler.TaskGroup)
        Public Property EntryTaskGroupId As String
        Public Property Tasks As List(Of Compiler.CompiledTask)
    End Class

    ''' <summary>
    ''' Orchestrator Session Start Request
    ''' </summary>
    Public Class OrchestratorSessionStartRequest
        <JsonProperty("compilationResult")>
        Public Property CompilationResult As Object

        <JsonProperty("tasks")>
        Public Property Tasks As List(Of Object)

        <JsonProperty("translations")>
        Public Property Translations As Dictionary(Of String, String)
    End Class

    ''' <summary>
    ''' Orchestrator Session Input Request
    ''' </summary>
    Public Class OrchestratorSessionInputRequest
        Public Property Input As String
    End Class

    ''' <summary>
    ''' Task Session Start Request (Chat Simulator diretto)
    ''' ✅ NUOVO MODELLO: Accetta TaskTree opzionale (working copy) invece di caricare dal database
    ''' </summary>
    Public Class TaskSessionStartRequest
        <JsonProperty("taskId")>
        Public Property TaskId As String

        ''' <summary>
        ''' ✅ NUOVO: ID dell'istanza del task (taskInstanceId)
        ''' Concettualmente separato da TaskTree: l'identità appartiene all'istanza, non all'albero.
        ''' Se non presente, viene usato taskId come fallback.
        ''' </summary>
        <JsonProperty("taskInstanceId")>
        Public Property TaskInstanceId As String

        <JsonProperty("projectId")>
        Public Property ProjectId As String

        <JsonProperty("translations")>
        Public Property Translations As Dictionary(Of String, String)

        ''' <summary>
        ''' Lingua della sessione (es. "it-IT", "en-US") - OBBLIGATORIA
        ''' </summary>
        <JsonProperty("language")>
        Public Property Language As String

        ''' <summary>
        ''' ✅ NUOVO: TaskTree completo (working copy) dalla memoria frontend
        ''' Se presente, viene usato direttamente invece di caricare dal database
        ''' </summary>
        <JsonProperty("taskTree")>
        Public Property TaskTree As JObject
    End Class

    ''' <summary>
    ''' Task Session Input Request
    ''' </summary>
    Public Class TaskSessionInputRequest
        <JsonProperty("input")>
        Public Property Input As String
    End Class

    ''' <summary>
    ''' Result class for task compilation (replaces tuple to avoid VB.NET value-type issues)
    ''' </summary>
    Public Class CompileTaskResult
        Public Property Success As Boolean
        Public Property Result As Compiler.CompiledUtteranceTask
        Public Property ErrorMessage As String

        Public Sub New()
            Success = False
            Result = Nothing
            ErrorMessage = String.Empty
        End Sub

        Public Sub New(success As Boolean, result As Compiler.CompiledUtteranceTask, errorMessage As String)
            Me.Success = success
            Me.Result = result
            Me.ErrorMessage = errorMessage
        End Sub
    End Class

End Namespace
