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
    Public Property Tasks As List(Of Compiler.Task)

    Public Sub New()
        Tasks = New List(Of Task)()
    End Sub
End Class

