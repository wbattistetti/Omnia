Option Strict On
Option Explicit On

Imports System.Collections.Generic
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

    Public Overrides Function Compile(task As Task, taskId As String, flow As Flow) As CompiledTask
        Dim compiledTask As CompiledTask

        Select Case _taskType
            Case TaskTypes.SayMessage
                Dim sayMessageTask As New CompiledTaskSayMessage()
                ' ✅ Estrai text da task.Text (nuovo modello) o da task.Value("text") (vecchio modello)
                Dim textValue As String = ""

                ' Prova prima task.Text (proprietà diretta, nuovo modello)
                If Not String.IsNullOrEmpty(task.Text) Then
                    textValue = task.Text
                ElseIf task.Value IsNot Nothing AndAlso task.Value.ContainsKey("text") Then
                    ' Fallback: vecchio modello con text in value
                    textValue = If(task.Value("text")?.ToString(), "")
                End If

                sayMessageTask.Text = If(String.IsNullOrEmpty(textValue), "", textValue)
                compiledTask = sayMessageTask

            Case TaskTypes.ClassifyProblem
                Dim classifyTask As New CompiledTaskClassifyProblem()
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
                Dim backendTask As New CompiledTaskBackendCall()
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
                compiledTask = New CompiledTaskCloseSession()

            Case TaskTypes.Transfer
                Dim transferTask As New CompiledTaskTransfer()
                If task.Value IsNot Nothing AndAlso task.Value.ContainsKey("target") Then
                    transferTask.Target = If(task.Value("target")?.ToString(), "")
                End If
                compiledTask = transferTask

            Case Else
                ' Fallback: crea SayMessage
                Console.WriteLine($"⚠️ [COMPILER][SimpleTaskCompiler] Unknown TaskType {_taskType}, creating SayMessage fallback")
                compiledTask = New CompiledTaskSayMessage()
        End Select

        ' Popola campi comuni
        PopulateCommonFields(compiledTask, taskId)

        Return compiledTask
    End Function
End Class

