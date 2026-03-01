Option Strict On
Option Explicit On

Namespace Interfaces
    ''' <summary>
    ''' ✅ STATELESS: Interfaccia per risolvere traduzioni (evita dipendenza circolare)
    ''' </summary>
    Public Interface ITranslationResolver
        ''' <summary>
        ''' Risolve una chiave di traduzione in testo
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="locale">Locale (es. "it-IT")</param>
        ''' <param name="textKey">Chiave di traduzione (GUID)</param>
        ''' <returns>Testo tradotto o Nothing se non trovato</returns>
        Function ResolveTranslation(projectId As String, locale As String, textKey As String) As String
    End Interface
End Namespace
