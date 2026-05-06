Option Strict On
Option Explicit On

Imports System.Collections
Imports Compiler
Imports Compiler.DTO.Runtime
Imports System.Linq
Imports System.Net.Http
Imports System.Text
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Executor BackendCall: mock table deterministica oppure HTTP reale verso l&apos;endpoint del task (allineato al designer).
''' </summary>
Public Class BackendCallTaskExecutor
    Inherits TaskExecutorBase

    Private Shared ReadOnly HttpShared As New HttpClient With {.Timeout = TimeSpan.FromMinutes(2)}

    Private Const DefaultVisibleListItems As Integer = 12

    Public Sub New()
        MyBase.New()
    End Sub

    Private Shared Function GetExecutionMode(t As CompiledBackendCallTask) As String
        If t.Config IsNot Nothing AndAlso t.Config.ContainsKey("mockTableDefaultExecutionMode") Then
            Dim s = t.Config("mockTableDefaultExecutionMode")?.ToString()?.Trim().ToUpperInvariant()
            If s = "REAL" Then Return "REAL"
            If s = "MOCK" Then Return "MOCK"
        End If
        Return "MOCK"
    End Function

    ''' <summary>MOCK + righe mock compilate → usa solo tabella.</summary>
    Private Shared Function PreferMockTable(t As CompiledBackendCallTask) As Boolean
        Return String.Equals(GetExecutionMode(t), "MOCK", StringComparison.Ordinal) AndAlso
            t.MockRows IsNot Nothing AndAlso t.MockRows.Count > 0
    End Function

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState, Optional userInput As String = "") As Threading.Tasks.Task(Of TaskExecutionResult)
        Dim backendTask = TryCast(task, CompiledBackendCallTask)
        If backendTask Is Nothing Then
            Console.WriteLine($"⚠️ [BackendCallTaskExecutor] Task {task.Id} is not a CompiledBackendCallTask")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is not a CompiledBackendCallTask",
                .IsCompleted = False
            }
        End If

        Console.WriteLine($"[BackendCallTaskExecutor] Executing BackendCall task {backendTask.Id}")

        If state.VariableStore Is Nothing Then
            state.VariableStore = New Dictionary(Of String, Object)()
        End If

        If PreferMockTable(backendTask) Then
            Return ExecuteMockupTable(backendTask, state)
        End If

        Dim ep = If(backendTask.Endpoint, "").Trim()
        If ep.Length > 0 Then
            Return Await ExecuteHttpAsync(backendTask, state).ConfigureAwait(False)
        End If

        If backendTask.MockRows IsNot Nothing AndAlso backendTask.MockRows.Count > 0 Then
            Return ExecuteMockupTable(backendTask, state)
        End If

        Console.WriteLine($"[BackendCallTaskExecutor] No mockTable defined. Task executed without backend call.")
        Return New TaskExecutionResult() With {
            .Success = True,
            .IsCompleted = True,
            .BackendCallDiagnosticJson = BuildDiagnosticJson(backendTask, state, "no_mock", Nothing, Nothing)
        }
    End Function

    Private Async Function ExecuteHttpAsync(backendTask As CompiledBackendCallTask, state As ExecutionState) As Threading.Tasks.Task(Of TaskExecutionResult)
        Dim built As BackendSendHttp.BuiltBackendHttpRequest = Nothing
        Try
            built = BackendSendHttp.BuildSendHttpRequest(
                backendTask.Endpoint,
                backendTask.Method,
                backendTask.EndpointHeaders,
                backendTask.Inputs,
                state.VariableStore)
        Catch ex As Exception
            Dim msg = $"BackendCall HTTP build failed: {ex.Message}"
            Console.WriteLine($"[BackendCallTaskExecutor] ❌ {msg}")
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = msg,
                .IsCompleted = False,
                .BackendCallDiagnosticJson = BuildHttpDiagnosticJson(backendTask, state, built, Nothing, Nothing, msg)
            }
        End Try

        Dim req As New HttpRequestMessage(New HttpMethod(built.Method), built.Url)
        For Each kv In built.Headers
            If String.Equals(kv.Key, "Content-Type", StringComparison.OrdinalIgnoreCase) OrElse
               String.Equals(kv.Key, "content-type", StringComparison.OrdinalIgnoreCase) Then Continue For
            req.Headers.TryAddWithoutValidation(kv.Key, kv.Value)
        Next

        If built.BodyJson IsNot Nothing Then
            req.Content = New StringContent(built.BodyJson, Encoding.UTF8, "application/json")
        End If

        Dim inputsSnapshot = CollectMappedInputs(backendTask, state)

        Dim resp As HttpResponseMessage = Nothing
        Dim responseBody As String = ""
        Try
            resp = Await HttpShared.SendAsync(req).ConfigureAwait(False)
            responseBody = Await resp.Content.ReadAsStringAsync().ConfigureAwait(False)
        Catch ex As Exception
            Dim msg = $"BackendCall HTTP transport error: {ex.Message}"
            Console.WriteLine($"[BackendCallTaskExecutor] ❌ {msg}")
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = msg,
                .IsCompleted = False,
                .BackendCallDiagnosticJson = BuildHttpDiagnosticJson(backendTask, state, built, Nothing, Nothing, msg, inputsSnapshot)
            }
        End Try

        Dim statusCode = CInt(resp.StatusCode)

        If Not resp.IsSuccessStatusCode Then
            Dim preview = If(responseBody.Length > 400, responseBody.Substring(0, 400) & "…", responseBody)
            Dim errMsg = $"HTTP {statusCode}: {preview}"
            Console.WriteLine($"[BackendCallTaskExecutor] ❌ {errMsg}")
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = errMsg,
                .IsCompleted = False,
                .BackendCallDiagnosticJson = BuildHttpDiagnosticJson(backendTask, state, built, statusCode, responseBody, errMsg, inputsSnapshot)
            }
        End If

        Dim root As JToken = Nothing
        Try
            root = If(String.IsNullOrWhiteSpace(responseBody), Nothing, JToken.Parse(responseBody))
        Catch ex As Exception
            Dim msg = $"BackendCall response is not JSON: {ex.Message}"
            Return New TaskExecutionResult With {
                .Success = False,
                .Err = msg,
                .IsCompleted = False,
                .BackendCallDiagnosticJson = BuildHttpDiagnosticJson(backendTask, state, built, statusCode, responseBody, msg, inputsSnapshot)
            }
        End Try

        Dim assignmentCount = ApplyOutputsFromJson(backendTask, state, root)

        Dim outParams = CollectMappedOutputsFromResponse(backendTask, root)

        Console.WriteLine($"[BackendCallTaskExecutor] ✅ HTTP BackendCall completed: status={statusCode}, outputs mapped={assignmentCount}")

        Return New TaskExecutionResult With {
            .Success = True,
            .IsCompleted = True,
            .BackendCallDiagnosticJson = BuildHttpDiagnosticJson(backendTask, state, built, statusCode, responseBody, Nothing, inputsSnapshot, outParams)
        }
    End Function

    Private Shared Function ApplyOutputsFromJson(t As CompiledBackendCallTask, state As ExecutionState, responseRoot As JToken) As Integer
        Dim n = 0
        If t.Outputs Is Nothing OrElse responseRoot Is Nothing Then Return 0

        For Each outDef In t.Outputs
            Dim varId = DictStr(outDef, "variable").Trim()
            Dim apiPath = DictStr(outDef, "apiField").Trim()
            If varId = "" OrElse apiPath = "" Then Continue For

            Dim tok = BackendSendHttp.GetJsonAtPath(responseRoot, apiPath)
            If tok Is Nothing OrElse tok.Type = JTokenType.Null Then Continue For

            state.VariableStore(varId) = tok.ToObject(Of Object)()
            n += 1
        Next
        Return n
    End Function

    Private Shared Function CollectMappedOutputsFromResponse(backendTask As CompiledBackendCallTask, responseRoot As JToken) As JArray
        Dim arr As New JArray()
        If backendTask.Outputs Is Nothing OrElse responseRoot Is Nothing Then Return arr

        For Each outDef In backendTask.Outputs
            Dim internalName = DictStr(outDef, "internalName").Trim()
            Dim apiPath = DictStr(outDef, "apiField").Trim()
            If apiPath = "" Then Continue For
            Dim label = If(internalName <> "", internalName, "output")
            Dim tok = BackendSendHttp.GetJsonAtPath(responseRoot, apiPath)
            Dim jo As New JObject From {
                {"name", label},
                {"value", If(tok Is Nothing, JValue.CreateNull(), tok)}
            }
            arr.Add(jo)
        Next
        Return arr
    End Function

    Private Shared Function DictStr(d As Dictionary(Of String, Object), key As String) As String
        If d Is Nothing OrElse Not d.ContainsKey(key) Then Return ""
        Return If(d(key)?.ToString(), "")
    End Function

    Private Shared Function BuildHttpDiagnosticJson(
        backendTask As CompiledBackendCallTask,
        state As ExecutionState,
        built As BackendSendHttp.BuiltBackendHttpRequest,
        httpStatus As Integer?,
        rawBody As String,
        errMsg As String,
        Optional inputsOverride As JArray = Nothing,
        Optional outputsOverride As JArray = Nothing
    ) As String
        Dim inputs = If(inputsOverride IsNot Nothing, inputsOverride, CollectMappedInputs(backendTask, state))
        Dim outputs = If(outputsOverride IsNot Nothing, outputsOverride, New JArray())

        Dim url = If(built IsNot Nothing, built.Url, If(backendTask.Endpoint, ""))
        Dim method = If(built IsNot Nothing, built.Method, If(backendTask.Method, "POST"))
        Dim bodyPreview As String = Nothing
        If built IsNot Nothing AndAlso built.BodyJson IsNot Nothing Then
            bodyPreview = If(built.BodyJson.Length > 800, built.BodyJson.Substring(0, 800) & "…", built.BodyJson)
        End If

        Dim responsePreview As String = Nothing
        If rawBody IsNot Nothing Then
            responsePreview = If(rawBody.Length > 1200, rawBody.Substring(0, 1200) & "…", rawBody)
        End If

        Dim outcome As String = If(errMsg Is Nothing, "http_success", "http_error")

        Dim root As New JObject From {
            {"taskId", backendTask.Id},
            {"displayName", ResolveDisplayName(backendTask)},
            {"endpoint", url},
            {"method", method},
            {"outcome", outcome},
            {"httpStatus", If(httpStatus.HasValue, JToken.FromObject(httpStatus.Value), Nothing)},
            {"requestBodyPreview", If(bodyPreview Is Nothing, Nothing, JToken.FromObject(bodyPreview))},
            {"responsePreview", If(responsePreview Is Nothing, Nothing, JToken.FromObject(responsePreview))},
            {"errorMessage", If(String.IsNullOrWhiteSpace(errMsg), Nothing, JToken.FromObject(errMsg))},
            {"inputParameters", inputs},
            {"outputParameters", outputs},
            {"listPreviewLimit", DefaultVisibleListItems}
        }
        Return root.ToString(Formatting.None)
    End Function

    Private Function ValuesEqual(value1 As Object, value2 As Object) As Boolean
        If value1 Is Nothing AndAlso value2 Is Nothing Then Return True
        If value1 Is Nothing OrElse value2 Is Nothing Then Return False

        Dim type1 = value1.GetType()
        Dim type2 = value2.GetType()
        If type1 IsNot type2 Then Return False

        If TypeOf value1 Is Dictionary(Of String, Object) OrElse TypeOf value1 Is Array OrElse TypeOf value1 Is IList Then
            Dim json1 = JsonConvert.SerializeObject(value1)
            Dim json2 = JsonConvert.SerializeObject(value2)
            Return json1 = json2
        End If

        Return value1.Equals(value2)
    End Function

    Private Function ExecuteMockupTable(backendTask As CompiledBackendCallTask, state As ExecutionState) As TaskExecutionResult
        Dim matchedRows As New List(Of CompiledMockRow)

        For Each row In backendTask.MockRows
            Dim allMatch = True

            For Each cond In row.Conditions
                Dim currentValue As Object = Nothing

                If cond.IsLiteralConstant Then
                    currentValue = cond.VariableId
                Else
                    If state.VariableStore.ContainsKey(cond.VariableId) Then
                        currentValue = state.VariableStore(cond.VariableId)
                    Else
                        Console.WriteLine($"[BackendCallTaskExecutor] ⚠️ VariableStore does not contain varId '{cond.VariableId}'. Using Nothing for comparison.")
                    End If
                End If

                If Not ValuesEqual(currentValue, cond.ExpectedValue) Then
                    allMatch = False
                    Exit For
                End If
            Next

            If allMatch Then
                matchedRows.Add(row)
            End If
        Next

        If matchedRows.Count = 0 Then
            Console.WriteLine($"[BackendCallTaskExecutor] No matching row found. Task executed successfully but no mockTable row matched. No variables modified.")
            Return New TaskExecutionResult() With {
                .Success = True,
                .IsCompleted = True,
                .BackendCallDiagnosticJson = BuildDiagnosticJson(backendTask, state, "no_match", Nothing, Nothing)
            }
        End If

        If matchedRows.Count > 1 Then
            Dim ids = String.Join(", ", matchedRows.Select(Function(r) r.Id))
            Console.WriteLine($"[BackendCallTaskExecutor] ❌ ERROR: Multiple mockTable rows match ({ids}). MockTable must have unique input combinations.")
            Dim errTxt = $"Multiple mockTable rows match ({ids}). MockTable must have unique input combinations."
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = errTxt,
                .IsCompleted = False,
                .BackendCallDiagnosticJson = BuildDiagnosticJson(backendTask, state, "ambiguous", Nothing, errTxt)
            }
        End If

        Dim matchedRow = matchedRows(0)
        Console.WriteLine($"[BackendCallTaskExecutor] ✅ Matched row: {matchedRow.Id}")

        Dim inputsSnapshot = CollectMappedInputs(backendTask, state)

        Dim assignmentCount = 0
        For Each assign In matchedRow.Assignments
            If assign.IsLiteralConstant Then
                Console.WriteLine($"[BackendCallTaskExecutor] ⚠️ Output mapping is a literal (no varId). Skipping VariableStore write.")
                Continue For
            End If
            If Not String.IsNullOrEmpty(assign.VariableId) Then
                state.VariableStore(assign.VariableId) = assign.Value
                assignmentCount += 1
            Else
                Console.WriteLine($"[BackendCallTaskExecutor] ⚠️ WARNING: Assignment has empty VariableId. Skipping.")
            End If
        Next

        Console.WriteLine($"[BackendCallTaskExecutor] ✅ BackendCall completed: {assignmentCount} output variables written")

        Dim outParams = CollectOutputParamsFromRow(backendTask, matchedRow)

        Return New TaskExecutionResult() With {
            .Success = True,
            .IsCompleted = True,
            .BackendCallDiagnosticJson = BuildDiagnosticJson(backendTask, state, "success", matchedRow, Nothing, inputsSnapshot, outParams)
        }
    End Function

    Private Shared Function ResolveDisplayName(t As CompiledBackendCallTask) As String
        If t.Config IsNot Nothing AndAlso t.Config.ContainsKey("label") Then
            Dim lab = t.Config("label")?.ToString()
            If Not String.IsNullOrWhiteSpace(lab) Then Return lab.Trim()
        End If
        Dim sid = t.Id
        If String.IsNullOrEmpty(sid) Then Return "Backend"
        If sid.Length <= 12 Then Return sid
        Return sid.Substring(0, 8) & "…"
    End Function

    Private Shared Function CollectMappedInputs(backendTask As CompiledBackendCallTask, state As ExecutionState) As JArray
        Dim arr As New JArray()
        If backendTask.Inputs Is Nothing Then Return arr
        For Each inp In backendTask.Inputs
            Dim internalName = If(inp.ContainsKey("internalName"), inp("internalName")?.ToString(), "")
            If String.IsNullOrWhiteSpace(internalName) Then internalName = "input"
            Dim varId = If(inp.ContainsKey("variable"), inp("variable")?.ToString(), "")
            Dim val As Object = Nothing
            If Not String.IsNullOrEmpty(varId) AndAlso state.VariableStore.ContainsKey(varId) Then
                val = state.VariableStore(varId)
            End If
            Dim jo As New JObject From {
                {"name", internalName},
                {"value", ToJToken(val)}
            }
            arr.Add(jo)
        Next
        Return arr
    End Function

    Private Shared Function CollectOutputParamsFromRow(backendTask As CompiledBackendCallTask, matchedRow As CompiledMockRow) As JArray
        Dim arr As New JArray()
        For Each assign In matchedRow.Assignments
            Dim label As String
            If assign.IsLiteralConstant Then
                label = "literal"
            ElseIf Not String.IsNullOrEmpty(assign.VariableId) Then
                label = InternalNameForOutputVar(backendTask.Outputs, assign.VariableId)
            Else
                label = "output"
            End If
            Dim jo As New JObject From {
                {"name", label},
                {"value", ToJToken(assign.Value)}
            }
            arr.Add(jo)
        Next
        Return arr
    End Function

    Private Shared Function InternalNameForOutputVar(outputs As List(Of Dictionary(Of String, Object)), varId As String) As String
        If outputs Is Nothing OrElse String.IsNullOrEmpty(varId) Then Return varId
        For Each o In outputs
            Dim v = If(o.ContainsKey("variable"), o("variable")?.ToString(), "")
            If String.Equals(v, varId, StringComparison.OrdinalIgnoreCase) Then
                Dim nm = If(o.ContainsKey("internalName"), o("internalName")?.ToString(), "")
                If Not String.IsNullOrWhiteSpace(nm) Then Return nm.Trim()
            End If
        Next
        Return varId
    End Function

    Private Shared Function ToJToken(val As Object) As JToken
        If val Is Nothing Then Return JValue.CreateNull()
        Return JToken.FromObject(val)
    End Function

    ''' <param name="inputsOverride">Usato per success: snapshot input prima delle assegnazioni.</param>
    ''' <param name="outputsOverride">Lista output già costruita dalla riga matchata.</param>
    Private Shared Function BuildDiagnosticJson(
        backendTask As CompiledBackendCallTask,
        state As ExecutionState,
        outcome As String,
        matchedRow As CompiledMockRow,
        Optional errMsg As String = Nothing,
        Optional inputsOverride As JArray = Nothing,
        Optional outputsOverride As JArray = Nothing
    ) As String
        Dim inputs = If(inputsOverride IsNot Nothing, inputsOverride, CollectMappedInputs(backendTask, state))
        Dim outputs As JArray = If(outputsOverride IsNot Nothing, outputsOverride, New JArray())

        Dim rowId As String = Nothing
        If matchedRow IsNot Nothing AndAlso Not String.IsNullOrWhiteSpace(matchedRow.Id) Then
            rowId = matchedRow.Id
        End If

        Dim root As New JObject From {
            {"taskId", backendTask.Id},
            {"displayName", ResolveDisplayName(backendTask)},
            {"endpoint", If(String.IsNullOrEmpty(backendTask.Endpoint), "", backendTask.Endpoint)},
            {"method", If(String.IsNullOrEmpty(backendTask.Method), "POST", backendTask.Method)},
            {"outcome", outcome},
            {"matchedRowId", If(rowId Is Nothing, Nothing, JToken.FromObject(rowId))},
            {"errorMessage", If(String.IsNullOrWhiteSpace(errMsg), Nothing, JToken.FromObject(errMsg))},
            {"inputParameters", inputs},
            {"outputParameters", outputs},
            {"listPreviewLimit", DefaultVisibleListItems}
        }
        Return root.ToString(Formatting.None)
    End Function

End Class
