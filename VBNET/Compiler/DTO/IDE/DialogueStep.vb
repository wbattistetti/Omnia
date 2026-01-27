Option Strict On
Option Explicit On

Imports System.Collections.Generic
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
    Public Property Escalations As List(Of Compiler.Escalation)

        Public Sub New()
            Escalations = New List(Of Compiler.Escalation)()
        End Sub
End Class
