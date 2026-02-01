Option Strict On
Option Explicit On

Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Http.HttpResults
Imports Newtonsoft.Json

''' <summary>
''' Helper utilities for HTTP responses
''' </summary>
Namespace Helpers

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
            Return Results.Content(errorJson, "application/json", Nothing, statusCode)
        End Function

    End Module

End Namespace
