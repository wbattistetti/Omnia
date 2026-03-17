Option Strict On
Option Explicit On

Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports GrammarFlowEngine

Namespace ApiServer.Handlers
    ''' <summary>
    ''' Handles grammar test endpoints for Grammar Editor
    ''' </summary>
    Public Module GrammarTestHandlers

        ''' <summary>
        ''' Request model for test-phrase endpoint
        ''' </summary>
        Public Class TestPhraseRequest
            Public Property Grammar As GrammarFlowEngine.Grammar
            Public Property Text As String
        End Class

        ''' <summary>
        ''' Request model for test-phrases endpoint
        ''' </summary>
        Public Class TestPhrasesRequest
            Public Property Grammar As GrammarFlowEngine.Grammar
            Public Property Phrases As List(Of TestPhraseItem)
        End Class

        ''' <summary>
        ''' Phrase item in test-phrases request
        ''' </summary>
        Public Class TestPhraseItem
            Public Property Id As String
            Public Property Text As String
        End Class

        ''' <summary>
        ''' Response model for test result
        ''' </summary>
        Public Class TestPhraseResult
            Public Property Success As Boolean
            Public Property Bindings As Dictionary(Of String, Object)
            Public Property ConsumedWords As Integer
            Public Property GarbageUsed As Integer
            Public Property MatchDetails As List(Of MatchDetail)
        End Class

        ''' <summary>
        ''' Match detail for UI display
        ''' </summary>
        Public Class MatchDetail
            Public Property Type As String ' "slot", "semantic-value", "linguistic"
            Public Property Id As String
            Public Property Label As String
            Public Property SemanticValue As String
            Public Property LinguisticText As String
            Public Property Children As List(Of MatchDetail)
        End Class

        ''' <summary>
        ''' Handles POST /api/grammar/test-phrase
        ''' Tests a single phrase against the grammar
        ''' </summary>
        Public Async Function HandleTestPhrase(context As HttpContext) As Task(Of IResult)
            Try
                Console.WriteLine("[GrammarTest] ========================================")
                Console.WriteLine("[GrammarTest] POST /api/grammar/test-phrase - Request received")

                ' Read request body
                Dim body As String = Nothing
                Using reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                End Using

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Request body is empty")
                    Return Results.BadRequest(New With {.error = "Request body is required"})
                End If

                Dim request = JsonConvert.DeserializeObject(Of TestPhraseRequest)(body)

                If request.Grammar Is Nothing Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Grammar is required")
                    Return Results.BadRequest(New With {.error = "Grammar is required"})
                End If

                If String.IsNullOrEmpty(request.Text) Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Text is required")
                    Return Results.BadRequest(New With {.error = "Text is required"})
                End If

                Console.WriteLine($"[GrammarTest] Testing phrase: '{request.Text}'")
                Console.WriteLine($"[GrammarTest] Grammar: {request.Grammar.Name} (Nodes: {request.Grammar.Nodes.Count}, Edges: {request.Grammar.Edges.Count})")

                ' Create interpreter and parse
                Dim interpreter As New GrammarEngine(request.Grammar)
                Dim parseResult = interpreter.Parse(request.Text)

                ' Map ParseResult to TestPhraseResult
                Dim testResult = MapParseResultToTestResult(parseResult, request.Grammar, request.Text)

                Console.WriteLine($"[GrammarTest] ✅ Parse completed: Success={testResult.Success}, Bindings={testResult.Bindings.Count}, ConsumedWords={testResult.ConsumedWords}")

                Return Results.Ok(New With {.result = testResult})

            Catch ex As Exception
                Console.WriteLine($"[GrammarTest] ❌ ERROR: {ex.Message}")
                Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                Return Results.Json(New With {.error = $"Internal server error: {ex.Message}"}, statusCode:=500)
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/grammar/test-phrases
        ''' Tests multiple phrases against the grammar
        ''' </summary>
        Public Async Function HandleTestPhrases(context As HttpContext) As Task(Of IResult)
            Try
                Console.WriteLine("[GrammarTest] ========================================")
                Console.WriteLine("[GrammarTest] POST /api/grammar/test-phrases - Request received")

                ' Read request body
                Dim body As String = Nothing
                Using reader As New StreamReader(context.Request.Body)
                    body = Await reader.ReadToEndAsync()
                End Using

                If String.IsNullOrEmpty(body) Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Request body is empty")
                    Return Results.BadRequest(New With {.error = "Request body is required"})
                End If

                Dim request = JsonConvert.DeserializeObject(Of TestPhrasesRequest)(body)

                If request.Grammar Is Nothing Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Grammar is required")
                    Return Results.BadRequest(New With {.error = "Grammar is required"})
                End If

                If request.Phrases Is Nothing OrElse request.Phrases.Count = 0 Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Phrases list is required and cannot be empty")
                    Return Results.BadRequest(New With {.error = "Phrases list is required and cannot be empty"})
                End If

                Console.WriteLine($"[GrammarTest] Testing {request.Phrases.Count} phrases")
                Console.WriteLine($"[GrammarTest] Grammar: {request.Grammar.Name} (Nodes: {request.Grammar.Nodes.Count}, Edges: {request.Grammar.Edges.Count})")

                ' Create interpreter once (reuse for all phrases)
                Dim interpreter As New GrammarEngine(request.Grammar)

                ' Test all phrases
                Dim testResults As New List(Of Object)()
                For Each phrase In request.Phrases
                    Try
                        Dim parseResult = interpreter.Parse(phrase.Text)
                        Dim testResult = MapParseResultToTestResult(parseResult, request.Grammar, phrase.Text)
                        testResults.Add(New With {
                            .phraseId = phrase.Id,
                            .success = testResult.Success,
                            .bindings = testResult.Bindings,
                            .consumedWords = testResult.ConsumedWords,
                            .garbageUsed = testResult.GarbageUsed,
                            .matchDetails = testResult.MatchDetails
                        })
                    Catch ex As Exception
                        Console.WriteLine($"[GrammarTest] ⚠️ Error testing phrase '{phrase.Text}': {ex.Message}")
                        testResults.Add(New With {
                            .phraseId = phrase.Id,
                            .success = False,
                            .bindings = New Dictionary(Of String, Object)(),
                            .consumedWords = 0,
                            .garbageUsed = 0,
                            .matchDetails = New List(Of MatchDetail)(),
                            .error = ex.Message
                        })
                    End Try
                Next

                Console.WriteLine($"[GrammarTest] ✅ All phrases tested: {testResults.Count} results")

                Return Results.Ok(New With {.results = testResults})

            Catch ex As Exception
                Console.WriteLine($"[GrammarTest] ❌ ERROR: {ex.Message}")
                Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                Return Results.Json(New With {.error = $"Internal server error: {ex.Message}"}, statusCode:=500)
            End Try
        End Function

        ''' <summary>
        ''' Maps ParseResult to TestPhraseResult with matchDetails
        ''' </summary>
        Private Function MapParseResultToTestResult(
            parseResult As ParseResult,
            grammar As Grammar,
            text As String
        ) As TestPhraseResult
            Dim result As New TestPhraseResult() With {
                .Success = parseResult.Success,
                .Bindings = parseResult.Bindings,
                .ConsumedWords = parseResult.ConsumedWords,
                .GarbageUsed = parseResult.GarbageUsed,
                .MatchDetails = New List(Of MatchDetail)()
            }

            ' Generate matchDetails from bindings
            If parseResult.Success AndAlso parseResult.Bindings IsNot Nothing Then
                For Each kvp In parseResult.Bindings
                    Dim bindingKey = kvp.Key
                    Dim bindingValue = kvp.Value

                    ' Try to identify binding type by checking grammar
                    Dim matchDetail = CreateMatchDetail(bindingKey, bindingValue, grammar)
                    If matchDetail IsNot Nothing Then
                        result.MatchDetails.Add(matchDetail)
                    End If
                Next
            End If

            Return result
        End Function

        ''' <summary>
        ''' Creates a MatchDetail from a binding key-value pair
        ''' Based on ExtractBindings logic: slot.Name, semanticSet.Name, or "value"
        ''' </summary>
        Private Function CreateMatchDetail(
            key As String,
            value As Object,
            grammar As GrammarFlowEngine.Grammar
        ) As MatchDetail
            Dim valueStr = If(value?.ToString(), "")

            ' Check if it's a slot (key is slot.Name)
            If grammar.Slots IsNot Nothing Then
                Dim slot = grammar.Slots.FirstOrDefault(Function(s) String.Equals(s.Name, key, StringComparison.OrdinalIgnoreCase))
                If slot IsNot Nothing Then
                    Return New MatchDetail() With {
                        .Type = "slot",
                        .Id = slot.Id,
                        .Label = slot.Name,
                        .LinguisticText = valueStr,
                        .Children = New List(Of MatchDetail)()
                    }
                End If
            End If

            ' Check if it's a semantic set (key is semanticSet.Name, value is semanticValue.Value)
            If grammar.SemanticSets IsNot Nothing Then
                Dim semanticSet = grammar.SemanticSets.FirstOrDefault(Function(s) String.Equals(s.Name, key, StringComparison.OrdinalIgnoreCase))
                If semanticSet IsNot Nothing AndAlso semanticSet.Values IsNot Nothing Then
                    ' Find the semantic value that matches the binding value
                    Dim semanticValue = semanticSet.Values.FirstOrDefault(Function(v) String.Equals(v.Value, valueStr, StringComparison.OrdinalIgnoreCase))
                    If semanticValue IsNot Nothing Then
                        Return New MatchDetail() With {
                            .Type = "semantic-value",
                            .Id = semanticValue.Id,
                            .Label = semanticValue.Value,
                            .SemanticValue = semanticValue.Value,
                            .LinguisticText = valueStr,
                            .Children = New List(Of MatchDetail)()
                        }
                    End If
                End If
            End If

            ' Check if key is "value" (semantic-value binding without semantic-set)
            If String.Equals(key, "value", StringComparison.OrdinalIgnoreCase) Then
                ' Try to find semantic value by value string
                If grammar.SemanticSets IsNot Nothing Then
                    For Each semanticSet In grammar.SemanticSets
                        If semanticSet.Values IsNot Nothing Then
                            Dim semanticValue = semanticSet.Values.FirstOrDefault(Function(v) String.Equals(v.Value, valueStr, StringComparison.OrdinalIgnoreCase))
                            If semanticValue IsNot Nothing Then
                                Return New MatchDetail() With {
                                    .Type = "semantic-value",
                                    .Id = semanticValue.Id,
                                    .Label = semanticValue.Value,
                                    .SemanticValue = semanticValue.Value,
                                    .LinguisticText = valueStr,
                                    .Children = New List(Of MatchDetail)()
                                }
                            End If
                        End If
                    Next
                End If
            End If

            ' Default: treat as linguistic match (matched text without specific binding)
            Return New MatchDetail() With {
                .Type = "linguistic",
                .Id = key,
                .Label = key,
                .LinguisticText = valueStr,
                .Children = New List(Of MatchDetail)()
            }
        End Function

    End Module
End Namespace
