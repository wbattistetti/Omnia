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
        Dim dataRequestTask As New CompiledTaskGetData()

        ' ✅ Carica DDT da:
        ' 1. Campi diretti del task (task.MainData, task.StepPrompts, ecc.) - nuovo modello
        ' 2. flow.DDTs array usando taskId - array separato
        ' 3. task.Value("ddt") - vecchio modello (backward compatibility)

        Dim assembledDDT As Compiler.AssembledDDT = Nothing

        ' PRIORITY 1: Campi diretti sul task (nuovo modello)
        If task.MainData IsNot Nothing AndAlso task.MainData.Count > 0 Then
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
            assembledDDT = flow.DDTs.FirstOrDefault(Function(d) d.Id = taskId)
            If assembledDDT IsNot Nothing Then
                Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT found in flow.DDTs for task {taskId}")
            End If
        End If

        ' PRIORITY 3: Cerca in task.Value("ddt") (backward compatibility)
        If assembledDDT Is Nothing AndAlso task.Value IsNot Nothing AndAlso task.Value.ContainsKey("ddt") Then
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
            Try
                Dim ddtCompiler As New DDTCompiler()
                ' Serializza AssembledDDT a JSON per DDTCompiler.Compile
                Dim ddtJson = JsonConvert.SerializeObject(assembledDDT)
                Dim ddtResult = ddtCompiler.Compile(ddtJson)
                If ddtResult IsNot Nothing AndAlso ddtResult.Instance IsNot Nothing Then
                    dataRequestTask.DDT = ddtResult.Instance
                    Console.WriteLine($"✅ [DataRequestTaskCompiler] DDT compiled successfully for task {taskId}")
                Else
                    Console.WriteLine($"⚠️ [DataRequestTaskCompiler] DDT compilation returned no instance for task {taskId}")
                End If
            Catch ex As Exception
                Console.WriteLine($"⚠️ [DataRequestTaskCompiler] Failed to compile DDT for task {taskId}: {ex.Message}")
            End Try
        Else
            Console.WriteLine($"⚠️ [DataRequestTaskCompiler] No DDT found for DataRequest task {taskId} - DDT will be Nothing")
        End If

        ' Popola campi comuni
        PopulateCommonFields(dataRequestTask, row, node, taskId)

        Return dataRequestTask
    End Function
End Class

