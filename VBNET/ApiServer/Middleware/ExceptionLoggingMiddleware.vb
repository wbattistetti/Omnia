Option Strict On
Option Explicit On
Imports Microsoft.AspNetCore.Http
Imports Microsoft.Extensions.DependencyInjection
Imports Newtonsoft.Json
Imports ApiServer.Interfaces

Namespace ApiServer.Middleware
    ''' <summary>
    ''' ✅ FASE 3: Middleware per logging strutturato delle eccezioni
    ''' </summary>
    Public Class ExceptionLoggingMiddleware
        Private ReadOnly _next As RequestDelegate

        Public Sub New([next] As RequestDelegate)
            _next = [next]
        End Sub

        Public Async Function InvokeAsync(context As HttpContext) As Task
            ' ✅ FASE 3: Usa logger dal DI container (se disponibile)
            Dim logger = context.RequestServices.GetService(Of ApiServer.Interfaces.ILogger)()

            If logger IsNot Nothing Then
                logger.LogDebug("Request started", New With {
                    .method = context.Request.Method,
                    .path = context.Request.Path.ToString()
                })
            Else
                Console.WriteLine($"🔵 [ExceptionLoggingMiddleware] Request: {context.Request.Method} {context.Request.Path}")
            End If

            Try
                Await _next(context)

                If logger IsNot Nothing Then
                    logger.LogDebug("Request completed successfully", New With {
                        .method = context.Request.Method,
                        .path = context.Request.Path.ToString(),
                        .statusCode = context.Response.StatusCode
                    })
                Else
                    Console.WriteLine($"✅ [ExceptionLoggingMiddleware] Request completed successfully: {context.Request.Method} {context.Request.Path}")
                End If
            Catch ex As Exception
                ' ✅ FASE 3: Usa logger strutturato per eccezioni
                If logger IsNot Nothing Then
                    Dim jsonEx = TryCast(ex, JsonSerializationException)
                    logger.LogError("ExceptionLoggingMiddleware: Unhandled exception caught", ex, New With {
                        .path = context.Request.Path.ToString(),
                        .method = context.Request.Method,
                        .jsonException = If(jsonEx IsNot Nothing, New With {
                            .path = jsonEx.Path,
                            .lineNumber = jsonEx.LineNumber,
                            .linePosition = jsonEx.LinePosition
                        }, Nothing)
                    })
                Else
                    ' Fallback a Console se logger non disponibile
                    Console.WriteLine("═══════════════════════════════════════════════════════════════")
                    Console.WriteLine("❌ [ExceptionLoggingMiddleware] UNHANDLED EXCEPTION CAUGHT")
                    Console.WriteLine($"   Path: {context.Request.Path}")
                    Console.WriteLine($"   Method: {context.Request.Method}")
                    Console.WriteLine($"   Type: {ex.GetType().FullName}")
                    Console.WriteLine($"   Message: {ex.Message}")
                    Console.WriteLine($"   StackTrace: {ex.StackTrace}")
                    If ex.InnerException IsNot Nothing Then
                        Console.WriteLine("   ── Inner Exception ──")
                        Console.WriteLine($"   Type: {ex.InnerException.GetType().FullName}")
                        Console.WriteLine($"   Message: {ex.InnerException.Message}")
                    End If
                    Console.WriteLine("═══════════════════════════════════════════════════════════════")
                End If

                ' Rilancia l'eccezione per non nasconderla
                Throw
            End Try
        End Function
    End Class
End Namespace
