Option Strict On
Option Explicit On

Imports Newtonsoft.Json

''' <summary>
''' Task row in a flowchart node - represents a task instance within a FlowNode
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class TaskRow
    ''' <summary>
    ''' Row ID (unique identifier for this task row in the flowchart)
    ''' </summary>
    <JsonProperty("id")>
    Public Property Id As String

    ''' <summary>
    ''' Task ID (optional, falls back to Id if not present)
    ''' </summary>
    <JsonProperty("taskId")>
    Public Property TaskId As String

    ''' <summary>
    ''' Row label shown in the flowchart (NodeRow.text); used for user-facing compiler messages.
    ''' </summary>
    <JsonProperty("text")>
    Public Property Text As String
End Class


