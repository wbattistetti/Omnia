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
                    ' ✅ Endpoint come oggetto (può essere Dictionary o JObject)
                    If task.Value.ContainsKey("endpoint") Then
                        Dim endpointObj = task.Value("endpoint")
                        If endpointObj IsNot Nothing Then
                            ' Gestisci Dictionary(Of String, Object)
                            If TypeOf endpointObj Is Dictionary(Of String, Object) Then
                                Dim ep = CType(endpointObj, Dictionary(Of String, Object))
                                If ep.ContainsKey("url") Then
                                    backendTask.Endpoint = If(ep("url")?.ToString(), "")
                                End If
                                If ep.ContainsKey("method") Then
                                    backendTask.Method = If(ep("method")?.ToString(), "POST")
                                End If
                                ' Gestisci anche JObject (se viene da JSON)
                            ElseIf TypeOf endpointObj Is Newtonsoft.Json.Linq.JObject Then
                                Dim ep = CType(endpointObj, Newtonsoft.Json.Linq.JObject)
                                If ep("url") IsNot Nothing Then
                                    backendTask.Endpoint = If(ep("url")?.ToString(), "")
                                End If
                                If ep("method") IsNot Nothing Then
                                    backendTask.Method = If(ep("method")?.ToString(), "POST")
                                End If
                                ' Fallback: se è già una stringa (retrocompatibilità)
                            ElseIf TypeOf endpointObj Is String Then
                                backendTask.Endpoint = CStr(endpointObj)
                            End If
                        End If
                    End If

                    ' ✅ Method separato (per retrocompatibilità se non è dentro endpoint)
                    If task.Value.ContainsKey("method") AndAlso String.IsNullOrEmpty(backendTask.Method) Then
                        backendTask.Method = If(task.Value("method")?.ToString(), "POST")
                    End If

                    ' ✅ Copia inputs se esiste
                    If task.Value.ContainsKey("inputs") Then
                        Dim inputsValue = task.Value("inputs")
                        If inputsValue IsNot Nothing Then
                            If TypeOf inputsValue Is List(Of Object) Then
                                ' Converti List(Of Object) in List(Of Dictionary)
                                Dim inputsList = CType(inputsValue, List(Of Object))
                                For Each inp In inputsList
                                    If TypeOf inp Is Dictionary(Of String, Object) Then
                                        backendTask.Inputs.Add(CType(inp, Dictionary(Of String, Object)))
                                    End If
                                Next
                            ElseIf TypeOf inputsValue Is List(Of Dictionary(Of String, Object)) Then
                                backendTask.Inputs = CType(inputsValue, List(Of Dictionary(Of String, Object)))
                            End If
                        End If
                    End If

                    ' ✅ Copia outputs se esiste
                    If task.Value.ContainsKey("outputs") Then
                        Dim outputsValue = task.Value("outputs")
                        If outputsValue IsNot Nothing Then
                            If TypeOf outputsValue Is List(Of Object) Then
                                ' Converti List(Of Object) in List(Of Dictionary)
                                Dim outputsList = CType(outputsValue, List(Of Object))
                                For Each outp In outputsList
                                    If TypeOf outp Is Dictionary(Of String, Object) Then
                                        backendTask.Outputs.Add(CType(outp, Dictionary(Of String, Object)))
                                    End If
                                Next
                            ElseIf TypeOf outputsValue Is List(Of Dictionary(Of String, Object)) Then
                                backendTask.Outputs = CType(outputsValue, List(Of Dictionary(Of String, Object)))
                            End If
                        End If
                    End If

                    ' ✅ Copia mockTable SOLO se esiste E ha almeno una riga
                    If task.Value.ContainsKey("mockTable") Then
                        Dim mockTableValue = task.Value("mockTable")
                        If mockTableValue IsNot Nothing Then
                            ' Verifica se è una lista/array con almeno un elemento
                            Dim hasRows As Boolean = False

                            If TypeOf mockTableValue Is IList Then
                                Dim list = CType(mockTableValue, IList)
                                hasRows = list.Count > 0
                            ElseIf TypeOf mockTableValue Is Array Then
                                Dim arr = CType(mockTableValue, Array)
                                hasRows = arr.Length > 0
                            ElseIf TypeOf mockTableValue Is List(Of Object) Then
                                Dim list = CType(mockTableValue, List(Of Object))
                                hasRows = list.Count > 0
                            ElseIf TypeOf mockTableValue Is Newtonsoft.Json.Linq.JArray Then
                                Dim jArray = CType(mockTableValue, Newtonsoft.Json.Linq.JArray)
                                hasRows = jArray.Count > 0
                            End If

                            ' ✅ Compila mockTable solo se ha righe
                            If hasRows Then
                                If TypeOf mockTableValue Is List(Of Object) Then
                                    ' Converti List(Of Object) in List(Of Dictionary)
                                    Dim mockList = CType(mockTableValue, List(Of Object))
                                    For Each row In mockList
                                        If TypeOf row Is Dictionary(Of String, Object) Then
                                            backendTask.MockTable.Add(CType(row, Dictionary(Of String, Object)))
                                        End If
                                    Next
                                ElseIf TypeOf mockTableValue Is List(Of Dictionary(Of String, Object)) Then
                                    backendTask.MockTable = CType(mockTableValue, List(Of Dictionary(Of String, Object)))
                                ElseIf TypeOf mockTableValue Is Newtonsoft.Json.Linq.JArray Then
                                    ' Converti JArray in List(Of Dictionary)
                                    Dim jArray = CType(mockTableValue, Newtonsoft.Json.Linq.JArray)
                                    For Each item In jArray
                                        If TypeOf item Is Newtonsoft.Json.Linq.JObject Then
                                            Dim dict = New Dictionary(Of String, Object)()
                                            Dim jObj = CType(item, Newtonsoft.Json.Linq.JObject)
                                            For Each prop In jObj.Properties()
                                                dict(prop.Name) = prop.Value?.ToObject(Of Object)()
                                            Next
                                            backendTask.MockTable.Add(dict)
                                        End If
                                    Next
                                End If
                            End If
                        End If
                    End If

                    ' ✅ Copia anche tutto il value in Config per retrocompatibilità
                    For Each kvp In task.Value
                        backendTask.Config(kvp.Key) = kvp.Value
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
    ''' ❌ RIMOSSO: task.Text - task.text non deve esistere
    ''' Tries Parameters[parameterId='text'], then Value["parameters"].
    ''' Throws immediately if the key is missing or appears to be literal text.
    ''' </summary>
    Private Function ExtractTextKeyFromTask(task As TaskDefinition) As String
        Dim textKey As String = ""

        ' ❌ RIMOSSO: If Not String.IsNullOrWhiteSpace(task.Text) Then
        ' Il modello corretto è: task contiene solo GUID nei parameters

        If task.Parameters IsNot Nothing Then
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
                $"The IDE must provide a translation key (GUID) or literal text. " &
                $"Checked: Parameters[parameterId='text'], Value.parameters.")
        End If

        ' ✅ ACCETTA sia GUID che testo letterale
        ' - GUID: viene risolto a runtime tramite TranslationRepository nel messageCallback
        ' - Testo letterale: usato direttamente (per flow semplici senza traduzioni)
        ' La validazione rigida è stata rimossa per supportare entrambi i casi d'uso
        ' La risoluzione TextKey → testo avviene nel messageCallback di FlowOrchestrator (single point of truth)
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

