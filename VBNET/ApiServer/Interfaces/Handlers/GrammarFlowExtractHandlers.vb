Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.IO
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports GrammarFlowEngine
Imports TaskEngine

''' <summary>
''' Handles GrammarFlow extraction endpoint for NLP contract extraction
''' </summary>
Public Module GrammarFlowExtractHandlers

    ''' <summary>
    ''' Request model for grammarflow-extract endpoint
    ''' </summary>
    Public Class GrammarFlowExtractRequest
        Public Property Text As String
        Public Property Grammar As GrammarFlowEngine.Grammar
        Public Property Contract As GrammarFlowExtractContract
    End Class

    ''' <summary>
    ''' Contract information for mapping slot names to subIds
    ''' </summary>
    Public Class GrammarFlowExtractContract
        Public Property TemplateName As String
        Public Property SubDataMapping As Dictionary(Of String, SubDataMappingInfo)
    End Class

    ''' <summary>
    ''' SubData mapping information
    ''' </summary>
    Public Class SubDataMappingInfo
        Public Property GroupName As String
        Public Property Label As String
        Public Property Type As String
    End Class

    ''' <summary>
    ''' Response model for grammarflow-extract endpoint
    ''' </summary>
    Public Class GrammarFlowExtractResponse
        Public Property Values As Dictionary(Of String, Object)
        Public Property Confidence As Double
        Public Property Success As Boolean
        Public Property ErrorMessage As String
    End Class

    ''' <summary>
    ''' Handles POST /api/nlp/grammarflow-extract
    ''' Extracts values from text using GrammarFlow engine
    ''' </summary>
    Public Async Function HandleGrammarFlowExtract(context As HttpContext) As Task(Of IResult)
        Try
            Console.WriteLine("[GrammarFlowExtract] ========================================")
            Console.WriteLine("[GrammarFlowExtract] POST /api/nlp/grammarflow-extract - Request received")

            ' Read request body
            Dim body As String = Nothing
            Using reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
            End Using

            If String.IsNullOrEmpty(body) Then
                Console.WriteLine("[GrammarFlowExtract] ❌ ERROR: Request body is empty")
                Return Results.BadRequest(New With {.error = "Request body is required"})
            End If

            Dim request = JsonConvert.DeserializeObject(Of GrammarFlowExtractRequest)(body)

            If request.Grammar Is Nothing Then
                Console.WriteLine("[GrammarFlowExtract] ❌ ERROR: Grammar is required")
                Return Results.BadRequest(New With {.error = "Grammar is required"})
            End If

            If String.IsNullOrEmpty(request.Text) Then
                Console.WriteLine("[GrammarFlowExtract] ❌ ERROR: Text is required")
                Return Results.BadRequest(New With {.error = "Text is required"})
            End If

            Console.WriteLine($"[GrammarFlowExtract] Processing text: '{request.Text}' (length: {request.Text.Length})")
            Dim nodesCount = If(request.Grammar.Nodes IsNot Nothing, request.Grammar.Nodes.Count, 0)
            Console.WriteLine($"[GrammarFlowExtract] Grammar has {nodesCount} nodes")
            Dim templateName = If(request.Contract IsNot Nothing, request.Contract.TemplateName, "N/A")
            Console.WriteLine($"[GrammarFlowExtract] Contract template: '{templateName}'")
            Dim subDataCount = If(request.Contract IsNot Nothing AndAlso request.Contract.SubDataMapping IsNot Nothing, request.Contract.SubDataMapping.Count, 0)
            Console.WriteLine($"[GrammarFlowExtract] Contract has {subDataCount} subData mappings")

            ' Create GrammarEngine and parse text
            Dim engine As New GrammarEngine(request.Grammar, useRegex:=True)
            Dim parseResult = engine.Parse(request.Text)

            If parseResult.ParseEvent <> ParseEvents.Match Then
                Console.WriteLine($"[GrammarFlowExtract] ❌ No match found: {parseResult.ErrorMessage}")
                Return Results.Ok(New GrammarFlowExtractResponse() With {
                    .Success = False,
                    .Values = New Dictionary(Of String, Object)(),
                    .Confidence = 0.0,
                    .ErrorMessage = parseResult.ErrorMessage
                })
            End If

            Console.WriteLine($"[GrammarFlowExtract] ✅ Match found!")
            Dim bindingsCount = If(parseResult.Bindings IsNot Nothing, parseResult.Bindings.Count, 0)
            Console.WriteLine($"[GrammarFlowExtract] Bindings count: {bindingsCount}")
            If parseResult.Bindings IsNot Nothing Then
                For Each kvp In parseResult.Bindings
                    Console.WriteLine($"[GrammarFlowExtract]   Binding: {kvp.Key} = {kvp.Value}")
                Next
            End If

            Dim extractedValues As Dictionary(Of String, Object)
            If parseResult.Bindings Is Nothing OrElse parseResult.Bindings.Count = 0 Then
                extractedValues = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            Else
                Dim compiled As New CompiledNlpContract()
                If request.Contract IsNot Nothing AndAlso request.Contract.SubDataMapping IsNot Nothing Then
                    For Each kvp In request.Contract.SubDataMapping
                        Dim src = kvp.Value
                        compiled.DataMapping(kvp.Key) = New TaskEngine.SubDataMappingInfo With {
                            .GroupName = src.GroupName,
                            .Label = src.Label,
                            .Type = src.Type
                        }
                    Next
                End If
                extractedValues = MapGrammarBindingsToCanonicalKeys(parseResult.Bindings, compiled)
                For Each kvp In extractedValues
                    Console.WriteLine($"[GrammarFlowExtract] ✅ Mapped subId '{kvp.Key}' = {kvp.Value}")
                Next
            End If

            ' Calculate confidence (simple heuristic: 0.8 if match found, 0.9 if all expected slots matched)
            Dim confidence As Double = 0.8
            If request.Contract IsNot Nothing AndAlso request.Contract.SubDataMapping IsNot Nothing AndAlso extractedValues.Count = request.Contract.SubDataMapping.Count Then
                confidence = 0.9
            End If

            Console.WriteLine($"[GrammarFlowExtract] ✅ Extraction completed: {extractedValues.Count} values, confidence: {confidence}")

            Return Results.Ok(New GrammarFlowExtractResponse() With {
                .Success = True,
                .Values = extractedValues,
                .Confidence = confidence
            })

        Catch ex As Exception
            Console.WriteLine($"[GrammarFlowExtract] ❌ EXCEPTION: {ex.Message}")
            Console.WriteLine($"[GrammarFlowExtract] Stack trace: {ex.StackTrace}")
            Return Results.Problem(
                title:="GrammarFlow extraction failed",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

    ''' <summary>
    ''' Per ogni chiave in SubDataMapping: legge il binding solo da chiave canonica o da GroupName (stesso nome gruppo GF).
    ''' Nessun merge, nessun pass-through dei binding senza mapping.
    ''' </summary>
    Private Function MapGrammarBindingsToCanonicalKeys(
        bindings As Dictionary(Of String, Object),
        contract As CompiledNlpContract
    ) As Dictionary(Of String, Object)

        Dim extracted As New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
        If bindings Is Nothing OrElse bindings.Count = 0 Then Return extracted
        If contract Is Nothing OrElse contract.DataMapping Is Nothing OrElse contract.DataMapping.Count = 0 Then
            Return extracted
        End If

        For Each kvp In contract.DataMapping
            Dim subId = kvp.Key
            Dim groupName = kvp.Value?.GroupName
            Dim raw As Object = Nothing
            If bindings.TryGetValue(subId, raw) Then
            ElseIf Not String.IsNullOrEmpty(groupName) AndAlso bindings.TryGetValue(groupName, raw) Then
            Else
                Continue For
            End If
            If raw Is Nothing Then Continue For
            Dim s = raw.ToString()
            If String.IsNullOrWhiteSpace(s) Then Continue For
            extracted(subId) = raw
        Next

        Return extracted
    End Function

End Module
