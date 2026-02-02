Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

''' <summary>
''' TaskAssembler: compila strutture IDE (TaskTreeExpanded - AST montato) in strutture Runtime (Task ricorsivo)
''' Responsabilità:
''' - Mappare campi uno a uno
''' - Compilare tipi (DialogueStep IDE → DialogueStep Runtime)
''' - Convertire Constraints in ValidationConditions
''' - Costruire struttura ricorsiva Task → Task → Task
''' MODELLO RIGOROSO: Passa SOLO chiavi di traduzione, NON risolve testo
''' </summary>
Public Class TaskAssembler

    ''' <summary>
    ''' Verifica se una stringa è un GUID valido
    ''' </summary>
    Private Function IsGuid(value As String) As Boolean
        If String.IsNullOrEmpty(value) Then
            Return False
        End If
        ' GUID format: 8-4-4-4-12 hex digits
        Dim guidPattern As String = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        Return System.Text.RegularExpressions.Regex.IsMatch(value.ToLower(), guidPattern)
    End Function

    ''' <summary>
    ''' Compila TaskTreeExpanded (IDE - AST montato) in RuntimeTask ricorsivo (Runtime)
    ''' Restituisce il RuntimeTask root dell'albero ricorsivo
    ''' </summary>
    Public Function Compile(assembled As Compiler.TaskTreeExpanded) As RuntimeTask
        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "TaskTreeExpanded cannot be Nothing")
        End If

        ' ❌ RIMOSSO: translations - il compilatore NON deve più gestire traduzioni
        ' ✅ NUOVO MODELLO: Costruisci RuntimeTask root ricorsivo
        ' Se c'è un solo nodo, è il root; se ce ne sono più, creiamo un nodo aggregato
        Dim rootTask As RuntimeTask = Nothing

        If assembled.Nodes IsNot Nothing AndAlso assembled.Nodes.Count > 0 Then
            If assembled.Nodes.Count = 1 Then
                ' Un solo nodo: è il root
                Dim taskNode As Compiler.TaskNode = assembled.Nodes(0)
                rootTask = CompileNode(taskNode, Nothing)
                rootTask.Id = assembled.TaskInstanceId ' ✅ Usa TaskInstanceId del TaskTreeExpanded come ID del root
            Else
                ' Più nodi: crea un nodo aggregato root con subTasks
                rootTask = New RuntimeTask() With {
                    .Id = assembled.TaskInstanceId, ' ✅ Usa TaskInstanceId invece di Id
                    .Condition = Nothing,
                    .Steps = New List(Of TaskEngine.DialogueStep)(),
                    .Constraints = New List(Of ValidationCondition)(),
                    .NlpContract = Nothing,
                    .SubTasks = New List(Of RuntimeTask)() ' ✅ Necessario perché ci sono più nodi
                }
                ' Compila ogni nodo come subTask
                For Each taskNode As Compiler.TaskNode In assembled.Nodes
                    If taskNode IsNot Nothing Then
                        Dim subTask = CompileNode(taskNode, Nothing)
                        rootTask.SubTasks.Add(subTask)
                    End If
                Next
            End If
        Else
            ' Nessun nodo: crea un task vuoto
            rootTask = New RuntimeTask() With {
                .Id = assembled.TaskInstanceId, ' ✅ Usa TaskInstanceId invece di Id
                .Condition = Nothing,
                .Steps = New List(Of TaskEngine.DialogueStep)(),
                .Constraints = New List(Of ValidationCondition)(),
                .NlpContract = Nothing,
                .SubTasks = Nothing
            }
        End If

        Return rootTask
    End Function

    ''' <summary>
    ''' Compila TaskNode (IDE) in RuntimeTask (Runtime)
    ''' Costruisce struttura ricorsiva RuntimeTask → RuntimeTask → RuntimeTask
    ''' </summary>
    Private Function CompileNode(ideNode As Compiler.TaskNode, parentTask As RuntimeTask) As RuntimeTask
        ' ✅ Copia solo proprietà runtime essenziali:
        ' - Id: necessario per identificare il nodo
        ' - Name: usato per fallback regex hardcoded in Parser.vb
        ' - SubTasks: necessario per nodi compositi
        ' - Steps: necessario per i response del dialogo
        ' - State, Value, ParentData: gestiti a runtime
        ' - ValidationConditions: derivati da Constraints del template (TODO: implementare conversione)
        ' ❌ Rimosse proprietà design-time non usate a runtime:
        ' - Label: solo per UI
        ' - Type: non usato a runtime (se è constraint, va nei constraints)
        ' - Required: non è un campo del nodo, va nei constraints
        ' - Synonyms: legacy, non serve
        ' - TemplateId: riferimento esterno, non serve a runtime
        ' ✅ Constraints: devono essere convertiti in ValidationConditions (TODO: implementare)
        ' ✅ Crea RuntimeTask ricorsivo
        Dim task As New RuntimeTask() With {
            .Id = ideNode.Id,
            .Condition = Nothing, ' Condition viene dall'istanza, non dal template
            .Steps = New List(Of TaskEngine.DialogueStep)(),
            .Constraints = New List(Of ValidationCondition)(),
            .NlpContract = Nothing, ' Verrà caricato da DDTCompiler
            .SubTasks = Nothing ' ✅ Inizializzato solo se ci sono subTasks
        }

        If ideNode.Steps IsNot Nothing Then
            ' ✅ Log dettagliato: mostra tutti gli step prima della validazione
            Console.WriteLine($"[DEBUG] TaskAssembler.CompileNode: Node.Id={ideNode.Id}, ideNode.Steps.Count={ideNode.Steps.Count}")
            System.Diagnostics.Debug.WriteLine($"[DEBUG] TaskAssembler.CompileNode: Node.Id={ideNode.Id}, ideNode.Steps.Count={ideNode.Steps.Count}")

            For i = 0 To ideNode.Steps.Count - 1
                Dim ideStep = ideNode.Steps(i)
                Console.WriteLine($"[DEBUG]   Step[{i}]: ideStep.Type='{ideStep.Type}', ideStep.Escalations.Count={If(ideStep.Escalations IsNot Nothing, ideStep.Escalations.Count, 0)}")
                System.Diagnostics.Debug.WriteLine($"[DEBUG]   Step[{i}]: ideStep.Type='{ideStep.Type}'")
            Next

            ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
            Dim seenTypes As New HashSet(Of DialogueState)()
            For Each ideStep As Compiler.DialogueStep In ideNode.Steps
                Dim runtimeStep = CompileDialogueStep(ideStep)
                Console.WriteLine($"[DEBUG] Compiling step: ideStep.Type='{ideStep.Type}' -> runtimeStep.Type={runtimeStep.Type}")
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Compiling step: ideStep.Type='{ideStep.Type}' -> runtimeStep.Type={runtimeStep.Type}")

                If seenTypes.Contains(runtimeStep.Type) Then
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                    Console.WriteLine($"❌ [TaskAssembler.CompileNode] DUPLICATE STEP DETECTED")
                    Console.WriteLine($"   Node.Id: {ideNode.Id}")
                    Console.WriteLine($"   Duplicate Type: {runtimeStep.Type}")
                    Console.WriteLine($"   ideStep.Type (original): {ideStep.Type}")
                    Dim allStepTypes = ideNode.Steps.Select(Function(s) $"{s.Type}->{CompileStepType(s.Type)}").ToList()
                    Console.WriteLine($"   All step types (ide->runtime): {String.Join(", ", allStepTypes)}")
                    Console.WriteLine($"   Already seen types: {String.Join(", ", seenTypes.Select(Function(t) t.ToString()))}")
                    Console.WriteLine($"═══════════════════════════════════════════════════════════════")
                    Console.Out.Flush()
                    System.Diagnostics.Debug.WriteLine($"❌ [TaskAssembler.CompileNode] DUPLICATE STEP: Node.Id={ideNode.Id}, Type={runtimeStep.Type}")
                    Throw New InvalidOperationException($"Invalid task model: Node {ideNode.Id} has duplicate steps with Type={runtimeStep.Type}. Each Type must appear exactly once.")
                End If
                seenTypes.Add(runtimeStep.Type)
                task.Steps.Add(runtimeStep)
            Next
        End If

        If ideNode.Constraints IsNot Nothing AndAlso ideNode.Constraints.Count > 0 Then
            For Each constraintObj As Object In ideNode.Constraints
                Dim validationCondition = ConvertConstraintToValidationCondition(constraintObj)
                If validationCondition IsNot Nothing Then
                    task.Constraints.Add(validationCondition)
                End If
            Next
        End If

        ' ✅ DIAG: Verifica dataContract quando arriva a CompileNode
        Console.WriteLine($"[DIAG] TaskAssembler.CompileNode: ideNode.Id={ideNode.Id}, ideNode.DataContract IsNothing={ideNode.DataContract Is Nothing}")
        If ideNode.DataContract IsNot Nothing Then
            Console.WriteLine($"[DIAG] TaskAssembler.CompileNode: ideNode.DataContract type: {ideNode.DataContract.GetType().Name}")
            Try
                Dim dataContractJson = JsonConvert.SerializeObject(ideNode.DataContract)
                Console.WriteLine($"[DIAG] TaskAssembler.CompileNode: ideNode.DataContract JSON (first 200 chars): {dataContractJson.Substring(0, Math.Min(200, dataContractJson.Length))}")
            Catch ex As Exception
                Console.WriteLine($"[DIAG] TaskAssembler.CompileNode: ideNode.DataContract JSON serialization failed: {ex.Message}")
            End Try
        Else
            Console.WriteLine($"[DIAG] TaskAssembler.CompileNode: ideNode.DataContract is Nothing - checking if it should be present")
        End If

        ' ✅ Converti dataContract in CompiledNlpContract se presente
        If ideNode.DataContract IsNot Nothing Then
            Try
                Console.WriteLine($"[TaskAssembler] Compiling dataContract for node {ideNode.Id}")
                Dim baseContract = ConvertDataContractToNlpContract(ideNode.DataContract)
                If baseContract IsNot Nothing Then
                    task.NlpContract = CompiledNlpContract.Compile(baseContract)
                    If task.NlpContract.IsValid Then
                        Console.WriteLine($"[TaskAssembler] Successfully compiled NlpContract for node {ideNode.Id}, main regex compiled: {task.NlpContract.CompiledMainRegex IsNot Nothing}")
                    Else
                        Console.WriteLine($"[TaskAssembler] WARNING: NlpContract compiled with errors for node {ideNode.Id}: {String.Join(", ", task.NlpContract.ValidationErrors)}")
                        Throw New InvalidOperationException($"NlpContract compilation failed for node {ideNode.Id}: {String.Join(", ", task.NlpContract.ValidationErrors)}")
                    End If
                Else
                    Console.WriteLine($"[TaskAssembler] WARNING: Failed to convert dataContract to NLPContract for node {ideNode.Id}")
                End If
            Catch ex As Exception
                Console.WriteLine($"[TaskAssembler] ERROR: Failed to compile dataContract for node {ideNode.Id}: {ex.GetType().Name} - {ex.Message}")
                Console.WriteLine($"[TaskAssembler] ERROR: Stack trace: {ex.StackTrace}")
                Throw New InvalidOperationException($"Failed to compile dataContract for node {ideNode.Id}: {ex.Message}", ex)
            End Try
        Else
            Console.WriteLine($"[TaskAssembler] No dataContract found for node {ideNode.Id}, NlpContract will remain Nothing")
        End If

        ' Compila SubTasks (ricorsivo) - inizializza solo se ci sono subTasks
        If ideNode.SubTasks IsNot Nothing AndAlso ideNode.SubTasks.Count > 0 Then
            If task.SubTasks Is Nothing Then
                task.SubTasks = New List(Of RuntimeTask)()
            End If
            For Each subNode As Compiler.TaskNode In ideNode.SubTasks
                Dim subTask = CompileNode(subNode, task)
                task.SubTasks.Add(subTask)
            Next
        End If

        Return task
    End Function

    ''' <summary>
    ''' Converte un constraint (Object) in ValidationCondition
    ''' </summary>
    Private Function ConvertConstraintToValidationCondition(constraintObj As Object) As ValidationCondition
        If constraintObj Is Nothing Then
            Return Nothing
        End If

        Try
            ' Serializza e deserializza per convertire Object in ValidationCondition
            Dim constraintJson = JsonConvert.SerializeObject(constraintObj)
            Dim validationCondition = JsonConvert.DeserializeObject(Of ValidationCondition)(constraintJson)

            ' Se la deserializzazione fallisce, prova a costruire manualmente
            If validationCondition Is Nothing Then
                ' Prova a estrarre campi da Dictionary
                If TypeOf constraintObj Is Dictionary(Of String, Object) Then
                    Dim constraintDict = CType(constraintObj, Dictionary(Of String, Object))
                    Dim idValue As Object = Nothing
                    If constraintDict.ContainsKey("id") Then
                        idValue = constraintDict("id")
                    End If

                    Dim typeValue As Object = Nothing
                    If constraintDict.ContainsKey("type") Then
                        typeValue = constraintDict("type")
                    End If

                    Dim errorMessageValue As Object = Nothing
                    If constraintDict.ContainsKey("errorMessage") Then
                        errorMessageValue = constraintDict("errorMessage")
                    End If

                    validationCondition = New ValidationCondition() With {
                        .Id = If(idValue IsNot Nothing, idValue.ToString(), Guid.NewGuid().ToString()),
                        .Type = If(typeValue IsNot Nothing, typeValue.ToString(), "custom"),
                        .ErrorMessage = If(errorMessageValue IsNot Nothing, errorMessageValue.ToString(), Nothing),
                        .Parameters = New Dictionary(Of String, Object)()
                    }

                    ' Copia tutti gli altri campi come Parameters
                    For Each kvp In constraintDict
                        If kvp.Key <> "id" AndAlso kvp.Key <> "type" AndAlso kvp.Key <> "errorMessage" Then
                            validationCondition.Parameters(kvp.Key) = kvp.Value
                        End If
                    Next
                End If
            End If

            Return validationCondition
        Catch ex As Exception
            Console.WriteLine($"[COMPILER] ERROR: Failed to convert constraint to ValidationCondition: {ex.Message}")
            Return Nothing
        End Try
    End Function

    ''' <summary>
    ''' Compila DialogueStep (IDE) in DialogueStep (Runtime)
    ''' </summary>
    Private Function CompileDialogueStep(ideStep As Compiler.DialogueStep) As TaskEngine.DialogueStep
        Dim runtimeStep As New TaskEngine.DialogueStep() With {
            .Type = CompileStepType(ideStep.Type),
            .Escalations = New List(Of TaskEngine.Escalation)()
        }

        If ideStep.Escalations IsNot Nothing Then
            For Each ideEscalation As Compiler.Escalation In ideStep.Escalations
                Dim runtimeEscalation = CompileEscalation(ideEscalation)
                If runtimeEscalation IsNot Nothing Then
                    runtimeStep.Escalations.Add(runtimeEscalation)
                End If
            Next
        End If

        Return runtimeStep
    End Function

    ''' <summary>
    ''' Compila stringa step type in DialogueState enum
    ''' Il compilatore NON fa fallback: se il tipo è invalido, fallisce immediatamente.
    ''' Fallback comportamentali sono gestiti dal motore runtime, non dal compilatore.
    ''' </summary>
    Private Function CompileStepType(typeStr As String) As DialogueState
        If String.IsNullOrEmpty(typeStr) Then
            Throw New InvalidOperationException($"Step type cannot be null or empty. This indicates a structural error in the task model. Every DialogueStep must have a valid type.")
        End If

        Select Case typeStr.ToLower()
            Case "start"
                Return DialogueState.Start
            Case "nomatch"
                Return DialogueState.NoMatch
            Case "noinput"
                Return DialogueState.NoInput
            Case "confirmation"
                Return DialogueState.Confirmation
            Case "notconfirmed"
                Return DialogueState.NotConfirmed
            Case "success"
                Return DialogueState.Success
            Case "introduction"
                ' ✅ "introduction" è un alias valido per "start" nel modello IDE
                ' Usato per step introduttivi che si comportano come Start
                Return DialogueState.Start
            Case Else
                ' ❌ RIMOSSO FALLBACK: Il compilatore NON deve indovinare o correggere errori strutturali
                ' Se il tipo è sconosciuto, il modello è invalido e deve essere corretto a monte
                Throw New InvalidOperationException($"Unknown step type '{typeStr}'. Valid types are: start, noMatch, noInput, confirmation, notConfirmed, success, introduction. This indicates a structural error in the task model that must be fixed at the source.")
        End Select
    End Function

    ''' <summary>
    ''' Compila Escalation (IDE) in Escalation (Runtime)
    ''' </summary>
    Private Function CompileEscalation(ideEscalation As Compiler.Escalation) As TaskEngine.Escalation
        Dim runtimeEscalation As New TaskEngine.Escalation() With {
            .EscalationId = ideEscalation.EscalationId,
            .Tasks = New List(Of ITask)()
        }

        If ideEscalation.Tasks IsNot Nothing Then
            For Each ideTask As Compiler.Task In ideEscalation.Tasks
                Dim runtimeTask = CompileTask(ideTask)
                If runtimeTask IsNot Nothing Then
                    runtimeEscalation.Tasks.Add(runtimeTask)
                End If
            Next
        End If

        Return runtimeEscalation
    End Function

    ''' <summary>
    ''' Compila Task (IDE) in ITask (Runtime)
    ''' </summary>
    Private Function CompileTask(ideTask As Compiler.Task) As ITask
        If Not ideTask.Type.HasValue Then
            Console.WriteLine($"[COMPILER] ERROR: Task {ideTask.Id} has no Type")
            Return Nothing
        End If

        Dim typeValue = ideTask.Type.Value
        If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
            Console.WriteLine($"[COMPILER] ERROR: Task {ideTask.Id} has invalid Type: {typeValue}")
            Return Nothing
        End If

        Dim taskType = CType(typeValue, TaskTypes)

        Select Case taskType
            Case TaskTypes.SayMessage
                ' ✅ Estrai SOLO la chiave, NON risolvere
                Dim textKey As String = ""

                If Not String.IsNullOrWhiteSpace(ideTask.Text) Then
                    textKey = ideTask.Text.Trim()
                ElseIf ideTask.Parameters IsNot Nothing Then
                    Dim textParams = ideTask.Parameters.Where(Function(p) p.ParameterId = "text").ToList()
                    If textParams.Count = 0 Then
                        Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has no parameter with ParameterId='text'. The 'text' parameter is mandatory for MessageTask.")
                    ElseIf textParams.Count > 1 Then
                        Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has {textParams.Count} parameters with ParameterId='text'. Each parameter ID must be unique.")
                    End If
                    Dim textParam = textParams.Single()
                    If String.IsNullOrWhiteSpace(textParam.Value) Then
                        Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has parameter 'text' with empty value. TextKey cannot be empty.")
                    End If
                    textKey = textParam.Value.Trim()
                ElseIf ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
                    Dim parameters = ideTask.Value("parameters")
                    If TypeOf parameters Is List(Of Object) Then
                        Dim paramsList = CType(parameters, List(Of Object))
                        Dim textParams = paramsList.Where(Function(p) TypeOf p Is Dictionary(Of String, Object) AndAlso CType(p, Dictionary(Of String, Object)).ContainsKey("parameterId") AndAlso CType(p, Dictionary(Of String, Object))("parameterId")?.ToString() = "text").ToList()
                        If textParams.Count = 0 Then
                            Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has no parameter with ParameterId='text' in Value.parameters. The 'text' parameter is mandatory for MessageTask.")
                        ElseIf textParams.Count > 1 Then
                            Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has {textParams.Count} parameters with ParameterId='text' in Value.parameters. Each parameter ID must be unique.")
                        End If
                        Dim textParam = CType(textParams.Single(), Dictionary(Of String, Object))
                        Dim textValue = textParam("value")?.ToString()
                        If String.IsNullOrWhiteSpace(textValue) Then
                            Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has parameter 'text' with empty value in Value.parameters. TextKey cannot be empty.")
                        End If
                        textKey = textValue.Trim()
                    End If
                End If

                ' ❌ ERRORE DI COMPILAZIONE: TextKey obbligatorio
                If String.IsNullOrWhiteSpace(textKey) Then
                    Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has no TextKey. The IDE must provide a translation key (GUID or symbolic name), not literal text. TextKey is mandatory.")
                End If

                ' ✅ Verifica che non sia testo letterale (euristica: se contiene spazi e non è un GUID, probabilmente è testo)
                If Not IsGuid(textKey) AndAlso textKey.Contains(" ") Then
                    Throw New InvalidOperationException($"SayMessage task '{ideTask.Id}' has TextKey '{textKey}' which appears to be literal text. The IDE must provide only translation keys (GUID or symbolic names), not literal text.")
                End If

                ' ✅ Crea MessageTask con SOLO la chiave
                Return New MessageTask(textKey)
            Case TaskTypes.CloseSession
                Return New CloseSessionTask()
            Case TaskTypes.Transfer
                Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating TransferTask")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating TransferTask")
                Return New TransferTask()
            Case TaskTypes.UtteranceInterpretation
                Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: UtteranceInterpretation tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: UtteranceInterpretation tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.BackendCall
                Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: BackendCall tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: BackendCall tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.ClassifyProblem
                Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case Else
                Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Unknown TaskType '{taskType}', returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Unknown TaskType '{taskType}', returning Nothing")
                Return Nothing
        End Select
    End Function

    ''' <summary>
    ''' Compila DialogueStep in Response (per Introduction)
    ''' </summary>
    Private Function CompileDialogueStepToResponse(ideStep As Compiler.DialogueStep) As Response
        Dim response As New Response()

        ' Prendi la prima escalation del primo step
        If ideStep.Escalations IsNot Nothing AndAlso ideStep.Escalations.Count > 0 Then
            Dim firstEscalation = ideStep.Escalations(0)
            If firstEscalation.Tasks IsNot Nothing Then
                For Each ideTask As Compiler.Task In firstEscalation.Tasks
                    Dim runtimeTask = CompileTask(ideTask)
                    If runtimeTask IsNot Nothing Then
                        response.Tasks.Add(runtimeTask)
                    End If
                Next
            End If
        End If

        Return response
    End Function

    ''' <summary>
    ''' Calcola FullLabel per tutti i nodi (compile-time)
    ''' </summary>
    Private Sub CalculateFullLabels(instance As TaskInstance)
        If instance.TaskList IsNot Nothing Then
            For Each mainTask As TaskEngine.TaskNode In instance.TaskList
                CalculateFullLabelForNode(mainTask, "")
            Next
        End If
    End Sub

    ''' <summary>
    ''' Calcola FullLabel ricorsivamente per un nodo
    ''' </summary>
    Private Sub CalculateFullLabelForNode(node As TaskEngine.TaskNode, parentPath As String)
        Dim currentPath As String
        If String.IsNullOrEmpty(parentPath) Then
            currentPath = node.Id
        Else
            currentPath = $"{parentPath}.{node.Id}"
        End If

        node.FullLabel = currentPath

        ' Ricorsivo per subTasks
        If node.SubTasks IsNot Nothing Then
            For Each subNode As TaskEngine.TaskNode In node.SubTasks
                CalculateFullLabelForNode(subNode, currentPath)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Converte dataContract (JObject o Object) in NLPContract
    ''' Gestisce il formato dataContract con array "contracts" e lo converte in NLPContract con oggetti "regex", "rules", ecc.
    ''' </summary>
    Private Function ConvertDataContractToNlpContract(dataContract As Object) As NLPContract
        If dataContract Is Nothing Then
            Return Nothing
        End If

        ' Se è già NLPContract, ritorna direttamente
        If TypeOf dataContract Is NLPContract Then
            Return CType(dataContract, NLPContract)
        End If

        Try
            ' Converti in JObject se necessario
            Dim contractObj As JObject = Nothing
            If TypeOf dataContract Is JObject Then
                contractObj = CType(dataContract, JObject)
            ElseIf TypeOf dataContract Is String Then
                contractObj = JObject.Parse(CType(dataContract, String))
            Else
                ' Serializza e deserializza per convertire Object generico in JObject
                Dim jsonString = JsonConvert.SerializeObject(dataContract)
                contractObj = JObject.Parse(jsonString)
            End If

            If contractObj Is Nothing Then
                Console.WriteLine($"[TaskAssembler] ERROR: Failed to convert dataContract to JObject")
                Return Nothing
            End If

            ' Crea NLPContract base
            Dim nlpContract As New NLPContract()

            ' Estrai campi base
            If contractObj("templateName") IsNot Nothing Then
                nlpContract.TemplateName = contractObj("templateName").ToString()
            End If
            If contractObj("templateId") IsNot Nothing Then
                nlpContract.TemplateId = contractObj("templateId").ToString()
            End If
            If contractObj("sourceTemplateId") IsNot Nothing Then
                nlpContract.SourceTemplateId = contractObj("sourceTemplateId").ToString()
            End If

            ' Estrai subDataMapping
            If contractObj("subDataMapping") IsNot Nothing Then
                Try
                    Dim subDataMappingJson = contractObj("subDataMapping").ToString()
                    Dim subDataMappingDict = JsonConvert.DeserializeObject(Of Dictionary(Of String, SubDataMappingInfo))(subDataMappingJson)
                    If subDataMappingDict IsNot Nothing Then
                        nlpContract.SubDataMapping = subDataMappingDict
                    End If
                Catch ex As Exception
                    Console.WriteLine($"[TaskAssembler] WARNING: Failed to deserialize subDataMapping: {ex.Message}")
                End Try
            End If

            ' ✅ CONVERSIONE CHIAVE: Converti array "contracts" in oggetti "regex", "rules", ecc.
            If contractObj("contracts") IsNot Nothing AndAlso contractObj("contracts").Type = JTokenType.Array Then
                Dim contractsArray = CType(contractObj("contracts"), JArray)

                For Each contractItem As JObject In contractsArray
                    Dim contractType = If(contractItem("type")?.ToString(), "")
                    Dim contractEnabled = If(contractItem("enabled")?.ToObject(Of Boolean?)(), True)

                    If Not contractEnabled Then
                        Continue For ' Salta contract disabilitati
                    End If

                    Select Case contractType.ToLower()
                        Case "regex"
                            ' Crea RegexConfig
                            nlpContract.Regex = New RegexConfig()

                            ' Estrai patterns
                            If contractItem("patterns") IsNot Nothing AndAlso contractItem("patterns").Type = JTokenType.Array Then
                                Dim patternsArray = CType(contractItem("patterns"), JArray)
                                nlpContract.Regex.Patterns = New List(Of String)()
                                For Each patternToken In patternsArray
                                    If patternToken.Type = JTokenType.String Then
                                        nlpContract.Regex.Patterns.Add(patternToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai patternModes (opzionale)
                            If contractItem("patternModes") IsNot Nothing AndAlso contractItem("patternModes").Type = JTokenType.Array Then
                                Dim patternModesArray = CType(contractItem("patternModes"), JArray)
                                nlpContract.Regex.PatternModes = New List(Of String)()
                                For Each modeToken In patternModesArray
                                    If modeToken.Type = JTokenType.String Then
                                        nlpContract.Regex.PatternModes.Add(modeToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai ambiguityPattern (opzionale)
                            If contractItem("ambiguityPattern") IsNot Nothing Then
                                nlpContract.Regex.AmbiguityPattern = contractItem("ambiguityPattern").ToString()
                            End If

                            ' Estrai ambiguity config (opzionale)
                            If contractItem("ambiguity") IsNot Nothing Then
                                Try
                                    Dim ambiguityJson = contractItem("ambiguity").ToString()
                                    Dim ambiguity = JsonConvert.DeserializeObject(Of AmbiguityConfig)(ambiguityJson)
                                    If ambiguity IsNot Nothing Then
                                        nlpContract.Regex.Ambiguity = ambiguity
                                    End If
                                Catch ex As Exception
                                    Console.WriteLine($"[TaskAssembler] WARNING: Failed to deserialize ambiguity config: {ex.Message}")
                                End Try
                            End If

                            ' Estrai testCases (opzionale)
                            If contractItem("testCases") IsNot Nothing AndAlso contractItem("testCases").Type = JTokenType.Array Then
                                Dim testCasesArray = CType(contractItem("testCases"), JArray)
                                nlpContract.Regex.TestCases = New List(Of String)()
                                For Each testCaseToken In testCasesArray
                                    If testCaseToken.Type = JTokenType.String Then
                                        nlpContract.Regex.TestCases.Add(testCaseToken.ToString())
                                    End If
                                Next
                            End If

                        Case "rules"
                            ' Crea RulesConfig
                            nlpContract.Rules = New RulesConfig()

                            ' Estrai extractorCode (opzionale)
                            If contractItem("extractorCode") IsNot Nothing Then
                                nlpContract.Rules.ExtractorCode = contractItem("extractorCode").ToString()
                            End If

                            ' Estrai validators (opzionale)
                            If contractItem("validators") IsNot Nothing AndAlso contractItem("validators").Type = JTokenType.Array Then
                                Dim validatorsArray = CType(contractItem("validators"), JArray)
                                nlpContract.Rules.Validators = New List(Of Object)()
                                For Each validatorToken In validatorsArray
                                    nlpContract.Rules.Validators.Add(validatorToken.ToObject(Of Object)())
                                Next
                            End If

                            ' Estrai testCases (opzionale)
                            If contractItem("testCases") IsNot Nothing AndAlso contractItem("testCases").Type = JTokenType.Array Then
                                Dim testCasesArray = CType(contractItem("testCases"), JArray)
                                nlpContract.Rules.TestCases = New List(Of String)()
                                For Each testCaseToken In testCasesArray
                                    If testCaseToken.Type = JTokenType.String Then
                                        nlpContract.Rules.TestCases.Add(testCaseToken.ToString())
                                    End If
                                Next
                            End If

                        Case "ner"
                            ' Crea NERConfig
                            nlpContract.Ner = New NERConfig()

                            ' Estrai entityTypes (opzionale)
                            If contractItem("entityTypes") IsNot Nothing AndAlso contractItem("entityTypes").Type = JTokenType.Array Then
                                Dim entityTypesArray = CType(contractItem("entityTypes"), JArray)
                                nlpContract.Ner.EntityTypes = New List(Of String)()
                                For Each entityTypeToken In entityTypesArray
                                    If entityTypeToken.Type = JTokenType.String Then
                                        nlpContract.Ner.EntityTypes.Add(entityTypeToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai confidence (opzionale)
                            If contractItem("confidence") IsNot Nothing Then
                                Dim confidenceValue = contractItem("confidence").ToObject(Of Double?)()
                                If confidenceValue.HasValue Then
                                    nlpContract.Ner.Confidence = confidenceValue.Value
                                End If
                            End If

                            ' Estrai enabled (opzionale)
                            If contractItem("enabled") IsNot Nothing Then
                                Dim enabledValue = contractItem("enabled").ToObject(Of Boolean?)()
                                If enabledValue.HasValue Then
                                    nlpContract.Ner.Enabled = enabledValue.Value
                                End If
                            End If

                        Case "llm"
                            ' Crea LLMConfig
                            nlpContract.Llm = New LLMConfig()

                            ' Estrai systemPrompt (opzionale)
                            If contractItem("systemPrompt") IsNot Nothing Then
                                nlpContract.Llm.SystemPrompt = contractItem("systemPrompt").ToString()
                            End If

                            ' Estrai userPromptTemplate (opzionale)
                            If contractItem("userPromptTemplate") IsNot Nothing Then
                                nlpContract.Llm.UserPromptTemplate = contractItem("userPromptTemplate").ToString()
                            End If

                            ' Estrai responseSchema (opzionale)
                            If contractItem("responseSchema") IsNot Nothing Then
                                nlpContract.Llm.ResponseSchema = contractItem("responseSchema").ToObject(Of Object)()
                            End If

                            ' Estrai enabled (opzionale)
                            If contractItem("enabled") IsNot Nothing Then
                                Dim enabledValue = contractItem("enabled").ToObject(Of Boolean?)()
                                If enabledValue.HasValue Then
                                    nlpContract.Llm.Enabled = enabledValue.Value
                                End If
                            End If

                    End Select
                Next
            End If

            Return nlpContract

        Catch ex As Exception
            Console.WriteLine($"[TaskAssembler] ERROR: Exception converting dataContract to NLPContract: {ex.GetType().Name} - {ex.Message}")
            Console.WriteLine($"[TaskAssembler] ERROR: Stack trace: {ex.StackTrace}")
            Throw New InvalidOperationException($"Failed to convert dataContract to NLPContract: {ex.Message}", ex)
        End Try
    End Function
End Class



