Option Strict On
Option Explicit On
Imports TaskEngine
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports Newtonsoft.Json.Linq

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
                Dim labels As New List(Of String)

                If task.Value IsNot Nothing Then
                    ' Prefer semanticValues[].label (canonical model)
                    If task.Value.ContainsKey("semanticValues") Then
                        Dim svTok = task.Value("semanticValues")
                        Dim svArr = TryCast(svTok, JArray)
                        If svArr IsNot Nothing Then
                            For Each el In svArr
                                Dim jo = TryCast(el, JObject)
                                If jo IsNot Nothing Then
                                    Dim lab = jo("label")?.ToString()
                                    If Not String.IsNullOrWhiteSpace(lab) Then labels.Add(lab)
                                End If
                            Next
                        End If
                    End If

                    ' Legacy: value("intents") as strings or objects with name
                    If labels.Count = 0 AndAlso task.Value.ContainsKey("intents") Then
                        Dim intentsValue = task.Value("intents")
                        If TypeOf intentsValue Is List(Of String) Then
                            labels = CType(intentsValue, List(Of String))
                        ElseIf TypeOf intentsValue Is String() Then
                            labels = New List(Of String)(CType(intentsValue, String()))
                        Else
                            Dim legacyArr = TryCast(intentsValue, JArray)
                            If legacyArr IsNot Nothing Then
                                For Each el In legacyArr
                                    Dim jo = TryCast(el, JObject)
                                    If jo IsNot Nothing Then
                                        Dim n = jo("name")?.ToString()
                                        If Not String.IsNullOrWhiteSpace(n) Then labels.Add(n)
                                    End If
                                Next
                            End If
                        End If
                    End If
                End If

                If labels.Count > 0 Then classifyTask.Intents = labels
                compiledTask = classifyTask

            Case TaskTypes.BackendCall
                Dim backendTask As New CompiledBackendCallTask()

                ' ✅ Cast a BackendCallTaskDefinition per accedere alle proprietà type-safe
                Dim backendDef = TryCast(task, BackendCallTaskDefinition)

                If backendDef IsNot Nothing Then
                    ' ✅ DEBUG: Log per verificare la deserializzazione
                    Console.WriteLine($"[SimpleTaskCompiler] ✅ Task deserialized as BackendCallTaskDefinition: taskId={task.Id}")
                    Console.WriteLine($"[SimpleTaskCompiler] 🔍 Inputs count: {If(backendDef.Inputs IsNot Nothing, backendDef.Inputs.Count, 0)}")
                    Console.WriteLine($"[SimpleTaskCompiler] 🔍 Outputs count: {If(backendDef.Outputs IsNot Nothing, backendDef.Outputs.Count, 0)}")

                    ' ✅ Usa proprietà dirette (type-safe, no dictionary lookup)

                    ' ✅ Endpoint
                    If backendDef.Endpoint IsNot Nothing Then
                        If backendDef.Endpoint.ContainsKey("url") Then
                            backendTask.Endpoint = If(backendDef.Endpoint("url")?.ToString(), "")
                        End If
                        If backendDef.Endpoint.ContainsKey("method") Then
                            backendTask.Method = If(backendDef.Endpoint("method")?.ToString(), "POST")
                        End If
                    End If

                    ' ✅ Inputs
                    If backendDef.Inputs IsNot Nothing Then
                        ' ✅ DEBUG: Log ogni input per verificare internalName
                        For Each inputDef In backendDef.Inputs
                            Dim internalName = If(inputDef.ContainsKey("internalName"), inputDef("internalName")?.ToString(), "")
                            Dim varId = If(inputDef.ContainsKey("variable"), inputDef("variable")?.ToString(), "")
                            Console.WriteLine($"[SimpleTaskCompiler] 🔍 Input: internalName={If(String.IsNullOrEmpty(internalName), "EMPTY", internalName)}, varId={If(String.IsNullOrEmpty(varId), "EMPTY", varId)}")
                        Next
                        backendTask.Inputs = backendDef.Inputs
                    Else
                        Console.WriteLine($"[SimpleTaskCompiler] ⚠️ WARNING: backendDef.Inputs is Nothing")
                    End If

                    ' ✅ Outputs
                    If backendDef.Outputs IsNot Nothing Then
                        ' ✅ DEBUG: Log ogni output per verificare internalName
                        For Each outputDef In backendDef.Outputs
                            Dim internalName = If(outputDef.ContainsKey("internalName"), outputDef("internalName")?.ToString(), "")
                            Dim varId = If(outputDef.ContainsKey("variable"), outputDef("variable")?.ToString(), "")
                            Console.WriteLine($"[SimpleTaskCompiler] 🔍 Output: internalName={If(String.IsNullOrEmpty(internalName), "EMPTY", internalName)}, varId={If(String.IsNullOrEmpty(varId), "EMPTY", varId)}")
                        Next
                        backendTask.Outputs = backendDef.Outputs
                    Else
                        Console.WriteLine($"[SimpleTaskCompiler] ⚠️ WARNING: backendDef.Outputs is Nothing")
                    End If

                    ' ✅ MockTable (solo se ha righe)
                    If backendDef.MockTable IsNot Nothing AndAlso backendDef.MockTable.Count > 0 Then
                        backendTask.MockTable = backendDef.MockTable

                        ' ✅ NEW: Parse JSON → MockTableDesign
                        Dim mockTableDesign = ParseMockTableJson(backendDef.MockTable, backendDef.Inputs, backendDef.Outputs)

                        ' ✅ NEW: Build ColumnMapping
                        Dim columnMapping = BuildColumnMapping(backendDef.Inputs, backendDef.Outputs, task.Id)

                        ' ✅ NEW: Compile MockTableDesign + ColumnMapping → MockRows
                        Dim mockRows = CompileMockTable(mockTableDesign, columnMapping, task.Id)

                        ' ✅ Assign to compiled task
                        backendTask.MockTableDesign = mockTableDesign
                        backendTask.ColumnMapping = columnMapping
                        backendTask.MockRows = mockRows
                    End If

                    ' ✅ Copia anche tutto in Config per retrocompatibilità
                    If backendDef.Value IsNot Nothing Then
                        For Each kvp As KeyValuePair(Of String, Object) In backendDef.Value
                            backendTask.Config(kvp.Key) = kvp.Value
                        Next
                    End If
                Else
                    ' ❌ ERRORE BLOCCANTE: BackendCall task deve essere deserializzato come BackendCallTaskDefinition
                    Dim errorMsg = $"BackendCall task '{task.Id}' was not deserialized as BackendCallTaskDefinition. " &
                                   $"Actual type: {task.GetType().Name}. " &
                                   $"This indicates a deserialization error. " &
                                   $"The task must be properly deserialized using DeserializeTaskFromJson in CompilationHandlers."
                    Console.WriteLine($"[SimpleTaskCompiler] ❌ ERROR: {errorMsg}")
                    Throw New InvalidOperationException(errorMsg)
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

            Case TaskTypes.AIAgent
                Dim agentTask As New CompiledAIAgentTask()
                Dim agentDef = TryCast(task, AIAgentTaskDefinition)
                If agentDef IsNot Nothing Then
                    agentTask.Rules = If(agentDef.Rules, "")
                    agentTask.LlmEndpoint = If(agentDef.LlmEndpoint, "")
                Else
                    If task.Value IsNot Nothing Then
                        If task.Value.ContainsKey("rules") Then
                            agentTask.Rules = If(task.Value("rules")?.ToString(), "")
                        End If
                        If task.Value.ContainsKey("llmEndpoint") Then
                            agentTask.LlmEndpoint = If(task.Value("llmEndpoint")?.ToString(), "")
                        End If
                    End If
                End If
                compiledTask = agentTask

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

        TranslationKeyCanonical.ValidateTranslationKeyParameterOrThrow(textKey, $"SayMessage task '{task.Id}'")
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

    ''' <summary>
    ''' ✅ Parses JSON mockTable into MockTableDesign
    ''' Transforms Dictionary structure into clean table structure
    ''' ⚠️ FIX: Supports both Dictionary and JObject (Newtonsoft.Json deserialization)
    ''' </summary>
    Private Function ParseMockTableJson(
        mockTableJson As List(Of Dictionary(Of String, Object)),
        inputs As List(Of Dictionary(Of String, Object)),
        outputs As List(Of Dictionary(Of String, Object))
    ) As Compiler.DTO.IDE.MockTableDesign
        Dim design As New Compiler.DTO.IDE.MockTableDesign()

        ' ✅ Parse rows: transform Dictionary structure into RowDesign with Cells
        If mockTableJson IsNot Nothing Then
            Console.WriteLine($"[SimpleTaskCompiler] 🔍 Parsing {mockTableJson.Count} mockTable rows")

            For i = 0 To mockTableJson.Count - 1
                Dim rowJson = mockTableJson(i)
                Dim rowId = If(rowJson.ContainsKey("id"), rowJson("id")?.ToString(), $"row_{i}")
                Dim row As New Compiler.DTO.IDE.RowDesign(rowId)

                ' ✅ Parse inputs → Cells
                ' ⚠️ FIX: Support both Dictionary and JObject (Newtonsoft.Json)
                If rowJson.ContainsKey("inputs") Then
                    Dim inputsValue = rowJson("inputs")
                    Dim rowInputs As Dictionary(Of String, Object) = Nothing

                    If TypeOf inputsValue Is Dictionary(Of String, Object) Then
                        rowInputs = CType(inputsValue, Dictionary(Of String, Object))
                    ElseIf TypeOf inputsValue Is JObject Then
                        ' ✅ Convert JObject to Dictionary
                        Dim jobj = CType(inputsValue, JObject)
                        rowInputs = New Dictionary(Of String, Object)()
                        For Each prop In jobj.Properties()
                            Dim propValue As Object = Nothing
                            If prop.Value IsNot Nothing Then
                                If prop.Value.Type = JTokenType.Null Then
                                    propValue = Nothing
                                Else
                                    propValue = prop.Value.ToObject(Of Object)()
                                End If
                            End If
                            rowInputs(prop.Name) = propValue
                        Next
                    End If

                    If rowInputs IsNot Nothing Then
                        For Each kvp In rowInputs
                            If Not String.IsNullOrEmpty(kvp.Key) Then
                                row.Cells.Add(New Compiler.DTO.IDE.CellDesign(kvp.Key, kvp.Value))
                            End If
                        Next
                    End If
                End If

                ' ✅ Parse outputs → Cells
                ' ⚠️ FIX: Support both Dictionary and JObject (Newtonsoft.Json)
                If rowJson.ContainsKey("outputs") Then
                    Dim outputsValue = rowJson("outputs")
                    Dim rowOutputs As Dictionary(Of String, Object) = Nothing

                    If TypeOf outputsValue Is Dictionary(Of String, Object) Then
                        rowOutputs = CType(outputsValue, Dictionary(Of String, Object))
                    ElseIf TypeOf outputsValue Is JObject Then
                        ' ✅ Convert JObject to Dictionary
                        Dim jobj = CType(outputsValue, JObject)
                        rowOutputs = New Dictionary(Of String, Object)()
                        For Each prop In jobj.Properties()
                            Dim propValue As Object = Nothing
                            If prop.Value IsNot Nothing Then
                                If prop.Value.Type = JTokenType.Null Then
                                    propValue = Nothing
                                Else
                                    propValue = prop.Value.ToObject(Of Object)()
                                End If
                            End If
                            rowOutputs(prop.Name) = propValue
                        Next
                    End If

                    If rowOutputs IsNot Nothing Then
                        For Each kvp In rowOutputs
                            If Not String.IsNullOrEmpty(kvp.Key) Then
                                row.Cells.Add(New Compiler.DTO.IDE.CellDesign(kvp.Key, kvp.Value))
                            End If
                        Next
                    End If
                End If

                Console.WriteLine($"[SimpleTaskCompiler] ✅ Row {rowId}: {row.Cells.Count} cells created")
                design.Rows.Add(row)
            Next
        End If

        ' ✅ Update columns based on current signature
        design = UpdateMockTableColumns(design, inputs, outputs)

        Dim totalCells = design.Rows.Sum(Function(r) If(r.Cells IsNot Nothing, r.Cells.Count, 0))
        Console.WriteLine($"[SimpleTaskCompiler] ✅ Parsed {design.Rows.Count} rows with {totalCells} total cells")
        Return design
    End Function

    ''' <summary>
    ''' ✅ Updates MockTableDesign columns based on current backend signature
    ''' Rules:
    ''' A. If column exists in signature → IsActive = True (create or reactivate)
    ''' B. If column NOT in signature → IsActive = False (park, don't delete)
    ''' C. If parked column returns to signature → IsActive = True (reactivate)
    ''' </summary>
    Private Function UpdateMockTableColumns(
        mockTable As Compiler.DTO.IDE.MockTableDesign,
        inputs As List(Of Dictionary(Of String, Object)),
        outputs As List(Of Dictionary(Of String, Object))
    ) As Compiler.DTO.IDE.MockTableDesign
        If mockTable Is Nothing Then
            mockTable = New Compiler.DTO.IDE.MockTableDesign()
        End If

        ' ✅ Build sets of current signature column names
        Dim currentInputNames As New HashSet(Of String)()
        Dim currentOutputNames As New HashSet(Of String)()

        If inputs IsNot Nothing Then
            For Each inputDef In inputs
                Dim columnName = If(inputDef.ContainsKey("internalName"), inputDef("internalName")?.ToString(), "")
                If Not String.IsNullOrEmpty(columnName) Then
                    currentInputNames.Add(columnName)
                End If
            Next
        End If

        If outputs IsNot Nothing Then
            For Each outputDef In outputs
                Dim columnName = If(outputDef.ContainsKey("internalName"), outputDef("internalName")?.ToString(), "")
                If Not String.IsNullOrEmpty(columnName) Then
                    currentOutputNames.Add(columnName)
                End If
            Next
        End If

        ' ✅ Build dictionary of existing columns by name
        Dim existingColumns As New Dictionary(Of String, Compiler.DTO.IDE.ColumnDefinition)()
        If mockTable.Columns IsNot Nothing Then
            For Each col In mockTable.Columns
                existingColumns(col.Name) = col
            Next
        End If

        ' ✅ Process input columns
        For Each inputName In currentInputNames
            If existingColumns.ContainsKey(inputName) Then
                ' ✅ Column exists → reactivate it
                existingColumns(inputName).IsActive = True
                existingColumns(inputName).Type = Compiler.DTO.IDE.ColumnType.Input
            Else
                ' ✅ New column → create it as active
                Dim newCol As New Compiler.DTO.IDE.ColumnDefinition(inputName, Compiler.DTO.IDE.ColumnType.Input, True)
                existingColumns(inputName) = newCol
            End If
        Next

        ' ✅ Process output columns
        For Each outputName In currentOutputNames
            If existingColumns.ContainsKey(outputName) Then
                ' ✅ Column exists → reactivate it
                existingColumns(outputName).IsActive = True
                existingColumns(outputName).Type = Compiler.DTO.IDE.ColumnType.Output
            Else
                ' ✅ New column → create it as active
                Dim newCol As New Compiler.DTO.IDE.ColumnDefinition(outputName, Compiler.DTO.IDE.ColumnType.Output, True)
                existingColumns(outputName) = newCol
            End If
        Next

        ' ✅ Park columns that are no longer in signature
        ' First, collect all column names from existing rows (to preserve parked columns with data)
        Dim allColumnNamesInRows As New HashSet(Of String)()
        If mockTable.Rows IsNot Nothing Then
            For Each row In mockTable.Rows
                If row.Cells IsNot Nothing Then
                    For Each cell In row.Cells
                        If Not String.IsNullOrEmpty(cell.ColumnName) Then
                            allColumnNamesInRows.Add(cell.ColumnName)
                        End If
                    Next
                End If
            Next
        End If

        ' ✅ For columns in rows but not in signature → park them
        For Each colName In allColumnNamesInRows
            If Not currentInputNames.Contains(colName) AndAlso Not currentOutputNames.Contains(colName) Then
                If existingColumns.ContainsKey(colName) Then
                    ' ✅ Park existing column
                    existingColumns(colName).IsActive = False
                Else
                    ' ✅ Create parked column (preserve data from rows)
                    ' Try to infer type from existing cells (if all cells are in inputs or outputs)
                    Dim colType = Compiler.DTO.IDE.ColumnType.Input ' Default
                    ' Note: We can't reliably infer type from parked columns, so we use Input as default
                    Dim newCol As New Compiler.DTO.IDE.ColumnDefinition(colName, colType, False)
                    existingColumns(colName) = newCol
                End If
            End If
        Next

        ' ✅ Update mockTable.Columns
        mockTable.Columns = New List(Of Compiler.DTO.IDE.ColumnDefinition)(existingColumns.Values)

        Return mockTable
    End Function

    ''' <summary>
    ''' ✅ Builds ColumnMapping from Inputs/Outputs definitions
    ''' Maps columnName (internalName) → varId
    ''' </summary>
    Private Function BuildColumnMapping(
        inputs As List(Of Dictionary(Of String, Object)),
        outputs As List(Of Dictionary(Of String, Object)),
        taskId As String
    ) As Compiler.DTO.IDE.ColumnMapping
        Dim mapping As New Compiler.DTO.IDE.ColumnMapping()

        ' ✅ Build input mappings: columnName → varId
        If inputs IsNot Nothing Then
            For Each inputDef In inputs
                Dim columnName = If(inputDef.ContainsKey("internalName"), inputDef("internalName")?.ToString(), "")
                Dim varId = If(inputDef.ContainsKey("variable"), inputDef("variable")?.ToString(), "")

                If Not String.IsNullOrEmpty(columnName) AndAlso Not String.IsNullOrEmpty(varId) Then
                    mapping.InputMappings(columnName) = varId
                ElseIf Not String.IsNullOrEmpty(columnName) Then
                    Console.WriteLine($"[SimpleTaskCompiler] ⚠️ Input column '{columnName}' missing varId in task {taskId}")
                End If
            Next
        End If

        ' ✅ Build output mappings: columnName → varId
        If outputs IsNot Nothing Then
            For Each outputDef In outputs
                Dim columnName = If(outputDef.ContainsKey("internalName"), outputDef("internalName")?.ToString(), "")
                Dim varId = If(outputDef.ContainsKey("variable"), outputDef("variable")?.ToString(), "")

                If Not String.IsNullOrEmpty(columnName) AndAlso Not String.IsNullOrEmpty(varId) Then
                    mapping.OutputMappings(columnName) = varId
                ElseIf Not String.IsNullOrEmpty(columnName) Then
                    Console.WriteLine($"[SimpleTaskCompiler] ⚠️ Output column '{columnName}' missing varId in task {taskId}")
                End If
            Next
        End If

        Return mapping
    End Function

    ''' <summary>
    ''' ✅ Compiles MockTableDesign + ColumnMapping into CompiledMockRows
    ''' Linear compilation: loop on Rows and Cells, lookup in mapping
    ''' ⚠️ IMPORTANT: Only compiles ACTIVE columns (parked columns are skipped)
    ''' </summary>
    Private Function CompileMockTable(
        mockTable As Compiler.DTO.IDE.MockTableDesign,
        mapping As Compiler.DTO.IDE.ColumnMapping,
        taskId As String
    ) As List(Of CompiledMockRow)
        Dim compiled As New List(Of CompiledMockRow)()

        If mockTable Is Nothing OrElse mockTable.Rows Is Nothing OrElse mockTable.Rows.Count = 0 Then
            Return compiled
        End If

        ' ✅ Build dictionary of columns by name for fast lookup
        Dim columnsByName As New Dictionary(Of String, Compiler.DTO.IDE.ColumnDefinition)()
        If mockTable.Columns IsNot Nothing Then
            For Each col In mockTable.Columns
                columnsByName(col.Name) = col
            Next
        End If

        For Each row In mockTable.Rows
            Dim compiledRow As New CompiledMockRow(row.Id)

            ' ✅ Loop on cells: use mapping to find varId
            ' ⚠️ IMPORTANT: Only compile cells for ACTIVE columns
            For Each cell In row.Cells
                ' ✅ Check if column exists and is active
                If Not columnsByName.ContainsKey(cell.ColumnName) Then
                    Console.WriteLine($"[SimpleTaskCompiler] ⚠️ Row {row.Id}: column '{cell.ColumnName}' not found in Columns. Skipping.")
                    Continue For
                End If

                Dim col = columnsByName(cell.ColumnName)

                ' ✅ Skip parked columns (only compile active columns)
                If Not col.IsActive Then
                    Continue For
                End If

                ' ✅ Compile based on column type
                If col.Type = Compiler.DTO.IDE.ColumnType.Input Then
                    If mapping.InputMappings.ContainsKey(cell.ColumnName) Then
                        Dim varId = mapping.InputMappings(cell.ColumnName)
                        compiledRow.Conditions.Add(New CompiledMockCondition(varId, cell.Value))
                    Else
                        Console.WriteLine($"[SimpleTaskCompiler] ⚠️ Row {row.Id}: input column '{cell.ColumnName}' not mapped to any variable")
                    End If
                Else
                    If mapping.OutputMappings.ContainsKey(cell.ColumnName) Then
                        Dim varId = mapping.OutputMappings(cell.ColumnName)
                        compiledRow.Assignments.Add(New CompiledMockAssignment(varId, cell.Value))
                    Else
                        Console.WriteLine($"[SimpleTaskCompiler] ⚠️ Row {row.Id}: output column '{cell.ColumnName}' not mapped to any variable")
                    End If
                End If
            Next

            compiled.Add(compiledRow)
            Console.WriteLine($"[SimpleTaskCompiler] ✅ Compiled row {row.Id}: {compiledRow.Conditions.Count} conditions, {compiledRow.Assignments.Count} assignments")
        Next

        Console.WriteLine($"[SimpleTaskCompiler] ✅ Compiled {compiled.Count} mockTable rows for task {taskId} (only active columns)")
        Return compiled
    End Function
End Class

