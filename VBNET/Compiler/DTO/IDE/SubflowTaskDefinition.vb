Option Strict On
Option Explicit On

Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Definizione IDE per task che esegue un sub-flow compilato (flowId del canvas + binding I/O).
''' </summary>
Public Class SubflowTaskDefinition
    Inherits TaskDefinition

    <JsonProperty("flowId")>
    Public Property FlowId As String

    <JsonProperty("inputBindings")>
    Public Property InputBindings As List(Of SubflowIoBinding)

    <JsonProperty("outputBindings")>
    Public Property OutputBindings As List(Of SubflowIoBinding)
End Class
