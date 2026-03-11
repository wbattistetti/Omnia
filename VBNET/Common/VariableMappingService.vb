Option Strict On
Option Explicit On
Imports System.Net.Http
Imports System.Text
Imports Newtonsoft.Json
Imports System.Threading.Tasks

''' <summary>
''' Service for resolving variable ID (varId) from nodeId and taskInstanceId.
'''
''' This mapping is needed because:
''' - Parser extracts values using nodeId (template node ID, common across instances)
''' - VariableStore must use varId (unique per taskInstance) as key
''' - AST in conditions contains varId, so VariableStore lookup must match
'''
''' Example:
'''   Template "città" (nodeId="template-123") used by:
'''   - TaskInstance A ("città di partenza") → varId="guid-1111"
'''   - TaskInstance B ("città di arrivo") → varId="guid-2222"
'''
'''   When parser extracts "Milano" for TaskInstance A:
'''   - Memory["template-123"] = "Milano"
'''   - Mapping: (nodeId="template-123", taskInstanceId="task-A") → varId="guid-1111"
'''   - VariableStore["guid-1111"] = "Milano" ✅
''' </summary>
Public Class VariableMappingService
    Private Shared ReadOnly _httpClient As New HttpClient()
    Private Shared ReadOnly _cache As New Dictionary(Of String, String)()
    Private Shared ReadOnly _cacheLock As New Object()

    ''' <summary>
    ''' Resolves varId from (projectId, nodeId, taskInstanceId).
    ''' Uses cache to avoid repeated API calls.
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

        ' Check cache first
        Dim cacheKey = $"{projectId}:{nodeId}:{taskInstanceId}"
        SyncLock _cacheLock
            If _cache.ContainsKey(cacheKey) Then
                Return _cache(cacheKey)
            End If
        End SyncLock

        ' Resolve from API
        Dim varId = GetVarIdFromApi(projectId, nodeId, taskInstanceId)

        ' Cache result (even if Nothing, to avoid repeated failed lookups)
        If Not String.IsNullOrEmpty(varId) Then
            SyncLock _cacheLock
                _cache(cacheKey) = varId
            End SyncLock
        End If

        Return varId
    End Function

    ''' <summary>
    ''' Calls backend API to resolve varId.
    ''' </summary>
    Private Shared Function GetVarIdFromApi(
        projectId As String,
        nodeId As String,
        taskInstanceId As String
    ) As String
        Try
            ' Call backend API: GET /api/projects/:pid/variables?nodeId=...&taskInstanceId=...
            Dim apiUrl = $"http://localhost:3100/api/projects/{projectId}/variables?nodeId={Uri.EscapeDataString(nodeId)}&taskInstanceId={Uri.EscapeDataString(taskInstanceId)}"

            Dim response = _httpClient.GetAsync(apiUrl).Result
            If Not response.IsSuccessStatusCode Then
                If response.StatusCode = System.Net.HttpStatusCode.NotFound Then
                    Console.WriteLine($"[VariableMappingService] Variable not found: nodeId={nodeId}, taskInstanceId={taskInstanceId}")
                    Return Nothing
                End If
                Console.WriteLine($"[VariableMappingService] API error: {response.StatusCode}")
                Return Nothing
            End If

            Dim jsonContent = response.Content.ReadAsStringAsync().Result
            Dim variables = JsonConvert.DeserializeObject(Of List(Of Dictionary(Of String, Object)))(jsonContent)

            If variables IsNot Nothing AndAlso variables.Count > 0 Then
                Dim firstVar = variables(0)
                If firstVar.ContainsKey("varId") Then
                    Dim varId = firstVar("varId")?.ToString()
                    Console.WriteLine($"[VariableMappingService] ✅ Resolved: nodeId={nodeId}, taskInstanceId={taskInstanceId} → varId={varId}")
                    Return varId
                End If
            End If

            Console.WriteLine($"[VariableMappingService] ⚠️ No varId found in API response")
            Return Nothing

        Catch ex As Exception
            Console.WriteLine($"[VariableMappingService] ❌ Error resolving varId: {ex.Message}")
            Console.WriteLine($"[VariableMappingService]   StackTrace: {ex.StackTrace}")
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' Clears the cache (useful when variables are created/deleted).
    ''' </summary>
    Public Shared Sub ClearCache()
        SyncLock _cacheLock
            _cache.Clear()
        End SyncLock
    End Sub
End Class
