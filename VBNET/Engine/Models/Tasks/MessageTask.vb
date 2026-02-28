' MessageTask.vb
' Micro-task that sends a translated message to the user.

Option Strict On
Option Explicit On

''' <summary>
''' Sends a localised message to the user.
''' Uses only translation keys; never stores literal text.
''' </summary>
Public Class MessageTask
    Inherits TaskBase

    ''' <summary>
    ''' Translation key (GUID or symbolic name) — mandatory.
    ''' </summary>
    Public Property TextKey As String

    Public Sub New(textKey As String)
        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New ArgumentException("TextKey cannot be null, empty, or whitespace.", NameOf(textKey))
        End If
        Me.TextKey = textKey
    End Sub

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Message"
        End Get
    End Property

    ''' <summary>
    ''' Resolves the translation key and sends the resulting text via onMessage.
    ''' </summary>
    Public Overrides Sub Execute(context As TaskUtterance, onMessage As Action(Of String))
        If onMessage Is Nothing Then
            Throw New ArgumentNullException(NameOf(onMessage), "onMessage callback cannot be Nothing.")
        End If

        Dim text As String = ResolveTranslation(context)
        Dim processed As String = Utils.ProcessPlaceholders(text, context)

        If String.IsNullOrEmpty(processed) Then
            Throw New InvalidOperationException($"Processed text for key '{TextKey}' is empty after placeholder resolution in task '{context.Id}'.")
        End If

        onMessage(processed)
    End Sub

    ' --- Private helpers ---

    Private Function ResolveTranslation(context As TaskUtterance) As String
        If String.IsNullOrWhiteSpace(context.ProjectId) Then
            Throw New InvalidOperationException($"Context '{context.Id}' has no ProjectId. Cannot resolve key '{TextKey}'.")
        End If
        If String.IsNullOrWhiteSpace(context.Locale) Then
            Throw New InvalidOperationException($"Context '{context.Id}' has no Locale. Cannot resolve key '{TextKey}'.")
        End If
        If context.TranslationResolver Is Nothing Then
            Throw New InvalidOperationException($"Context '{context.Id}' has no TranslationResolver. Cannot resolve key '{TextKey}'.")
        End If

        Dim text = context.TranslationResolver.ResolveTranslation(context.ProjectId, context.Locale, TextKey)

        If String.IsNullOrEmpty(text) Then
            Throw New InvalidOperationException($"Translation key '{TextKey}' not found for project '{context.ProjectId}', locale '{context.Locale}'.")
        End If

        Return text
    End Function
End Class
