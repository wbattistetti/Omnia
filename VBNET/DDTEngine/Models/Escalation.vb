' Escalation.vb
' Rappresenta una recovery (tentativo di recupero) per un DialogueStep

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Rappresenta una escalation (recovery) per un DialogueStep
    ''' Corrisponde a Escalation nel frontend TypeScript
    ''' </summary>
    Public Class Escalation
        ''' <summary>
        ''' ID univoco dell'escalation (opzionale, usato principalmente per editor/compatibilità JSON)
        ''' Nel runtime viene usato l'indice dell'array invece dell'ID
        ''' </summary>
        Public Property EscalationId As String

    ''' <summary>
    ''' Lista di tasks da eseguire per questa escalation
    ''' </summary>
    Public Property Tasks As List(Of ITask) 'da trasformarte in ienumerable perchè a runtime non cambia la collezione

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
            EscalationId = ""
            Tasks = New List(Of ITask)()
        End Sub
    End Class



