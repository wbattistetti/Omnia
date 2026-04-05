' POST /api/nlp/contract-extract — estrazione via UtteranceInterpretationParse (stesso motore del runtime).
Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports System.Linq
Imports System.Text.RegularExpressions
Imports System.Threading.Tasks
Imports Compiler
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports TaskEngine
Imports TaskEngine.Models
Imports TaskEngine.UtteranceInterpretation

''' <summary>
''' HTTP contract extraction: CompiledUtteranceTask minimale + UtteranceInterpretationParse.
''' </summary>
Public Module ContractExtractHandlers

    Public Class ContractExtractRequest
        Public Property Text As String
        ''' <summary>JSON of CompiledNlpContract (engines, subDataMapping, patterns).</summary>
        Public Property ContractJson As String
    End Class

    Public Async Function HandleContractExtract(context As HttpContext) As Task(Of IResult)
        Try
            Dim body As String
            Using reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
            End Using

            If String.IsNullOrEmpty(body) Then
                Return Results.BadRequest(New With {.error = "Request body is required"})
            End If

            Dim request = JsonConvert.DeserializeObject(Of ContractExtractRequest)(body)
            If request Is Nothing OrElse String.IsNullOrEmpty(request.Text) Then
                Return Results.BadRequest(New With {.error = "text is required"})
            End If
            If String.IsNullOrEmpty(request.ContractJson) Then
                Return Results.BadRequest(New With {.error = "contractJson is required"})
            End If

            Dim contract = JsonConvert.DeserializeObject(Of CompiledNlpContract)(request.ContractJson)
            If contract Is Nothing Then
                Return Results.BadRequest(New With {.error = "Invalid contractJson"})
            End If

            CompileContractRegexIfNeeded(contract)

            Dim task = BuildMinimalUtteranceTaskForContractExtract(contract)
            If task.Engines Is Nothing OrElse task.Engines.Count = 0 Then
                Return Results.BadRequest(New With {.error = "Contract must have at least one enabled regex or grammarflow engine."})
            End If

            Dim pr = UtteranceInterpretationParse.Parse(request.Text.Trim(), task)
            Dim values As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            If pr.Result = ParseResultType.Match AndAlso pr.ExtractedVariables IsNot Nothing Then
                For Each ev In pr.ExtractedVariables
                    values(ev.NodeId) = ev.Value
                Next
            End If

            Dim hasMatch = values.Count > 0
            Return Results.Ok(New With {
                .values = values,
                .hasMatch = hasMatch,
                .engine = "vb"
            })
        Catch ex As Exception
            Return Results.Problem(
                title:="Contract extraction failed",
                detail:=ex.Message,
                statusCode:=500)
        End Try
    End Function

    Private Sub CompileContractRegexIfNeeded(contract As CompiledNlpContract)
        If contract Is Nothing Then Return
        If contract.CompiledMainRegex IsNot Nothing Then Return
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

    Private Function BuildMinimalUtteranceTaskForContractExtract(contract As CompiledNlpContract) As CompiledUtteranceTask
        Const nodeId As String = "00000000-0000-0000-0000-000000000001"
        Dim task As New CompiledUtteranceTask With {
            .Id = "contract-extract",
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
