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
    ''' Lista di azioni da eseguire per questa escalation
    ''' </summary>
    Public Property Actions As List(Of IAction) 'da trasformarte in ienumerable perchè a runtime non cambia la collezione 

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
            EscalationId = ""
            Actions = New List(Of IAction)()
        End Sub
    End Class



