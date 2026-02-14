Option Strict On
Option Explicit On

Namespace ApiServer.Repositories
    ''' <summary>
    ''' ✅ STATELESS: Adapter che implementa ITranslationResolver per DDTEngine
    ''' Usa TranslationRepository per risolvere traduzioni
    ''' </summary>
    Public Class TranslationResolverAdapter
        Implements TaskEngine.Interfaces.ITranslationResolver

        Private ReadOnly _translationRepository As ITranslationRepository

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        Public Sub New(translationRepository As ITranslationRepository)
            If translationRepository Is Nothing Then
                Throw New ArgumentNullException(NameOf(translationRepository), "TranslationRepository cannot be Nothing")
            End If
            _translationRepository = translationRepository
        End Sub

        ''' <summary>
        ''' Risolve una traduzione dal repository
        ''' </summary>
        Public Function ResolveTranslation(projectId As String, locale As String, textKey As String) As String Implements TaskEngine.Interfaces.ITranslationResolver.ResolveTranslation
            Return _translationRepository.GetTranslation(projectId, locale, textKey)
        End Function
    End Class
End Namespace
