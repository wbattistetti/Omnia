Option Strict On
Option Explicit On
Imports Compiler
Imports System.Linq
Imports Newtonsoft.Json

''' <summary>
''' Executor per task di tipo BackendCall
''' Implementa matching deterministico con mockTable
''' </summary>
Public Class BackendCallTaskExecutor
    Inherits TaskExecutorBase

    Public Sub New()
        MyBase.New()
    End Sub

    ''' <summary>
    ''' ✅ Deterministic typed matching function
    ''' Matches input values with type checking, null/undefined handling, and deep comparison
    ''' </summary>
    Private Function MatchesInput(rowValue As Object, currentValue As Object) As Boolean
        ' ✅ Type check: same type required (10 !== "10")
        If rowValue Is Nothing AndAlso currentValue Is Nothing Then Return True
        If rowValue Is Nothing OrElse currentValue Is Nothing Then Return False

        Dim rowType = rowValue.GetType()
        Dim currentType = currentValue.GetType()
        If rowType IsNot currentType Then Return False

        ' ✅ Deep comparison for objects/arrays
        If TypeOf rowValue Is Dictionary(Of String, Object) OrElse TypeOf rowValue Is Array OrElse TypeOf rowValue Is IList Then
            Dim rowJson = JsonConvert.SerializeObject(rowValue)
            Dim currentJson = JsonConvert.SerializeObject(currentValue)
            Return rowJson = currentJson
        End If

        ' ✅ Exact match for primitives (case-sensitive for strings)
        Return rowValue.Equals(currentValue)
    End Function

    Public Overrides Async Function Execute(task As CompiledTask, state As ExecutionState, Optional userInput As String = "") As System.Threading.Tasks.Task(Of TaskExecutionResult)
        Dim backendTask = TryCast(task, CompiledBackendCallTask)
        If backendTask Is Nothing Then
            Console.WriteLine($"⚠️ [BackendCallTaskExecutor] Task {task.Id} is not a CompiledBackendCallTask")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = "Task is not a CompiledBackendCallTask",
                .IsCompleted = False
            }
        End If

        Console.WriteLine($"[BackendCallTaskExecutor] Executing BackendCall task {task.Id}")

        ' Get variableStore
        If state.VariableStore Is Nothing Then
            state.VariableStore = New Dictionary(Of String, Object)()
        End If

        ' ✅ If mockTable exists and has rows, try to match input values
        If backendTask.MockTable IsNot Nothing AndAlso backendTask.MockTable.Count > 0 Then
            Dim inputs = If(backendTask.Inputs, New List(Of Dictionary(Of String, Object))())
            Dim outputs = If(backendTask.Outputs, New List(Of Dictionary(Of String, Object))())

            ' Build current input values from variableStore
            Dim currentInputValues As New Dictionary(Of String, Object)()
            For Each inputDef In inputs
                If inputDef.ContainsKey("variable") AndAlso inputDef.ContainsKey("internalName") Then
                    Dim varId = inputDef("variable")?.ToString()
                    Dim internalName = inputDef("internalName")?.ToString()
                    If Not String.IsNullOrEmpty(varId) AndAlso Not String.IsNullOrEmpty(internalName) Then
                        If state.VariableStore.ContainsKey(varId) Then
                            currentInputValues(internalName) = state.VariableStore(varId)
                        End If
                    End If
                End If
            Next

            Console.WriteLine($"[BackendCallTaskExecutor] Current input values: {JsonConvert.SerializeObject(currentInputValues)}")

            ' ✅ Find ALL matching rows (for validation)
            Dim matchingRows As New List(Of Dictionary(Of String, Object))()
            For Each row In backendTask.MockTable
                If Not row.ContainsKey("inputs") OrElse Not TypeOf row("inputs") Is Dictionary(Of String, Object) Then
                    Continue For
                End If

                Dim rowInputs = CType(row("inputs"), Dictionary(Of String, Object))

                ' ✅ Complete match: ALL inputs must match
                Dim allMatch = True
                For Each inputDef In inputs
                    If Not inputDef.ContainsKey("internalName") Then Continue For
                    Dim internalName = inputDef("internalName")?.ToString()
                    If String.IsNullOrEmpty(internalName) Then Continue For

                    Dim rowValue As Object = Nothing
                    Dim currentValue As Object = Nothing

                    If rowInputs.ContainsKey(internalName) Then
                        rowValue = rowInputs(internalName)
                    End If
                    If currentInputValues.ContainsKey(internalName) Then
                        currentValue = currentInputValues(internalName)
                    End If

                    If Not MatchesInput(rowValue, currentValue) Then
                        allMatch = False
                        Exit For
                    End If
                Next

                If allMatch Then
                    matchingRows.Add(row)
                End If
            Next

            ' ✅ Validation: exactly 0 or 1 row (never 2+)
            If matchingRows.Count = 0 Then
                ' No match found: task executed without modifying variables
                Console.WriteLine($"[BackendCallTaskExecutor] No matching row found. Task executed successfully but no mockTable row matched. No variables modified.")
                ' ✅ success: True means "task executed without modifying variables" (not "mock found")
                Return New TaskExecutionResult() With {
                    .Success = True,
                    .IsCompleted = True
                }
            End If

            If matchingRows.Count > 1 Then
                ' ⚠️ ERROR: Multiple rows match (non-deterministic)
                Dim rowIds = String.Join(", ", matchingRows.Select(Function(r) If(r.ContainsKey("id"), r("id")?.ToString(), "no-id")))
                Console.WriteLine($"[BackendCallTaskExecutor] ❌ ERROR: Multiple mockTable rows match ({matchingRows.Count} rows: {rowIds}). MockTable must have unique input combinations.")
                Return New TaskExecutionResult() With {
                    .Success = False,
                    .Err = $"Multiple mockTable rows match ({matchingRows.Count} rows). MockTable must have unique input combinations.",
                    .IsCompleted = False
                }
            End If

            ' ✅ Exactly 1 row matched
            Dim matchedRow = matchingRows(0)
            Console.WriteLine($"[BackendCallTaskExecutor] ✅ Matched row: {If(matchedRow.ContainsKey("id"), matchedRow("id")?.ToString(), "no-id")}")

            If matchedRow.ContainsKey("outputs") AndAlso TypeOf matchedRow("outputs") Is Dictionary(Of String, Object) Then
                Dim rowOutputs = CType(matchedRow("outputs"), Dictionary(Of String, Object))

                ' Map output values to variableStore varIds
                Dim outputCount = 0
                For Each output In outputs
                    If output.ContainsKey("variable") AndAlso output.ContainsKey("internalName") Then
                        Dim varId = output("variable")?.ToString()
                        Dim internalName = output("internalName")?.ToString()
                        If Not String.IsNullOrEmpty(varId) AndAlso Not String.IsNullOrEmpty(internalName) Then
                            If rowOutputs.ContainsKey(internalName) Then
                                Dim outputValue = rowOutputs(internalName)
                                If outputValue IsNot Nothing Then
                                    state.VariableStore(varId) = outputValue
                                    outputCount += 1
                                    Console.WriteLine($"[BackendCallTaskExecutor] ✅ Wrote output: varId={varId}, value={JsonConvert.SerializeObject(outputValue)}")
                                End If
                            End If
                        End If
                    End If
                Next

                Console.WriteLine($"[BackendCallTaskExecutor] ✅ BackendCall completed: {outputCount} output variables written")
            End If

            Return New TaskExecutionResult() With {
                .Success = True,
                .IsCompleted = True
            }
        Else
            ' No mockTable: return empty (or could make actual API call in future)
            Console.WriteLine($"[BackendCallTaskExecutor] No mockTable defined. Task executed without backend call.")
            Return New TaskExecutionResult() With {
                .Success = True,
                .IsCompleted = True
            }
        End If
    End Function
End Class
