' GoldenTestHelper.vb
' Helper per confrontare output del motore V1 e Serverless Engine
' Struttura per golden test manuale

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Collections.Generic

''' <summary>
''' Helper per confrontare output del motore V1 e Serverless Engine
'''
''' UTILITÀ:
''' - Confronta output strutturale (non implementazione)
''' - Utile per golden test manuale
''' - Verifica che entrambi i motori producano lo stesso risultato
'''
''' NOTA:
''' Questo è solo la struttura. L'implementazione completa richiede:
''' - Eseguire lo stesso TaskInstance con entrambi i motori
''' - Salvare gli output (messaggi, stati finali, ecc.)
''' - Confrontare manualmente o con script
''' </summary>
Public Class GoldenTestHelper
    ''' <summary>
    ''' Risultato di un'esecuzione per confronto
    ''' </summary>
    Public Class ExecutionResult
        ''' <summary>
        ''' Lista dei messaggi emessi durante l'esecuzione
        ''' </summary>
        Public Property Messages As New List(Of String)()

        ''' <summary>
        ''' Stato finale di tutti i task nodes
        ''' Dictionary: NodeId -> DialogueState
        ''' </summary>
        Public Property FinalStates As New Dictionary(Of String, DialogueState)()

        ''' <summary>
        ''' Valori finali di tutti i task nodes
        ''' Dictionary: NodeId -> Value
        ''' </summary>
        Public Property FinalValues As New Dictionary(Of String, Object)()

        ''' <summary>
        ''' Contatori escalation finali
        ''' Dictionary: DialogueState -> Counter
        ''' </summary>
        Public Property FinalCounters As New Dictionary(Of DialogueState, Integer)()

        ''' <summary>
        ''' Indica se l'esecuzione è completata
        ''' </summary>
        Public Property IsCompleted As Boolean = False

        ''' <summary>
        ''' Numero di iterazioni eseguite
        ''' </summary>
        Public Property IterationCount As Integer = 0
    End Class

    ''' <summary>
    ''' Esegue un TaskInstance con il motore V1 e salva il risultato
    ''' </summary>
    ''' <param name="taskInstance">Istanza del task da eseguire</param>
    ''' <returns>Risultato dell'esecuzione</returns>
    Public Shared Function ExecuteWithV1(taskInstance As TaskInstance) As ExecutionResult
        Dim result As New ExecutionResult()
        Dim messages As New List(Of String)()

        ' Crea motore V1
        Dim engine As New Motore()

        ' Collega handler per catturare messaggi
        AddHandler engine.MessageToShow, Sub(sender, e)
                                              messages.Add(e.Message)
                                          End Sub

        ' Esegui task
        engine.ExecuteTask(taskInstance)

        ' Salva risultati
        result.Messages = messages
        result.IsCompleted = True

        ' Salva stati finali
        For Each taskNode As TaskNode In taskInstance.TaskList
            result.FinalStates(taskNode.Id) = taskNode.State
            result.FinalValues(taskNode.Id) = taskNode.Value

            ' Salva anche subTasks
            If taskNode.SubTasks IsNot Nothing Then
                For Each subTask As TaskNode In taskNode.SubTasks
                    result.FinalStates(subTask.Id) = subTask.State
                    result.FinalValues(subTask.Id) = subTask.Value
                Next
            End If
        Next

        Return result
    End Function

    ''' <summary>
    ''' Esegue un TaskInstance con il Serverless Engine e salva il risultato
    ''' </summary>
    ''' <param name="taskInstance">Istanza del task da eseguire</param>
    ''' <returns>Risultato dell'esecuzione</returns>
    Public Shared Function ExecuteWithServerless(taskInstance As TaskInstance) As ExecutionResult
        Dim result As New ExecutionResult()
        Dim messages As New List(Of String)()

        ' Crea motore Serverless (usando Facade per compatibilità)
        Dim facade As New ServerlessEngineFacade()

        ' Collega handler per catturare messaggi
        AddHandler facade.MessageToShow, Sub(sender, e)
                                             messages.Add(e.Message)
                                         End Sub

        ' Esegui task
        facade.ExecuteTask(taskInstance)

        ' Salva risultati
        result.Messages = messages
        result.IsCompleted = True

        ' Salva stati finali
        For Each taskNode As TaskNode In taskInstance.TaskList
            result.FinalStates(taskNode.Id) = taskNode.State
            result.FinalValues(taskNode.Id) = taskNode.Value

            ' Salva anche subTasks
            If taskNode.SubTasks IsNot Nothing Then
                For Each subTask As TaskNode In taskNode.SubTasks
                    result.FinalStates(subTask.Id) = subTask.State
                    result.FinalValues(subTask.Id) = subTask.Value
                Next
            End If
        Next

        Return result
    End Function

    ''' <summary>
    ''' Confronta due ExecutionResult e restituisce le differenze
    ''' </summary>
    ''' <param name="v1Result">Risultato del motore V1</param>
    ''' <param name="serverlessResult">Risultato del Serverless Engine</param>
    ''' <returns>Lista di differenze (stringhe descrittive)</returns>
    Public Shared Function CompareResults(v1Result As ExecutionResult, serverlessResult As ExecutionResult) As List(Of String)
        Dim differences As New List(Of String)()

        ' Confronta numero di messaggi
        If v1Result.Messages.Count <> serverlessResult.Messages.Count Then
            differences.Add($"Messages count differs: V1={v1Result.Messages.Count}, Serverless={serverlessResult.Messages.Count}")
        Else
            ' Confronta contenuto dei messaggi
            For i As Integer = 0 To v1Result.Messages.Count - 1
                If v1Result.Messages(i) <> serverlessResult.Messages(i) Then
                    differences.Add($"Message[{i}] differs: V1='{v1Result.Messages(i)}', Serverless='{serverlessResult.Messages(i)}'")
                End If
            Next
        End If

        ' Confronta stati finali
        For Each kvp As KeyValuePair(Of String, DialogueState) In v1Result.FinalStates
            If Not serverlessResult.FinalStates.ContainsKey(kvp.Key) Then
                differences.Add($"State missing in Serverless: NodeId={kvp.Key}, V1State={kvp.Value}")
            ElseIf serverlessResult.FinalStates(kvp.Key) <> kvp.Value Then
                differences.Add($"State differs for NodeId={kvp.Key}: V1={kvp.Value}, Serverless={serverlessResult.FinalStates(kvp.Key)}")
            End If
        Next

        ' Verifica stati extra in Serverless
        For Each kvp As KeyValuePair(Of String, DialogueState) In serverlessResult.FinalStates
            If Not v1Result.FinalStates.ContainsKey(kvp.Key) Then
                differences.Add($"State extra in Serverless: NodeId={kvp.Key}, ServerlessState={kvp.Value}")
            End If
        Next

        ' Confronta valori finali (solo se presenti)
        For Each kvp As KeyValuePair(Of String, Object) In v1Result.FinalValues
            If Not serverlessResult.FinalValues.ContainsKey(kvp.Key) Then
                differences.Add($"Value missing in Serverless: NodeId={kvp.Key}, V1Value={kvp.Value}")
            ElseIf Not Object.Equals(kvp.Value, serverlessResult.FinalValues(kvp.Key)) Then
                differences.Add($"Value differs for NodeId={kvp.Key}: V1={kvp.Value}, Serverless={serverlessResult.FinalValues(kvp.Key)}")
            End If
        Next

        ' Verifica valori extra in Serverless
        For Each kvp As KeyValuePair(Of String, Object) In serverlessResult.FinalValues
            If Not v1Result.FinalValues.ContainsKey(kvp.Key) Then
                differences.Add($"Value extra in Serverless: NodeId={kvp.Key}, ServerlessValue={kvp.Value}")
            End If
        Next

        ' Confronta IsCompleted
        If v1Result.IsCompleted <> serverlessResult.IsCompleted Then
            differences.Add($"IsCompleted differs: V1={v1Result.IsCompleted}, Serverless={serverlessResult.IsCompleted}")
        End If

        Return differences
    End Function

    ''' <summary>
    ''' Esegue un golden test completo: esegue con entrambi i motori e confronta i risultati
    ''' </summary>
    ''' <param name="taskInstance">Istanza del task da testare</param>
    ''' <returns>True se i risultati sono identici, False altrimenti</returns>
    Public Shared Function RunGoldenTest(taskInstance As TaskInstance) As Boolean
        Console.WriteLine("[GoldenTest] ═══════════════════════════════════════════════════════")
        Console.WriteLine("[GoldenTest] 🧪 Starting Golden Test")
        Console.WriteLine("[GoldenTest] ═══════════════════════════════════════════════════════")

        ' Esegui con V1
        Console.WriteLine("[GoldenTest] ▶️ Executing with V1 Engine...")
        Dim v1Result = ExecuteWithV1(taskInstance)
        Console.WriteLine($"[GoldenTest] ✅ V1 completed: Messages={v1Result.Messages.Count}, States={v1Result.FinalStates.Count}")

        ' Reset task instance per esecuzione pulita
        taskInstance.Reset()

        ' Esegui con Serverless
        Console.WriteLine("[GoldenTest] ▶️ Executing with Serverless Engine...")
        Dim serverlessResult = ExecuteWithServerless(taskInstance)
        Console.WriteLine($"[GoldenTest] ✅ Serverless completed: Messages={serverlessResult.Messages.Count}, States={serverlessResult.FinalStates.Count}")

        ' Confronta risultati
        Console.WriteLine("[GoldenTest] 🔍 Comparing results...")
        Dim differences = CompareResults(v1Result, serverlessResult)

        If differences.Count = 0 Then
            Console.WriteLine("[GoldenTest] ✅ GOLDEN TEST PASSED: Results are identical!")
            Console.WriteLine("[GoldenTest] ═══════════════════════════════════════════════════════")
            Return True
        Else
            Console.WriteLine($"[GoldenTest] ❌ GOLDEN TEST FAILED: Found {differences.Count} differences:")
            For Each diff As String In differences
                Console.WriteLine($"[GoldenTest]   - {diff}")
            Next
            Console.WriteLine("[GoldenTest] ═══════════════════════════════════════════════════════")
            Return False
        End If
    End Function
End Class
