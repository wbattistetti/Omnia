Option Strict On
Option Explicit On

Imports System.IO
Imports System.Linq
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Newtonsoft.Json.Serialization
Imports GrammarFlowEngine

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
        Public Async Function HandleTestPhrase(context As HttpContext) As Task
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
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Request body is required"}, context)
                    Return
                End If

                Dim request = JsonConvert.DeserializeObject(Of TestPhraseRequest)(body)

                If request.Grammar Is Nothing Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Grammar is required")
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Grammar is required"}, context)
                    Return
                End If

                If String.IsNullOrEmpty(request.Text) Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Text is required")
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Text is required"}, context)
                    Return
                End If

                Console.WriteLine($"[GrammarTest] Testing phrase: '{request.Text}'")
                Console.WriteLine($"[GrammarTest] Grammar: {request.Grammar.Name} (Nodes: {request.Grammar.Nodes.Count}, Edges: {request.Grammar.Edges.Count})")

                ' Create interpreter with regex mode enabled
                Dim interpreter As New GrammarEngine(request.Grammar, useRegex:=True)
                Console.WriteLine($"[GrammarTest] ✅ Using REGEX mode for parsing")
                Dim parseResult = interpreter.Parse(request.Text)

                ' Map ParseResult to TestPhraseResult
                Dim testResult = MapParseResultToTestResult(parseResult, request.Grammar, request.Text)

                Console.WriteLine($"[GrammarTest] ✅ Parse completed: Success={testResult.Success}, Bindings={testResult.Bindings.Count}, ConsumedWords={testResult.ConsumedWords}")

                Await OkJson(New With {.result = testResult}, context)
                Return ' Response already written

            Catch ex As Exception
                Console.WriteLine($"[GrammarTest] ❌ ERROR: {ex.Message}")
                Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                WriteErrorJson($"Internal server error: {ex.Message}", context, 500)
            End Try
        End Function

        ''' <summary>
        ''' Handles POST /api/grammar/test-phrases
        ''' Tests multiple phrases against the grammar
        ''' </summary>
        Public Async Function HandleTestPhrases(context As HttpContext) As Task
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
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Request body is required"}, context)
                    Return
                End If

                Dim request = JsonConvert.DeserializeObject(Of TestPhrasesRequest)(body)

                If request.Grammar Is Nothing Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Grammar is required")
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Grammar is required"}, context)
                    Return
                End If

                If request.Phrases Is Nothing OrElse request.Phrases.Count = 0 Then
                    Console.WriteLine("[GrammarTest] ❌ ERROR: Phrases list is required and cannot be empty")
                    context.Response.StatusCode = 400
                    Await OkJson(New With {.error = "Phrases list is required and cannot be empty"}, context)
                    Return
                End If

                Console.WriteLine($"[GrammarTest] Testing {request.Phrases.Count} phrases")
                Console.WriteLine($"[GrammarTest] Grammar: {request.Grammar.Name} (Nodes: {request.Grammar.Nodes.Count}, Edges: {request.Grammar.Edges.Count})")

                ' Create interpreter once (reuse for all phrases) with regex mode enabled
                Dim interpreter As GrammarEngine = Nothing
                Try
                    interpreter = New GrammarEngine(request.Grammar, useRegex:=True)
                    Console.WriteLine($"[GrammarTest] ✅ Using REGEX mode for parsing")
                Catch ex As Exception
                    Console.WriteLine($"[GrammarTest] ❌ ERROR creating GrammarEngine: {ex.Message}")
                    Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                    WriteErrorJson($"Failed to create grammar engine: {ex.Message}", context, 500)
                    Return
                End Try

                ' Test all phrases
                Dim testResults As New List(Of Object)()
                For Each phrase In request.Phrases
                    Try
                        Console.WriteLine($"[GrammarTest] Testing phrase: '{phrase.Text}'")
                        Dim parseResult = interpreter.Parse(phrase.Text)
                        Console.WriteLine($"[GrammarTest] Parse result: ParseEvent={parseResult.ParseEvent}, MatchTree={If(parseResult.MatchTree IsNot Nothing, "present", "null")}")

                        Dim testResult = MapParseResultToTestResult(parseResult, request.Grammar, phrase.Text)
                        Console.WriteLine($"[GrammarTest] Test result: Success={testResult.Success}, MatchDetails count={testResult.MatchDetails.Count}")

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
                        Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
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

                Try
                    Dim response = New With {.results = testResults}
                    Console.WriteLine($"[GrammarTest] Attempting to serialize {testResults.Count} results...")
                    Await OkJson(response, context)
                    Console.WriteLine($"[GrammarTest] ✅ Response written successfully")
                    Return ' Response already written
                Catch ex As Exception
                    Console.WriteLine($"[GrammarTest] ❌ ERROR serializing response: {ex.Message}")
                    Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                    Console.WriteLine($"[GrammarTest] Inner exception: {If(ex.InnerException IsNot Nothing, ex.InnerException.Message, "None")}")
                    WriteErrorJson($"Failed to serialize response: {ex.Message}", context, 500)
                End Try

            Catch ex As Exception
                Console.WriteLine($"[GrammarTest] ❌ ERROR in HandleTestPhrases: {ex.Message}")
                Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                WriteErrorJson($"Internal server error: {ex.Message}", context, 500)
            End Try
        End Function

        ''' <summary>
        ''' Writes error JSON directly to response stream (synchronous version for catch blocks)
        ''' </summary>
        Private Sub WriteErrorJson(errorMessage As String, context As HttpContext, statusCode As Integer)
            Try
                context.Response.StatusCode = statusCode
                Dim errorData = New With {.error = errorMessage}
                Dim settings As New JsonSerializerSettings() With {
                    .ContractResolver = New CamelCasePropertyNamesContractResolver(),
                    .NullValueHandling = NullValueHandling.Ignore
                }
                Dim json = JsonConvert.SerializeObject(errorData, settings)
                Dim jsonBytes = System.Text.Encoding.UTF8.GetBytes(json)
                context.Response.ContentType = "application/json; charset=utf-8"
                context.Response.ContentLength = jsonBytes.Length
                context.Response.Body.WriteAsync(jsonBytes, 0, jsonBytes.Length).GetAwaiter().GetResult()
            Catch
                ' If writing fails, at least status code is set
            End Try
        End Sub

        ''' <summary>
        ''' Serializes data using Newtonsoft with CamelCase and writes directly to response stream.
        ''' This ensures correct camelCase JSON, proper Content-Length, and UTF-8 encoding.
        ''' Results.Content() and Results.Text() can produce empty responses with complex objects.
        ''' </summary>
        Private Async Function OkJson(data As Object, context As HttpContext) As Task
            Try
                Dim settings As New JsonSerializerSettings() With {
                    .ContractResolver = New CamelCasePropertyNamesContractResolver(),
                    .NullValueHandling = NullValueHandling.Ignore,
                    .ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    .MaxDepth = 100 ' Increase max depth for recursive structures
                }
                Dim json = JsonConvert.SerializeObject(data, settings)
                Console.WriteLine($"[GrammarTest] Serialized JSON length: {json.Length} characters")
                If json.Length = 0 Then
                    Console.WriteLine($"[GrammarTest] ⚠️ WARNING: Serialized JSON is empty!")
                End If

                ' Write directly to response stream with proper headers
                context.Response.ContentType = "application/json; charset=utf-8"
                Dim jsonBytes = System.Text.Encoding.UTF8.GetBytes(json)
                context.Response.ContentLength = jsonBytes.Length
                Await context.Response.Body.WriteAsync(jsonBytes, 0, jsonBytes.Length)
                Console.WriteLine($"[GrammarTest] ✅ Response written: {jsonBytes.Length} bytes")
            Catch ex As Exception
                Console.WriteLine($"[GrammarTest] ❌ ERROR in OkJson: {ex.Message}")
                Console.WriteLine($"[GrammarTest] Stack trace: {ex.StackTrace}")
                Throw
            End Try
        End Function

        ''' <summary>
        ''' Maps ParseResult to TestPhraseResult with matchDetails
        ''' ✅ Costruisce MatchDetails dalla struttura gerarchica MatchTree
        ''' </summary>
        Private Function MapParseResultToTestResult(
            parseResult As ParseResult,
            grammar As Grammar,
            text As String
        ) As TestPhraseResult
            Dim result As New TestPhraseResult() With {
                .Success = (parseResult.ParseEvent = ParseEvents.Match),
                .Bindings = parseResult.Bindings,
                .ConsumedWords = parseResult.ConsumedWords,
                .GarbageUsed = parseResult.GarbageUsed,
                .MatchDetails = New List(Of MatchDetail)()
            }

            ' ✅ Costruisci MatchDetails dalla lista di match (no fake root)
            ' I match reali sono in MatchTree.Children, non nel root stesso
            If parseResult.ParseEvent = ParseEvents.Match AndAlso parseResult.MatchTree IsNot Nothing AndAlso
               parseResult.MatchTree.Children IsNot Nothing AndAlso parseResult.MatchTree.Children.Count > 0 Then
                ' Process each match directly (no root)
                Dim allDetails As New List(Of MatchDetail)()
                For Each match In parseResult.MatchTree.Children
                    Dim matchDetails = BuildMatchDetails(match, grammar)
                    allDetails.AddRange(matchDetails)
                Next
                result.MatchDetails = allDetails
            End If

            Return result
        End Function

        ''' <summary>
        ''' Costruisce MatchDetails ricorsivamente dalla struttura gerarchica MatchResult
        ''' </summary>
        Private Function BuildMatchDetails(matchResult As MatchResult, grammar As GrammarFlowEngine.Grammar) As List(Of MatchDetail)
            Dim details As New List(Of MatchDetail)()

            ' Se il nodo ha uno slot, crea MatchDetail per lo slot
            If matchResult.SlotBinding IsNot Nothing Then
                Dim slotDetail = New MatchDetail() With {
                    .Type = "slot",
                    .Id = matchResult.SlotBinding.Id,
                    .Label = matchResult.SlotBinding.Name,
                    .Children = New List(Of MatchDetail)()
                }
                ' ⚠️ NON impostare LinguisticText sullo slot se c'è un semantic-value child

                ' Se ha anche un semantic value, aggiungilo come figlio dello slot
                If matchResult.SemanticValueBinding IsNot Nothing Then
                    Dim semanticDetail = New MatchDetail() With {
                        .Type = "semantic-value",
                        .Id = matchResult.SemanticValueBinding.Id,
                        .Label = matchResult.SemanticValueBinding.Name,
                        .SemanticValue = matchResult.SemanticValueBinding.Value,
                        .Children = New List(Of MatchDetail)()
                    }
                    ' ⚠️ NON aggiungere linguistic qui - è già nei children processati ricorsivamente
                    slotDetail.Children.Add(semanticDetail)
                End If

                details.Add(slotDetail)
            ElseIf matchResult.SemanticValueBinding IsNot Nothing Then
                ' Solo semantic value, senza slot
                Dim semanticDetail = New MatchDetail() With {
                    .Type = "semantic-value",
                    .Id = matchResult.SemanticValueBinding.Id,
                    .Label = matchResult.SemanticValueBinding.Name,
                    .SemanticValue = matchResult.SemanticValueBinding.Value,
                    .Children = New List(Of MatchDetail)()
                }
                ' ⚠️ NON aggiungere linguistic qui - è già nei children processati ricorsivamente
                details.Add(semanticDetail)
            ElseIf Not String.IsNullOrEmpty(matchResult.MatchedText) Then
                ' Solo linguistic match (label/synonym senza bindings)
                Dim linguisticDetail = New MatchDetail() With {
                    .Type = "linguistic",
                    .Id = matchResult.NodeId,
                    .Label = matchResult.NodeLabel,
                    .LinguisticText = matchResult.MatchedText,
                    .Children = New List(Of MatchDetail)()
                }
                details.Add(linguisticDetail)
            End If

            ' ✅ Ricorsivamente costruisci i figli (linguistiche, semantic-values, etc.)
            ' I children sono già strutturati correttamente (slot → semantic-value → linguistic)
            If matchResult.Children IsNot Nothing AndAlso matchResult.Children.Count > 0 Then
                For Each child In matchResult.Children
                    Dim childDetails = BuildMatchDetails(child, grammar)
                    ' Aggiungi i figli all'ultimo detail creato (se esiste)
                    If details.Count > 0 Then
                        ' Aggiungi i children all'ultimo detail (slot o semantic-value)
                        details.Last().Children.AddRange(childDetails)
                    Else
                        ' Se non c'è un detail principale, aggiungi i figli direttamente
                        details.AddRange(childDetails)
                    End If
                Next
            End If

            Return details
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
