Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json
Imports DDTEngine

''' <summary>
''' Compiler per task di tipo DataRequest
''' Gestisce la logica complessa di caricamento e compilazione DDT
''' </summary>
Public Class DataRequestTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As Task, row As RowData, node As FlowNode, taskId As String, flow As Flow) As CompiledTask
        Console.WriteLine($"🔍 [DataRequestTaskCompiler] Compile called for task {taskId}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] Compile called for task {taskId}")
        Console.WriteLine($"🔍 [DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] task.TemplateId={task.TemplateId}, task.Id={task.Id}")
        Console.WriteLine($"🔍 [DataRequestTaskCompiler] task.MainData IsNot Nothing={task.MainData IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] task.MainData IsNot Nothing={task.MainData IsNot Nothing}")
        If task.MainData IsNot Nothing Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] task.MainData.Count={task.MainData.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] task.MainData.Count={task.MainData.Count}")
        End If
        Console.WriteLine($"🔍 [DataRequestTaskCompiler] flow.DDTs IsNot Nothing={flow.DDTs IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] flow.DDTs IsNot Nothing={flow.DDTs IsNot Nothing}")
        If flow.DDTs IsNot Nothing Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] flow.DDTs.Count={flow.DDTs.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] flow.DDTs.Count={flow.DDTs.Count}")
        End If

        Dim dataRequestTask As New CompiledTaskGetData()

        ' ✅ Carica DDT da:
        ' 1. Campi diretti del task (task.MainData, task.StepPrompts, ecc.) - nuovo modello
        ' 2. flow.DDTs array usando taskId - array separato
        ' 3. task.Value("ddt") - vecchio modello (backward compatibility)

        Dim assembledDDT As Compiler.AssembledDDT = Nothing

        ' PRIORITY 1: Campi diretti sul task (nuovo modello)
        If task.MainData IsNot Nothing AndAlso task.MainData.Count > 0 Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] Trying to load DDT from task.MainData (PRIORITY 1)")
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
                End If

                Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT loaded from task direct fields for task {taskId}")
            Catch ex As Exception
                Console.WriteLine($"⚠️ [DataRequestTaskCompiler] Failed to build AssembledDDT from task fields: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        End If

        ' PRIORITY 2: Cerca in flow.DDTs array usando taskId
        If assembledDDT Is Nothing AndAlso flow.DDTs IsNot Nothing Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] Trying to load DDT from flow.DDTs (PRIORITY 2)")
            assembledDDT = flow.DDTs.FirstOrDefault(Function(d) d.Id = taskId)
            If assembledDDT IsNot Nothing Then
                Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT found in flow.DDTs for task {taskId}")
            Else
                Console.WriteLine($"⚠️ [DataRequestTaskCompiler] DDT not found in flow.DDTs for taskId {taskId}")
            End If
        End If

        ' PRIORITY 3: Cerca in task.Value("ddt") (backward compatibility)
        If assembledDDT Is Nothing AndAlso task.Value IsNot Nothing AndAlso task.Value.ContainsKey("ddt") Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] Trying to load DDT from task.Value(""ddt"") (PRIORITY 3)")
            Dim ddtValue = task.Value("ddt")
            If ddtValue IsNot Nothing Then
                Try
                    Dim ddtJson As String = If(TypeOf ddtValue Is String, CStr(ddtValue), ddtValue.ToString())
                    If Not String.IsNullOrEmpty(ddtJson) Then
                        Dim settings As New JsonSerializerSettings()
                        settings.Converters.Add(New MainDataNodeListConverter())
                        assembledDDT = JsonConvert.DeserializeObject(Of Compiler.AssembledDDT)(ddtJson, settings)
                        Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT loaded from task.Value(""ddt"") for task {taskId}")
                    End If
                Catch ex As Exception
                    Console.WriteLine($"⚠️ [DataRequestTaskCompiler] Failed to deserialize DDT from task.Value: {ex.Message}")
                End Try
            End If
        End If

        ' Compila DDT se trovato
        If assembledDDT IsNot Nothing Then
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT found! Starting DDT compilation...")
            Console.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, MainData IsNot Nothing={assembledDDT.MainData IsNot Nothing}")
            System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT.Id={assembledDDT.Id}, MainData IsNot Nothing={assembledDDT.MainData IsNot Nothing}")
            If assembledDDT.MainData IsNot Nothing Then
                Console.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT.MainData.Count={assembledDDT.MainData.Count}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] assembledDDT.MainData.Count={assembledDDT.MainData.Count}")
            End If
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza AssembledDDT a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(assembledDDT)
                Console.WriteLine($"🔍 [DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                System.Diagnostics.Debug.WriteLine($"🔍 [DataRequestTaskCompiler] Calling DDTCompiler.Compile with JSON length={ddtJson.Length}")
                Dim ddtResult = ddtCompiler.Compile(ddtJson)
                If ddtResult IsNot Nothing AndAlso ddtResult.Instance IsNot Nothing Then
                    dataRequestTask.DDT = ddtResult.Instance
                    Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"✅ [DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [DataRequestTaskCompiler] Exception details: {ex.ToString()}")
            End Try
        Else
            Console.WriteLine($"⚠️ [DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
            System.Diagnostics.Debug.WriteLine($"⚠️ [DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
        End If

        ' Popola campi comuni
        PopulateCommonFields(dataRequestTask, row, node, taskId)

        Return dataRequestTask
    End Function
End Class

