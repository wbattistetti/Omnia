Option Strict On
Option Explicit On

Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json

''' <summary>
''' Helper utilities for HTTP responses
''' </summary>

''' <summary>
''' Creates a standardized JSON error response
''' </summary>
''' <param name="errorMessage">The error message to include in the response.</param>
''' <param name="statusCode">The HTTP status code to return.</param>
''' <returns>An IResult containing the error response.</returns>
Public Module ResponseHelpers

        Public Function CreateErrorResponse(errorMessage As String, statusCode As Integer) As IResult
            Dim errorObj = New With {
                .error = errorMessage,
                .timestamp = DateTime.UtcNow.ToString("O")
            }
            Dim errorJson = JsonConvert.SerializeObject(errorObj, New JsonSerializerSettings() With {
                .NullValueHandling = NullValueHandling.Ignore
            })
            ' ✅ ENTERPRISE: Esplicita charset=utf-8 per coerenza (middleware gestisce il resto automaticamente)
            Return Results.Content(errorJson, "application/json; charset=utf-8", Nothing, statusCode)
        End Function

        ''' <summary>
        ''' Creates a standardized JSON success response
        ''' </summary>
        ''' <param name="data">The data object to include in the response.</param>
        ''' <returns>An IResult containing the success response.</returns>
        Public Function CreateSuccessResponse(data As Object) As IResult
            Try
                Dim json = JsonConvert.SerializeObject(data, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore
                })
                ' ✅ ENTERPRISE: Esplicita charset=utf-8 per coerenza (middleware gestisce il resto automaticamente)
                Return Results.Content(json, "application/json; charset=utf-8", Nothing, 200)
            Catch ex As Exception
                Console.WriteLine($"❌ [CreateSuccessResponse] EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Throw
            End Try
        End Function

    End Module
