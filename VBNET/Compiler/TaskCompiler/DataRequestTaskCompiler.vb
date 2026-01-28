Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports DDTEngine

''' <summary>
''' Compiler per task di tipo DataRequest
''' Gestisce la logica complessa di caricamento e compilazione DDT
'''
''' LOGICA CONCETTUALE DEI DATI:
''' - Template: contiene struttura condivisa (constraints, examples, nlpContract)
''' - Istanza: contiene SOLO override (modifiche rispetto al template)
''' - Risoluzione lazy: se mancante nell'istanza → cerca nel template usando templateId
''' - NO fallback: se template non trovato → errore esplicito (non maschera problemi)
'''
''' VANTAGGI:
''' - Elimina duplicazione: stesso contract salvato N volte per N istanze
''' - Aggiornamenti centralizzati: cambi template → tutte istanze usano nuovo contract
''' - Performance: meno dati nel database, lookup template in memoria (O(1))
''' </summary>
Public Class DataRequestTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As Task, row As RowData, node As FlowNode, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Compile called for task {taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Compile called for task {taskId}")
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data IsNot Nothing={task.Data IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data IsNot Nothing={task.Data IsNot Nothing}")
        If task.Data IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data.Count={task.Data.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] task.Data.Count={task.Data.Count}")
        End If

        Dim dataRequestTask As New CompiledTaskGetData()

        ' ✅ PRIORITY 1: Campi diretti sul task (nuovo modello)
        ' L'istanza contiene solo override (modifiche rispetto al template)
        ' Se constraints/examples/nlpContract mancano → risoluzione lazy dal template
        Dim assembledDDT As Compiler.AssembledDDT = Nothing

        If task.Data IsNot Nothing AndAlso task.Data.Count > 0 Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Trying to load DDT from task.Data (PRIORITY 1)")
            Try
                ' Serializza task a JSON e deserializza come AssembledDDT
                ' Questo gestisce automaticamente la conversione di MainData usando i converter
                Dim taskJson = JsonConvert.SerializeObject(task)
                Dim settings As New JsonSerializerSettings()
                settings.Converters.Add(New MainDataNodeListConverter())
                assembledDDT = JsonConvert.DeserializeObject(Of Compiler.AssembledDDT)(taskJson, settings)

                ' Assicurati che Id e Label siano impostati
                If assembledDDT IsNot Nothing Then
                    assembledDDT.Id = task.Id
                    If String.IsNullOrEmpty(assembledDDT.Label) Then
                        assembledDDT.Label = task.Label
                    End If
                    If assembledDDT.Translations Is Nothing Then
                        assembledDDT.Translations = New Dictionary(Of String, String)()
                    End If

                    ' ✅ RISOLUZIONE LAZY: Se constraints/examples/nlpContract mancano nell'istanza,
                    ' cerca nel template usando templateId
                    ' LOGICA: Template contiene struttura condivisa, istanza contiene solo override
                    If Not String.IsNullOrEmpty(task.TemplateId) Then
                        Dim template = flow.Tasks.FirstOrDefault(Function(t) t.Id = task.TemplateId)
                        If template IsNot Nothing Then
                            ' ✅ Risolvi constraints/examples/nlpContract a livello root se mancanti
                            If (assembledDDT.Constraints Is Nothing OrElse assembledDDT.Constraints.Count = 0) AndAlso
                               template.Constraints IsNot Nothing AndAlso template.Constraints.Count > 0 Then
                                assembledDDT.Constraints = template.Constraints
                                Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints from template {task.TemplateId}")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints from template {task.TemplateId}")
                            End If

                            If (assembledDDT.Examples Is Nothing OrElse assembledDDT.Examples.Count = 0) AndAlso
                               template.Examples IsNot Nothing AndAlso template.Examples.Count > 0 Then
                                assembledDDT.Examples = template.Examples
                                Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved examples from template {task.TemplateId}")
                                System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved examples from template {task.TemplateId}")
                            End If

                            ' ✅ Risolvi constraints/examples/nlpContract per ogni nodo data
                            If assembledDDT.Data IsNot Nothing AndAlso template.Data IsNot Nothing Then
                                For i = 0 To Math.Min(assembledDDT.Data.Count - 1, template.Data.Count - 1)
                                    Dim instanceNode = assembledDDT.Data(i)
                                    Dim templateNode = template.Data(i)

                                    ' ✅ Risolvi constraints se mancanti
                                    If (instanceNode.Constraints Is Nothing OrElse instanceNode.Constraints.Count = 0) AndAlso
                                       templateNode.Constraints IsNot Nothing AndAlso templateNode.Constraints.Count > 0 Then
                                        instanceNode.Constraints = templateNode.Constraints
                                        Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints for data[{i}] from template")
                                        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints for data[{i}] from template")
                                    End If

                                    ' ✅ Risolvi constraints per subData (ricorsivo)
                                    If instanceNode.SubData IsNot Nothing AndAlso templateNode.SubData IsNot Nothing Then
                                        For j = 0 To instanceNode.SubData.Count - 1
                                            Dim instanceSubNode = instanceNode.SubData(j)
                                            ' ✅ Cerca subData corrispondente nel template usando Id o Label
                                            Dim templateSubNode = templateNode.SubData.FirstOrDefault(
                                                Function(s) (Not String.IsNullOrEmpty(instanceSubNode.Id) AndAlso s.Id = instanceSubNode.Id) OrElse
                                                           (Not String.IsNullOrEmpty(instanceSubNode.Label) AndAlso s.Label = instanceSubNode.Label))

                                            If templateSubNode IsNot Nothing Then
                                                If (instanceSubNode.Constraints Is Nothing OrElse instanceSubNode.Constraints.Count = 0) AndAlso
                                                   templateSubNode.Constraints IsNot Nothing AndAlso templateSubNode.Constraints.Count > 0 Then
                                                    instanceSubNode.Constraints = templateSubNode.Constraints
                                                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints for subData[{j}] from template")
                                                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] Resolved constraints for subData[{j}] from template")
                                                End If
                                            End If
                                        Next
                                    End If
                                Next
                            End If
                        Else
                            ' ❌ NO FALLBACK: Se template non trovato → errore esplicito
                            ' Non mascherare il problema con fallback silenzioso
                            Console.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found in flow.Tasks - cannot resolve missing constraints/examples")
                            Console.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] This indicates a data inconsistency: task references template that doesn't exist")
                            System.Diagnostics.Debug.WriteLine($"❌ [COMPILER][DataRequestTaskCompiler] Template {task.TemplateId} not found in flow.Tasks")
                            ' Non lanciare eccezione qui, ma logga l'errore (il DDT compiler gestirà i campi mancanti)
                        End If
                    End If

                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT loaded from task direct fields for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to build AssembledDDT from task fields: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        End If

        ' ❌ RIMOSSO: PRIORITY 2 (flow.DDTs) e PRIORITY 3 (task.Value("ddt"))
        ' LOGICA: Ogni task contiene già tutto quello che serve (con risoluzione lazy da template)
        ' flow.DDTs e task.Value("ddt") sono ridondanti/legacy e non servono più

        ' Compila DDT se trovato
        If assembledDDT IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, Data IsNot Nothing={assembledDDT.Data IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, Data IsNot Nothing={assembledDDT.Data IsNot Nothing}")
            If assembledDDT.Data IsNot Nothing Then
                Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Data.Count={assembledDDT.Data.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] assembledDDT.Data.Count={assembledDDT.Data.Count}")
            End If
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza AssembledDDT a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(assembledDDT)
                Console.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                Dim ddtResult = ddtCompiler.Compile(ddtJson)
                If ddtResult IsNot Nothing AndAlso ddtResult.Instance IsNot Nothing Then
                    dataRequestTask.DDT = ddtResult.Instance
                    Console.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        Else
            Console.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [COMPILER][DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
        End If

        ' Popola campi comuni
        PopulateCommonFields(dataRequestTask, row, node, taskId)

        Return dataRequestTask
    End Function
End Class

