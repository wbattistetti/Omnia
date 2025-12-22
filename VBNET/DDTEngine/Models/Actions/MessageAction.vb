' MessageAction.vb
' Action per inviare un messaggio

Option Strict On
Option Explicit On

''' <summary>
''' Action per inviare un messaggio all'utente
''' </summary>
Public Class MessageAction
    Inherits ActionBase

    ''' <summary>
    ''' Testo del messaggio da inviare
    ''' </summary>
    Public Property Text As String

    ''' <summary>
    ''' Chiave di traduzione per il testo (opzionale)
    ''' </summary>
    Public Property TextKey As String

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Text = ""
        TextKey = ""
    End Sub

    ''' <summary>
    ''' Costruttore con testo
    ''' </summary>
    Public Sub New(text As String)
        Me.Text = text
        Me.TextKey = ""
    End Sub

    Public Overrides ReadOnly Property ActionId As String
        Get
            Return "SayMessage"  ' ✅ Simplified: Direct string, no enum conversion
        End Get
    End Property

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Message"
        End Get
    End Property

    ''' <summary>
    ''' Esegue l'azione: processa i placeholder e mostra il messaggio
    ''' </summary>
    Public Overrides Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
        If onMessage Is Nothing Then Return

        Dim processedText As String = ProcessPlaceholders(Me.Text, ddtInstance, Nothing)
        If Not String.IsNullOrEmpty(processedText) Then
            onMessage(processedText)
        End If
    End Sub
End Class
