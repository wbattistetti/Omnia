Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Compiler
Imports TaskEngine

Namespace ApiServer.SessionStorage
    ''' <summary>
    ''' ✅ FASE 4: Serializza/deserializza sessioni per Redis
    '''
    ''' NOTA: TaskSession e OrchestratorSession contengono oggetti runtime non serializzabili
    ''' (Motore, FlowOrchestrator, EventEmitter). Serializziamo solo i dati necessari
    ''' e ricostruiamo gli oggetti runtime durante la deserializzazione.
    ''' </summary>
    Public Class SessionSerializer
        ''' <summary>
        ''' ✅ STATELESS: Dati serializzabili di TaskSession (solo stato runtime, non configurazione immutabile)
        ''' </summary>
        Private Class TaskSessionData
            ' ✅ STATELESS: Identificatori sessione
            Public Property SessionId As String

            ' ✅ STATELESS: Riferimenti alla configurazione immutabile (non duplicata)
            Public Property ProjectId As String
            Public Property DialogVersion As String
            Public Property Locale As String

            ' ✅ STATELESS: Stato runtime (unico per questa chiamata)
            Public Property CurrentNodeId As String
            Public Property RuntimeData As Dictionary(Of String, Object)

            ' ✅ STATELESS: Stato comunicazione
            Public Property Messages As List(Of Object)
            Public Property IsWaitingForInput As Boolean
            Public Property WaitingForInputData As Object
            Public Property SseConnected As Boolean = False

            ' ✅ Snapshot dello stato del TaskUtterance — persiste State, Value,
            ' EscalationCounters tra una request HTTP e l'altra.
            ' La configurazione (Steps, NlpContract) NON è inclusa: viene sempre
            ' ricostruita dal dialogo compilato nel DialogRepository.
            Public Property TaskUtteranceState As TaskEngine.TaskUtteranceStateSnapshot
        End Class

        ''' <summary>
        ''' Dati serializzabili di OrchestratorSession (senza oggetti runtime)
        ''' </summary>
        Private Class OrchestratorSessionData
            Public Property SessionId As String
            Public Property CompilationResult As FlowCompilationResult
            Public Property Tasks As List(Of Object)
            Public Property Translations As Dictionary(Of String, String)
            Public Property Messages As List(Of Object)
            Public Property IsWaitingForInput As Boolean
            Public Property WaitingForInputData As Object
        End Class

        ''' <summary>
        ''' ✅ STATELESS: Serializza TaskSession (solo stato runtime, non configurazione immutabile)
        ''' </summary>
        Public Shared Function SerializeTaskSession(session As TaskSession) As String
            Try
                ' Extract the mutable state snapshot before serialization so that
                ' EscalationCounters, State and Value survive the Redis round-trip.
                Dim stateSnapshot As TaskEngine.TaskUtteranceStateSnapshot = Nothing
                If session.TaskInstance IsNot Nothing Then
                    stateSnapshot = session.TaskInstance.ExtractState()
                ElseIf session.TaskUtteranceState IsNot Nothing Then
                    stateSnapshot = session.TaskUtteranceState
                End If

                Dim data As New TaskSessionData() With {
                    .SessionId = session.SessionId,
                    .ProjectId = session.ProjectId,
                    .DialogVersion = session.DialogVersion,
                    .Locale = session.Locale,
                    .CurrentNodeId = session.CurrentNodeId,
                    .RuntimeData = If(session.RuntimeData, New Dictionary(Of String, Object)()),
                    .Messages = session.Messages,
                    .IsWaitingForInput = session.IsWaitingForInput,
                    .WaitingForInputData = session.WaitingForInputData,
                    .SseConnected = session.SseConnected,
                    .TaskUtteranceState = stateSnapshot
                }

                Return JsonConvert.SerializeObject(data, New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                })
            Catch ex As Exception
                Throw New Exception($"Failed to serialize TaskSession: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' ✅ STATELESS: Deserializza TaskSession (solo stato runtime, dialogo e traduzioni da repository)
        ''' </summary>
        Public Shared Function DeserializeTaskSession(json As String) As TaskSession
            Try
                Dim settings As New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore
                }
                Dim data = JsonConvert.DeserializeObject(Of TaskSessionData)(json, settings)
                If data Is Nothing Then
                    Return Nothing
                End If

                ' ✅ STATELESS: Ricrea TaskSession con solo stato runtime
                Dim messagesList = If(data.Messages, New List(Of Object)())

                ' ✅ STATELESS: Usa EventEmitter condiviso (non creare nuovo EventEmitter)
                Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(data.SessionId)
                Dim session As New TaskSession() With {
                    .SessionId = data.SessionId,
                    .ProjectId = data.ProjectId,
                    .DialogVersion = data.DialogVersion,
                    .Locale = data.Locale,
                    .CurrentNodeId = data.CurrentNodeId,
                    .RuntimeData = If(data.RuntimeData, New Dictionary(Of String, Object)()),
                    .Messages = messagesList,
                    .IsWaitingForInput = data.IsWaitingForInput,
                    .WaitingForInputData = data.WaitingForInputData,
                    .SseConnected = data.SseConnected,
                    .EventEmitter = sharedEmitter,
                    .TaskEngine = New Motore(),
                    .TaskUtteranceState = data.TaskUtteranceState
                }

                ' ✅ STATELESS: RuntimeTask e TaskInstance verranno ricostruiti quando necessario dal DialogRepository.
                ' Il TaskUtteranceState viene riapplicato in EnsureTaskInstanceLoaded.

                Return session
            Catch ex As Exception
                Throw New Exception($"Failed to deserialize TaskSession: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Serializza OrchestratorSession (solo dati, non oggetti runtime)
        ''' </summary>
        Public Shared Function SerializeOrchestratorSession(session As OrchestratorSession) As String
            Try
                Dim data As New OrchestratorSessionData() With {
                    .SessionId = session.SessionId,
                    .CompilationResult = session.CompilationResult,
                    .Tasks = session.Tasks,
                    .Translations = session.Translations,
                    .Messages = session.Messages,
                    .IsWaitingForInput = session.IsWaitingForInput,
                    .WaitingForInputData = session.WaitingForInputData
                }

                Return JsonConvert.SerializeObject(data, New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .TypeNameHandling = TypeNameHandling.Auto ' ✅ STATELESS: Include type info for interfaces
                })
            Catch ex As Exception
                Throw New Exception($"Failed to serialize OrchestratorSession: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Deserializza OrchestratorSession e ricostruisce oggetti runtime
        ''' ✅ STATELESS: Accetta executionStateStorage opzionale per ricreare FlowOrchestrator con storage
        ''' </summary>
        Public Shared Function DeserializeOrchestratorSession(json As String, Optional sessionId As String = Nothing, Optional executionStateStorage As ApiServer.Interfaces.IExecutionStateStorage = Nothing) As OrchestratorSession
            Try
                ' ✅ STATELESS: Usa TypeNameHandling per deserializzare correttamente interfacce
                Dim settings As New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .TypeNameHandling = TypeNameHandling.Auto ' Include type info for interfaces
                }
                Dim data = JsonConvert.DeserializeObject(Of OrchestratorSessionData)(json, settings)
                If data Is Nothing Then
                    Return Nothing
                End If

                ' Ricrea oggetti runtime
                Dim taskEngine As New Motore()
                Dim session As New OrchestratorSession() With {
                    .SessionId = data.SessionId,
                    .CompilationResult = data.CompilationResult,
                    .Tasks = data.Tasks,
                    .Translations = data.Translations,
                    .Messages = If(data.Messages, New List(Of Object)()),
                    .IsWaitingForInput = data.IsWaitingForInput,
                    .WaitingForInputData = data.WaitingForInputData,
                    .EventEmitter = New EventEmitter(), ' Ricrea EventEmitter (vuoto)
                    .TaskEngine = taskEngine
                }

                ' ✅ STATELESS: Ricrea FlowOrchestrator con ExecutionStateStorage se disponibile
                If data.CompilationResult IsNot Nothing Then
                    Try
                        session.Orchestrator = New TaskEngine.Orchestrator.FlowOrchestrator(data.CompilationResult, taskEngine, sessionId, executionStateStorage)
                    Catch ex As Exception
                        ' Orchestrator sarà Nothing, verrà ricreato quando necessario
                    End Try
                End If

                Return session
            Catch ex As Exception
                Throw New Exception($"Failed to deserialize OrchestratorSession: {ex.Message}", ex)
            End Try
        End Function
    End Class
End Namespace
