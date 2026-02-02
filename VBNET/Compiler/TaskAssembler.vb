Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' TaskAssembler: compila strutture IDE (TaskTreeExpanded - AST montato) in strutture Runtime (Task ricorsivo)
''' Responsabilità:
''' - Mappare campi uno a uno
''' - Compilare tipi (DialogueStep IDE → DialogueStep Runtime)
''' - Convertire Constraints in ValidationConditions
''' - Costruire struttura ricorsiva Task → Task → Task
''' - Sostituire GUID con testi tradotti nella lingua corrente
''' </summary>
Public Class TaskAssembler

    ' ✅ Traduzioni per sostituire GUID con testi durante la compilazione
    Private translations As Dictionary(Of String, String)

    ''' <summary>
    ''' Imposta le traduzioni per la risoluzione dei GUID
    ''' </summary>
    Public Sub SetTranslations(translationsDict As Dictionary(Of String, String))
        translations = translationsDict
    End Sub

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
    ''' Risolve un valore: se è un GUID, cerca la traduzione; altrimenti usa il valore originale
    ''' Se il valore sembra essere una chiave non risolta (es. "ask.base"), restituisce stringa vuota
    ''' </summary>
    Private Function ResolveText(value As String) As String
        If String.IsNullOrEmpty(value) Then
            Return value
        End If

        If IsGuid(value) AndAlso translations IsNot Nothing AndAlso translations.ContainsKey(value) Then
            Dim translatedText = translations(value)
            If Not String.IsNullOrEmpty(translatedText) Then
                Return translatedText
            End If
        End If

        If value.Contains(".") AndAlso (value.StartsWith("ask.") OrElse value.StartsWith("confirm.") OrElse value.StartsWith("success.") OrElse value.StartsWith("noMatch.") OrElse value.StartsWith("noInput.")) Then
            Return $"Messaggio non trovato: {value}"
        End If

        ' Altrimenti usa il valore originale (non è un GUID o traduzione non trovata, ma sembra essere testo valido)
        Return value
    End Function

    ''' <summary>
    ''' Compila TaskTreeExpanded (IDE - AST montato) in RuntimeTask ricorsivo (Runtime)
    ''' Restituisce il RuntimeTask root dell'albero ricorsivo
    ''' </summary>
    Public Function Compile(assembled As Compiler.TaskTreeExpanded) As RuntimeTask
        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "TaskTreeExpanded cannot be Nothing")
        End If

        translations = If(assembled.Translations, New Dictionary(Of String, String)())
        ' ✅ NUOVO MODELLO: Costruisci RuntimeTask root ricorsivo
        ' Se c'è un solo nodo, è il root; se ce ne sono più, creiamo un nodo aggregato
        Dim rootTask As RuntimeTask = Nothing

        If assembled.Nodes IsNot Nothing AndAlso assembled.Nodes.Count > 0 Then
            If assembled.Nodes.Count = 1 Then
                ' Un solo nodo: è il root
                Dim taskNode As Compiler.TaskNode = assembled.Nodes(0)
                rootTask = CompileNode(taskNode, Nothing)
                rootTask.Id = assembled.Id ' Usa l'ID del TaskTreeExpanded come ID del root
            Else
                ' Più nodi: crea un nodo aggregato root con subTasks
                rootTask = New RuntimeTask() With {
                    .Id = assembled.Id,
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
                .Id = assembled.Id,
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
                If Not String.IsNullOrEmpty(ideTask.Text) Then
                    Return New MessageTask(ResolveText(ideTask.Text))
                End If
                If ideTask.Parameters IsNot Nothing Then
                    Dim textParam = ideTask.Parameters.FirstOrDefault(Function(p) p.ParameterId = "text")
                    If textParam IsNot Nothing AndAlso Not String.IsNullOrEmpty(textParam.Value) Then
                        Return New MessageTask(ResolveText(textParam.Value))
                    End If
                End If
                If ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
                    Dim parameters = ideTask.Value("parameters")
                    If TypeOf parameters Is List(Of Object) Then
                        Dim paramsList = CType(parameters, List(Of Object))
                        Dim textParam = paramsList.FirstOrDefault(Function(p) TypeOf p Is Dictionary(Of String, Object) AndAlso CType(p, Dictionary(Of String, Object)).ContainsKey("parameterId") AndAlso CType(p, Dictionary(Of String, Object))("parameterId")?.ToString() = "text")
                        If textParam IsNot Nothing Then
                            Dim textValue = CType(textParam, Dictionary(Of String, Object))("value")?.ToString()
                            If Not String.IsNullOrEmpty(textValue) Then
                                Return New MessageTask(ResolveText(textValue))
                            End If
                        End If
                    End If
                End If
                Console.WriteLine($"[COMPILER] ERROR: SayMessage task {ideTask.Id} has no text")
                Return Nothing
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
            currentPath = node.Name
        Else
            currentPath = $"{parentPath}.{node.Name}"
        End If

        node.FullLabel = currentPath

        ' Ricorsivo per subTasks
        If node.SubTasks IsNot Nothing Then
            For Each subNode As TaskEngine.TaskNode In node.SubTasks
                CalculateFullLabelForNode(subNode, currentPath)
            Next
        End If
    End Sub
End Class

