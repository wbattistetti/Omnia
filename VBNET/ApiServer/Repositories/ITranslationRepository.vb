Option Strict On
Option Explicit On

Namespace ApiServer.Repositories
    ''' <summary>
    ''' Repository per traduzioni (configurazione immutabile)
    ''' Chiave: projectId + locale + textKey
    ''' </summary>
    Public Interface ITranslationRepository
        ''' <summary>
        ''' Carica una traduzione dal repository
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="locale">Locale (es. "it-IT", "en-US")</param>
        ''' <param name="textKey">Chiave di traduzione (GUID)</param>
        ''' <returns>Testo tradotto o Nothing se non trovato</returns>
        Function GetTranslation(projectId As String, locale As String, textKey As String) As String

        ''' <summary>
        ''' Carica multiple traduzioni in batch (più efficiente)
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="locale">Locale</param>
        ''' <param name="textKeys">Lista di chiavi di traduzione</param>
        ''' <returns>Dictionary di textKey -> testo tradotto</returns>
        Function GetTranslationsBatch(projectId As String, locale As String, textKeys As List(Of String)) As Dictionary(Of String, String)

        ''' <summary>
        ''' Salva una traduzione nel repository
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="locale">Locale</param>
        ''' <param name="textKey">Chiave di traduzione</param>
        ''' <param name="text">Testo tradotto</param>
        Sub SetTranslation(projectId As String, locale As String, textKey As String, text As String)

        ''' <summary>
        ''' Verifica se una traduzione esiste
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="locale">Locale</param>
        ''' <param name="textKey">Chiave di traduzione</param>
        ''' <returns>True se esiste, False altrimenti</returns>
        Function TranslationExists(projectId As String, locale As String, textKey As String) As Boolean
    End Interface
End Namespace
