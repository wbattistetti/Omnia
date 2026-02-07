Option Strict On
Option Explicit On
' Nota: TaskSession e OrchestratorSession sono definiti in SessionManager.vb
' Le interfacce possono riferirsi a tipi definiti in altri file

Namespace ApiServer.Interfaces
    ''' <summary>
    ''' Interfaccia per storage delle sessioni
    ''' Permette di cambiare implementazione (InMemory, Redis, ecc.) senza modificare il codice che la usa
    ''' </summary>
    Public Interface ISessionStorage
        ''' <summary>
        ''' Recupera una TaskSession esistente
        ''' </summary>
        Function GetTaskSession(sessionId As String) As TaskSession

        ''' <summary>
        ''' Salva una TaskSession
        ''' </summary>
        Sub SaveTaskSession(session As TaskSession)

        ''' <summary>
        ''' Elimina una TaskSession
        ''' </summary>
        Sub DeleteTaskSession(sessionId As String)

        ''' <summary>
        ''' Recupera una OrchestratorSession esistente
        ''' </summary>
        Function GetOrchestratorSession(sessionId As String) As OrchestratorSession

        ''' <summary>
        ''' Salva una OrchestratorSession
        ''' </summary>
        Sub SaveOrchestratorSession(session As OrchestratorSession)

        ''' <summary>
        ''' Elimina una OrchestratorSession
        ''' </summary>
        Sub DeleteOrchestratorSession(sessionId As String)
    End Interface
End Namespace
