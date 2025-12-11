'NOTA DA TOGLIERE:
'   per chiami DTO? non basterebbe mettere un modello dati RuntIme? Ovvero mettere IDE e Runtime come due namepapces? 
'ovvero il compilatore riceve dal forntend In jsono con tuttoil flowchart, tutil gli edge, tutti i task.values, per esempio i test dei sauìy messagi, i value con tutter le escalations e le actions per i getdata, ecc. Insomma la totlalià dei dati che descrivno un progetot puo diventare un Jsono molot grande. 
'Quesot json vien poi deserializzato dal compilatore In vb,.net che un modello dati identico a quell dell'IDE in react ma in vb.net e quind iriesca deserialiare il json dnel suo corrispndnete modello dell 'IDE in vb.net. 

'Fatto questo sa quali sono i dati che sefrcvono per il runtime e crea un modlello più asciutto per il modello di runtime e lo serializza in un joso., COsi poi il motre di runtime puo rivvere il jsono e deserializzarlo nella sua struttura dati e avviare il dialogo 

' DialogueStepDTO.vb
' DTO per deserializzazione JSON di DialogueStep

Option Strict On
Option Explicit On

Imports System.Text.Json.Serialization

    ''' <summary>
    ''' DTO per deserializzare DialogueStep dal JSON
    ''' Corrisponde a StepGroup nel frontend
    ''' </summary>
    Public Class DialogueStepDTO
        <JsonPropertyName("type")>
        Public Property Type As String ' "start", "noMatch", "noInput", ecc.

        <JsonPropertyName("escalations")>
        Public Property Escalations As List(Of EscalationDTO)
    End Class



