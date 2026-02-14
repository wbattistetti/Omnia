Option Strict On
Option Explicit On
Imports TaskEngine.Interfaces

Namespace ApiServer.Repositories
    ''' <summary>
    ''' ✅ STATELESS: Implementazione di ITranslationResolver per ApiServer
    ''' </summary>
    Public Class TranslationResolver
        Implements ITranslationResolver

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
        ''' Risolve una chiave di traduzione in testo
        ''' </summary>
        Public Function ResolveTranslation(projectId As String, locale As String, textKey As String) As String Implements ITranslationResolver.ResolveTranslation
            Try
                Return _translationRepository.GetTranslation(projectId, locale, textKey)
            Catch ex As Exception
                Console.WriteLine($"[TranslationResolver] ❌ Error resolving translation: {ex.Message}")
                Return Nothing
            End Try
        End Function
    End Class
End Namespace
