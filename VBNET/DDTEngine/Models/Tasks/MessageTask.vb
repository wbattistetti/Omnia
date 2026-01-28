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
        Console.WriteLine($"[MessageTask] Execute called: Text='{Me.Text}', onMessage Is Nothing={onMessage Is Nothing}")

        If onMessage Is Nothing Then
            Console.WriteLine($"[MessageTask] ERROR: onMessage is Nothing!")
            Return
        End If

        Dim processedText As String = ProcessPlaceholders(Me.Text, ddtInstance, Nothing)
        Console.WriteLine($"[MessageTask] Processed text: '{processedText}'")

        If Not String.IsNullOrEmpty(processedText) Then
            Console.WriteLine($"[MessageTask] Calling onMessage with: '{processedText}'")
            onMessage(processedText)
            Console.WriteLine($"[MessageTask] onMessage called successfully")
        Else
            Console.WriteLine($"[MessageTask] WARNING: Processed text is empty!")
        End If
    End Sub
End Class

