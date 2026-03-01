' DialogueStep.vb
' Rappresenta uno step di dialogo (corrisponde a StepGroup nel frontend)

Option Strict On
Option Explicit On

''' <summary>
''' Rappresenta uno step di dialogo compilato (runtime)
''' Corrisponde a StepGroup nel frontend TypeScript
''' Ogni CompiledDialogueStep corrisponde a un DialogueStepType e contiene multiple escalation (recovery)
''' </summary>
Public Class CompiledDialogueStep
    ''' <summary>
    ''' Tipo di step (corrisponde a DialogueStepType)
    ''' </summary>
    Public Property Type As DialogueStepType

    ''' <summary>
    ''' Lista di escalation (recovery) per questo step
    ''' Il counter seleziona quale escalation usare: Escalations(counter)
    ''' </summary>
    Public Property Escalations As List(Of Escalation)

    ''' <summary>
    ''' Step ID (optional, for linking to data nodes)
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Data ID this step is linked to (optional)
    ''' </summary>
    Public Property DataId As String

    ''' <summary>
    ''' Indica se questo step richiede un utterance dall'utente
    ''' </summary>
    Public Property RequiresUtterance As Boolean

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Escalations = New List(Of Escalation)()
        RequiresUtterance = False
    End Sub
End Class
