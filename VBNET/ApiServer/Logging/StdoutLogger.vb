Option Strict On
Option Explicit On
Imports Newtonsoft.Json

Namespace ApiServer.Logging
    ''' <summary>
    ''' Implementazione di ILogger che scrive su stdout in formato JSON
    ''' Compatibile con i requisiti di osservabilità (logs su stdout)
    ''' </summary>
    Public Class StdoutLogger
        Implements ApiServer.Interfaces.ILogger

        ''' <summary>
        ''' Log di debug (dettagli tecnici)
        ''' </summary>
        Public Sub LogDebug(message As String, Optional data As Object = Nothing) Implements ApiServer.Interfaces.ILogger.LogDebug
            WriteLog("DEBUG", message, data, Nothing)
        End Sub

        ''' <summary>
        ''' Log informativo (eventi normali)
        ''' </summary>
        Public Sub LogInfo(message As String, Optional data As Object = Nothing) Implements ApiServer.Interfaces.ILogger.LogInfo
            WriteLog("INFO", message, data, Nothing)
        End Sub

        ''' <summary>
        ''' Log di warning (situazioni anomale ma non critiche)
        ''' </summary>
        Public Sub LogWarning(message As String, Optional data As Object = Nothing) Implements ApiServer.Interfaces.ILogger.LogWarning
            WriteLog("WARNING", message, data, Nothing)
        End Sub

        ''' <summary>
        ''' Log di errore (eccezioni e problemi critici)
        ''' </summary>
        Public Sub LogError(message As String, ex As Exception, Optional data As Object = Nothing) Implements ApiServer.Interfaces.ILogger.LogError
            WriteLog("ERROR", message, data, ex)
        End Sub

        ''' <summary>
        ''' Scrive il log su stdout in formato JSON strutturato
        ''' </summary>
        Private Sub WriteLog(level As String, message As String, data As Object, ex As Exception)
            Try
                Dim logEntry = New With {
                    .timestamp = DateTime.UtcNow.ToString("O"),
                    .level = level,
                    .message = message,
                    .data = data,
                    .exception = If(ex IsNot Nothing, New With {
                        .type = ex.GetType().FullName,
                        .message = ex.Message,
                        .stackTrace = ex.StackTrace,
                        .innerException = If(ex.InnerException IsNot Nothing, New With {
                            .type = ex.InnerException.GetType().FullName,
                            .message = ex.InnerException.Message
                        }, Nothing)
                    }, Nothing)
                }

                Dim json = JsonConvert.SerializeObject(logEntry, Formatting.None)
                Console.WriteLine(json)
                Console.Out.Flush()
            Catch serializationEx As Exception
                ' Fallback: se la serializzazione fallisce, usa formato semplice
                Console.WriteLine($"[{level}] {message}")
                If ex IsNot Nothing Then
                    Console.WriteLine($"Exception: {ex.GetType().Name} - {ex.Message}")
                End If
            End Try
        End Sub
    End Class
End Namespace
