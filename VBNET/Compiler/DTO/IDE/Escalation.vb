Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' Escalation: corrisponde ESATTAMENTE a Escalation TypeScript del frontend
''' </summary>
Public Class Escalation
    <JsonProperty("escalationId")>
    Public Property EscalationId As String

    <JsonProperty("tasks")>
    Public Property Tasks As List(Of TaskDefinition)

    Public Sub New()
        Tasks = New List(Of TaskDefinition)()
    End Sub
End Class
