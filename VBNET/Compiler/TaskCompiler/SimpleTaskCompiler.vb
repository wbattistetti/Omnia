Option Strict On
Option Explicit On
Imports TaskEngine
Imports Compiler.DTO.IDE

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

    Public Overrides Function Compile(task As TaskDefinition, taskId As String, allTemplates As List(Of TaskDefinition)) As CompiledTask
        Dim compiledTask As CompiledTask

        Select Case _taskType
            Case TaskTypes.SayMessage
                ' ✅ Compila SayMessage come CompiledSayMessageTask
                ' L'orchestrator gestisce già CompiledSayMessageTask tramite TaskExecutor
                Dim sayMessageTask As New CompiledSayMessageTask()
                sayMessageTask.TextKey = ExtractTextKeyFromTask(task)
                compiledTask = sayMessageTask

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

    ''' <summary>
    ''' Extracts the TextKey (translation GUID) from a SayMessage task.
    ''' Tries task.Text, then Parameters[parameterId='text'], then Value["parameters"].
    ''' Throws immediately if the key is missing or appears to be literal text.
    ''' </summary>
    Private Function ExtractTextKeyFromTask(task As TaskDefinition) As String
        Dim textKey As String = ""

        If Not String.IsNullOrWhiteSpace(task.Text) Then
            textKey = task.Text.Trim()

        ElseIf task.Parameters IsNot Nothing Then
            Dim textParams = task.Parameters.Where(Function(p) p.ParameterId = "text").ToList()
            If textParams.Count = 0 Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{task.Id}': no parameter with ParameterId='text'. " &
                    $"The 'text' parameter is mandatory.")
            End If
            If textParams.Count > 1 Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{task.Id}': {textParams.Count} parameters with ParameterId='text'. " &
                    $"ParameterId must be unique.")
            End If
            If String.IsNullOrWhiteSpace(textParams.Single().Value) Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{task.Id}': parameter 'text' has an empty value. TextKey cannot be empty.")
            End If
            textKey = textParams.Single().Value.Trim()

        ElseIf task.Value IsNot Nothing AndAlso task.Value.ContainsKey("parameters") Then
            Dim parameters = task.Value("parameters")
            If TypeOf parameters Is List(Of Object) Then
                Dim paramsList = CType(parameters, List(Of Object))
                Dim textParams = paramsList _
                    .Where(Function(p)
                               If Not TypeOf p Is Dictionary(Of String, Object) Then Return False
                               Dim d = CType(p, Dictionary(Of String, Object))
                               Return d.ContainsKey("parameterId") AndAlso d("parameterId")?.ToString() = "text"
                           End Function) _
                    .ToList()
                If textParams.Count = 0 Then
                    Throw New InvalidOperationException(
                        $"SayMessage task '{task.Id}': no parameter with ParameterId='text' in Value.parameters.")
                End If
                If textParams.Count > 1 Then
                    Throw New InvalidOperationException(
                        $"SayMessage task '{task.Id}': {textParams.Count} parameters with ParameterId='text' in Value.parameters.")
                End If
                Dim textParam = CType(textParams.Single(), Dictionary(Of String, Object))
                Dim textValue = textParam("value")?.ToString()
                If String.IsNullOrWhiteSpace(textValue) Then
                    Throw New InvalidOperationException(
                        $"SayMessage task '{task.Id}': parameter 'text' has an empty value in Value.parameters.")
                End If
                textKey = textValue.Trim()
            End If
        End If

        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New InvalidOperationException(
                $"SayMessage task '{task.Id}': no TextKey found. " &
                $"The IDE must provide a translation key (GUID), not literal text. " &
                $"Checked: task.Text, Parameters[parameterId='text'], Value.parameters.")
        End If

        ' ✅ Validazione: TextKey deve essere un GUID (non testo letterale)
        ' Nota: IsGuid è definito in TaskAssembler, ma per semplicità facciamo una validazione base
        If textKey.Contains(" ") AndAlso Not IsGuid(textKey) Then
            Throw New InvalidOperationException(
                $"SayMessage task '{task.Id}': TextKey '{textKey}' looks like literal text. " &
                $"Only translation keys (GUIDs) are accepted — not raw text strings.")
        End If

        Return textKey
    End Function

    ''' <summary>
    ''' Helper per verificare se una stringa è un GUID valido
    ''' </summary>
    Private Function IsGuid(value As String) As Boolean
        If String.IsNullOrWhiteSpace(value) Then
            Return False
        End If
        Try
            Dim guid As New Guid(value)
            Return True
        Catch
            Return False
        End Try
    End Function
End Class

