Option Strict On
Option Explicit On
Imports Newtonsoft.Json

Imports TaskEngine

''' <summary>
''' Definizione IDE per task AI Agent (regole + endpoint LLM opzionale).
''' </summary>
Public Class AIAgentTaskDefinition
    Inherits TaskDefinition

    ''' <summary>
    ''' Provider runtime: LLM Omnia/OpenAI (<see cref="IAPlatform.OpenAI"/>) o ElevenLabs Agents (<see cref="IAPlatform.ElevenLabs"/>).
    ''' Stringhe JSON tipiche: <c>openai</c>, <c>elevenlabs</c> (allineato al frontend <c>AgentPlatform</c> dove applicabile).
    ''' </summary>
    <JsonProperty("platform")>
    <JsonConverter(GetType(IAPlatformJsonConverter))>
    Public Property Platform As IAPlatform

    ''' <summary>
    ''' ElevenLabs Agent ID (convai); usato solo quando <see cref="Platform"/> è ElevenLabs.
    ''' </summary>
    <JsonProperty("agentId")>
    Public Property AgentId As String

    ''' <summary>
    ''' Variabili dinamiche passate all&apos;agente ElevenLabs (conversation initiation).
    ''' </summary>
    <JsonProperty("dynamicVariables")>
    Public Property DynamicVariables As Dictionary(Of String, Object)

    ''' <summary>
    ''' Base URL dell&apos;ApiServer per i path <c>/elevenlabs/*</c> (es. <c>http://localhost:5000</c>).
    ''' </summary>
    <JsonProperty("backendBaseUrl")>
    Public Property BackendBaseUrl As String

    ''' <summary>
    ''' Prompt sintetico / regole passate al modello.
    ''' </summary>
    <JsonProperty("rules")>
    Public Property Rules As String

    ''' <summary>
    ''' URL POST per lo step LLM (assoluto). Il compile deve fornire un default se omesso in progettazione.
    ''' </summary>
    <JsonProperty("llmEndpoint")>
    Public Property LlmEndpoint As String

    Public Sub New()
        MyBase.New()
        Platform = IAPlatform.OpenAI
        AgentId = ""
        DynamicVariables = New Dictionary(Of String, Object)()
        BackendBaseUrl = ""
        Rules = ""
        LlmEndpoint = ""
    End Sub
End Class
