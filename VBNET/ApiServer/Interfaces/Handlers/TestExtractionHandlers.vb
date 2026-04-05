Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports System.Linq
Imports System.Text.RegularExpressions
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports TaskEngine
Imports TaskEngine.Models
Imports TaskEngine.UtteranceInterpretation
Imports Compiler
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime

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

                CompileContractRegexIfNeeded(contract)

                Dim task = BuildMinimalUtteranceTaskForTest(contract)
                If task.Engines Is Nothing OrElse task.Engines.Count = 0 Then
                    Return Results.BadRequest(New With {.error = "Could not bind interpretation engines from contract."})
                End If

                Console.WriteLine($"[TestExtraction] Calling UtteranceInterpretationParse with text: '{request.Text}'")
                Dim pr = UtteranceInterpretationParse.Parse(request.Text.Trim(), task)
                Dim hasMatch = pr.Result = ParseResultType.Match AndAlso pr.ExtractedVariables IsNot Nothing AndAlso pr.ExtractedVariables.Count > 0
                Console.WriteLine($"[TestExtraction] Parse result: {pr.Result}, hasMatch={hasMatch}")

                Dim extractedValues As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
                If hasMatch AndAlso pr.ExtractedVariables IsNot Nothing Then
                    For Each ev In pr.ExtractedVariables
                        extractedValues(ev.NodeId) = ev.Value
                    Next
                End If

                Dim extractionResult As New With {
                    .values = extractedValues,
                    .hasMatch = hasMatch,
                    .source = "regex",
                    .errors = If(hasMatch,
                                 New List(Of String)(),
                                 New List(Of String) From {"No match found"}),
                    .confidence = If(hasMatch, If(pr.Confidence > 0R, pr.Confidence, 0.95), 0.0)
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

        ''' <summary>Compila la regex principale da NLPEngine se assente nel JSON (allineato a contract-extract).</summary>
        Private Sub CompileContractRegexIfNeeded(contract As CompiledNlpContract)
            If contract Is Nothing OrElse contract.CompiledMainRegex IsNot Nothing Then Return
            Dim rxEngine = contract.Engines?.FirstOrDefault(Function(e) e IsNot Nothing AndAlso String.Equals(e.Type, "regex", StringComparison.OrdinalIgnoreCase) AndAlso e.Enabled)
            If rxEngine Is Nothing OrElse rxEngine.Patterns Is Nothing OrElse rxEngine.Patterns.Count = 0 Then Return
            Try
                contract.CompiledMainRegex = New Regex(rxEngine.Patterns(0), RegexOptions.IgnoreCase Or RegexOptions.Compiled)
                If contract.CompiledRegexPatterns Is Nothing Then
                    contract.CompiledRegexPatterns = New List(Of Regex)()
                Else
                    contract.CompiledRegexPatterns.Clear()
                End If
                For Each p In rxEngine.Patterns
                    contract.CompiledRegexPatterns.Add(New Regex(p, RegexOptions.IgnoreCase Or RegexOptions.Compiled))
                Next
            Catch
            End Try
        End Sub

        Private Function BuildMinimalUtteranceTaskForTest(contract As CompiledNlpContract) As CompiledUtteranceTask
            Const nodeId As String = "00000000-0000-0000-0000-000000000001"
            Dim task As New CompiledUtteranceTask With {
                .Id = "test-task",
                .NodeId = nodeId,
                .NlpContract = contract
            }
            Dim table As New CanonicalGuidTable With {.MainNodeCanonicalGuid = nodeId}
            If contract.DataMapping IsNot Nothing Then
                For Each kvp In contract.DataMapping
                    table.Data.Add(New CanonicalDatumRow With {
                        .SubDataMappingKey = kvp.Key,
                        .CanonicalGuid = kvp.Key,
                        .RegexGroupName = If(kvp.Value?.GroupName, String.Empty)
                    })
                Next
            End If
            Dim ide As New NLPContract With {
                .TemplateName = contract.TemplateName,
                .TemplateId = contract.TemplateId,
                .SourceTemplateId = contract.SourceTemplateId,
                .SubDataMapping = contract.DataMapping,
                .Engines = contract.Engines
            }
            task.Engines = InterpretationEngineBinding.CreateEngines(task, contract, ide, table)
            Return task
        End Function

    End Module

    ' Request model
    Public Class TestExtractionRequest
        Public Property Text As String
        Public Property EngineType As String = "regex"
        Public Property ContractJson As String  ' JSON string of CompiledNlpContract
    End Class

End Namespace
