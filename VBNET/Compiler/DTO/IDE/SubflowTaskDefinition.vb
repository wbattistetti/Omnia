Option Strict On
Option Explicit On

Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Definizione IDE per task che esegue un sub-flow compilato (flowId + binding S2 espliciti).
''' </summary>
Public Class SubflowTaskDefinition
    Inherits TaskDefinition

    <JsonProperty("flowId")>
    Public Property FlowId As String

    ''' <summary>Versione schema binding; deve essere 1.</summary>
    <JsonProperty("subflowBindingsSchemaVersion")>
    Public Property SubflowBindingsSchemaVersion As Integer?

    <JsonProperty("subflowBindings")>
    Public Property SubflowBindings As List(Of SubflowBinding)
End Class
