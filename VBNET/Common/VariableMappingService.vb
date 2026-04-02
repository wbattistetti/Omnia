Option Strict On
Option Explicit On
Imports System.Net.Http
Imports System.Text
Imports Newtonsoft.Json

''' <summary>
''' Legacy entry point: variable identity is the TaskTreeNode GUID.
''' <see cref="GetVarIdByNodeId"/> returns <paramref name="nodeId"/> (same as VariableInstance.Id).
''' </summary>
Public Class VariableMappingService
    Private Shared ReadOnly _httpClient As New HttpClient()

    ''' <summary>
    ''' Returns the variable id for the given task node. Identity is <c>nodeId</c> (GUID).
    ''' </summary>
    Public Shared Function GetVarIdByNodeId(
        projectId As String,
        nodeId As String,
        taskInstanceId As String
    ) As String
        If String.IsNullOrEmpty(projectId) OrElse
           String.IsNullOrEmpty(nodeId) OrElse
           String.IsNullOrEmpty(taskInstanceId) Then
            Return Nothing
        End If
        Return nodeId
    End Function

    ''' <summary>
    ''' Saves variables to database via POST API.
    ''' </summary>
    Public Shared Function SaveVariables(
        projectId As String,
        variables As List(Of Dictionary(Of String, Object))
    ) As Boolean
        If String.IsNullOrEmpty(projectId) OrElse variables Is Nothing OrElse variables.Count = 0 Then
            Return False
        End If

        Try
            Dim requestBody As New Dictionary(Of String, Object) From {
                {"variables", variables}
            }

            Dim json = JsonConvert.SerializeObject(requestBody)
            Dim content As New StringContent(json, Encoding.UTF8, "application/json")

            Dim response = _httpClient.PostAsync(
                $"http://localhost:3100/api/projects/{projectId}/variables",
                content
            ).Result

            If response.IsSuccessStatusCode Then
                Dim result = response.Content.ReadAsStringAsync().Result
                Console.WriteLine($"[VariableMappingService] ✅ Saved {variables.Count} variables to DB: {result}")
                Return True
            Else
                Dim errorText = response.Content.ReadAsStringAsync().Result
                Console.WriteLine($"[VariableMappingService] ❌ Failed to save variables: {response.StatusCode} - {errorText}")
                Return False
            End If
        Catch ex As Exception
            Console.WriteLine($"[VariableMappingService] ❌ Error saving variables: {ex.Message}")
            Console.WriteLine($"[VariableMappingService]   StackTrace: {ex.StackTrace}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' No-op: mapping is identity on node GUID.
    ''' </summary>
    Public Shared Sub ClearCache()
    End Sub
End Class
