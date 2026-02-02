Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' TaskTreeExpanded: AST montato con template fusi e override applicati (ex TaskTreeRuntime)
''' ✅ RINOMINATO: TaskTreeRuntime → TaskTreeExpanded (nome più accurato)
''' Il frontend usa TaskTree, il loader converte TaskTree → TaskTreeExpanded (AST montato).
''' TaskTreeExpanded NON è runtime, è un AST intermedio prima della compilazione.
''' Flusso: Loader → TaskTreeExpanded → Task → Compilatore → CompiledTask → Motore
''' NOTA: TaskEngine/TaskInstance/TaskNode sono interni al runtime.
''' nodes è sempre un array: nodes: TaskNode[]
''' </summary>
Public Class TaskTreeExpanded
    ''' <summary>
    ''' ✅ RINOMINATO: Id → TaskInstanceId (concettualmente più corretto)
    ''' L'identità appartiene all'istanza del task, non all'albero concettuale.
    ''' Supporto retrocompatibilità: accetta sia "id" che "taskInstanceId" dal JSON.
    ''' </summary>
    <JsonProperty("taskInstanceId", Required:=Required.Default)>
    Public Property TaskInstanceId As String

    <JsonProperty("label")>
    Public Property Label As String

    <JsonProperty("nodes")>
    <JsonConverter(GetType(TaskNodeListConverter))>
    Public Property Nodes As List(Of Compiler.TaskNode)

    <JsonProperty("translations")>
    Public Property Translations As Dictionary(Of String, String)

    <JsonProperty("introduction")>
    Public Property Introduction As Compiler.DialogueStep

    ''' <summary>
    ''' Constraints a livello root (opzionale, risolto lazy dal template se mancante)
    ''' </summary>
    <JsonProperty("constraints")>
    Public Property Constraints As List(Of Object)

    Public Sub New()
        Translations = New Dictionary(Of String, String)()
        Nodes = New List(Of Compiler.TaskNode)()
        Constraints = New List(Of Object)()
    End Sub
End Class

