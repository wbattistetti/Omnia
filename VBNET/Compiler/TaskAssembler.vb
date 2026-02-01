Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
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

        ' Se è un GUID e abbiamo traduzioni, cerca la traduzione
        If IsGuid(value) AndAlso translations IsNot Nothing AndAlso translations.ContainsKey(value) Then
            Dim translatedText = translations(value)
            If Not String.IsNullOrEmpty(translatedText) Then
                Console.WriteLine($"✅ [COMPILER][TaskAssembler] Resolved GUID to text: {value.Substring(0, 8)}... -> '{translatedText.Substring(0, Math.Min(50, translatedText.Length))}...'")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] Resolved GUID to text: {value} -> '{translatedText}'")
                Return translatedText
            End If
        End If

        ' ❌ Se il valore sembra essere una chiave non risolta (es. "ask.base", "confirm.base", ecc.), restituisci messaggio di errore con la chiave
        ' Questi valori indicano che il frontend ha inviato una chiave invece di un GUID o testo tradotto
        If value.Contains(".") AndAlso (value.StartsWith("ask.") OrElse value.StartsWith("confirm.") OrElse value.StartsWith("success.") OrElse value.StartsWith("noMatch.") OrElse value.StartsWith("noInput.")) Then
            Dim errorMessage = $"Messaggio non trovato: {value}"
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] ResolveText: Detected unresolved key '{value}', returning error message")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] ResolveText: Detected unresolved key '{value}', returning error message: '{errorMessage}'")
            Return errorMessage
        End If

        ' Altrimenti usa il valore originale (non è un GUID o traduzione non trovata, ma sembra essere testo valido)
        Return value
    End Function

    ''' <summary>
    ''' Compila TaskTreeExpanded (IDE - AST montato) in RuntimeTask ricorsivo (Runtime)
    ''' Restituisce il RuntimeTask root dell'albero ricorsivo
    ''' </summary>
    Public Function Compile(assembled As Compiler.TaskTreeExpanded) As RuntimeTask
        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] Compile called for TaskTreeExpanded Id={assembled.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] Compile called for TaskTreeExpanded Id={assembled.Id}")

        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "TaskTreeExpanded cannot be Nothing")
        End If

        ' ✅ Salva traduzioni per uso durante la conversione
        translations = If(assembled.Translations, New Dictionary(Of String, String)())
        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] Loaded {translations.Count} translations for GUID resolution")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] Loaded {translations.Count} translations for GUID resolution")

        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] assembled.Nodes IsNot Nothing={assembled.Nodes IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] assembled.Nodes IsNot Nothing={assembled.Nodes IsNot Nothing}")
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
                .SubTasks = Nothing ' ✅ Nessun subTask, quindi Nothing
            }
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] assembled.Nodes is empty, created empty root Task")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] assembled.Nodes is empty, created empty root Task")
        End If

        ' ✅ DEBUG: Verifica Task finale
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] DEBUG: Final Task verification")
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine($"[COMPILER][TaskAssembler] rootTask.Id={If(String.IsNullOrEmpty(rootTask.Id), "NULL/EMPTY", rootTask.Id)}")
        Console.WriteLine($"[COMPILER][TaskAssembler] rootTask.Steps.Count={If(rootTask.Steps IsNot Nothing, rootTask.Steps.Count, 0)}")
        Console.WriteLine($"[COMPILER][TaskAssembler] rootTask.Constraints.Count={If(rootTask.Constraints IsNot Nothing, rootTask.Constraints.Count, 0)}")
        Console.WriteLine($"[COMPILER][TaskAssembler] rootTask.SubTasks.Count={If(rootTask.SubTasks IsNot Nothing, rootTask.SubTasks.Count, 0)}")
        If rootTask.SubTasks IsNot Nothing AndAlso rootTask.SubTasks.Count > 0 Then
            Dim firstSubTask = rootTask.SubTasks(0)
            Console.WriteLine($"[COMPILER][TaskAssembler] First subTask: Id={If(String.IsNullOrEmpty(firstSubTask.Id), "NULL", firstSubTask.Id)}, Steps.Count={If(firstSubTask.Steps IsNot Nothing, firstSubTask.Steps.Count, 0)}")
        End If
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")

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

        ' Compila Steps (DialogueStep[] → DialogueStep[])
        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        If ideNode.Steps IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            For Each ideStep As Compiler.DialogueStep In ideNode.Steps
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: compiling step type={ideStep.Type}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: compiling step type={ideStep.Type}")
                Dim runtimeStep = CompileDialogueStep(ideStep)
                task.Steps.Add(runtimeStep)
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileNode: ideNode.Steps is Nothing!")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileNode: ideNode.Steps is Nothing!")
        End If

        ' ✅ Compila Constraints in ValidationConditions
        If ideNode.Constraints IsNot Nothing AndAlso ideNode.Constraints.Count > 0 Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: Converting {ideNode.Constraints.Count} constraints to ValidationConditions")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileNode: Converting {ideNode.Constraints.Count} constraints to ValidationConditions")
            For Each constraintObj As Object In ideNode.Constraints
                Dim validationCondition = ConvertConstraintToValidationCondition(constraintObj)
                If validationCondition IsNot Nothing Then
                    task.Constraints.Add(validationCondition)
                End If
            Next
            Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileNode: Converted {task.Constraints.Count} constraints to ValidationConditions")
            System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileNode: Converted {task.Constraints.Count} constraints to ValidationConditions")
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
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] Failed to convert constraint to ValidationCondition: {ex.Message}")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] Failed to convert constraint: {ex.ToString()}")
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

        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")

        If ideStep.Escalations IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            For Each ideEscalation As Compiler.Escalation In ideStep.Escalations
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: compiling escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: compiling escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                If ideEscalation.Tasks IsNot Nothing Then
                    Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                End If
                Dim runtimeEscalation = CompileEscalation(ideEscalation)
                If runtimeEscalation IsNot Nothing Then
                    Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileDialogueStep: escalation compiled, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileDialogueStep: escalation compiled, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    runtimeStep.Escalations.Add(runtimeEscalation)
                Else
                    Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileDialogueStep: escalation compilation returned Nothing")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileDialogueStep: escalation compilation returned Nothing")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileDialogueStep: ideStep.Escalations is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileDialogueStep: ideStep.Escalations is Nothing")
        End If

        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
        Return runtimeStep
    End Function

    ''' <summary>
    ''' Compila stringa step type in DialogueState enum
    ''' </summary>
    Private Function CompileStepType(typeStr As String) As DialogueState
        If String.IsNullOrEmpty(typeStr) Then
            Return DialogueState.Start
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
            Case "success"
                Return DialogueState.Success
            Case "introduction"
                Return DialogueState.Start
            Case Else
                Return DialogueState.Start
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

        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")

        ' Compila Tasks (Task[] → ITask[])
        If ideEscalation.Tasks IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            For Each ideTask As Compiler.Task In ideEscalation.Tasks
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: compiling task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: compiling task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                Dim runtimeTask = CompileTask(ideTask)
                If runtimeTask IsNot Nothing Then
                    Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileEscalation: task compiled successfully")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileEscalation: task compiled successfully")
                    runtimeEscalation.Tasks.Add(runtimeTask)
                Else
                    Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileEscalation: task compilation returned Nothing for templateId={ideTask.TemplateId}")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileEscalation: task compilation returned Nothing for templateId={ideTask.TemplateId}")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileEscalation: ideEscalation.Tasks is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][TaskAssembler] CompileEscalation: ideEscalation.Tasks is Nothing")
        End If

        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        Return runtimeEscalation
    End Function

    ''' <summary>
    ''' Compila Task (IDE) in ITask (Runtime)
    ''' </summary>
    Private Function CompileTask(ideTask As Compiler.Task) As ITask
        Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")

        ' ✅ DEBUG: Log Parameters array e Value dictionary
        If ideTask.Parameters IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            For Each param In ideTask.Parameters
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
            Next
        Else
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Parameters is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Parameters is Nothing")
        End If

        If ideTask.Value IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            If ideTask.Value.ContainsKey("parameters") Then
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Found 'parameters' key in Value")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Found 'parameters' key in Value")
            End If
        Else
            Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Value is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: ideTask.Value is Nothing")
        End If

        ' ✅ NO FALLBACK - Type MUST be present and valid
        If Not ideTask.Type.HasValue Then
            Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Type is missing, returning Nothing")
            Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: NULL (REQUIRED - NO FALLBACK)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}")
            Console.WriteLine($"   - Text: {If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
            Console.WriteLine($"   - Parameters Count: {If(ideTask.Parameters IsNot Nothing, ideTask.Parameters.Count, 0)}")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Type is missing, returning Nothing")
            Return Nothing
        End If

        Dim typeValue = ideTask.Type.Value
        If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
            Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: {typeValue} (INVALID - NO FALLBACK)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Return Nothing
        End If

        Dim taskType = CType(typeValue, TaskTypes)
        Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Using Type enum: {taskType} (value={typeValue})")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Using Type enum: {taskType} (value={typeValue})")

        ' ✅ Usa taskType per determinare il tipo di task
        Select Case taskType
            Case TaskTypes.SayMessage
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Matched SayMessage/Message, checking for text...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Matched SayMessage/Message, checking for text...")
                ' ✅ Nuovo modello: text come proprietà diretta
                If Not String.IsNullOrEmpty(ideTask.Text) Then
                    Dim resolvedText = ResolveText(ideTask.Text)
                    Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with direct text: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with direct text: '{resolvedText}'")
                    Return New MessageTask(resolvedText)
                End If
                ' ✅ Nuovo modello: text in Parameters array (proprietà diretta)
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Direct text not found, checking Parameters array...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Direct text not found, checking Parameters array...")
                If ideTask.Parameters IsNot Nothing Then
                    Dim textParam = ideTask.Parameters.FirstOrDefault(Function(p) p.ParameterId = "text")
                    If textParam IsNot Nothing AndAlso Not String.IsNullOrEmpty(textParam.Value) Then
                        Dim resolvedText = ResolveText(textParam.Value)
                        Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with text from Parameters array: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with text from Parameters array: '{resolvedText}'")
                        Return New MessageTask(resolvedText)
                    End If
                End If

                ' ✅ Vecchio modello: text in value.parameters (backward compatibility)
                Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Parameters array not found, checking value.parameters...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Parameters array not found, checking value.parameters...")
                If ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
                    Console.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Found 'parameters' in Value, extracting text...")
                    System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskAssembler] CompileTask: Found 'parameters' in Value, extracting text...")
                    Dim parameters = ideTask.Value("parameters")
                    If TypeOf parameters Is List(Of Object) Then
                        Dim paramsList = CType(parameters, List(Of Object))
                        Dim textParam = paramsList.FirstOrDefault(Function(p) TypeOf p Is Dictionary(Of String, Object) AndAlso CType(p, Dictionary(Of String, Object)).ContainsKey("parameterId") AndAlso CType(p, Dictionary(Of String, Object))("parameterId")?.ToString() = "text")
                        If textParam IsNot Nothing Then
                            Dim textValue = CType(textParam, Dictionary(Of String, Object))("value")?.ToString()
                            If Not String.IsNullOrEmpty(textValue) Then
                                Dim resolvedText = ResolveText(textValue)
                                Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with text from value.parameters: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating MessageTask with text from value.parameters: '{resolvedText}'")
                                Return New MessageTask(resolvedText)
                            End If
                        End If
                    End If
                End If
                Console.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: No text found for SayMessage task, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][TaskAssembler] CompileTask: No text found for SayMessage task, returning Nothing")
                Return Nothing
            Case TaskTypes.CloseSession
                Console.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating CloseSessionTask")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskAssembler] CompileTask: Creating CloseSessionTask")
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

