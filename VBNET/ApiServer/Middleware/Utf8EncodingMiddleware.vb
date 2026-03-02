Option Strict On
Option Explicit On

Imports Microsoft.AspNetCore.Http
Imports System.Threading.Tasks

Namespace ApiServer.Middleware

    ''' <summary>
    ''' Middleware leggero che garantisce charset=utf-8 in tutte le risposte JSON
    ''' ✅ LEGGERO: Usa OnStarting invece di intercettare il body stream
    ''' Enterprise-ready: stabilisce invariante forte lato server
    ''' </summary>
    Public Class Utf8EncodingMiddleware
        Private ReadOnly _next As RequestDelegate

        Public Sub New(nextDelegate As RequestDelegate)
            _next = nextDelegate
        End Sub

        Public Async Function InvokeAsync(context As HttpContext) As Task
            ' ✅ LEGGERO: Registra callback PRIMA che il body venga scritto
            ' Non intercetta il stream, solo modifica gli header
            ' Zero overhead per risposte grandi
            context.Response.OnStarting(Function()
                                            If context.Response.ContentType IsNot Nothing AndAlso
                                               context.Response.ContentType.Contains("application/json") Then
                                                If Not context.Response.ContentType.Contains("charset") Then
                                                    context.Response.ContentType &= "; charset=utf-8"
                                                End If
                                            End If
                                            Return Task.CompletedTask
                                        End Function)

            ' Esegui il prossimo middleware (nessuna intercettazione del body)
            Await _next(context)
        End Function
    End Class

End Namespace
