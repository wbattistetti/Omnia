Option Strict On
Option Explicit On

Imports System.IO
Imports System.Linq
Imports System.Text.RegularExpressions
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports TaskEngine
Imports TaskEngine.Models
Imports Compiler.DTO.Runtime
Imports Compiler
Imports Compiler.TaskCompiler
Imports Common

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles test extraction endpoints for Recognition panel
    ''' </summary>
    Public Module TestExtractionHandlers

        ''' <summary>
        ''' Handles POST /api/runtime/task/{taskId}/test-extraction
        ''' Tests regex extraction using VB.NET Parser
        ''' </summary>
        Public Async Function HandleTestExtraction(context As HttpContext, taskId As String) As Task(Of IResult)
            Try
                Console.WriteLine($"[TestExtraction] ========================================")
                Console.WriteLine($"[TestExtraction] Request received for taskId: {taskId}")

                ' Read request body
                Dim body As String = Nothing
                Using reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                End Using

                Console.WriteLine($"[TestExtraction] Body length: {If(body IsNot Nothing, body.Length, 0)}")
                Console.WriteLine($"[TestExtraction] Body preview: {If(body IsNot Nothing AndAlso body.Length > 200, body.Substring(0, 200), body)}")

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: Request body is empty")
                    Return Results.BadRequest(New With {.error = "Request body is required"})
                End If

                Dim request = JsonConvert.DeserializeObject(Of TestExtractionRequest)(body)
                Console.WriteLine($"[TestExtraction] Request deserialized:")
                Console.WriteLine($"[TestExtraction]   - Text: {If(request.Text IsNot Nothing, $"'{request.Text}' (length: {request.Text.Length})", "NULL")}")
                Console.WriteLine($"[TestExtraction]   - EngineType: '{If(request.EngineType, "NULL")}'")
                Console.WriteLine($"[TestExtraction]   - ContractJson: {If(request.ContractJson IsNot Nothing, $"present (length: {request.ContractJson.Length})", "NULL")}")

                If String.IsNullOrEmpty(request.Text) Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: Text is required")
                    Return Results.BadRequest(New With {.error = "Text is required"})
                End If

                ' Only handle regex engine type
                If Not String.IsNullOrEmpty(request.EngineType) AndAlso request.EngineType <> "regex" Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: Engine type '{request.EngineType}' not supported")
                    Return Results.BadRequest(New With {
                        .error = $"Engine type '{request.EngineType}' not supported. Use Python API for non-regex engines."
                    })
                End If

                ' Get contract from request (as JSON object)
                Dim contract As CompiledNlpContract = Nothing

                ' If contract is provided in request, deserialize it
                If request.ContractJson IsNot Nothing Then
                    Console.WriteLine($"[TestExtraction] Attempting to deserialize contract...")
                    Try
                        contract = JsonConvert.DeserializeObject(Of CompiledNlpContract)(request.ContractJson)
                        Console.WriteLine($"[TestExtraction] ✅ Contract deserialized successfully")
                        Console.WriteLine($"[TestExtraction]   - Contract is Nothing: {contract Is Nothing}")
                        If contract IsNot Nothing Then
                            Dim contractEngines = contract.Engines
                            Console.WriteLine($"[TestExtraction]   - Engines count: {If(contractEngines IsNot Nothing, contractEngines.Count, 0)}")
                            If contractEngines IsNot Nothing Then
                                For Each p In contractEngines
                                    Console.WriteLine($"[TestExtraction]     - Engine: Type={p.Type}, Enabled={p.Enabled}, Patterns count={If(p.Patterns IsNot Nothing, p.Patterns.Count, 0)}")
                                Next
                            End If
                        End If
                    Catch ex As Exception
                        Console.WriteLine($"[TestExtraction] ❌ ERROR deserializing contract: {ex.Message}")
                        Console.WriteLine($"[TestExtraction] Stack trace: {ex.StackTrace}")
                        Return Results.BadRequest(New With {
                            .error = $"Failed to deserialize contract: {ex.Message}"
                        })
                    End Try
                Else
                    ' Contract must be provided
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: ContractJson is NULL or empty")
                    Return Results.BadRequest(New With {
                        .error = "Contract must be provided in request body. Please include 'contractJson' field with NlpContract JSON."
                    })
                End If

                If contract Is Nothing Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: Contract is Nothing after deserialization")
                    Return Results.BadRequest(New With {.error = "Contract deserialization returned Nothing"})
                End If

                ' Find regex parser
                Console.WriteLine($"[TestExtraction] Searching for regex engine...")
                Dim engines = contract.Engines
                Dim regexParser = engines?.FirstOrDefault(
                    Function(p) p.Type = "regex" AndAlso p.Enabled
                )

                If regexParser Is Nothing Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: No regex parser found")
                    Return Results.BadRequest(New With {
                        .error = "No enabled regex parser found in contract"
                    })
                End If

                If regexParser.Patterns Is Nothing OrElse regexParser.Patterns.Count = 0 Then
                    Console.WriteLine($"[TestExtraction] ❌ ERROR: Regex parser has no patterns")
                    Console.WriteLine($"[TestExtraction]   - Patterns is Nothing: {regexParser.Patterns Is Nothing}")
                    If regexParser.Patterns IsNot Nothing Then
                        Console.WriteLine($"[TestExtraction]   - Patterns count: {regexParser.Patterns.Count}")
                    End If
                    Return Results.BadRequest(New With {
                        .error = "No enabled regex parser found in contract"
                    })
                End If

                Console.WriteLine($"[TestExtraction] ✅ Regex parser found with {regexParser.Patterns.Count} pattern(s)")
                Console.WriteLine($"[TestExtraction]   - First pattern: '{If(regexParser.Patterns.Count > 0, regexParser.Patterns(0), "N/A")}'")

                ' ✅ CRITICAL: Compile the regex pattern before using it
                ' The CompiledMainRegex is not deserialized from JSON, so we must compile it manually
                If contract.CompiledMainRegex Is Nothing AndAlso regexParser.Patterns.Count > 0 Then
                    Try
                        Dim firstPattern = regexParser.Patterns(0)
                        Console.WriteLine($"[TestExtraction] Compiling regex pattern: '{firstPattern}'")
                        contract.CompiledMainRegex = New Regex(firstPattern, RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                        Console.WriteLine($"[TestExtraction] ✅ Regex compiled successfully")
                    Catch ex As Exception
                        Console.WriteLine($"[TestExtraction] ❌ ERROR compiling regex: {ex.Message}")
                        Return Results.BadRequest(New With {
                            .error = $"Invalid regex pattern: {ex.Message}"
                        })
                    End Try
                End If

                ' Create a minimal IParsableTask wrapper for the contract
                ' The Parser only needs the NlpContract, so we create a simple wrapper
                Dim minimalTask As New MinimalParsableTask(contract)

                ' ✅ FIX: Use ExtractSimple directly instead of ParseSimple
                ' Test extraction doesn't need runtime metadata (taskInstanceId, nodeId)
                ' ExtractSimple is stateless and perfect for testing engine functionality
                Console.WriteLine($"[TestExtraction] Calling Parser.ExtractSimple with text: '{request.Text}'")
                Dim extractedValue = Parser.ExtractSimple(request.Text, minimalTask)
                Console.WriteLine($"[TestExtraction] Extracted value: {If(extractedValue IsNot Nothing, $"'{extractedValue}'", "Nothing (no match)")}")

                ' Convert extracted value to ExtractionResult format
                Dim extractedValues As New Dictionary(Of String, Object)
                Dim hasMatch = extractedValue IsNot Nothing

                If hasMatch Then
                    ' ✅ Store extracted value with key "value" (standard format)
                    extractedValues("value") = extractedValue
                    Console.WriteLine($"[TestExtraction] ✅ Match found: value='{extractedValue}'")
                Else
                    Console.WriteLine($"[TestExtraction] ❌ No match found")
                End If

                Dim extractionResult As New With {
                    .values = extractedValues,
                    .hasMatch = hasMatch,
                    .source = "regex",
                    .errors = If(hasMatch,
                                 New List(Of String)(),
                                 New List(Of String) From {"No match found"}),
                    .confidence = If(hasMatch, 0.95, 0.0)
                }

                Console.WriteLine($"[TestExtraction] ✅ Success - returning result with {extractedValues.Count} values")
                Console.WriteLine($"[TestExtraction] ========================================")
                Return Results.Ok(extractionResult)

            Catch ex As Exception
                Console.WriteLine($"[TestExtraction] ❌ EXCEPTION: {ex.Message}")
                Console.WriteLine($"[TestExtraction] Stack trace: {ex.StackTrace}")
                If ex.InnerException IsNot Nothing Then
                    Console.WriteLine($"[TestExtraction] Inner exception: {ex.InnerException.Message}")
                End If
                Return Results.Problem(
                    title:="Test extraction failed",
                    detail:=ex.Message,
                    statusCode:=500
                )
            End Try
        End Function

        ' Minimal IParsableTask implementation for testing
        Private Class MinimalParsableTask
            Implements IParsableTask

            Private ReadOnly _contract As CompiledNlpContract

            Public Sub New(contract As CompiledNlpContract)
                _contract = contract
            End Sub

            Public ReadOnly Property Id As String Implements IParsableTask.Id
                Get
                    Return "test-task"
                End Get
            End Property

            Public ReadOnly Property NlpContract As CompiledNlpContract Implements IParsableTask.NlpContract
                Get
                    Return _contract
                End Get
            End Property

            Public ReadOnly Property SubTasks As List(Of IParsableTask) Implements IParsableTask.SubTasks
                Get
                    Return New List(Of IParsableTask)() ' Empty list for simple tasks
                End Get
            End Property

            Public Function HasSubTasks() As Boolean Implements IParsableTask.HasSubTasks
                Return False ' Simple task, no sub-tasks
            End Function
        End Class

    End Module

    ' Request model
    Public Class TestExtractionRequest
        Public Property Text As String
        Public Property EngineType As String = "regex"
        Public Property ContractJson As String  ' JSON string of CompiledNlpContract
    End Class

End Namespace
