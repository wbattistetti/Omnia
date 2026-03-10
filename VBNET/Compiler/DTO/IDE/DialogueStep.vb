Option Strict On
Option Explicit On
Imports Newtonsoft.Json

''' <summary>
''' DialogueStep: corrisponde ESATTAMENTE a DialogueStep TypeScript del frontend
''' Unificato con DialogueStep runtime per coerenza
''' </summary>
Public Class DialogueStep
    ''' <summary>
    ''' Tipo di step: 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'success' | 'introduction'
    ''' </summary>
    <JsonProperty("type")>
    Public Property Type As String

    ''' <summary>
    ''' Lista di escalation per questo step
    ''' </summary>
    <JsonProperty("escalations")>
    Public Property Escalations As List(Of Escalation)

    ''' <summary>
    ''' When True the step is disabled by the designer in the Response Editor.
    ''' The compiler must skip it so StepExists() returns False at runtime.
    ''' </summary>
    <JsonProperty("_disabled")>
    Public Property IsDisabled As Boolean

    Public Sub New()
        Escalations = New List(Of Escalation)()
        IsDisabled = False
    End Sub
End Class

