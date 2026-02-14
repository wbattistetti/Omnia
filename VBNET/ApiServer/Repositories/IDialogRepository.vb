Option Strict On
Option Explicit On
Imports Compiler

Namespace ApiServer.Repositories
    ''' <summary>
    ''' Repository per dialoghi compilati (configurazione immutabile)
    ''' Chiave: projectId + dialogVersion
    ''' </summary>
    Public Interface IDialogRepository
        ''' <summary>
        ''' Carica un dialogo compilato dal repository
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="version">Versione del dialogo</param>
        ''' <returns>RuntimeTask compilato o Nothing se non trovato</returns>
        Function GetDialog(projectId As String, version As String) As RuntimeTask

        ''' <summary>
        ''' Salva un dialogo compilato nel repository
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="version">Versione del dialogo</param>
        ''' <param name="runtimeTask">RuntimeTask compilato</param>
        Sub SaveDialog(projectId As String, version As String, runtimeTask As RuntimeTask)

        ''' <summary>
        ''' Verifica se un dialogo esiste nel repository
        ''' </summary>
        ''' <param name="projectId">ID del progetto</param>
        ''' <param name="version">Versione del dialogo</param>
        ''' <returns>True se esiste, False altrimenti</returns>
        Function DialogExists(projectId As String, version As String) As Boolean
    End Interface
End Namespace
