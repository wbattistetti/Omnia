Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' StepGroup: corrisponde ESATTAMENTE a StepGroup TypeScript del frontend
''' </summary>
Public Class StepGroup
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
            Escalations = New List(Of Escalation)()
        End Sub
    End Class
