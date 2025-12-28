' MessageTask.vb
' Task per inviare un messaggio

Option Strict On
Option Explicit On

''' <summary>
''' Task per inviare un messaggio all'utente
''' </summary>
Public Class MessageTask
    Inherits TaskBase

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

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Message"
        End Get
    End Property

    ''' <summary>
    ''' Esegue il task: processa i placeholder e mostra il messaggio
    ''' </summary>
    Public Overrides Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
        If onMessage Is Nothing Then Return

        Dim processedText As String = ProcessPlaceholders(Me.Text, ddtInstance, Nothing)
        If Not String.IsNullOrEmpty(processedText) Then
            onMessage(processedText)
        End If
    End Sub
End Class

