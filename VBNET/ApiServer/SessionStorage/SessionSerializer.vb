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
        ''' Dati serializzabili di TaskSession (senza oggetti runtime)
        ''' </summary>
        Private Class TaskSessionData
            Public Property SessionId As String
            Public Property RuntimeTask As RuntimeTask
            Public Property Language As String
            Public Property Translations As Dictionary(Of String, String)
            Public Property Messages As List(Of Object)
            Public Property IsWaitingForInput As Boolean
            Public Property WaitingForInputData As Object
            Public Property TaskInstanceData As String ' JSON serializzato di TaskInstance
            ' ✅ STATELESS: Flag per indicare se lo stream SSE è connesso
            Public Property SseConnected As Boolean = False
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
        ''' Serializza TaskSession (solo dati, non oggetti runtime)
        ''' </summary>
        Public Shared Function SerializeTaskSession(session As TaskSession) As String
            Try
                Dim data As New TaskSessionData() With {
                    .SessionId = session.SessionId,
                    .RuntimeTask = session.RuntimeTask,
                    .Language = session.Language,
                    .Translations = session.Translations,
                    .Messages = session.Messages,
                    .IsWaitingForInput = session.IsWaitingForInput,
                    .WaitingForInputData = session.WaitingForInputData,
                    .SseConnected = session.SseConnected
                }

                ' Serializza TaskInstance se presente (può avere riferimenti circolari)
                If session.TaskInstance IsNot Nothing Then
                    Try
                        data.TaskInstanceData = JsonConvert.SerializeObject(session.TaskInstance, New JsonSerializerSettings With {
                            .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                            .NullValueHandling = NullValueHandling.Ignore,
                            .MaxDepth = 32,
                            .TypeNameHandling = TypeNameHandling.Auto ' ✅ STATELESS: Include type info for interfaces (ITask)
                        })
                    Catch ex As Exception
                        ' Se TaskInstance non è serializzabile, salva Nothing
                        data.TaskInstanceData = Nothing
                        Console.WriteLine($"[SessionSerializer] Warning: Could not serialize TaskInstance: {ex.Message}")
                    End Try
                End If

                Return JsonConvert.SerializeObject(data, New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .TypeNameHandling = TypeNameHandling.Auto ' ✅ STATELESS: Include type info for interfaces (ITask)
                })
            Catch ex As Exception
                Throw New Exception($"Failed to serialize TaskSession: {ex.Message}", ex)
            End Try
        End Function

        ''' <summary>
        ''' Deserializza TaskSession e ricostruisce oggetti runtime
        ''' </summary>
        Public Shared Function DeserializeTaskSession(json As String) As TaskSession
            Try
                ' ✅ STATELESS: Usa TypeNameHandling per deserializzare correttamente interfacce (ITask)
                Dim settings As New JsonSerializerSettings With {
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .NullValueHandling = NullValueHandling.Ignore,
                    .TypeNameHandling = TypeNameHandling.Auto ' Include type info for interfaces (ITask)
                }
                Dim data = JsonConvert.DeserializeObject(Of TaskSessionData)(json, settings)
                If data Is Nothing Then
                    Return Nothing
                End If

                ' Ricrea TaskSession con dati deserializzati
                Dim messagesList = If(data.Messages, New List(Of Object)())
                Console.WriteLine($"[SessionSerializer] ✅ STATELESS: Deserializing TaskSession: SessionId={data.SessionId}, Messages.Count={messagesList.Count}, SseConnected={data.SseConnected}")
                ' ✅ STATELESS: Usa EventEmitter condiviso (non creare nuovo EventEmitter)
                Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(data.SessionId)
                Dim session As New TaskSession() With {
                    .SessionId = data.SessionId,
                    .RuntimeTask = data.RuntimeTask,
                    .Language = data.Language,
                    .Translations = data.Translations,
                    .Messages = messagesList,
                    .IsWaitingForInput = data.IsWaitingForInput,
                    .WaitingForInputData = data.WaitingForInputData,
                    .SseConnected = data.SseConnected,
                    .EventEmitter = sharedEmitter,
                    .TaskEngine = New Motore()
                }
                Console.WriteLine($"[SessionSerializer] ✅ STATELESS: TaskSession deserialized: SessionId={session.SessionId}, Messages.Count={session.Messages.Count}, IsWaitingForInput={session.IsWaitingForInput}, SseConnected={session.SseConnected}")
                ' TaskInstance verrà ricostruito quando necessario

                ' Deserializza TaskInstance se presente
                If Not String.IsNullOrEmpty(data.TaskInstanceData) Then
                    Try
                        ' ✅ STATELESS: Usa TypeNameHandling per deserializzare correttamente interfacce (ITask)
                        session.TaskInstance = JsonConvert.DeserializeObject(Of TaskInstance)(data.TaskInstanceData, New JsonSerializerSettings With {
                            .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                            .TypeNameHandling = TypeNameHandling.Auto ' Include type info for interfaces (ITask)
                        })
                    Catch ex As Exception
                        ' Se deserializzazione fallisce, TaskInstance sarà Nothing
                        ' Verrà ricostruito quando necessario
                        Console.WriteLine($"[SessionSerializer] Warning: Could not deserialize TaskInstance: {ex.Message}")
                    End Try
                End If

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
        ''' </summary>
        Public Shared Function DeserializeOrchestratorSession(json As String, Optional sessionId As String = Nothing) As OrchestratorSession
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

                ' Ricrea FlowOrchestrator se CompilationResult è disponibile
                If data.CompilationResult IsNot Nothing Then
                    Try
                        ' FlowOrchestrator richiede List(Of CompiledTask), non FlowCompilationResult
                        ' Per ora lasciamo Orchestrator = Nothing, verrà ricreato da SessionManager quando necessario
                        ' session.Orchestrator = New FlowOrchestrator(data.CompilationResult, taskEngine)
                    Catch ex As Exception
                        Console.WriteLine($"[SessionSerializer] Warning: Could not recreate FlowOrchestrator: {ex.Message}")
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
