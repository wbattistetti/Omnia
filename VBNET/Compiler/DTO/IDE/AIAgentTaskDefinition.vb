Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Definizione IDE per task AI Agent (regole + endpoint LLM opzionale).
''' </summary>
Public Class AIAgentTaskDefinition
    Inherits TaskDefinition

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
        Rules = ""
        LlmEndpoint = ""
    End Sub
End Class
