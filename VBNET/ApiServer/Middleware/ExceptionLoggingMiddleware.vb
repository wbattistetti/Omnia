Option Strict On
Option Explicit On

Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json

Namespace ApiServer.Middleware
    Public Class ExceptionLoggingMiddleware
        Private ReadOnly _next As RequestDelegate

        Public Sub New([next] As RequestDelegate)
            _next = [next]
        End Sub

        Public Async Function InvokeAsync(context As HttpContext) As Task
            Console.WriteLine($"🔵 [ExceptionLoggingMiddleware] Request: {context.Request.Method} {context.Request.Path}")
            Console.Out.Flush()
            Try
                Await _next(context)
                Console.WriteLine($"✅ [ExceptionLoggingMiddleware] Request completed successfully: {context.Request.Method} {context.Request.Path}")
                Console.Out.Flush()
            Catch ex As Exception
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
                    Console.WriteLine($"   StackTrace: {ex.InnerException.StackTrace}")
                End If

                Dim jsonEx = TryCast(ex, JsonSerializationException)
                If jsonEx IsNot Nothing Then
                    Console.WriteLine("   ── JSON Exception Details ──")
                    Console.WriteLine($"   JSON Path: {jsonEx.Path}")
                    Console.WriteLine($"   LineNumber: {jsonEx.LineNumber}")
                    Console.WriteLine($"   LinePosition: {jsonEx.LinePosition}")
                End If

                Console.WriteLine("═══════════════════════════════════════════════════════════════")
                Console.Out.Flush()

                ' Rilancia l'eccezione per non nasconderla
                Throw
            End Try
        End Function
    End Class
End Namespace
