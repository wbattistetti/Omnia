Option Strict On
Option Explicit On

Namespace OmniaDialogStepInfra
    ''' <summary>Chiave sessione binding dialogo KB (project + agent + conversation + documento).</summary>
    Public Class OmniaDialogStepSessionScope
        Public Property ProjectId As String
        Public Property AgentTaskId As String
        Public Property ConversationId As String
        Public Property KbDocumentId As String
    End Class
End Namespace
