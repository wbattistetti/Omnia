Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Text.RegularExpressions
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
    Private Shared Function IsGuid(value As String) As Boolean
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
            ' ✅ Validazione: verifica che non ci siano step duplicati con lo stesso Type
            Dim seenTypes As New HashSet(Of DialogueState)()
            For Each ideStep As Compiler.DialogueStep In ideNode.Steps
                Dim runtimeStep = CompileDialogueStep(ideStep)

                If seenTypes.Contains(runtimeStep.Type) Then
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

        ' ✅ VALIDAZIONE: Verifica congruenza tra Constraints e step Invalid
        ' Se ci sono Constraints, deve esistere uno step di tipo Invalid
        ' Se non ci sono Constraints, non deve esistere uno step di tipo Invalid
        Dim hasConstraints = task.Constraints IsNot Nothing AndAlso task.Constraints.Count > 0
        Dim hasInvalidStep = task.Steps IsNot Nothing AndAlso task.Steps.Any(Function(s) s.Type = DialogueState.Invalid)

        If hasConstraints AndAlso Not hasInvalidStep Then
            Throw New InvalidOperationException($"Invalid task model: Node {ideNode.Id} has {task.Constraints.Count} constraint(s) but no step of type 'invalid'. When constraints are present, an 'invalid' step is mandatory to handle validation failures.")
        End If

        If Not hasConstraints AndAlso hasInvalidStep Then
            Throw New InvalidOperationException($"Invalid task model: Node {ideNode.Id} has a step of type 'invalid' but no constraints. The 'invalid' step is only needed when constraints are present. Remove the 'invalid' step or add constraints.")
        End If

        ' ✅ Converti dataContract in CompiledNlpContract se presente
        If ideNode.DataContract IsNot Nothing Then
            Try
                Dim baseContract = ConvertDataContractToNlpContract(ideNode.DataContract)
                If baseContract IsNot Nothing Then
                    task.NlpContract = CompiledNlpContract.Compile(baseContract)
                    If Not task.NlpContract.IsValid Then
                        Throw New InvalidOperationException($"NlpContract compilation failed for node {ideNode.Id}: {String.Join(", ", task.NlpContract.ValidationErrors)}")
                    End If
                End If
            Catch ex As Exception
                Throw New InvalidOperationException($"Failed to compile dataContract for node {ideNode.Id}: {ex.Message}", ex)
            End Try
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

            If validationCondition Is Nothing Then
                Throw New InvalidOperationException(
                    $"ConvertConstraintToValidationCondition: deserialization returned Nothing for constraint. " &
                    $"JSON: {constraintJson}")
            End If

            Return validationCondition
        Catch ex As InvalidOperationException
            Throw
        Catch ex As Exception
            Throw New InvalidOperationException(
                $"ConvertConstraintToValidationCondition: failed to convert constraint object of type '{constraintObj.GetType().Name}'. " &
                $"Error: {ex.Message}", ex)
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
    ''' ✅ NORMALIZZAZIONE: "violation" viene normalizzato a "invalid" per compatibilità con frontend
    ''' </summary>
    Private Function CompileStepType(typeStr As String) As DialogueState
        If String.IsNullOrEmpty(typeStr) Then
            Throw New InvalidOperationException($"Step type cannot be null or empty. This indicates a structural error in the task model. Every DialogueStep must have a valid type.")
        End If

        ' ✅ NORMALIZZAZIONE: "violation" → "invalid" (compatibilità con frontend ddt.v2.types.ts)
        Dim normalizedType = typeStr.ToLower().Trim()
        If normalizedType = "violation" Then
            normalizedType = "invalid"
        End If

        Select Case normalizedType
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
            Case "invalid"
                Return DialogueState.Invalid
            Case "success"
                Return DialogueState.Success
            Case "introduction"
                ' ✅ "introduction" è un alias valido per "start" nel modello IDE
                ' Usato per step introduttivi che si comportano come Start
                Return DialogueState.Start
            Case Else
                ' ❌ RIMOSSO FALLBACK: Il compilatore NON deve indovinare o correggere errori strutturali
                ' Se il tipo è sconosciuto, il modello è invalido e deve essere corretto a monte
                Throw New InvalidOperationException($"Unknown step type '{typeStr}'. Valid types are: start, noMatch, noInput, confirmation, notConfirmed, invalid, violation, success, introduction. Note: 'violation' is automatically normalized to 'invalid'.")
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
            For i = 0 To ideEscalation.Tasks.Count - 1
                Dim ideTask = ideEscalation.Tasks(i)
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
    ''' <summary>
    ''' Compiles a single IDE task into a runtime ITask.
    ''' Throws immediately for any unknown or malformed task — no silent skips.
    ''' UtteranceInterpretation, BackendCall and ClassifyProblem are semantic task types
    ''' and do not produce an ITask; they are handled at the TaskUtterance level.
    ''' </summary>
    Private Function CompileTask(ideTask As Compiler.Task) As ITask
        If Not ideTask.Type.HasValue Then
            Throw New InvalidOperationException(
                $"Task '{ideTask.Id}' has no Type. Every task inside an escalation must have a valid type.")
        End If

        Dim typeValue = ideTask.Type.Value
        If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
            Throw New InvalidOperationException(
                $"Task '{ideTask.Id}' has unknown type value {typeValue}. " &
                $"Valid values are: {String.Join(", ", [Enum].GetValues(GetType(TaskTypes)))}")
        End If

        Dim taskType = CType(typeValue, TaskTypes)

        Select Case taskType
            Case TaskTypes.SayMessage
                Return New MessageTask(ExtractTextKeyFromIdeTask(ideTask))

            Case TaskTypes.CloseSession
                Return New CloseSessionTask()

            Case TaskTypes.Transfer
                Return New TransferTask()

            Case TaskTypes.UtteranceInterpretation, TaskTypes.BackendCall, TaskTypes.ClassifyProblem
                ' These are semantic task types — they compile to TaskUtterance, not ITask.
                ' Returning Nothing here is intentional and expected: the caller skips Nothing.
                Return Nothing

            Case Else
                Throw New InvalidOperationException(
                    $"Task '{ideTask.Id}' has type '{taskType}' which is not supported inside an escalation. " &
                    $"Only SayMessage, CloseSession and Transfer are valid escalation task types.")
        End Select
    End Function

    ''' <summary>
    ''' Extracts the TextKey (translation GUID) from a SayMessage IDE task.
    ''' Tries ideTask.Text, then Parameters[parameterId='text'], then Value["parameters"].
    ''' Throws immediately if the key is missing or appears to be literal text.
    ''' </summary>
    Private Shared Function ExtractTextKeyFromIdeTask(ideTask As Compiler.Task) As String
        Dim textKey As String = ""

        If Not String.IsNullOrWhiteSpace(ideTask.Text) Then
            textKey = ideTask.Text.Trim()

        ElseIf ideTask.Parameters IsNot Nothing Then
            Dim textParams = ideTask.Parameters.Where(Function(p) p.ParameterId = "text").ToList()
            If textParams.Count = 0 Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{ideTask.Id}': no parameter with ParameterId='text'. " &
                    $"The 'text' parameter is mandatory.")
            End If
            If textParams.Count > 1 Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{ideTask.Id}': {textParams.Count} parameters with ParameterId='text'. " &
                    $"ParameterId must be unique.")
            End If
            If String.IsNullOrWhiteSpace(textParams.Single().Value) Then
                Throw New InvalidOperationException(
                    $"SayMessage task '{ideTask.Id}': parameter 'text' has an empty value. TextKey cannot be empty.")
            End If
            textKey = textParams.Single().Value.Trim()

        ElseIf ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
            Dim parameters = ideTask.Value("parameters")
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
                        $"SayMessage task '{ideTask.Id}': no parameter with ParameterId='text' in Value.parameters.")
                End If
                If textParams.Count > 1 Then
                    Throw New InvalidOperationException(
                        $"SayMessage task '{ideTask.Id}': {textParams.Count} parameters with ParameterId='text' in Value.parameters.")
                End If
                Dim textParam = CType(textParams.Single(), Dictionary(Of String, Object))
                Dim textValue = textParam("value")?.ToString()
                If String.IsNullOrWhiteSpace(textValue) Then
                    Throw New InvalidOperationException(
                        $"SayMessage task '{ideTask.Id}': parameter 'text' has an empty value in Value.parameters.")
                End If
                textKey = textValue.Trim()
            End If
        End If

        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New InvalidOperationException(
                $"SayMessage task '{ideTask.Id}': no TextKey found. " &
                $"The IDE must provide a translation key (GUID), not literal text. " &
                $"Checked: ideTask.Text, Parameters[parameterId='text'], Value.parameters.")
        End If

        If Not IsGuid(textKey) AndAlso textKey.Contains(" ") Then
            Throw New InvalidOperationException(
                $"SayMessage task '{ideTask.Id}': TextKey '{textKey}' looks like literal text. " &
                $"Only translation keys (GUIDs) are accepted — not raw text strings.")
        End If

        Return textKey
    End Function

    ''' <summary>
    ''' Compila DialogueStep in List(Of ITask) (per Introduction/SuccessResponse)
    ''' </summary>
    Private Function CompileDialogueStepToTasks(ideStep As Compiler.DialogueStep) As List(Of ITask)
        Dim tasks As New List(Of ITask)()

        ' Prendi la prima escalation del primo step
        If ideStep.Escalations IsNot Nothing AndAlso ideStep.Escalations.Count > 0 Then
            Dim firstEscalation = ideStep.Escalations(0)
            If firstEscalation.Tasks IsNot Nothing Then
                For Each ideTask As Compiler.Task In firstEscalation.Tasks
                    Dim runtimeTask = CompileTask(ideTask)
                    If runtimeTask IsNot Nothing Then
                        tasks.Add(runtimeTask)
                    End If
                Next
            End If
        End If

        Return tasks
    End Function

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
            ' ❌ RIMOSSO: Catch silente che nascondeva errori di deserializzazione.
            ' ✅ NUOVO: Fail-fast con messaggio esplicito su ogni percorso di errore.
            If contractObj("subDataMapping") IsNot Nothing Then
                Dim subDataMappingToken As JToken = contractObj("subDataMapping")
                Dim subDataMappingDict As Dictionary(Of String, SubDataMappingInfo) = Nothing

                Select Case subDataMappingToken.Type
                    Case JTokenType.Object
                        ' ✅ Standard path: frontend sends subDataMapping as a JSON object.
                        Try
                            subDataMappingDict = subDataMappingToken.ToObject(Of Dictionary(Of String, SubDataMappingInfo))()
                        Catch ex As Exception
                            Throw New InvalidOperationException(
                                $"Failed to deserialize dataContract.subDataMapping (JObject path). " &
                                $"Template: '{If(nlpContract.TemplateName, "unknown")}'. Error: {ex.Message}", ex)
                        End Try

                    Case JTokenType.String
                        ' Legacy path: subDataMapping sent as a serialized JSON string.
                        Try
                            subDataMappingDict = JsonConvert.DeserializeObject(
                                Of Dictionary(Of String, SubDataMappingInfo))(subDataMappingToken.ToString())
                        Catch ex As Exception
                            Throw New InvalidOperationException(
                                $"Failed to deserialize dataContract.subDataMapping (String path). " &
                                $"Template: '{If(nlpContract.TemplateName, "unknown")}'. Error: {ex.Message}", ex)
                        End Try

                    Case JTokenType.Null
                        ' null token → treat as absent; leaf tasks may omit the mapping.

                    Case Else
                        Throw New InvalidOperationException(
                            $"dataContract.subDataMapping has unsupported JSON type: {subDataMappingToken.Type}. " &
                            $"Expected Object or String. Template: '{If(nlpContract.TemplateName, "unknown")}'.")
                End Select

                If subDataMappingDict IsNot Nothing Then
                    nlpContract.SubDataMapping = subDataMappingDict
                End If
            End If

            ' ✅ NEW: Popola Contracts direttamente (fonte di verità unica)
            ' ❌ RIMOSSO: La conversione contracts[] → nlpContract.Regex/Rules/Ner/Llm
            ' Ora usiamo direttamente nlpContract.Contracts
            If contractObj("contracts") IsNot Nothing AndAlso contractObj("contracts").Type = JTokenType.Array Then
                Dim contractsArray = CType(contractObj("contracts"), JArray)
                nlpContract.Contracts = New List(Of NLPContractEngine)()

                For Each contractItem As JObject In contractsArray
                    Dim contractType = If(contractItem("type")?.ToString(), "")
                    Dim contractEnabled = If(contractItem("enabled")?.ToObject(Of Boolean?)(), True)

                    If Not contractEnabled Then
                        Continue For ' Salta contract disabilitati
                    End If

                    Dim engine As New NLPContractEngine()
                    engine.Type = contractType
                    engine.Enabled = contractEnabled

                    Select Case contractType.ToLower()
                        Case "regex"
                            ' Estrai patterns
                            If contractItem("patterns") IsNot Nothing AndAlso contractItem("patterns").Type = JTokenType.Array Then
                                Dim patternsArray = CType(contractItem("patterns"), JArray)
                                engine.Patterns = New List(Of String)()
                                For Each patternToken In patternsArray
                                    If patternToken.Type = JTokenType.String Then
                                        engine.Patterns.Add(patternToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai patternModes (opzionale)
                            If contractItem("patternModes") IsNot Nothing AndAlso contractItem("patternModes").Type = JTokenType.Array Then
                                Dim patternModesArray = CType(contractItem("patternModes"), JArray)
                                engine.PatternModes = New List(Of String)()
                                For Each modeToken In patternModesArray
                                    If modeToken.Type = JTokenType.String Then
                                        engine.PatternModes.Add(modeToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai ambiguityPattern (opzionale)
                            If contractItem("ambiguityPattern") IsNot Nothing Then
                                engine.AmbiguityPattern = contractItem("ambiguityPattern").ToString()
                            End If

                            ' Estrai ambiguity config (opzionale)
                            If contractItem("ambiguity") IsNot Nothing Then
                                Try
                                    Dim ambiguityJson = contractItem("ambiguity").ToString()
                                    engine.Ambiguity = JsonConvert.DeserializeObject(Of AmbiguityConfig)(ambiguityJson)
                                Catch ex As Exception
                                    ' Ignore
                                End Try
                            End If

                            ' Estrai testCases (opzionale)
                            If contractItem("testCases") IsNot Nothing AndAlso contractItem("testCases").Type = JTokenType.Array Then
                                Dim testCasesArray = CType(contractItem("testCases"), JArray)
                                engine.TestCases = New List(Of String)()
                                For Each testCaseToken In testCasesArray
                                    If testCaseToken.Type = JTokenType.String Then
                                        engine.TestCases.Add(testCaseToken.ToString())
                                    End If
                                Next
                            End If

                        Case "rules"
                            ' Estrai extractorCode (opzionale)
                            If contractItem("extractorCode") IsNot Nothing Then
                                engine.ExtractorCode = contractItem("extractorCode").ToString()
                            End If

                            ' Estrai validators (opzionale)
                            If contractItem("validators") IsNot Nothing AndAlso contractItem("validators").Type = JTokenType.Array Then
                                Dim validatorsArray = CType(contractItem("validators"), JArray)
                                engine.Validators = New List(Of Object)()
                                For Each validatorToken In validatorsArray
                                    engine.Validators.Add(validatorToken.ToObject(Of Object)())
                                Next
                            End If

                            ' Estrai testCases (opzionale)
                            If contractItem("testCases") IsNot Nothing AndAlso contractItem("testCases").Type = JTokenType.Array Then
                                Dim testCasesArray = CType(contractItem("testCases"), JArray)
                                engine.TestCases = New List(Of String)()
                                For Each testCaseToken In testCasesArray
                                    If testCaseToken.Type = JTokenType.String Then
                                        engine.TestCases.Add(testCaseToken.ToString())
                                    End If
                                Next
                            End If

                        Case "ner"
                            ' Estrai entityTypes (opzionale)
                            If contractItem("entityTypes") IsNot Nothing AndAlso contractItem("entityTypes").Type = JTokenType.Array Then
                                Dim entityTypesArray = CType(contractItem("entityTypes"), JArray)
                                engine.EntityTypes = New List(Of String)()
                                For Each entityTypeToken In entityTypesArray
                                    If entityTypeToken.Type = JTokenType.String Then
                                        engine.EntityTypes.Add(entityTypeToken.ToString())
                                    End If
                                Next
                            End If

                            ' Estrai confidence (opzionale)
                            If contractItem("confidence") IsNot Nothing Then
                                Dim confidenceValue = contractItem("confidence").ToObject(Of Double?)()
                                If confidenceValue.HasValue Then
                                    engine.Confidence = confidenceValue.Value
                                End If
                            End If

                        Case "llm"
                            ' Estrai systemPrompt (opzionale)
                            If contractItem("systemPrompt") IsNot Nothing Then
                                engine.SystemPrompt = contractItem("systemPrompt").ToString()
                            End If

                            ' Estrai userPromptTemplate (opzionale)
                            If contractItem("userPromptTemplate") IsNot Nothing Then
                                engine.UserPromptTemplate = contractItem("userPromptTemplate").ToString()
                            End If

                            ' Estrai responseSchema (opzionale)
                            If contractItem("responseSchema") IsNot Nothing Then
                                engine.ResponseSchema = contractItem("responseSchema").ToObject(Of Object)()
                            End If
                    End Select

                    nlpContract.Contracts.Add(engine)
                Next
            End If

            ' ✅ Validate group-name coherence: mapping ↔ regex bidirectional check.
            ' Only runs when a composite mapping exists (leaf contracts are skipped).
            If nlpContract.SubDataMapping IsNot Nothing AndAlso nlpContract.SubDataMapping.Count > 0 Then
                ValidateGroupNameCoherence(nlpContract)
            End If

            Return nlpContract

        Catch ex As Exception
            Throw New InvalidOperationException($"Failed to convert dataContract to NLPContract: {ex.Message}", ex)
        End Try
    End Function

    ' ── Group-name validation helpers ────────────────────────────────────────

    ''' <summary>
    ''' ✅ REMOVED: _guidGroupPattern - no longer needed, using inline pattern for s[0-9]+
    ''' Pattern for deterministic group names based on index.
    ''' Format: s followed by one or more digits (e.g. s1, s2, s3).
    ''' </summary>
    ' Private Shared ReadOnly _guidGroupPattern As New System.Text.RegularExpressions.Regex(
    '     "^g_[a-f0-9]{12}$",
    '     System.Text.RegularExpressions.RegexOptions.IgnoreCase Or
    '     System.Text.RegularExpressions.RegexOptions.Compiled)

    ''' <summary>
    ''' Validates that every GroupName in SubDataMapping exists as a named group
    ''' in the main regex pattern, and that every named group in the pattern has
    ''' a corresponding entry in SubDataMapping.
    ''' GroupName is mandatory and must match the format g_[a-f0-9]{12}.
    ''' Throws InvalidOperationException with a complete error list on any mismatch.
    ''' </summary>
    Private Shared Sub ValidateGroupNameCoherence(contract As NLPContract)
        If contract Is Nothing Then Return
        If contract.SubDataMapping Is Nothing OrElse contract.SubDataMapping.Count = 0 Then Return

        ' ✅ NEW: Leggi regex contract da Contracts invece di contract.Regex
        Dim regexContract = contract.Contracts?.FirstOrDefault(Function(c) c.Type = "regex" AndAlso c.Enabled)
        If regexContract Is Nothing OrElse
           regexContract.Patterns Is Nothing OrElse
           regexContract.Patterns.Count = 0 Then
            Return ' No regex contract, skip validation
        End If

        ' --- Step 1: extract named groups from the compiled main pattern ---
        Dim mainPattern = regexContract.Patterns(0)
        Dim rx As System.Text.RegularExpressions.Regex
        Try
            rx = New System.Text.RegularExpressions.Regex(
                mainPattern,
                System.Text.RegularExpressions.RegexOptions.IgnoreCase)
        Catch ex As Exception
            Throw New InvalidOperationException(
                $"NlpContract main regex pattern is invalid for template '{contract.TemplateName}': {ex.Message}" &
                $"  Pattern: {mainPattern}")
        End Try

        Dim regexGroups As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        For Each name As String In rx.GetGroupNames()
            ' Skip the full-match group ("0") and any unnamed numbered groups ("1", "2", …).
            ' .NET's GetGroupNames() returns both named groups AND implicit numbered groups
            ' for every capturing parenthesis; we only care about explicitly named groups.
            Dim parsedIndex As Integer
            If Not String.IsNullOrEmpty(name) AndAlso
               Not Integer.TryParse(name, parsedIndex) Then
                regexGroups.Add(name)
            End If
        Next

        ' --- Step 2: collect group names from the mapping (GroupName is required) ---
        Dim mappingGroups As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In contract.SubDataMapping
            Dim groupName = kvp.Value.GroupName
            If String.IsNullOrWhiteSpace(groupName) Then
                Throw New InvalidOperationException(
                    $"NlpContract (template '{contract.TemplateName}'): SubDataMapping entry for subtask " &
                    $"'{kvp.Key}' is missing GroupName. GroupName is required " &
                    $"(format: s[0-9]+, e.g. s1, s2, s3).")
            End If

            ' ✅ UPDATED: Accept s[0-9]+ format (deterministic based on index)
            Dim indexPattern As New Regex("^s[0-9]+$", RegexOptions.IgnoreCase)
            If Not indexPattern.IsMatch(groupName) Then
                Throw New InvalidOperationException(
                    $"NlpContract (template '{contract.TemplateName}'): GroupName '{groupName}' " &
                    $"for subtask '{kvp.Key}' is not a valid technical group name. " &
                    $"Expected format: s[0-9]+ (e.g. s1, s2, s3).")
            End If

            mappingGroups.Add(groupName)
        Next

        ' --- Step 3: bidirectional check ---
        Dim errors As New List(Of String)()

        ' Groups in regex that have no mapping entry
        For Each name As String In regexGroups
            If Not mappingGroups.Contains(name) Then
                errors.Add($"  - Regex group '{name}' exists in pattern but has no entry in SubDataMapping.")
            End If
        Next

        ' Groups in mapping that are absent from the regex
        For Each kvp As KeyValuePair(Of String, SubDataMappingInfo) In contract.SubDataMapping
            Dim groupName = kvp.Value.GroupName
            If Not regexGroups.Contains(groupName) Then
                errors.Add(
                    $"  - SubDataMapping references group '{groupName}' (subtask '{kvp.Key}') " &
                    $"but that group is absent from the regex pattern.")
            End If
        Next

        If errors.Count > 0 Then
            Throw New InvalidOperationException(
                $"NlpContract validation failed for template '{contract.TemplateName}':" &
                Environment.NewLine &
                String.Join(Environment.NewLine, errors))
        End If
    End Sub

End Class



