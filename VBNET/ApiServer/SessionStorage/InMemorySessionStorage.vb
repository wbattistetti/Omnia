Option Strict On
Option Explicit On

Namespace ApiServer.SessionStorage
    ''' <summary>
    ''' Implementazione in-memory di ISessionStorage
    ''' Wrappa la logica esistente di SessionManager per backward compatibility
    ''' </summary>
    Public Class InMemorySessionStorage
        Implements ApiServer.Interfaces.ISessionStorage

        Private ReadOnly _taskSessions As New Dictionary(Of String, TaskSession)
        Private ReadOnly _orchestratorSessions As New Dictionary(Of String, OrchestratorSession)
        Private ReadOnly _lock As New Object

        ''' <summary>
        ''' Recupera una TaskSession esistente
        ''' </summary>
        Public Function GetTaskSession(sessionId As String) As TaskSession Implements ApiServer.Interfaces.ISessionStorage.GetTaskSession
            SyncLock _lock
                If _taskSessions.ContainsKey(sessionId) Then
                    Return _taskSessions(sessionId)
                End If
                Return Nothing
            End SyncLock
        End Function

        ''' <summary>
        ''' Salva una TaskSession
        ''' </summary>
        Public Sub SaveTaskSession(session As TaskSession) Implements ApiServer.Interfaces.ISessionStorage.SaveTaskSession
            SyncLock _lock
                _taskSessions(session.SessionId) = session
            End SyncLock
        End Sub

        ''' <summary>
        ''' Elimina una TaskSession
        ''' </summary>
        Public Sub DeleteTaskSession(sessionId As String) Implements ApiServer.Interfaces.ISessionStorage.DeleteTaskSession
            SyncLock _lock
                If _taskSessions.ContainsKey(sessionId) Then
                    _taskSessions.Remove(sessionId)
                End If
            End SyncLock
        End Sub

        ''' <summary>
        ''' Recupera una OrchestratorSession esistente
        ''' </summary>
        Public Function GetOrchestratorSession(sessionId As String) As OrchestratorSession Implements ApiServer.Interfaces.ISessionStorage.GetOrchestratorSession
            SyncLock _lock
                If _orchestratorSessions.ContainsKey(sessionId) Then
                    Return _orchestratorSessions(sessionId)
                End If
                Return Nothing
            End SyncLock
        End Function

        ''' <summary>
        ''' Salva una OrchestratorSession
        ''' </summary>
        Public Sub SaveOrchestratorSession(session As OrchestratorSession) Implements ApiServer.Interfaces.ISessionStorage.SaveOrchestratorSession
            SyncLock _lock
                _orchestratorSessions(session.SessionId) = session
            End SyncLock
        End Sub

        ''' <summary>
        ''' Elimina una OrchestratorSession
        ''' </summary>
        Public Sub DeleteOrchestratorSession(sessionId As String) Implements ApiServer.Interfaces.ISessionStorage.DeleteOrchestratorSession
            SyncLock _lock
                If _orchestratorSessions.ContainsKey(sessionId) Then
                    Dim session = _orchestratorSessions(sessionId)
                    If session.Orchestrator IsNot Nothing Then
                        session.Orchestrator.Stop()
                    End If
                    _orchestratorSessions.Remove(sessionId)
                End If
            End SyncLock
        End Sub
    End Class
End Namespace
