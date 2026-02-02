' DialogueStep.vb
' Rappresenta uno step di dialogo (corrisponde a StepGroup nel frontend)

Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta uno step di dialogo
''' Corrisponde a StepGroup nel frontend TypeScript
''' Ogni DialogueStep corrisponde a un DialogueState e contiene multiple escalation (recovery)
''' </summary>
Public Class DialogueStep
    ''' <summary>
    ''' Tipo di step (corrisponde a DialogueState)
    ''' </summary>
    Public Property Type As DialogueState

    ''' <summary>
    ''' Lista di escalation (recovery) per questo step
    ''' Il counter seleziona quale escalation usare: Escalations(counter)
    ''' </summary>
    Public Property Escalations As List(Of Escalation)  'da trasformarte in ienumerable perch� a runtime non cambia la collezione 

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Escalations = New List(Of Escalation)()
    End Sub
End Class



