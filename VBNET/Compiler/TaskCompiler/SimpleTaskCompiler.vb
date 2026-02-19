Option Strict On
Option Explicit On
Imports TaskEngine

''' <summary>
''' Compiler per task semplici (SayMessage, ClassifyProblem, BackendCall, CloseSession, Transfer)
''' Gestisce tutti i tipi di task con logica semplice
''' </summary>
Public Class SimpleTaskCompiler
    Inherits TaskCompilerBase

    Private ReadOnly _taskType As TaskTypes

    Public Sub New(taskType As TaskTypes)
        _taskType = taskType
    End Sub

    Public Overrides Function Compile(task As Task, taskId As String, allTemplates As List(Of Task)) As CompiledTask
        Dim compiledTask As CompiledTask

        Select Case _taskType
            Case TaskTypes.SayMessage
                ' ❌ ERRORE BLOCCANTE: SayMessage non è supportato nel modello rigoroso
                ' SayMessage deve usare MessageTask con TextKey, non testo letterale
                Throw New InvalidOperationException($"SayMessage task type is not supported in the rigorous model. Use UtteranceInterpretation with MessageTask and TextKey instead.")

            Case TaskTypes.ClassifyProblem
                Dim classifyTask As New CompiledClassifyProblemTask()
                ' Estrai intents da value
                If task.Value IsNot Nothing AndAlso task.Value.ContainsKey("intents") Then
                    Dim intentsValue = task.Value("intents")
                    If TypeOf intentsValue Is List(Of String) Then
                        classifyTask.Intents = CType(intentsValue, List(Of String))
                    ElseIf TypeOf intentsValue Is String() Then
                        classifyTask.Intents = New List(Of String)(CType(intentsValue, String()))
                    End If
                End If
                compiledTask = classifyTask

            Case TaskTypes.BackendCall
                Dim backendTask As New CompiledBackendCallTask()
                If task.Value IsNot Nothing Then
                    If task.Value.ContainsKey("endpoint") Then
                        backendTask.Endpoint = If(task.Value("endpoint")?.ToString(), "")
                    End If
                    If task.Value.ContainsKey("method") Then
                        backendTask.Method = If(task.Value("method")?.ToString(), "POST")
                    End If
                    ' Copia tutto il value come payload
                    For Each kvp In task.Value
                        backendTask.Payload(kvp.Key) = kvp.Value
                    Next
                End If
                compiledTask = backendTask

            Case TaskTypes.CloseSession
                compiledTask = New CompiledCloseSessionTask()

            Case TaskTypes.Transfer
                Dim transferTask As New CompiledTransferTask()
                If task.Value IsNot Nothing AndAlso task.Value.ContainsKey("target") Then
                    transferTask.Target = If(task.Value("target")?.ToString(), "")
                End If
                compiledTask = transferTask

            Case Else
                ' ❌ ERRORE BLOCCANTE: tipo task sconosciuto, nessun fallback
                Throw New InvalidOperationException($"Unknown TaskType {_taskType}. The compiler cannot create a fallback task. Every task must have a valid, known type.")
        End Select

        ' Popola campi comuni
        PopulateCommonFields(compiledTask, taskId)

        Return compiledTask
    End Function
End Class

