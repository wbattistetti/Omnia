Option Strict On
Option Explicit On
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Http.Features
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
        Private Shared ReadOnly _logger As ApiServer.Logging.StdoutLogger = New ApiServer.Logging.StdoutLogger()

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

            ' Kestrel: FlushAsync().Wait() e Task.Run(...).Wait() in EmitEvent contano come I/O sincrono sul body — altrimenti InvalidOperationException.
            Dim bodyCtl = response.HttpContext.Features.Get(Of IHttpBodyControlFeature)()
            If bodyCtl IsNot Nothing Then
                bodyCtl.AllowSynchronousIO = True
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
                _logger.LogError($"[SseStreamManager] ❌ Error serializing data", ex, New With {
                    .sessionId = sessionId,
                    .eventType = eventType
                })
                Return
            End Try

            ' Prova a inviare evento se stream è aperto
            Dim writer As StreamWriter = Nothing
            Dim isStreamOpen = _activeStreams.TryGetValue(sessionId, writer)
            _logger.LogInfo($"[SseStreamManager] 🔍 Checking stream status", New With {
                .sessionId = sessionId,
                .eventType = eventType,
                .isStreamOpen = isStreamOpen,
                .activeStreamsCount = _activeStreams.Count
            })
            If isStreamOpen AndAlso writer IsNot Nothing Then
                Try
                    Dim messagePreview = If(jsonData.Length > 100, jsonData.Substring(0, 100) + "...", jsonData)
                    _logger.LogInfo($"[SseStreamManager] 📡 Sending SSE event", New With {
                        .sessionId = sessionId,
                        .eventType = eventType,
                        .dataPreview = messagePreview,
                        .dataLength = jsonData.Length
                    })
                    ' ✅ Usa Task.Run per evitare deadlock con async
                    System.Threading.Tasks.Task.Run(Async Function() As System.Threading.Tasks.Task
                                                      Await writer.WriteLineAsync($"event: {eventType}")
                                                      Await writer.WriteLineAsync($"data: {jsonData}")
                                                      Await writer.WriteLineAsync()
                                                      Await writer.FlushAsync()
                                                  End Function).Wait()
                    _logger.LogInfo($"[SseStreamManager] ✅ SSE event sent successfully", New With {
                        .sessionId = sessionId,
                        .eventType = eventType
                    })
                Catch ex As Exception
                    _logger.LogError($"[SseStreamManager] ❌ Error sending SSE event", ex, New With {
                        .sessionId = sessionId,
                        .eventType = eventType
                    })
                    ' Rimuovi stream se errore (connessione chiusa)
                    Dim removedWriter As StreamWriter = Nothing
                    _activeStreams.TryRemove(sessionId, removedWriter)
                End Try
            ElseIf isStreamOpen Then
                ' Stream aperto ma writer è null
                _logger.LogInfo($"[SseStreamManager] ⚠️ Stream writer is null", New With {
                    .sessionId = sessionId,
                    .eventType = eventType
                })
            Else
                ' Stream non aperto, aggiungi a buffer per riconnessione
                _logger.LogInfo($"[SseStreamManager] 💾 Buffering event (stream not open)", New With {
                    .sessionId = sessionId,
                    .eventType = eventType
                })
                Dim buffer As Queue(Of BufferedEvent) = Nothing
                If _messageBuffers.TryGetValue(sessionId, buffer) Then
                    buffer.Enqueue(New BufferedEvent With {
                        .EventType = eventType,
                        .Data = data
                    })
                Else
                    ' Crea nuovo buffer se non esiste
                    Dim newBuffer As New Queue(Of BufferedEvent)()
                    newBuffer.Enqueue(New BufferedEvent With {
                        .EventType = eventType,
                        .Data = data
                    })
                    _messageBuffers.TryAdd(sessionId, newBuffer)
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

            Dim removedWriter As StreamWriter = Nothing
            _activeStreams.TryRemove(sessionId, removedWriter)

            ' Pulisci buffer messaggi
            Dim removedBuffer As Queue(Of BufferedEvent) = Nothing
            _messageBuffers.TryRemove(sessionId, removedBuffer)
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

            Dim buffer As Queue(Of BufferedEvent) = Nothing
            If Not _messageBuffers.TryGetValue(sessionId, buffer) Then
                Return
            End If

            If buffer Is Nothing OrElse buffer.Count = 0 Then
                Return
            End If

            Dim writer As StreamWriter = Nothing
            If Not _activeStreams.TryGetValue(sessionId, writer) Then
                Return
            End If

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
