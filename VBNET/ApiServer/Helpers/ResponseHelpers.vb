Option Strict On
Option Explicit On

Imports Microsoft.AspNetCore.Http
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

        ''' <summary>
        ''' Creates a standardized JSON success response
        ''' </summary>
        ''' <param name="data">The data object to include in the response.</param>
        ''' <returns>An IResult containing the success response.</returns>
        Public Function CreateSuccessResponse(data As Object) As IResult
            Console.WriteLine($"🔵 [CreateSuccessResponse] ENTRY - data type: {If(data IsNot Nothing, data.GetType().Name, "Nothing")}")
            System.Diagnostics.Debug.WriteLine($"🔵 [CreateSuccessResponse] ENTRY - data type: {If(data IsNot Nothing, data.GetType().Name, "Nothing")}")
            Console.Out.Flush()

            Try
                Dim json = JsonConvert.SerializeObject(data, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore
                })
                Console.WriteLine($"🔵 [CreateSuccessResponse] JSON serialized: length={json.Length}, preview={If(json.Length > 100, json.Substring(0, 100) & "...", json)}")
                Console.Out.Flush()

                Dim result = Results.Content(json, "application/json", Nothing, 200)
                Console.WriteLine($"🔵 [CreateSuccessResponse] Result created: type={If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                Console.Out.Flush()

                Return result
            Catch ex As Exception
                Console.WriteLine($"🔵 [CreateSuccessResponse] EXCEPTION: {ex.GetType().Name} - {ex.Message}")
                Console.WriteLine($"🔵 [CreateSuccessResponse] StackTrace: {ex.StackTrace}")
                Console.Out.Flush()
                Throw
            End Try
        End Function

    End Module

End Namespace
