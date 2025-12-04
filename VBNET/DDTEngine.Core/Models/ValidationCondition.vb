' ValidationCondition.vb
' Rappresenta una condizione di validazione

Option Strict On
Option Explicit On

    ''' <summary>
    ''' Rappresenta una condizione di validazione
    ''' </summary>
    Public Class ValidationCondition
        ''' <summary>
        ''' ID della condizione
        ''' </summary>
        Public Property Id As String

        ''' <summary>
        ''' Tipo di validazione (es. "regex", "range", "custom")
        ''' </summary>
        Public Property Type As String

        ''' <summary>
        ''' Parametri della validazione
        ''' </summary>
        Public Property Parameters As Dictionary(Of String, Object)

        ''' <summary>
        ''' Messaggio di errore se la validazione fallisce
        ''' </summary>
        Public Property ErrorMessage As String

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        Public Sub New()
            Parameters = New Dictionary(Of String, Object)()
        End Sub
    End Class

