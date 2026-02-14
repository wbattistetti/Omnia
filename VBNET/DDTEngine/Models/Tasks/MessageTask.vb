' MessageTask.vb
' Task per inviare un messaggio

Option Strict On
Option Explicit On

''' <summary>
''' Task per inviare un messaggio all'utente
''' MODELLO RIGOROSO: Usa SOLO chiavi di traduzione, nessun fallback
''' </summary>
Public Class MessageTask
    Inherits TaskBase

    ''' <summary>
    ''' Chiave di traduzione (GUID o nome simbolico) - OBBLIGATORIA
    ''' NON può essere vuota, nulla o whitespace
    ''' </summary>
    Public Property TextKey As String

    ''' <summary>
    ''' Costruttore con chiave OBBLIGATORIA
    ''' </summary>
    Public Sub New(textKey As String)
        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New ArgumentException("TextKey cannot be null, empty, or whitespace. MessageTask requires a valid translation key.", NameOf(textKey))
        End If
        Me.TextKey = textKey
    End Sub

    Public Overrides ReadOnly Property Label As String
        Get
            Return "Message"
        End Get
    End Property

    ''' <summary>
    ''' Esegue il task: risolve chiave → testo, poi processa placeholder
    ''' ERRORE BLOCCANTE se chiave non risolvibile
    ''' </summary>
    Public Overrides Sub Execute(taskNode As TaskNode, taskInstance As TaskInstance, onMessage As Action(Of String))
        If onMessage Is Nothing Then
            Throw New ArgumentNullException(NameOf(onMessage), "onMessage callback cannot be Nothing")
        End If

        ' ✅ STEP 1: Risolvi chiave → testo usando dizionario traduzioni
        Dim text As String = ResolveTranslationKey(Me.TextKey, taskInstance)

        ' ❌ ERRORE BLOCCANTE: nessun fallback
        If String.IsNullOrEmpty(text) Then
            Throw New InvalidOperationException($"Translation key '{Me.TextKey}' not found in translations dictionary for task '{taskInstance.Id}'. The session cannot continue without this translation.")
        End If

        ' ✅ STEP 2: Processa placeholder nel testo tradotto
        Dim processedText As String = ProcessPlaceholders(text, taskInstance, Nothing)

        ' ❌ ERRORE BLOCCANTE: testo processato non può essere vuoto
        If String.IsNullOrEmpty(processedText) Then
            Throw New InvalidOperationException($"Processed text for translation key '{Me.TextKey}' is empty after placeholder resolution for task '{taskInstance.Id}'.")
        End If

        onMessage(processedText)
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Risolve una chiave di traduzione dal TranslationRepository
    ''' </summary>
    Private Function ResolveTranslationKey(key As String, taskInstance As TaskInstance) As String
        If String.IsNullOrWhiteSpace(key) Then
            Throw New ArgumentException("Translation key cannot be null, empty, or whitespace.", NameOf(key))
        End If

        ' ❌ ERRORE BLOCCANTE: ProjectId, Locale e TranslationResolver obbligatori
        If String.IsNullOrWhiteSpace(taskInstance.ProjectId) Then
            Throw New InvalidOperationException($"TaskInstance '{taskInstance.Id}' has no ProjectId. Cannot resolve translation key '{key}'.")
        End If
        If String.IsNullOrWhiteSpace(taskInstance.Locale) Then
            Throw New InvalidOperationException($"TaskInstance '{taskInstance.Id}' has no Locale. Cannot resolve translation key '{key}'.")
        End If
        If taskInstance.TranslationResolver Is Nothing Then
            Throw New InvalidOperationException($"TaskInstance '{taskInstance.Id}' has no TranslationResolver. Cannot resolve translation key '{key}'.")
        End If

        ' ✅ STATELESS: Lookup tramite TranslationResolver (evita dipendenza circolare)
        Dim translatedText = taskInstance.TranslationResolver.ResolveTranslation(taskInstance.ProjectId, taskInstance.Locale, key)

        If String.IsNullOrEmpty(translatedText) Then
            Throw New InvalidOperationException($"Translation key '{key}' not found in TranslationRepository for project '{taskInstance.ProjectId}' and locale '{taskInstance.Locale}'. The session cannot continue without this translation.")
        End If

        Return translatedText
    End Function
End Class

