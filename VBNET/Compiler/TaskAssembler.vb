Option Strict On
Option Explicit On
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler.DTO.IDE
Imports TaskEngine
Imports Compiler

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
    ''' Compila TaskTreeExpanded (IDE - AST montato) in CompiledUtteranceTask ricorsivo (Runtime)
    ''' Restituisce il CompiledUtteranceTask root dell'albero ricorsivo
    ''' </summary>
    Public Function Compile(assembled As TaskTreeExpanded) As CompiledUtteranceTask
        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "TaskTreeExpanded cannot be Nothing")
        End If

        ' ❌ RIMOSSO: translations - il compilatore NON deve più gestire traduzioni
        ' ✅ NUOVO MODELLO: Costruisci CompiledUtteranceTask root ricorsivo
        ' Se c'è un solo nodo, è il root; se ce ne sono più, creiamo un nodo aggregato
        Dim rootTask As CompiledUtteranceTask = Nothing

        If assembled.Nodes IsNot Nothing AndAlso assembled.Nodes.Count > 0 Then
            If assembled.Nodes.Count = 1 Then
                ' Un solo nodo: è il root
                Dim taskNode As TaskNode = assembled.Nodes(0)
                rootTask = CompileNode(taskNode, Nothing)
                rootTask.Id = assembled.TaskInstanceId ' ✅ Usa TaskInstanceId del TaskTreeExpanded come ID del root
                rootTask.NodeId = taskNode.Id ' ✅ NEW: Conserva GUID del nodo DDT (non sovrascrivere)
            Else
                ' Più nodi: crea un nodo aggregato root con subTasks
                rootTask = New CompiledUtteranceTask() With {
                    .Id = assembled.TaskInstanceId, ' ✅ Usa TaskInstanceId invece di Id
                    .Condition = Nothing,
                    .Steps = New List(Of TaskEngine.CompiledDialogueStep)(),
                    .Constraints = New List(Of TaskEngine.ValidationCondition)(),
                    .NlpContract = Nothing,
                    .SubTasks = New List(Of CompiledUtteranceTask)() ' ✅ Necessario perché ci sono più nodi
                }
                ' Compila ogni nodo come subTask
                For Each taskNode As TaskNode In assembled.Nodes
                    If taskNode IsNot Nothing Then
                        Dim subTask = CompileNode(taskNode, rootTask) ' ✅ Passa rootTask come parent
                        rootTask.SubTasks.Add(subTask)
                    End If
                Next
            End If
        Else
            ' Nessun nodo: crea un task vuoto
            rootTask = New CompiledUtteranceTask() With {
                .Id = assembled.TaskInstanceId, ' ✅ Usa TaskInstanceId invece di Id
                .Condition = Nothing,
                .Steps = New List(Of TaskEngine.CompiledDialogueStep)(),
                .Constraints = New List(Of TaskEngine.ValidationCondition)(),
                .NlpContract = Nothing,
                .SubTasks = Nothing
            }
        End If

        Return rootTask
    End Function

    ''' <summary>
    ''' Compila TaskNode (IDE) in CompiledUtteranceTask (Runtime)
    ''' Costruisce struttura ricorsiva CompiledUtteranceTask → CompiledUtteranceTask → CompiledUtteranceTask
    ''' ✅ Imposta ParentTask durante la compilazione per evitare ricerche ricorsive a runtime
    ''' </summary>
    Private Function CompileNode(ideNode As TaskNode, parentTask As CompiledUtteranceTask) As CompiledUtteranceTask
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
        ' ✅ Crea CompiledUtteranceTask ricorsivo
        Dim task As New CompiledUtteranceTask() With {
            .Id = ideNode.Id,
            .NodeId = ideNode.Id, ' ✅ NEW: Conserva GUID del nodo DDT per salvare variabili
            .Condition = Nothing, ' Condition viene dall'istanza, non dal template
            .Steps = New List(Of TaskEngine.CompiledDialogueStep)(),
            .Constraints = New List(Of ValidationCondition)(),
            .NlpContract = Nothing, ' Verrà caricato da DDTCompiler
            .SubTasks = Nothing ' ✅ Inizializzato solo se ci sono subTasks
        }

        If ideNode.Steps IsNot Nothing Then
            ' ✅ COMPILE-TIME FILTER: skip steps with no escalations (disabled in Response Editor).
            ' A step with 0 escalations has no messages → it was disabled by the designer.
            ' Excluding it here means StepExists() returns False naturally at runtime,
            ' with no changes needed in the engine layer.
            Dim seenTypes As New HashSet(Of DialogueStepType)()
            For Each ideStep As DialogueStep In ideNode.Steps
                If ideStep.IsDisabled Then
                    Console.WriteLine($"[TaskAssembler] ℹ️ Skipping disabled step '{ideStep.Type}' (_disabled=true) for node {ideNode.Id}")
                    Continue For
                End If
                If ideStep.Escalations Is Nothing OrElse ideStep.Escalations.Count = 0 Then
                    Console.WriteLine($"[TaskAssembler] ℹ️ Skipping disabled step '{ideStep.Type}' (0 escalations) for node {ideNode.Id}")
                    Continue For
                End If

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
        ' ⚠️ TEMPORANEAMENTE DISABILITATO: Permette nodi con constraints senza invalid step
        ' Se non c'è invalid step, tutti i dati vengono considerati validi (fallback a comportamento normale)
        Dim hasConstraints = task.Constraints IsNot Nothing AndAlso task.Constraints.Count > 0
        Dim hasInvalidStep = task.Steps IsNot Nothing AndAlso task.Steps.Any(Function(s) s.Type = DialogueStepType.Invalid)

        ' TODO: Re-implementare con fallback: se non c'è invalid step, considera tutti i dati validi
        'If hasConstraints AndAlso Not hasInvalidStep Then
        '    Throw New InvalidOperationException($"Invalid task model: Node {ideNode.Id} has {task.Constraints.Count} constraint(s) but no step of type 'invalid'. When constraints are present, an 'invalid' step is mandatory to handle validation failures.")
        'End If

        If Not hasConstraints AndAlso hasInvalidStep Then
            Throw New InvalidOperationException($"Invalid task model: Node {ideNode.Id} has a step of type 'invalid' but no constraints. The 'invalid' step is only needed when constraints are present. Remove the 'invalid' step or add constraints.")
        End If

        ' ✅ Compila dataContract in CompiledNlpContract se presente
        If ideNode.DataContract IsNot Nothing Then
            Try
                ' DataContract è già NLPContract (tipizzato), compila direttamente
                task.NlpContract = NlpContractCompiler.Compile(ideNode.DataContract)

                If Not task.NlpContract.IsValid Then
                    Throw New InvalidOperationException($"NlpContract compilation failed for node {ideNode.Id}: {String.Join(", ", task.NlpContract.ValidationErrors)}")
                End If

                ' ✅ Validate group-name coherence: mapping ↔ regex bidirectional check.
                ' Only runs when a composite mapping exists (leaf contracts are skipped).
                If ideNode.DataContract.SubDataMapping IsNot Nothing AndAlso ideNode.DataContract.SubDataMapping.Count > 0 Then
                    ValidateGroupNameCoherence(ideNode.DataContract)
                End If
            Catch ex As Exception
                Console.WriteLine($"[TaskAssembler.CompileNode] ❌ Node {ideNode.Id}: Exception during compilation: {ex.Message}")
                Console.WriteLine($"[TaskAssembler.CompileNode]   - StackTrace: {ex.StackTrace}")
                Throw New InvalidOperationException($"Failed to compile dataContract for node {ideNode.Id}: {ex.Message}", ex)
            End Try
        Else
            Console.WriteLine($"[TaskAssembler.CompileNode] ⚠️ Node {ideNode.Id}: ideNode.DataContract is Nothing")
        End If

        ' Compila SubTasks (ricorsivo) - inizializza solo se ci sono subTasks
        If ideNode.SubTasks IsNot Nothing AndAlso ideNode.SubTasks.Count > 0 Then
            If task.SubTasks Is Nothing Then
                task.SubTasks = New List(Of CompiledUtteranceTask)()
            End If
            For Each subNode As TaskNode In ideNode.SubTasks
                Dim subTask = CompileNode(subNode, task)
                task.SubTasks.Add(subTask)
            Next
        End If

        Return task
    End Function

    ''' <summary>
    ''' Converte un constraint (Object) in ValidationCondition
    ''' </summary>
    Private Function ConvertConstraintToValidationCondition(constraintObj As Object) As TaskEngine.ValidationCondition
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
    ''' Compila DialogueStep (IDE) in CompiledDialogueStep (Runtime)
    ''' </summary>
    Private Function CompileDialogueStep(ideStep As DialogueStep) As TaskEngine.CompiledDialogueStep
        Dim runtimeStep As New TaskEngine.CompiledDialogueStep() With {
            .Type = CompileStepType(ideStep.Type),
            .Escalations = New List(Of TaskEngine.Escalation)()
        }

        If ideStep.Escalations IsNot Nothing Then
            For Each ideEscalation As Escalation In ideStep.Escalations
                Dim runtimeEscalation = CompileEscalation(ideEscalation)
                If runtimeEscalation IsNot Nothing Then
                    runtimeStep.Escalations.Add(runtimeEscalation)
                End If
            Next
        End If

        Return runtimeStep
    End Function

    ''' <summary>
    ''' Compila stringa step type in DialogueStepType enum
    ''' Il compilatore NON fa fallback: se il tipo è invalido, fallisce immediatamente.
    ''' Fallback comportamentali sono gestiti dal motore runtime, non dal compilatore.
    ''' ✅ NORMALIZZAZIONE: "violation" viene normalizzato a "invalid" per compatibilità con frontend
    ''' ✅ "invalid" è l'unico step per quando i constraints non vengono superati
    ''' ✅ "disambiguation" non è più supportato (rimosso)
    ''' </summary>
    Private Function CompileStepType(typeStr As String) As TaskEngine.DialogueStepType
        If String.IsNullOrEmpty(typeStr) Then
            Throw New InvalidOperationException($"Step type cannot be null or empty. This indicates a structural error in the task model. Every DialogueStep must have a valid type.")
        End If

        Dim normalizedType = typeStr.ToLower().Trim()

        Select Case normalizedType
            Case "start"
                Return DialogueStepType.Start
            Case "nomatch"
                Return DialogueStepType.NoMatch
            Case "noinput"
                Return DialogueStepType.NoInput
            Case "confirmation"
                Return DialogueStepType.Confirmation
            Case "notconfirmed"
                Return DialogueStepType.NotConfirmed
            Case "invalid"
                ' ✅ "invalid" è l'unico step per quando i constraints non vengono superati
                Return DialogueStepType.Invalid
            Case "success"
                Return DialogueStepType.Success
            Case "introduction"
                ' ✅ "introduction" è un alias valido per "start" nel modello IDE
                ' Usato per step introduttivi che si comportano come Start
                Return DialogueStepType.Start
            Case Else
                ' ❌ RIMOSSO FALLBACK: Il compilatore NON deve indovinare o correggere errori strutturali
                ' Se il tipo è sconosciuto, il modello è invalido e deve essere corretto a monte
                Throw New InvalidOperationException($"Unknown step type '{typeStr}'. Valid types are: start, noMatch, noInput, confirmation, notConfirmed, invalid, success, introduction.")
        End Select
    End Function

    ''' <summary>
    ''' Compila Escalation (IDE) in Escalation (Runtime)
    ''' </summary>
    Private Function CompileEscalation(ideEscalation As Escalation) As TaskEngine.Escalation
        Dim runtimeEscalation As New TaskEngine.Escalation() With {
            .EscalationId = ideEscalation.EscalationId,
            .Tasks = New List(Of TaskEngine.ITask)()
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
    Private Function CompileTask(ideTask As TaskDefinition) As TaskEngine.ITask
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

            Case TaskTypes.UtteranceInterpretation, TaskTypes.BackendCall, TaskTypes.ClassifyProblem, TaskTypes.AIAgent, TaskTypes.Subflow
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
    ''' ❌ RIMOSSO: ideTask.Text - task.text non deve esistere
    ''' Tries Parameters[parameterId='text'], then Value["parameters"].
    ''' Throws immediately if the key is missing or appears to be literal text.
    ''' </summary>
    Private Shared Function ExtractTextKeyFromIdeTask(ideTask As TaskDefinition) As String
        Dim textKey As String = ""

        ' ❌ RIMOSSO: If Not String.IsNullOrWhiteSpace(ideTask.Text) Then
        ' Il modello corretto è: task contiene solo GUID nei parameters

        If ideTask.Parameters IsNot Nothing Then
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
                $"Checked: Parameters[parameterId='text'], Value.parameters.")
        End If

        TranslationKeyCanonical.ValidateTranslationKeyParameterOrThrow(textKey, $"SayMessage task '{ideTask.Id}'")

        Return textKey
    End Function

    ''' <summary>
    ''' Compila DialogueStep in List(Of ITask) (per Introduction/SuccessResponse)
    ''' </summary>
    Private Function CompileDialogueStepToTasks(ideStep As CompiledDialogueStep) As List(Of TaskEngine.ITask)
        Dim tasks As New List(Of ITask)()

        ' Prendi la prima escalation del primo step
        If ideStep.Escalations IsNot Nothing AndAlso ideStep.Escalations.Count > 0 Then
            Dim firstEscalation = ideStep.Escalations(0)
            If firstEscalation.Tasks IsNot Nothing Then
                For Each ideTask As TaskDefinition In firstEscalation.Tasks
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
    ''' ❌ RIMOSSA: ConvertDataContractToNlpContract
    ''' DataContract è ora tipizzato come NLPContract in TaskDefinition e TaskNode.
    ''' La deserializzazione JSON gestisce automaticamente la conversione.
    ''' Non serve più conversione manuale da Object/JObject a NLPContract.
    ''' </summary>

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

        ' ✅ NEW: Leggi regex contract da Parsers invece di contract.Regex
        Dim regexContract = contract.Engines?.FirstOrDefault(Function(c) c.Type = "regex" AndAlso c.Enabled)
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



