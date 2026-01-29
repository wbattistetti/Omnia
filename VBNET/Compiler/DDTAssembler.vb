Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports DDTEngine

''' <summary>
''' DDTAssembler: compila strutture IDE (AssembledDDT) in strutture Runtime (DDTInstance)
''' Responsabilità:
''' - Mappare campi uno a uno
''' - Normalizzare cardinalità (data singolo → MainDataList)
''' - Compilare tipi (DialogueStep IDE → DialogueStep Runtime)
''' - Gestire default e validazioni
''' - Sostituire GUID con testi tradotti nella lingua corrente
''' </summary>
Public Class DDTAssembler

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
                Console.WriteLine($"✅ [COMPILER][DDTAssembler] Resolved GUID to text: {value.Substring(0, 8)}... -> '{translatedText.Substring(0, Math.Min(50, translatedText.Length))}...'")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] Resolved GUID to text: {value} -> '{translatedText}'")
                Return translatedText
            End If
        End If

        ' ❌ Se il valore sembra essere una chiave non risolta (es. "ask.base", "confirm.base", ecc.), restituisci messaggio di errore con la chiave
        ' Questi valori indicano che il frontend ha inviato una chiave invece di un GUID o testo tradotto
        If value.Contains(".") AndAlso (value.StartsWith("ask.") OrElse value.StartsWith("confirm.") OrElse value.StartsWith("success.") OrElse value.StartsWith("noMatch.") OrElse value.StartsWith("noInput.")) Then
            Dim errorMessage = $"Messaggio non trovato: {value}"
            Console.WriteLine($"⚠️ [COMPILER][DDTAssembler] ResolveText: Detected unresolved key '{value}', returning error message")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DDTAssembler] ResolveText: Detected unresolved key '{value}', returning error message: '{errorMessage}'")
            Return errorMessage
        End If

        ' Altrimenti usa il valore originale (non è un GUID o traduzione non trovata, ma sembra essere testo valido)
        Return value
    End Function

    ''' <summary>
    ''' Compila AssembledDDT (IDE) in DDTInstance (Runtime)
    ''' </summary>
    Public Function Compile(assembled As Compiler.AssembledDDT) As DDTInstance
        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] Compile called for AssembledDDT Id={assembled.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] Compile called for AssembledDDT Id={assembled.Id}")

        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "AssembledDDT cannot be Nothing")
        End If

        ' ✅ Salva traduzioni per uso durante la conversione
        translations = If(assembled.Translations, New Dictionary(Of String, String)())
        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] Loaded {translations.Count} translations for GUID resolution")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] Loaded {translations.Count} translations for GUID resolution")

        ' ❌ REMOVED: .Label = assembled.Label, (label non serve a runtime, solo per UI)
        Dim instance As New DDTInstance() With {
            .Id = assembled.Id,
            .Translations = translations, ' ✅ Passa traduzioni all'istanza (per riferimento futuro se necessario)
            .MainDataList = New List(Of DDTNode)(),
            .IsAggregate = (assembled.Introduction IsNot Nothing)
        }

        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] assembled.Data IsNot Nothing={assembled.Data IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] assembled.Data IsNot Nothing={assembled.Data IsNot Nothing}")
        ' ✅ FIX: data è sempre una lista (normalizzata dal converter)
        If assembled.Data IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] assembled.Data.Count={assembled.Data.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] assembled.Data.Count={assembled.Data.Count}")
            For Each mainDataNode In assembled.Data
                If mainDataNode IsNot Nothing Then
                    Console.WriteLine($"🔍 [COMPILER][DDTAssembler] Converting mainDataNode: Id={mainDataNode.Id}, Name={mainDataNode.Name}, Steps IsNot Nothing={mainDataNode.Steps IsNot Nothing}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] Converting mainDataNode: Id={mainDataNode.Id}, Name={mainDataNode.Name}, Steps IsNot Nothing={mainDataNode.Steps IsNot Nothing}")
                    If mainDataNode.Steps IsNot Nothing Then
                        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] mainDataNode.Steps.Count={mainDataNode.Steps.Count}")
                        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] mainDataNode.Steps.Count={mainDataNode.Steps.Count}")
                    End If
                    Dim mainNode = CompileNode(mainDataNode, Nothing)
                    instance.MainDataList.Add(mainNode)
                    Console.WriteLine($"✅ [COMPILER][DDTAssembler] mainDataNode converted, runtimeNode.Steps.Count={mainNode.Steps.Count}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] mainDataNode converted, runtimeNode.Steps.Count={mainNode.Steps.Count}")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][DDTAssembler] assembled.Data is Nothing!")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DDTAssembler] assembled.Data is Nothing!")
        End If

        ' Compila Introduction (DialogueStep → Response)
        If assembled.Introduction IsNot Nothing Then
            instance.Introduction = CompileDialogueStepToResponse(assembled.Introduction)
        End If

        ' Calcola FullLabel per tutti i nodi (compile-time)
        CalculateFullLabels(instance)

        ' ✅ DEBUG: Verifica istanza finale PRIMA di restituirla
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] DEBUG: Final instance verification")
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.Id={If(String.IsNullOrEmpty(instance.Id), "NULL/EMPTY", instance.Id)}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.MainDataList IsNot Nothing={instance.MainDataList IsNot Nothing}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.MainDataList.Count={If(instance.MainDataList IsNot Nothing, instance.MainDataList.Count, 0)}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.IsAggregate={instance.IsAggregate}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.Introduction IsNot Nothing={instance.Introduction IsNot Nothing}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.SuccessResponse IsNot Nothing={instance.SuccessResponse IsNot Nothing}")
        Console.WriteLine($"[COMPILER][DDTAssembler] instance.Translations IsNot Nothing={instance.Translations IsNot Nothing}")
        If instance.Translations IsNot Nothing Then
            Console.WriteLine($"[COMPILER][DDTAssembler] instance.Translations.Count={instance.Translations.Count}")
        End If
        If instance.MainDataList IsNot Nothing AndAlso instance.MainDataList.Count > 0 Then
            Dim firstNode = instance.MainDataList(0)
            Console.WriteLine($"[COMPILER][DDTAssembler] First node: Id={If(String.IsNullOrEmpty(firstNode.Id), "NULL", firstNode.Id)}, Name={If(String.IsNullOrEmpty(firstNode.Name), "NULL", firstNode.Name)}, Steps.Count={firstNode.Steps.Count}")
        Else
            Console.WriteLine($"[COMPILER][DDTAssembler] ⚠️ WARNING: instance.MainDataList is empty or Nothing!")
        End If
        Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] DEBUG: Final instance verification")
        System.Diagnostics.Debug.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
        System.Diagnostics.Debug.WriteLine($"[COMPILER][DDTAssembler] instance.MainDataList.Count={If(instance.MainDataList IsNot Nothing, instance.MainDataList.Count, 0)}")

        Return instance
    End Function

    ''' <summary>
    ''' Compila MainDataNode (IDE) in DDTNode (Runtime)
    ''' Copia solo le proprietà necessarie per l'esecuzione runtime
    ''' </summary>
    Private Function CompileNode(ideNode As Compiler.MainDataNode, parentNode As DDTNode) As DDTNode
        ' ✅ Copia solo proprietà runtime essenziali:
        ' - Id: necessario per identificare il nodo
        ' - Name: usato per fallback regex hardcoded in Parser.vb
        ' - Required: usato per determinare se il dato è obbligatorio
        ' - SubTasks: necessario per nodi compositi
        ' - Steps: necessario per i response del dialogo
        ' - State, Value, ParentData: gestiti a runtime
        ' ❌ Rimosse proprietà design-time non usate a runtime:
        ' - Label: solo per UI
        ' - Type: non usato a runtime
        ' - Condition: non usato a runtime
        ' - Synonyms: non usato a runtime
        ' - Constraints: non usato a runtime (si usa ValidationConditions)
        Dim runtimeNode As New DDTNode() With {
            .Id = ideNode.Id,
            .Name = ideNode.Name,
            .Required = ideNode.Required,
            .Steps = New List(Of DDTEngine.DialogueStep)(),
            .SubTasks = New List(Of DDTNode)(),
            .State = DialogueState.Start,
            .Value = Nothing,
            .ParentData = parentNode
        }

        ' Compila Steps (DialogueStep[] → DialogueStep[])
        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        If ideNode.Steps IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            For Each ideStep As Compiler.DialogueStep In ideNode.Steps
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: compiling step type={ideStep.Type}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileNode: compiling step type={ideStep.Type}")
                Dim runtimeStep = CompileDialogueStep(ideStep)
                runtimeNode.Steps.Add(runtimeStep)
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileNode: ideNode.Steps is Nothing!")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileNode: ideNode.Steps is Nothing!")
        End If

        ' Compila SubData (ricorsivo)
        If ideNode.SubTasks IsNot Nothing Then
            For Each subNode As Compiler.MainDataNode In ideNode.SubTasks
                runtimeNode.SubTasks.Add(CompileNode(subNode, runtimeNode))
            Next
        End If

        Return runtimeNode
    End Function

    ''' <summary>
    ''' Compila DialogueStep (IDE) in DialogueStep (Runtime)
    ''' </summary>
    Private Function CompileDialogueStep(ideStep As Compiler.DialogueStep) As DDTEngine.DialogueStep
        Dim runtimeStep As New DDTEngine.DialogueStep() With {
            .Type = CompileStepType(ideStep.Type),
            .Escalations = New List(Of DDTEngine.Escalation)()
        }

        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")

        If ideStep.Escalations IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            For Each ideEscalation As Compiler.Escalation In ideStep.Escalations
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: compiling escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: compiling escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                If ideEscalation.Tasks IsNot Nothing Then
                    Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                End If
                Dim runtimeEscalation = CompileEscalation(ideEscalation)
                If runtimeEscalation IsNot Nothing Then
                    Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileDialogueStep: escalation compiled, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileDialogueStep: escalation compiled, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    runtimeStep.Escalations.Add(runtimeEscalation)
                Else
                    Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileDialogueStep: escalation compilation returned Nothing")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileDialogueStep: escalation compilation returned Nothing")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileDialogueStep: ideStep.Escalations is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileDialogueStep: ideStep.Escalations is Nothing")
        End If

        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
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
    Private Function CompileEscalation(ideEscalation As Compiler.Escalation) As DDTEngine.Escalation
        Dim runtimeEscalation As New DDTEngine.Escalation() With {
            .EscalationId = ideEscalation.EscalationId,
            .Tasks = New List(Of ITask)()
        }

        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")

        ' Compila Tasks (Task[] → ITask[])
        If ideEscalation.Tasks IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            For Each ideTask As Compiler.Task In ideEscalation.Tasks
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: compiling task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: compiling task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                Dim runtimeTask = CompileTask(ideTask)
                If runtimeTask IsNot Nothing Then
                    Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileEscalation: task compiled successfully")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileEscalation: task compiled successfully")
                    runtimeEscalation.Tasks.Add(runtimeTask)
                Else
                    Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileEscalation: task compilation returned Nothing for templateId={ideTask.TemplateId}")
                    System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileEscalation: task compilation returned Nothing for templateId={ideTask.TemplateId}")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileEscalation: ideEscalation.Tasks is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DDTAssembler] CompileEscalation: ideEscalation.Tasks is Nothing")
        End If

        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        Return runtimeEscalation
    End Function

    ''' <summary>
    ''' Compila Task (IDE) in ITask (Runtime)
    ''' </summary>
    Private Function CompileTask(ideTask As Compiler.Task) As ITask
        Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")

        ' ✅ DEBUG: Log Parameters array e Value dictionary
        If ideTask.Parameters IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            For Each param In ideTask.Parameters
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
            Next
        Else
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Parameters is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Parameters is Nothing")
        End If

        If ideTask.Value IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            If ideTask.Value.ContainsKey("parameters") Then
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Found 'parameters' key in Value")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Found 'parameters' key in Value")
            End If
        Else
            Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Value is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: ideTask.Value is Nothing")
        End If

        ' ✅ USA SOLO Type (enum numerico) - templateId è SOLO un GUID per riferimenti
        If Not ideTask.Type.HasValue Then
            Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Type is missing, returning Nothing")
            Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: NULL (REQUIRED)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)} (GUID reference, not used for type)")
            Console.WriteLine($"   - Text: {If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
            Console.WriteLine($"   - Parameters Count: {If(ideTask.Parameters IsNot Nothing, ideTask.Parameters.Count, 0)}")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Type is missing, returning Nothing")
            Return Nothing
        End If

        Dim typeValue = ideTask.Type.Value
        If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
            Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: {typeValue} (INVALID)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}")
            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Return Nothing
        End If

        Dim taskType = CType(typeValue, TaskTypes)
        Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Using Type enum: {taskType} (value={typeValue})")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Using Type enum: {taskType} (value={typeValue})")

        ' ✅ Usa taskType per determinare il tipo di task
        Select Case taskType
            Case TaskTypes.SayMessage
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Matched SayMessage/Message, checking for text...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Matched SayMessage/Message, checking for text...")
                ' ✅ Nuovo modello: text come proprietà diretta
                If Not String.IsNullOrEmpty(ideTask.Text) Then
                    Dim resolvedText = ResolveText(ideTask.Text)
                    Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with direct text: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with direct text: '{resolvedText}'")
                    Return New MessageTask(resolvedText)
                End If
                ' ✅ Nuovo modello: text in Parameters array (proprietà diretta)
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Direct text not found, checking Parameters array...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Direct text not found, checking Parameters array...")
                If ideTask.Parameters IsNot Nothing Then
                    Dim textParam = ideTask.Parameters.FirstOrDefault(Function(p) p.ParameterId = "text")
                    If textParam IsNot Nothing AndAlso Not String.IsNullOrEmpty(textParam.Value) Then
                        Dim resolvedText = ResolveText(textParam.Value)
                        Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with text from Parameters array: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with text from Parameters array: '{resolvedText}'")
                        Return New MessageTask(resolvedText)
                    End If
                End If

                ' ✅ Vecchio modello: text in value.parameters (backward compatibility)
                Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Parameters array not found, checking value.parameters...")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Parameters array not found, checking value.parameters...")
                If ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
                    Console.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Found 'parameters' in Value, extracting text...")
                    System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTAssembler] CompileTask: Found 'parameters' in Value, extracting text...")
                    Dim parameters = ideTask.Value("parameters")
                    If TypeOf parameters Is List(Of Object) Then
                        Dim paramsList = CType(parameters, List(Of Object))
                        Dim textParam = paramsList.FirstOrDefault(Function(p) TypeOf p Is Dictionary(Of String, Object) AndAlso CType(p, Dictionary(Of String, Object)).ContainsKey("parameterId") AndAlso CType(p, Dictionary(Of String, Object))("parameterId")?.ToString() = "text")
                        If textParam IsNot Nothing Then
                            Dim textValue = CType(textParam, Dictionary(Of String, Object))("value")?.ToString()
                            If Not String.IsNullOrEmpty(textValue) Then
                                Dim resolvedText = ResolveText(textValue)
                                Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with text from value.parameters: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating MessageTask with text from value.parameters: '{resolvedText}'")
                                Return New MessageTask(resolvedText)
                            End If
                        End If
                    End If
                End If
                Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: No text found for SayMessage task, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: No text found for SayMessage task, returning Nothing")
                Return Nothing
            Case TaskTypes.CloseSession
                Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating CloseSessionTask")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating CloseSessionTask")
                Return New CloseSessionTask()
            Case TaskTypes.Transfer
                Console.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating TransferTask")
                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTAssembler] CompileTask: Creating TransferTask")
                Return New TransferTask()
            Case TaskTypes.UtteranceInterpretation
                Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: UtteranceInterpretation tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: UtteranceInterpretation tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.BackendCall
                Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: BackendCall tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: BackendCall tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.ClassifyProblem
                Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case Else
                Console.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Unknown TaskType '{taskType}', returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DDTAssembler] CompileTask: Unknown TaskType '{taskType}', returning Nothing")
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
    Private Sub CalculateFullLabels(instance As DDTInstance)
        If instance.MainDataList IsNot Nothing Then
            For Each mainData As DDTNode In instance.MainDataList
                CalculateFullLabelForNode(mainData, "")
            Next
        End If
    End Sub

    ''' <summary>
    ''' Calcola FullLabel ricorsivamente per un nodo
    ''' </summary>
    Private Sub CalculateFullLabelForNode(node As DDTNode, parentPath As String)
        Dim currentPath As String
        If String.IsNullOrEmpty(parentPath) Then
            currentPath = node.Name
        Else
            currentPath = $"{parentPath}.{node.Name}"
        End If

        node.FullLabel = currentPath

        ' Ricorsivo per subData
        If node.SubTasks IsNot Nothing Then
            For Each subNode As DDTNode In node.SubTasks
                CalculateFullLabelForNode(subNode, currentPath)
            Next
        End If
    End Sub
End Class

