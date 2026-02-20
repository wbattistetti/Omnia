' GoldenTestHelper.vb
' Helper for comparing output from the new Motore vs ServerlessEngineFacade.

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Collections.Generic

''' <summary>
''' Utility for golden tests: runs the same TaskUtterance through two engines
''' and compares messages and final states.
''' </summary>
Public Class GoldenTestHelper
    ''' <summary>Snapshot of one engine run.</summary>
    Public Class ExecutionResult
        Public Property Messages As New List(Of String)()
        Public Property FinalStates As New Dictionary(Of String, DialogueState)()
        Public Property FinalValues As New Dictionary(Of String, Object)()
        Public Property FinalCounters As New Dictionary(Of DialogueState, Integer)()
        Public Property IsCompleted As Boolean = False
        Public Property IterationCount As Integer = 0
    End Class

    ' -------------------------------------------------------------------------
    ' Execute helpers
    ' -------------------------------------------------------------------------

    ''' <summary>Runs the task with the primary Motore and captures results.</summary>
    Public Shared Function ExecuteWithV1(taskUtterance As TaskUtterance) As ExecutionResult
        Dim result As New ExecutionResult()
        Dim messages As New List(Of String)()

        Dim engine As New Motore()
        AddHandler engine.MessageToShow, Sub(sender, e) messages.Add(e.Message)

        ' Run until waiting for input or completed.
        Dim turnResult = engine.ExecuteTurn(taskUtterance)
        result.IsCompleted = (turnResult.Status = TurnStatus.Completed)
        result.Messages = messages

        CollectStates(taskUtterance, result)
        Return result
    End Function

    ''' <summary>Runs the task with the ServerlessEngineFacade and captures results.</summary>
    Public Shared Function ExecuteWithServerless(taskUtterance As TaskUtterance) As ExecutionResult
        Dim result As New ExecutionResult()
        Dim messages As New List(Of String)()

        Dim facade As New ServerlessEngineFacade()
        AddHandler facade.MessageToShow, Sub(sender, e) messages.Add(e.Message)

        facade.ExecuteTask(taskUtterance)

        result.IsCompleted = True
        result.Messages = messages

        CollectStates(taskUtterance, result)
        Return result
    End Function

    ' -------------------------------------------------------------------------
    ' Comparison
    ' -------------------------------------------------------------------------

    ''' <summary>Returns a list of human-readable differences between two results.</summary>
    Public Shared Function CompareResults(v1Result As ExecutionResult,
                                          serverlessResult As ExecutionResult) As List(Of String)
        Dim differences As New List(Of String)()

        ' Messages
        If v1Result.Messages.Count <> serverlessResult.Messages.Count Then
            differences.Add($"Messages count differs: V1={v1Result.Messages.Count}, Serverless={serverlessResult.Messages.Count}")
        Else
            For i As Integer = 0 To v1Result.Messages.Count - 1
                If v1Result.Messages(i) <> serverlessResult.Messages(i) Then
                    differences.Add($"Message[{i}] differs: V1='{v1Result.Messages(i)}', Serverless='{serverlessResult.Messages(i)}'")
                End If
            Next
        End If

        ' States
        For Each kvp In v1Result.FinalStates
            If Not serverlessResult.FinalStates.ContainsKey(kvp.Key) Then
                differences.Add($"State missing in Serverless: Id={kvp.Key}, V1State={kvp.Value}")
            ElseIf serverlessResult.FinalStates(kvp.Key) <> kvp.Value Then
                differences.Add($"State differs for Id={kvp.Key}: V1={kvp.Value}, Serverless={serverlessResult.FinalStates(kvp.Key)}")
            End If
        Next
        For Each kvp In serverlessResult.FinalStates
            If Not v1Result.FinalStates.ContainsKey(kvp.Key) Then
                differences.Add($"State extra in Serverless: Id={kvp.Key}, ServerlessState={kvp.Value}")
            End If
        Next

        ' Values
        For Each kvp In v1Result.FinalValues
            If Not serverlessResult.FinalValues.ContainsKey(kvp.Key) Then
                differences.Add($"Value missing in Serverless: Id={kvp.Key}, V1Value={kvp.Value}")
            ElseIf Not Object.Equals(kvp.Value, serverlessResult.FinalValues(kvp.Key)) Then
                differences.Add($"Value differs for Id={kvp.Key}: V1={kvp.Value}, Serverless={serverlessResult.FinalValues(kvp.Key)}")
            End If
        Next
        For Each kvp In serverlessResult.FinalValues
            If Not v1Result.FinalValues.ContainsKey(kvp.Key) Then
                differences.Add($"Value extra in Serverless: Id={kvp.Key}, ServerlessValue={kvp.Value}")
            End If
        Next

        If v1Result.IsCompleted <> serverlessResult.IsCompleted Then
            differences.Add($"IsCompleted differs: V1={v1Result.IsCompleted}, Serverless={serverlessResult.IsCompleted}")
        End If

        Return differences
    End Function

    ''' <summary>Runs both engines, compares results, prints summary.</summary>
    Public Shared Function RunGoldenTest(taskUtterance As TaskUtterance) As Boolean
        Console.WriteLine("[GoldenTest] ═══════════════════════════════════════")
        Console.WriteLine("[GoldenTest] Starting Golden Test")

        Dim v1Result = ExecuteWithV1(taskUtterance)
        Console.WriteLine($"[GoldenTest] V1 completed: Messages={v1Result.Messages.Count}, States={v1Result.FinalStates.Count}")

        taskUtterance.Reset()

        Dim serverlessResult = ExecuteWithServerless(taskUtterance)
        Console.WriteLine($"[GoldenTest] Serverless completed: Messages={serverlessResult.Messages.Count}, States={serverlessResult.FinalStates.Count}")

        Dim differences = CompareResults(v1Result, serverlessResult)
        If differences.Count = 0 Then
            Console.WriteLine("[GoldenTest] PASSED: Results are identical.")
            Console.WriteLine("[GoldenTest] ═══════════════════════════════════════")
            Return True
        Else
            Console.WriteLine($"[GoldenTest] FAILED: {differences.Count} difference(s):")
            For Each diff In differences
                Console.WriteLine($"[GoldenTest]   - {diff}")
            Next
            Console.WriteLine("[GoldenTest] ═══════════════════════════════════════")
            Return False
        End If
    End Function

    ' -------------------------------------------------------------------------
    ' Private helpers
    ' -------------------------------------------------------------------------

    Private Shared Sub CollectStates(task As TaskUtterance, result As ExecutionResult)
        If task Is Nothing Then Return
        result.FinalStates(task.Id) = task.State
        result.FinalValues(task.Id) = task.Value
        If task.EscalationCounters IsNot Nothing Then
            For Each kvp In task.EscalationCounters
                result.FinalCounters(kvp.Key) = kvp.Value
            Next
        End If
        If task.SubTasks IsNot Nothing Then
            For Each child In task.SubTasks
                CollectStates(child, result)
            Next
        End If
    End Sub
End Class
