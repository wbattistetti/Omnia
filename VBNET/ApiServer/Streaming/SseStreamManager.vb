Option Strict On
Option Explicit On
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports System.Collections.Concurrent
Imports System.IO
Imports System.Threading.Tasks

Namespace ApiServer.Streaming
    ''' <summary>
    ''' Implementazione gestione Server-Sent Events (SSE)
    '''
    ''' Gestisce:
    ''' - Connessioni SSE per ogni sessione
    ''' - Buffer messaggi per riconnessioni
    ''' - Heartbeat per mantenere connessione viva
    ''' </summary>
    Public Class SseStreamManager
        Implements ISseStreamManager

        ''' <summary>
        ''' Classe helper per eventi bufferizzati
        ''' </summary>
        Private Class BufferedEvent
            Public Property EventType As String
            Public Property Data As Object
        End Class

        Private ReadOnly _activeStreams As New ConcurrentDictionary(Of String, StreamWriter)()
        Private ReadOnly _messageBuffers As New ConcurrentDictionary(Of String, Queue(Of BufferedEvent))()

        ''' <summary>
        ''' Apre una connessione SSE per una sessione
        ''' </summary>
        Public Sub OpenStream(sessionId As String, response As HttpResponse) Implements ISseStreamManager.OpenStream
            If String.IsNullOrEmpty(sessionId) Then
                Throw New ArgumentException("SessionId cannot be null or empty", NameOf(sessionId))
            End If

            If response Is Nothing Then
                Throw New ArgumentNullException(NameOf(response))
            End If

            ' Setup SSE headers
            response.ContentType = "text/event-stream"
            response.Headers.Add("Cache-Control", "no-cache")
            response.Headers.Add("Connection", "keep-alive")
            response.Headers.Add("X-Accel-Buffering", "no")
            response.Body.FlushAsync().Wait()

            ' Crea StreamWriter per questa connessione
            Dim writer As New StreamWriter(response.Body)
            _activeStreams.TryAdd(sessionId, writer)

            ' Inizializza buffer messaggi se non esiste
            _messageBuffers.TryAdd(sessionId, New Queue(Of BufferedEvent)())
        End Sub

        ''' <summary>
        ''' Emette un evento SSE
        ''' </summary>
        Public Sub EmitEvent(sessionId As String, eventType As String, data As Object) Implements ISseStreamManager.EmitEvent
            If String.IsNullOrEmpty(sessionId) Then
                Return
            End If

            If String.IsNullOrEmpty(eventType) Then
                eventType = "message"
            End If

            ' Serializza dati
            Dim jsonData As String
            Try
                jsonData = JsonConvert.SerializeObject(data)
            Catch ex As Exception
                Return
            End Try

            ' Prova a inviare evento se stream è aperto
            If _activeStreams.TryGetValue(sessionId, Nothing) Then
                Dim writer = _activeStreams(sessionId)
                If writer IsNot Nothing Then
                    Try
                        ' ✅ Usa Task.Run per evitare deadlock con async
                        System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                          Await writer.WriteLineAsync($"event: {eventType}")
                                                          Await writer.WriteLineAsync($"data: {jsonData}")
                                                          Await writer.WriteLineAsync()
                                                          Await writer.FlushAsync()
                                                      End Function).Wait()
                    Catch ex As Exception
                        ' Rimuovi stream se errore (connessione chiusa)
                        _activeStreams.TryRemove(sessionId, Nothing)
                    End Try
                End If
            Else
                ' Stream non aperto, aggiungi a buffer per riconnessione
                If _messageBuffers.TryGetValue(sessionId, Nothing) Then
                    _messageBuffers(sessionId).Enqueue(New BufferedEvent With {
                        .EventType = eventType,
                        .Data = data
                    })
                End If
            End If
        End Sub

        ''' <summary>
        ''' Chiude la connessione SSE per una sessione
        ''' </summary>
        Public Sub CloseStream(sessionId As String) Implements ISseStreamManager.CloseStream
            If String.IsNullOrEmpty(sessionId) Then
                Return
            End If

            _activeStreams.TryRemove(sessionId, Nothing)

            ' Pulisci buffer messaggi
            _messageBuffers.TryRemove(sessionId, Nothing)
        End Sub

        ''' <summary>
        ''' Verifica se una connessione SSE è aperta
        ''' </summary>
        Public Function IsStreamOpen(sessionId As String) As Boolean Implements ISseStreamManager.IsStreamOpen
            If String.IsNullOrEmpty(sessionId) Then
                Return False
            End If

            Return _activeStreams.ContainsKey(sessionId)
        End Function

        ''' <summary>
        ''' Invia messaggi bufferizzati quando stream si apre
        ''' </summary>
        Public Sub SendBufferedMessages(sessionId As String)
            If String.IsNullOrEmpty(sessionId) Then
                Return
            End If

            If Not _messageBuffers.TryGetValue(sessionId, Nothing) Then
                Return
            End If

            Dim buffer = _messageBuffers(sessionId)
            If buffer.Count = 0 Then
                Return
            End If

            If Not _activeStreams.TryGetValue(sessionId, Nothing) Then
                Return
            End If

            Dim writer = _activeStreams(sessionId)
            If writer Is Nothing Then
                Return
            End If

            While buffer.Count > 0
                Dim bufferedEvent = buffer.Dequeue()
                Try
                    Dim jsonData = JsonConvert.SerializeObject(bufferedEvent.Data)
                    ' ✅ Usa Task.Run per evitare deadlock con async
                    System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                      Await writer.WriteLineAsync($"event: {bufferedEvent.EventType}")
                                                      Await writer.WriteLineAsync($"data: {jsonData}")
                                                      Await writer.WriteLineAsync()
                                                      Await writer.FlushAsync()
                                                  End Function).Wait()
                Catch ex As Exception
                    Exit While
                End Try
            End While
        End Sub
    End Class
End Namespace
