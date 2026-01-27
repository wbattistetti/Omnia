Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports DDTEngine

''' <summary>
''' DDTAssembler: trasforma strutture IDE (AssembledDDT) in strutture Runtime (DDTInstance)
''' Responsabilità:
''' - Mappare campi uno a uno
''' - Normalizzare cardinalità (mainData singolo → MainDataList)
''' - Convertire tipi (DialogueStep IDE → DialogueStep Runtime)
''' - Gestire default e validazioni
''' - Sostituire GUID con testi tradotti nella lingua corrente
''' </summary>
Public Class DDTAssembler

    ' ✅ Traduzioni per sostituire GUID con testi durante la compilazione
    Private translations As Dictionary(Of String, String)

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
                Console.WriteLine($"✅ [DDTAssembler] Resolved GUID to text: {value.Substring(0, 8)}... -> '{translatedText.Substring(0, Math.Min(50, translatedText.Length))}...'")
                System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] Resolved GUID to text: {value} -> '{translatedText}'")
                Return translatedText
            End If
        End If

        ' ❌ Se il valore sembra essere una chiave non risolta (es. "ask.base", "confirm.base", ecc.), restituisci messaggio di errore con la chiave
        ' Questi valori indicano che il frontend ha inviato una chiave invece di un GUID o testo tradotto
        If value.Contains(".") AndAlso (value.StartsWith("ask.") OrElse value.StartsWith("confirm.") OrElse value.StartsWith("success.") OrElse value.StartsWith("noMatch.") OrElse value.StartsWith("noInput.")) Then
            Dim errorMessage = $"Messaggio non trovato: {value}"
            Console.WriteLine($"⚠️ [DDTAssembler] ResolveText: Detected unresolved key '{value}', returning error message")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DDTAssembler] ResolveText: Detected unresolved key '{value}', returning error message: '{errorMessage}'")
            Return errorMessage
        End If

        ' Altrimenti usa il valore originale (non è un GUID o traduzione non trovata, ma sembra essere testo valido)
        Return value
    End Function

    ''' <summary>
    ''' Trasforma AssembledDDT (IDE) in DDTInstance (Runtime)
    ''' </summary>
    Public Function ToRuntime(assembled As Compiler.AssembledDDT) As DDTInstance
        Console.WriteLine($"🔍 [DDTAssembler] ToRuntime called for AssembledDDT Id={assembled.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ToRuntime called for AssembledDDT Id={assembled.Id}")

        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "AssembledDDT cannot be Nothing")
        End If

        ' ✅ Salva traduzioni per uso durante la conversione
        translations = If(assembled.Translations, New Dictionary(Of String, String)())
        Console.WriteLine($"🔍 [DDTAssembler] Loaded {translations.Count} translations for GUID resolution")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] Loaded {translations.Count} translations for GUID resolution")

        ' ❌ REMOVED: .Label = assembled.Label, (label non serve a runtime, solo per UI)
        Dim instance As New DDTInstance() With {
            .Id = assembled.Id,
            .Translations = translations, ' ✅ Passa traduzioni all'istanza (per riferimento futuro se necessario)
            .MainDataList = New List(Of DDTNode)(),
            .IsAggregate = (assembled.Introduction IsNot Nothing)
        }

        Console.WriteLine($"🔍 [DDTAssembler] assembled.MainData IsNot Nothing={assembled.MainData IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] assembled.MainData IsNot Nothing={assembled.MainData IsNot Nothing}")
        ' ✅ FIX: mainData è ora sempre una lista (normalizzata dal converter)
        ' Gestisce sia oggetto singolo che array
        If assembled.MainData IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] assembled.MainData.Count={assembled.MainData.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] assembled.MainData.Count={assembled.MainData.Count}")
            For Each mainDataNode In assembled.MainData
                If mainDataNode IsNot Nothing Then
                    Console.WriteLine($"🔍 [DDTAssembler] Converting mainDataNode: Id={mainDataNode.Id}, Name={mainDataNode.Name}, Steps IsNot Nothing={mainDataNode.Steps IsNot Nothing}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] Converting mainDataNode: Id={mainDataNode.Id}, Name={mainDataNode.Name}, Steps IsNot Nothing={mainDataNode.Steps IsNot Nothing}")
                    If mainDataNode.Steps IsNot Nothing Then
                        Console.WriteLine($"🔍 [DDTAssembler] mainDataNode.Steps.Count={mainDataNode.Steps.Count}")
                        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] mainDataNode.Steps.Count={mainDataNode.Steps.Count}")
                    End If
                    Dim mainNode = ConvertNode(mainDataNode, Nothing)
                    instance.MainDataList.Add(mainNode)
                    Console.WriteLine($"✅ [DDTAssembler] mainDataNode converted, runtimeNode.Steps.Count={mainNode.Steps.Count}")
                    System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] mainDataNode converted, runtimeNode.Steps.Count={mainNode.Steps.Count}")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [DDTAssembler] assembled.MainData is Nothing!")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DDTAssembler] assembled.MainData is Nothing!")
        End If

        ' Converti Introduction (DialogueStep → Response)
        If assembled.Introduction IsNot Nothing Then
            instance.Introduction = ConvertDialogueStepToResponse(assembled.Introduction)
        End If

        ' Calcola FullLabel per tutti i nodi (compile-time)
        CalculateFullLabels(instance)

        Return instance
    End Function

    ''' <summary>
    ''' Converte MainDataNode (IDE) in DDTNode (Runtime)
    ''' Copia solo le proprietà necessarie per l'esecuzione runtime
    ''' </summary>
    Private Function ConvertNode(ideNode As Compiler.MainDataNode, parentNode As DDTNode) As DDTNode
        ' ✅ Copia solo proprietà runtime essenziali:
        ' - Id: necessario per identificare il nodo
        ' - Name: usato per fallback regex hardcoded in Parser.vb
        ' - Required: usato per determinare se il dato è obbligatorio
        ' - SubData: necessario per nodi compositi
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
            .SubData = New List(Of DDTNode)(),
            .State = DialogueState.Start,
            .Value = Nothing,
            .ParentData = parentNode
        }

        ' Converti Steps (DialogueStep[] → DialogueStep[])
        Console.WriteLine($"🔍 [DDTAssembler] ConvertNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertNode: ideNode.Steps IsNot Nothing={ideNode.Steps IsNot Nothing}")
        If ideNode.Steps IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] ConvertNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertNode: ideNode.Steps.Count={ideNode.Steps.Count}")
            For Each ideStep As Compiler.DialogueStep In ideNode.Steps
                Console.WriteLine($"🔍 [DDTAssembler] ConvertNode: converting step type={ideStep.Type}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertNode: converting step type={ideStep.Type}")
                Dim runtimeStep = ConvertDialogueStep(ideStep)
                runtimeNode.Steps.Add(runtimeStep)
            Next
        Else
            Console.WriteLine($"⚠️ [DDTAssembler] ConvertNode: ideNode.Steps is Nothing!")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DDTAssembler] ConvertNode: ideNode.Steps is Nothing!")
        End If

        ' Converti SubData (ricorsivo)
        If ideNode.SubData IsNot Nothing Then
            For Each subNode As Compiler.MainDataNode In ideNode.SubData
                runtimeNode.SubData.Add(ConvertNode(subNode, runtimeNode))
            Next
        End If

        Return runtimeNode
    End Function

    ''' <summary>
    ''' Converte DialogueStep (IDE) in DialogueStep (Runtime)
    ''' </summary>
    Private Function ConvertDialogueStep(ideStep As Compiler.DialogueStep) As DDTEngine.DialogueStep
        Dim runtimeStep As New DDTEngine.DialogueStep() With {
            .Type = ConvertStepType(ideStep.Type),
            .Escalations = New List(Of DDTEngine.Escalation)()
        }

        Console.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: type={ideStep.Type}, escalations IsNot Nothing={ideStep.Escalations IsNot Nothing}")

        If ideStep.Escalations IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: escalations.Count={ideStep.Escalations.Count}")
            For Each ideEscalation As Compiler.Escalation In ideStep.Escalations
                Console.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: converting escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: converting escalation {ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
                If ideEscalation.Tasks IsNot Nothing Then
                    Console.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: escalation.Tasks.Count={ideEscalation.Tasks.Count}")
                End If
                Dim runtimeEscalation = ConvertEscalation(ideEscalation)
                If runtimeEscalation IsNot Nothing Then
                    Console.WriteLine($"✅ [DDTAssembler] ConvertDialogueStep: escalation converted, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertDialogueStep: escalation converted, runtime.Tasks.Count={runtimeEscalation.Tasks.Count}")
                    runtimeStep.Escalations.Add(runtimeEscalation)
                Else
                    Console.WriteLine($"❌ [DDTAssembler] ConvertDialogueStep: escalation conversion returned Nothing")
                    System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertDialogueStep: escalation conversion returned Nothing")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [DDTAssembler] ConvertDialogueStep: ideStep.Escalations is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DDTAssembler] ConvertDialogueStep: ideStep.Escalations is Nothing")
        End If

        Console.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertDialogueStep: final runtimeStep.Escalations.Count={runtimeStep.Escalations.Count}")
        Return runtimeStep
    End Function

    ''' <summary>
    ''' Converte stringa step type in DialogueState enum
    ''' </summary>
    Private Function ConvertStepType(typeStr As String) As DialogueState
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
    ''' Converte Escalation (IDE) in Escalation (Runtime)
    ''' </summary>
    Private Function ConvertEscalation(ideEscalation As Compiler.Escalation) As DDTEngine.Escalation
        Dim runtimeEscalation As New DDTEngine.Escalation() With {
            .EscalationId = ideEscalation.EscalationId,
            .Tasks = New List(Of ITask)()
        }

        Console.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: escalationId={ideEscalation.EscalationId}, tasks IsNot Nothing={ideEscalation.Tasks IsNot Nothing}")

        ' Converti Tasks (Task[] → ITask[])
        If ideEscalation.Tasks IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: ideEscalation.Tasks.Count={ideEscalation.Tasks.Count}")
            For Each ideTask As Compiler.Task In ideEscalation.Tasks
                Console.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: converting task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: converting task id={ideTask.Id}, templateId={ideTask.TemplateId}, text={ideTask.Text}")
                Dim runtimeTask = ConvertTask(ideTask)
                If runtimeTask IsNot Nothing Then
                    Console.WriteLine($"✅ [DDTAssembler] ConvertEscalation: task converted successfully")
                    System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertEscalation: task converted successfully")
                    runtimeEscalation.Tasks.Add(runtimeTask)
                Else
                    Console.WriteLine($"❌ [DDTAssembler] ConvertEscalation: task conversion returned Nothing for templateId={ideTask.TemplateId}")
                    System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertEscalation: task conversion returned Nothing for templateId={ideTask.TemplateId}")
                End If
            Next
        Else
            Console.WriteLine($"⚠️ [DDTAssembler] ConvertEscalation: ideEscalation.Tasks is Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DDTAssembler] ConvertEscalation: ideEscalation.Tasks is Nothing")
        End If

        Console.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertEscalation: final runtimeEscalation.Tasks.Count={runtimeEscalation.Tasks.Count}")
        Return runtimeEscalation
    End Function

    ''' <summary>
    ''' Converte Task (IDE) in ITask (Runtime)
    ''' </summary>
    Private Function ConvertTask(ideTask As Compiler.Task) As ITask
        Console.WriteLine($"🔍 [DDTAssembler] ConvertTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask called: id={ideTask.Id}, type={If(ideTask.Type.HasValue, ideTask.Type.Value.ToString(), "NULL")}, templateId={If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}, text={If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")

        ' ✅ DEBUG: Log Parameters array e Value dictionary
        If ideTask.Parameters IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Parameters IsNot Nothing, Count={ideTask.Parameters.Count}")
            For Each param In ideTask.Parameters
                Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Parameter parameterId={param.ParameterId}, value={param.Value}")
            Next
        Else
            Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Parameters is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Parameters is Nothing")
        End If

        If ideTask.Value IsNot Nothing Then
            Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Value IsNot Nothing, keys={String.Join(", ", ideTask.Value.Keys)}")
            If ideTask.Value.ContainsKey("parameters") Then
                Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Found 'parameters' key in Value")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Found 'parameters' key in Value")
            End If
        Else
            Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Value is Nothing")
            System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: ideTask.Value is Nothing")
        End If

        ' ✅ USA SOLO Type (enum numerico) - templateId è SOLO un GUID per riferimenti
        If Not ideTask.Type.HasValue Then
            Console.WriteLine($"❌ [DDTAssembler] ConvertTask: Type is missing, returning Nothing")
            Console.WriteLine($"❌ [DDTAssembler] ConvertTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: NULL (REQUIRED)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)} (GUID reference, not used for type)")
            Console.WriteLine($"   - Text: {If(String.IsNullOrEmpty(ideTask.Text), "EMPTY", ideTask.Text)}")
            Console.WriteLine($"   - Parameters Count: {If(ideTask.Parameters IsNot Nothing, ideTask.Parameters.Count, 0)}")
            System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: Type is missing, returning Nothing")
            Return Nothing
        End If

        Dim typeValue = ideTask.Type.Value
        If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
            Console.WriteLine($"❌ [DDTAssembler] ConvertTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Console.WriteLine($"❌ [DDTAssembler] ConvertTask: Task structure:")
            Console.WriteLine($"   - Id: {ideTask.Id}")
            Console.WriteLine($"   - Type: {typeValue} (INVALID)")
            Console.WriteLine($"   - TemplateId: {If(String.IsNullOrEmpty(ideTask.TemplateId), "EMPTY", ideTask.TemplateId)}")
            System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: Invalid Type enum value: {typeValue}, returning Nothing")
            Return Nothing
        End If

        Dim taskType = CType(typeValue, TaskTypes)
        Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Using Type enum: {taskType} (value={typeValue})")
        System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Using Type enum: {taskType} (value={typeValue})")

        ' ✅ Usa taskType per determinare il tipo di task
        Select Case taskType
            Case TaskTypes.SayMessage
                Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Matched SayMessage/Message, checking for text...")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Matched SayMessage/Message, checking for text...")
                ' ✅ Nuovo modello: text come proprietà diretta
                If Not String.IsNullOrEmpty(ideTask.Text) Then
                    Dim resolvedText = ResolveText(ideTask.Text)
                    Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with direct text: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                    System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with direct text: '{resolvedText}'")
                    Return New MessageTask(resolvedText)
                End If
                ' ✅ Nuovo modello: text in Parameters array (proprietà diretta)
                Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Direct text not found, checking Parameters array...")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Direct text not found, checking Parameters array...")
                If ideTask.Parameters IsNot Nothing Then
                    Dim textParam = ideTask.Parameters.FirstOrDefault(Function(p) p.ParameterId = "text")
                    If textParam IsNot Nothing AndAlso Not String.IsNullOrEmpty(textParam.Value) Then
                        Dim resolvedText = ResolveText(textParam.Value)
                        Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with text from Parameters array: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                        System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with text from Parameters array: '{resolvedText}'")
                        Return New MessageTask(resolvedText)
                    End If
                End If

                ' ✅ Vecchio modello: text in value.parameters (backward compatibility)
                Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Parameters array not found, checking value.parameters...")
                System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Parameters array not found, checking value.parameters...")
                If ideTask.Value IsNot Nothing AndAlso ideTask.Value.ContainsKey("parameters") Then
                    Console.WriteLine($"🔍 [DDTAssembler] ConvertTask: Found 'parameters' in Value, extracting text...")
                    System.Diagnostics.Debug.WriteLine($"🔍 [DDTAssembler] ConvertTask: Found 'parameters' in Value, extracting text...")
                    Dim parameters = ideTask.Value("parameters")
                    If TypeOf parameters Is List(Of Object) Then
                        Dim paramsList = CType(parameters, List(Of Object))
                        Dim textParam = paramsList.FirstOrDefault(Function(p) TypeOf p Is Dictionary(Of String, Object) AndAlso CType(p, Dictionary(Of String, Object)).ContainsKey("parameterId") AndAlso CType(p, Dictionary(Of String, Object))("parameterId")?.ToString() = "text")
                        If textParam IsNot Nothing Then
                            Dim textValue = CType(textParam, Dictionary(Of String, Object))("value")?.ToString()
                            If Not String.IsNullOrEmpty(textValue) Then
                                Dim resolvedText = ResolveText(textValue)
                                Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with text from value.parameters: '{resolvedText.Substring(0, Math.Min(50, resolvedText.Length))}...'")
                                System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating MessageTask with text from value.parameters: '{resolvedText}'")
                                Return New MessageTask(resolvedText)
                            End If
                        End If
                    End If
                End If
                Console.WriteLine($"❌ [DDTAssembler] ConvertTask: No text found for SayMessage task, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: No text found for SayMessage task, returning Nothing")
                Return Nothing
            Case TaskTypes.CloseSession
                Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating CloseSessionTask")
                System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating CloseSessionTask")
                Return New CloseSessionTask()
            Case TaskTypes.Transfer
                Console.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating TransferTask")
                System.Diagnostics.Debug.WriteLine($"✅ [DDTAssembler] ConvertTask: Creating TransferTask")
                Return New TransferTask()
            Case TaskTypes.DataRequest
                Console.WriteLine($"❌ [DDTAssembler] ConvertTask: DataRequest tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: DataRequest tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.BackendCall
                Console.WriteLine($"❌ [DDTAssembler] ConvertTask: BackendCall tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: BackendCall tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case TaskTypes.ClassifyProblem
                Console.WriteLine($"❌ [DDTAssembler] ConvertTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: ClassifyProblem tasks are not supported in escalations, returning Nothing")
                Return Nothing
            Case Else
                Console.WriteLine($"❌ [DDTAssembler] ConvertTask: Unknown TaskType '{taskType}', returning Nothing")
                System.Diagnostics.Debug.WriteLine($"❌ [DDTAssembler] ConvertTask: Unknown TaskType '{taskType}', returning Nothing")
                Return Nothing
        End Select
    End Function

    ''' <summary>
    ''' Converte DialogueStep in Response (per Introduction)
    ''' </summary>
    Private Function ConvertDialogueStepToResponse(ideStep As Compiler.DialogueStep) As Response
        Dim response As New Response()

        ' Prendi la prima escalation del primo step
        If ideStep.Escalations IsNot Nothing AndAlso ideStep.Escalations.Count > 0 Then
            Dim firstEscalation = ideStep.Escalations(0)
            If firstEscalation.Tasks IsNot Nothing Then
                For Each ideTask As Compiler.Task In firstEscalation.Tasks
                    Dim runtimeTask = ConvertTask(ideTask)
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
        If node.SubData IsNot Nothing Then
            For Each subNode As DDTNode In node.SubData
                CalculateFullLabelForNode(subNode, currentPath)
            Next
        End If
    End Sub
End Class

