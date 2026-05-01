Option Strict On
Option Explicit On
Imports Compiler
Imports Compiler.DTO.Runtime
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
    Private Function ValuesEqual(value1 As Object, value2 As Object) As Boolean
        ' ✅ Type check: same type required (10 !== "10")
        If value1 Is Nothing AndAlso value2 Is Nothing Then Return True
        If value1 Is Nothing OrElse value2 Is Nothing Then Return False

        Dim type1 = value1.GetType()
        Dim type2 = value2.GetType()
        If type1 IsNot type2 Then Return False

        ' ✅ Deep comparison for objects/arrays
        If TypeOf value1 Is Dictionary(Of String, Object) OrElse TypeOf value1 Is Array OrElse TypeOf value1 Is IList Then
            Dim json1 = JsonConvert.SerializeObject(value1)
            Dim json2 = JsonConvert.SerializeObject(value2)
            Return json1 = json2
        End If

        ' ✅ Exact match for primitives (case-sensitive for strings)
        Return value1.Equals(value2)
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

        ' ✅ Initialize VariableStore if needed
        If state.VariableStore Is Nothing Then
            state.VariableStore = New Dictionary(Of String, Object)()
        End If

        ' ✅ Use compiled MockRows (typed structures)
        If backendTask.MockRows IsNot Nothing AndAlso backendTask.MockRows.Count > 0 Then
            Return ExecuteMockupTable(backendTask, state)
        Else
            ' No mockTable: return empty (or could make actual API call in future)
            Console.WriteLine($"[BackendCallTaskExecutor] No mockTable defined. Task executed without backend call.")
            Return New TaskExecutionResult() With {
                .Success = True,
                .IsCompleted = True
            }
        End If
    End Function

    ''' <summary>
    ''' ✅ Optimized execution: evaluates precompiled boolean formulas
    ''' Zero internalName, zero intermediate dictionaries, direct VariableStore access
    ''' Algorithm: Collect all matching rows, then decide (0/1/2+)
    ''' </summary>
    Private Function ExecuteMockupTable(backendTask As CompiledBackendCallTask, state As ExecutionState) As TaskExecutionResult
        ' 🔍 Lista delle righe che matchano le condizioni
        Dim matchedRows As New List(Of CompiledMockRow)

        ' 🔍 Valuta ogni riga della mockTable
        For Each row In backendTask.MockRows
            Dim allMatch = True

            ' 🔍 Valuta ogni condizione della riga (AND)
            For Each cond In row.Conditions
                Dim currentValue As Object = Nothing

                If cond.IsLiteralConstant Then
                    ' Stesso campo `variable` del task: valore costante, non lookup in VariableStore (allineato a splitTaskVariableField lato TS)
                    currentValue = cond.VariableId
                Else
                    If state.VariableStore.ContainsKey(cond.VariableId) Then
                        currentValue = state.VariableStore(cond.VariableId)
                    Else
                        Console.WriteLine($"[BackendCallTaskExecutor] ⚠️ VariableStore does not contain varId '{cond.VariableId}'. Using Nothing for comparison.")
                    End If
                End If

                ' ❌ Se una condizione fallisce → la riga non matcha
                If Not ValuesEqual(currentValue, cond.ExpectedValue) Then
                    allMatch = False
                    Exit For
                End If
            Next

            ' 🔍 Se tutte le condizioni sono vere → riga matchata
            If allMatch Then
                matchedRows.Add(row)
            End If
        Next

        ' 🔍 Nessuna riga matchata → success senza modifiche
        If matchedRows.Count = 0 Then
            Console.WriteLine($"[BackendCallTaskExecutor] No matching row found. Task executed successfully but no mockTable row matched. No variables modified.")
            Return New TaskExecutionResult() With {
                .Success = True,
                .IsCompleted = True
            }
        End If

        ' ❌ Più di una riga matchata → errore deterministico
        If matchedRows.Count > 1 Then
            Dim ids = String.Join(", ", matchedRows.Select(Function(r) r.Id))
            Console.WriteLine($"[BackendCallTaskExecutor] ❌ ERROR: Multiple mockTable rows match ({ids}). MockTable must have unique input combinations.")
            Return New TaskExecutionResult() With {
                .Success = False,
                .Err = $"Multiple mockTable rows match ({ids}). MockTable must have unique input combinations.",
                .IsCompleted = False
            }
        End If

        ' ✅ Esattamente una riga matchata → applica gli assignment
        Dim matchedRow = matchedRows(0)
        Console.WriteLine($"[BackendCallTaskExecutor] ✅ Matched row: {matchedRow.Id}")

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
        Return New TaskExecutionResult() With {
            .Success = True,
            .IsCompleted = True
        }
    End Function

End Class
