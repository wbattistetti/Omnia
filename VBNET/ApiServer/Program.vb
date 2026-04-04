Option Strict On
Option Explicit On
Imports System.IO
Imports System.Linq
Imports System.Threading
Imports ApiServer.Helpers
Imports ApiServer.Models
Imports ApiServer.Interfaces
Imports ApiServer.Logging
Imports ApiServer.Repositories
Imports ApiServer.SessionStorage
Imports Microsoft.AspNetCore.Builder
Imports Microsoft.AspNetCore.Hosting
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Http.Features
Imports Microsoft.Extensions.DependencyInjection
Imports Microsoft.Extensions.Hosting
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Newtonsoft.Json.Serialization

Module Program
    ' ✅ STATELESS: Configurazione Redis (condivisa)
    Friend _redisConnectionString As String = Nothing
    Friend _redisKeyPrefix As String = Nothing
    Friend _sessionTTL As Integer = 3600

    ''' <summary>
    ''' ✅ STATELESS: Ottiene la connection string Redis
    ''' </summary>
    Public Function GetRedisConnectionString() As String
        Return If(String.IsNullOrEmpty(_redisConnectionString), "localhost:6379", _redisConnectionString)
    End Function

    ''' <summary>
    ''' ✅ STATELESS: Ottiene il key prefix Redis
    ''' </summary>
    Public Function GetRedisKeyPrefix() As String
        Return If(String.IsNullOrEmpty(_redisKeyPrefix), "omnia:", _redisKeyPrefix)
    End Function

    ''' <summary>
    ''' Main entry point - runs ASP.NET Core HTTP server
    ''' </summary>
    Sub Main(args As String())
        Console.WriteLine("🔥🔥🔥 PROGRAM STARTED - THIS IS THE REAL BINARY")
        Console.Out.Flush()
        Console.WriteLine("🚀 [Main] ApiServer starting...")
        Console.WriteLine($"   Args count: {args.Length}")
        RunHttpServerMode(args)
    End Sub

    ''' <summary>
    ''' Runs in HTTP server mode (ASP.NET Core Web API)
    ''' </summary>
    Private Sub RunHttpServerMode(args As String())
        Console.WriteLine("🌐 [RunHttpServerMode] Initializing ASP.NET Core Web API...")
        Try
            Dim builder = WebApplication.CreateBuilder(args)

            ' ✅ FIX: Increase request body size limit to handle large compilation requests with conditions
            ' Default limit is 30MB, but we need to ensure it's high enough for large flows
            builder.WebHost.ConfigureKestrel(Sub(options)
                                                 options.Limits.MaxRequestBodySize = 100 * 1024 * 1024 ' 100MB
                                             End Sub)

            ' ✅ FASE 2: Configura Dependency Injection
            ' Registra ILogger come singleton
            Dim logger As ApiServer.Interfaces.ILogger = New ApiServer.Logging.StdoutLogger()
            builder.Services.AddSingleton(Of ApiServer.Interfaces.ILogger)(logger)

            ' ✅ STATELESS: Leggi configurazione Redis da appsettings.json
            Dim redisConnectionString = If(builder.Configuration("Redis:ConnectionString"), "localhost:6379")
            Dim redisKeyPrefix = If(builder.Configuration("Redis:KeyPrefix"), "omnia:")
            Dim sessionTTLStr = If(builder.Configuration("Redis:SessionTTL"), "3600")
            Dim sessionTTL As Integer = 3600
            Integer.TryParse(sessionTTLStr, sessionTTL)

            ' ✅ STATELESS: Salva configurazione Redis per accesso da altri moduli
            _redisConnectionString = redisConnectionString
            _redisKeyPrefix = redisKeyPrefix
            _sessionTTL = sessionTTL

            Console.WriteLine($"[Program] ✅ STATELESS: Redis configuration loaded:")
            Console.WriteLine($"[Program]   ConnectionString: {redisConnectionString}")
            Console.WriteLine($"[Program]   KeyPrefix: {redisKeyPrefix}")
            Console.WriteLine($"[Program]   SessionTTL: {sessionTTL}s")

            ' ✅ STATELESS: Redis è OBBLIGATORIO - se non disponibile, il servizio non si avvia
            Console.WriteLine("═══════════════════════════════════════════════════════════════")
            Console.WriteLine("🔴 STATELESS MODE: Redis is REQUIRED")
            Console.WriteLine("═══════════════════════════════════════════════════════════════")

            Dim storage As ApiServer.Interfaces.ISessionStorage
            Try
                storage = New ApiServer.SessionStorage.RedisSessionStorage(redisConnectionString, redisKeyPrefix, sessionTTL)
                Console.WriteLine("✅ Session storage: Redis (stateless mode)")
                Console.WriteLine("═══════════════════════════════════════════════════════════════")
            Catch ex As Exception
                Console.WriteLine("═══════════════════════════════════════════════════════════════")
                Console.WriteLine("❌ CRITICAL ERROR: Redis is not available")
                Console.WriteLine($"   Error: {ex.Message}")
                Console.WriteLine("   Service cannot start without Redis.")
                Console.WriteLine("   Please ensure Redis is running and accessible.")
                Console.WriteLine("═══════════════════════════════════════════════════════════════")
                Throw ' Termina l'applicazione
            End Try

            builder.Services.AddSingleton(Of ApiServer.Interfaces.ISessionStorage)(storage)

            ' ✅ STATELESS: Configura SessionManager con storage, connection string, key prefix e TTL per Pub/Sub e ExecutionStateStorage
            SessionManager.ConfigureStorage(storage, redisConnectionString, redisKeyPrefix, sessionTTL)
            SessionManager.ConfigureLogger(logger)

            ' Configura TaskSessionHandlers con logger
            ApiServer.Handlers.TaskSessionHandlers.ConfigureLogger(logger)

            ' ✅ FASE 3: Usa logger invece di Console.WriteLine (dopo configurazione DI)
            logger.LogInfo("Dependency Injection configured", New With {
                .phase = "FASE 2",
                .services = New With {
                    .logger = "ILogger",
                    .sessionStorage = "ISessionStorage"
                }
            })

            ' Add services
            ' ✅ SOLUZIONE DEFINITIVA: CamelCasePropertyNamesContractResolver globale
            ' Converte automaticamente TUTTE le proprietà PascalCase → camelCase
            ' Elimina la necessità di JsonProperty manuali e fallback nel frontend
            builder.Services.AddControllers().AddNewtonsoftJson(Sub(options)
                                                                    options.SerializerSettings.ContractResolver = New CamelCasePropertyNamesContractResolver()
                                                                    options.SerializerSettings.NullValueHandling = NullValueHandling.Ignore
                                                                    options.SerializerSettings.ReferenceLoopHandling = ReferenceLoopHandling.Ignore
                                                                    options.SerializerSettings.Formatting = Formatting.None
                                                                End Sub)
            builder.Services.AddCors(Sub(options)
                                         options.AddDefaultPolicy(Sub(policy)
                                                                      policy.AllowAnyOrigin()
                                                                      policy.AllowAnyMethod()
                                                                      policy.AllowAnyHeader()
                                                                  End Sub)
                                     End Sub)

            Dim app = builder.Build()

            ' Configure pipeline
            app.UseCors()
            ' ✅ ENTERPRISE: Garantisci UTF-8 encoding in tutte le risposte JSON (leggero, zero overhead)
            app.UseMiddleware(Of ApiServer.Middleware.Utf8EncodingMiddleware)()
            ' ✅ FASE 3: Usa logger invece di Console.WriteLine
            logger.LogInfo("Registering ExceptionLoggingMiddleware")
            app.UseMiddleware(Of ApiServer.Middleware.ExceptionLoggingMiddleware)()
            logger.LogInfo("ExceptionLoggingMiddleware registered")

            ' Add global exception handler
            app.UseExceptionHandler(Sub(appBuilder)
                                        appBuilder.Run(Async Function(context As HttpContext) As System.Threading.Tasks.Task
                                                           Dim exceptionHandlerPathFeature = context.Features.Get(Of Microsoft.AspNetCore.Diagnostics.IExceptionHandlerPathFeature)()
                                                           Dim ex = exceptionHandlerPathFeature?.Error
                                                           If ex IsNot Nothing Then
                                                               ' ✅ FASE 3: Usa logger dal DI container (o fallback a Console)
                                                               Try
                                                                   Dim serviceProvider = context.RequestServices
                                                                   Dim loggerFromDI = serviceProvider.GetService(Of ApiServer.Interfaces.ILogger)()
                                                                   If loggerFromDI IsNot Nothing Then
                                                                       loggerFromDI.LogError("GlobalExceptionHandler: Unhandled exception", ex, New With {
                                                                           .path = context.Request.Path.ToString(),
                                                                           .method = context.Request.Method,
                                                                           .jsonException = If(TryCast(ex, JsonSerializationException) IsNot Nothing, New With {
                                                                               .path = TryCast(ex, JsonSerializationException).Path,
                                                                               .lineNumber = TryCast(ex, JsonSerializationException).LineNumber,
                                                                               .linePosition = TryCast(ex, JsonSerializationException).LinePosition
                                                                           }, Nothing)
                                                                       })
                                                                   Else
                                                                       ' Fallback a Console se logger non disponibile
                                                                       Console.WriteLine($"❌ [GlobalExceptionHandler] UNHANDLED EXCEPTION: {ex.GetType().FullName} - {ex.Message}")
                                                                   End If
                                                               Catch
                                                                   ' Fallback assoluto: usa Console
                                                                   Console.WriteLine($"❌ [GlobalExceptionHandler] UNHANDLED EXCEPTION: {ex.GetType().FullName} - {ex.Message}")
                                                               End Try
                                                           End If
                                                           context.Response.StatusCode = 500
                                                           Await context.Response.WriteAsync("Internal Server Error")
                                                       End Function)
                                    End Sub)

            app.UseRouting()

            ' Map API endpoints (we map manually, so we don't need MapControllers())
            ' ✅ FASE 3: Usa logger invece di Console.WriteLine
            logger.LogInfo("Mapping API endpoints")
            MapApiEndpoints(app)

            ' Start server on port 5000
            logger.LogInfo("ApiServer starting", New With {
                .url = "http://localhost:5000",
                .phase = "FASE 3"
            })
            Console.WriteLine("✅ Server is running. Press Ctrl+C to stop.")

            ' Run the server (this blocks until the server is stopped)
            ' Specify URL explicitly to ensure it listens on the correct port
            app.Run("http://localhost:5000")
        Catch ex As Exception
            Console.WriteLine($"❌ Error starting HTTP server: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Throw
        End Try
    End Sub

    ''' <summary>
    ''' Maps all API endpoints
    ''' </summary>
    Private Sub MapApiEndpoints(app As WebApplication)
        ' GET /api/health - Test endpoint
        app.MapGet("/api/health", Function() As IResult
                                      Console.WriteLine("✅ [Health] Health check requested")
                                      Return Results.Ok(New With {.status = "ok", .timestamp = DateTime.UtcNow.ToString("O")})
                                  End Function)

        ' POST /api/runtime/compile - Read body manually to use Newtonsoft.Json (handles string->int conversion)
        app.MapPost("/api/runtime/compile", Function(context As HttpContext) As System.Threading.Tasks.Task
                                                Return CompilationHandlers.HandleCompileFlow(context)
                                            End Function)

        ' POST /api/runtime/compile/task - Compile a single task (for chat simulator)
        app.MapPost("/api/runtime/compile/task", Function(context As HttpContext) As System.Threading.Tasks.Task
                                                     Return CompilationHandlers.HandleCompileTask(context)
                                                 End Function)

        ' ✅ STATELESS: POST /api/runtime/dialog/save - Salva dialogo compilato nel repository
        app.MapPost("/api/runtime/dialog/save", Function(context As HttpContext) As System.Threading.Tasks.Task(Of IResult)
                                                    Return CompilationHandlers.HandleSaveDialog(context)
                                                End Function)

        ' POST /api/runtime/task/{taskId}/test-extraction - Test regex extraction (VB.NET)
        app.MapPost("/api/runtime/task/{taskId}/test-extraction",
            Async Function(context As HttpContext, taskId As String) As Task(Of IResult)
                Return Await ApiServer.Handlers.TestExtractionHandlers.HandleTestExtraction(context, taskId)
            End Function)

        ' POST /api/runtime/task/session/start - Chat Simulator diretto (solo UtteranceInterpretation)
        Console.WriteLine("🔥 REGISTERING ENDPOINT: /api/runtime/task/session/start")
        System.Diagnostics.Debug.WriteLine("🔥 REGISTERING ENDPOINT: /api/runtime/task/session/start")
        Console.Out.Flush()
        app.MapPost("/api/runtime/task/session/start", Async Function(context As HttpContext) As Task(Of IResult)
                                                           Console.WriteLine("═══════════════════════════════════════════════════════════════")
                                                           Console.WriteLine("🔵 [MapPost] /api/runtime/task/session/start - ENTRY POINT")
                                                           System.Diagnostics.Debug.WriteLine("🔵 [MapPost] /api/runtime/task/session/start - ENTRY POINT")
                                                           Console.Out.Flush()
                                                           Try
                                                               Console.WriteLine("🔵 [MapPost] About to call HandleTaskSessionStart...")
                                                               System.Diagnostics.Debug.WriteLine("🔵 [MapPost] About to call HandleTaskSessionStart...")
                                                               Console.Out.Flush()

                                                               Dim result = Await ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionStart(context)

                                                               Console.WriteLine($"🔵 [MapPost] HandleTaskSessionStart returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                               System.Diagnostics.Debug.WriteLine($"🔵 [MapPost] HandleTaskSessionStart returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                               Console.Out.Flush()

                                                               ' ✅ Esegui esplicitamente l'IResult per scrivere nel context.Response
                                                               If result IsNot Nothing Then
                                                                   Console.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                   Console.Out.Flush()

                                                                   Await result.ExecuteAsync(context)

                                                                   Console.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                   Console.Out.Flush()
                                                               End If

                                                               Return Results.Empty
                                                           Catch ex As Exception
                                                               Console.WriteLine($"🔴 [MapPost] Exception: {ex}")
                                                               System.Diagnostics.Debug.WriteLine($"🔴 [MapPost] Exception: {ex}")
                                                               Console.Out.Flush()
                                                               Throw
                                                           End Try
                                                       End Function)

        ' GET /api/runtime/task/session/{id}/stream (SSE) - Chat Simulator diretto
        app.MapGet("/api/runtime/task/session/{id}/stream", Function(context As HttpContext, id As String) As System.Threading.Tasks.Task
                                                                Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionStream(context, id)
                                                            End Function)

        ' POST /api/runtime/task/session/{id}/input - Chat Simulator diretto
        app.MapPost("/api/runtime/task/session/{id}/input", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionInput(context, id)
                                                            End Function)

        ' DELETE /api/runtime/task/session/{id} - Chat Simulator diretto
        app.MapDelete("/api/runtime/task/session/{id}", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                            Return ApiServer.Handlers.TaskSessionHandlers.HandleTaskSessionDelete(context, id)
                                                        End Function)

        ' POST /api/runtime/orchestrator/session/start
        app.MapPost("/api/runtime/orchestrator/session/start", Async Function(context As HttpContext) As Task(Of IResult)
                                                                   Console.WriteLine("═══════════════════════════════════════════════════════════════════════════")
                                                                   Console.WriteLine("🔵 [MapPost] /api/runtime/orchestrator/session/start - Handler called")
                                                                   Console.Out.Flush()
                                                                   System.Diagnostics.Debug.WriteLine("🔵 [MapPost] Handler called")
                                                                   Try
                                                                       Console.WriteLine("🔵 [MapPost] About to call HandleOrchestratorSessionStart...")
                                                                       Console.Out.Flush()
                                                                       System.Diagnostics.Debug.WriteLine("🔵 [MapPost] About to call function")

                                                                       Dim result = Await HandleOrchestratorSessionStart(context)

                                                                       System.Diagnostics.Debug.WriteLine($"🔵 [MapPost] Function returned")
                                                                       Console.WriteLine($"🔵 [MapPost] Handler returned, result type: {If(result IsNot Nothing, result.GetType().Name, "Nothing")}")
                                                                       Console.Out.Flush()

                                                                       ' ✅ CRITICAL: Esegui esplicitamente l'IResult per scrivere nel context.Response
                                                                       '    Stesso pattern di HandleTaskSessionStart - garantisce body JSON valido
                                                                       If result IsNot Nothing Then
                                                                           Console.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                           System.Diagnostics.Debug.WriteLine("🔵 [MapPost] Executing IResult explicitly...")
                                                                           Console.Out.Flush()

                                                                           Await result.ExecuteAsync(context)

                                                                           Console.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                           System.Diagnostics.Debug.WriteLine("🔵 [MapPost] IResult executed successfully")
                                                                           Console.Out.Flush()
                                                                       End If

                                                                       Return Results.Empty
                                                                   Catch ex As Exception
                                                                       Console.WriteLine($"🔴 [MapPost] EXCEPTION CAUGHT: {ex.GetType().Name}")
                                                                       Console.WriteLine($"🔴 [MapPost] Exception message: {ex.Message}")
                                                                       Console.WriteLine($"🔴 [MapPost] Stack trace: {ex.StackTrace}")
                                                                       Console.Out.Flush()
                                                                       System.Diagnostics.Debug.WriteLine($"🔴 [MapPost] Exception: {ex.Message}")
                                                                       If ex.InnerException IsNot Nothing Then
                                                                           Console.WriteLine($"🔴 [MapPost] Inner exception: {ex.InnerException.Message}")
                                                                           Console.Out.Flush()
                                                                       End If
                                                                       Throw
                                                                   End Try
                                                               End Function)

        ' GET /api/runtime/orchestrator/session/{id}/stream (SSE)
        app.MapGet("/api/runtime/orchestrator/session/{id}/stream", Function(context As HttpContext, id As String) As System.Threading.Tasks.Task
                                                                        Return HandleOrchestratorSessionStream(context, id)
                                                                    End Function)

        ' POST /api/runtime/orchestrator/session/{id}/input
        app.MapPost("/api/runtime/orchestrator/session/{id}/input", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                        Return HandleOrchestratorSessionInput(context, id)
                                                                    End Function)

        ' DELETE /api/runtime/orchestrator/session/{id}
        app.MapDelete("/api/runtime/orchestrator/session/{id}", Function(context As HttpContext, id As String) As Task(Of IResult)
                                                                    Return HandleOrchestratorSessionDelete(context, id)
                                                                End Function)

        ' ✅ POST /api/grammar/test-phrase - Test a single phrase against grammar
        app.MapPost("/api/grammar/test-phrase", Function(context As HttpContext) As Task
                                                    Return GrammarTestHandlers.HandleTestPhrase(context)
                                                End Function)

        ' ✅ POST /api/grammar/test-phrases - Test multiple phrases against grammar
        app.MapPost("/api/grammar/test-phrases", Function(context As HttpContext) As Task
                                                     Return GrammarTestHandlers.HandleTestPhrases(context)
                                                 End Function)

        ' ✅ POST /api/nlp/grammarflow-extract - Extract values using GrammarFlow engine
        app.MapPost("/api/nlp/grammarflow-extract", Function(context As HttpContext) As Task(Of IResult)
                                                        Return GrammarFlowExtractHandlers.HandleGrammarFlowExtract(context)
                                                    End Function)

        ' ✅ POST /api/nlp/contract-extract — ParserExtraction (GrammarFlow → regex), same as runtime
        app.MapPost("/api/nlp/contract-extract", Function(context As HttpContext) As Task(Of IResult)
                                                     Return ContractExtractHandlers.HandleContractExtract(context)
                                                 End Function)

        ' ✅ POST /api/runtime/translations/invalidate-cache - Invalida cache traduzioni
        app.MapPost("/api/runtime/translations/invalidate-cache", Function(req As HttpRequest) As IResult
                                                                      Try
                                                                          Dim body = req.ReadFromJsonAsync(Of Dictionary(Of String, Object))().Result
                                                                          Dim projectId = If(body IsNot Nothing AndAlso body.ContainsKey("projectId"), CStr(body("projectId")), Nothing)
                                                                          Dim locale = If(body IsNot Nothing AndAlso body.ContainsKey("locale"), CStr(body("locale")), Nothing)
                                                                          Dim invalidateAll = If(body IsNot Nothing AndAlso body.ContainsKey("invalidateAll"), CBool(body("invalidateAll")), False)

                                                                          If String.IsNullOrEmpty(projectId) Or String.IsNullOrEmpty(locale) Then
                                                                              Return Results.BadRequest(New With {.error = "projectId and locale are required"})
                                                                          End If

                                                                          ' ✅ Invalida cache nel TranslationRepository
                                                                          Dim translationRepo = SessionManager.GetTranslationRepository()
                                                                          If translationRepo IsNot Nothing Then
                                                                              ' ✅ Cast a RedisTranslationRepository per accedere a InvalidateCache
                                                                              Dim redisRepo = TryCast(translationRepo, ApiServer.Repositories.RedisTranslationRepository)
                                                                              If redisRepo IsNot Nothing Then
                                                                                  redisRepo.InvalidateCache(projectId, locale, invalidateAll)
                                                                                  Console.WriteLine($"[API] ✅ Cache invalidated for project {projectId}, locale {locale}, invalidateAll={invalidateAll}")
                                                                              Else
                                                                                  Console.WriteLine($"[API] ⚠️ TranslationRepository is not RedisTranslationRepository, cannot invalidate cache")
                                                                              End If
                                                                          Else
                                                                              Console.WriteLine($"[API] ⚠️ TranslationRepository is not available")
                                                                          End If

                                                                          Return Results.Ok(New With {.success = True, .message = "Cache invalidated"})
                                                                      Catch ex As Exception
                                                                          Console.WriteLine($"[API] ❌ Error invalidating cache: {ex.Message}")
                                                                          Console.WriteLine($"[API] ❌ Stack trace: {ex.StackTrace}")
                                                                          Return Results.StatusCode(500)
                                                                      End Try
                                                                  End Function)
    End Sub

    ' HandleCompileFlow, HandleCompileTask, HandleCompileFlowWithModel moved to ApiServer.Handlers.CompilationHandlers

    ''' <summary>
    ''' Handles POST /api/runtime/orchestrator/session/start
    ''' </summary>
    ''' <summary>
    ''' ✅ ARCHITECTURAL: Handles POST /api/runtime/orchestrator/session/start
    ''' Simmetrico a HandleTaskSessionStart: usa ResponseHelpers, non tocca context.Response
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStart(context As HttpContext) As Task(Of IResult)
        Try
            ' ✅ STEP 1: Read request body
            Dim body As String = Nothing
            Try
                Dim reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
            Catch readEx As Exception
                Return ResponseHelpers.CreateErrorResponse($"Failed to read request body: {readEx.Message}", 400)
            End Try

            If String.IsNullOrEmpty(body) Then
                Return ResponseHelpers.CreateErrorResponse("Empty request body", 400)
            End If

            ' ✅ STEP 2: Deserialize request
            Dim request As OrchestratorSessionStartRequest = Nothing
            Try
                ' ✅ DEBUG: Verifica se body contiene projectId
                Dim bodyContainsProjectId = body.Contains("projectId", StringComparison.OrdinalIgnoreCase)
                Console.WriteLine($"🔵 [HandleOrchestratorSessionStart] Body contains 'projectId': {bodyContainsProjectId}")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStart] Body contains projectId: {bodyContainsProjectId}")

                request = JsonConvert.DeserializeObject(Of OrchestratorSessionStartRequest)(body, New JsonSerializerSettings() With {
                    .NullValueHandling = NullValueHandling.Ignore,
                    .MissingMemberHandling = MissingMemberHandling.Ignore
                })
            Catch jsonEx As Exception
                Return ResponseHelpers.CreateErrorResponse($"Invalid JSON: {jsonEx.Message}", 400)
            End Try

            If request Is Nothing OrElse request.CompilationResult Is Nothing Then
                Return ResponseHelpers.CreateErrorResponse("Missing CompilationResult", 400)
            End If

            ' ✅ DEBUG: Verifica projectId e locale dopo deserializzazione
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStart] After deserialization:")
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStart]   request.ProjectId: '{If(request.ProjectId, "NULL/EMPTY")}'")
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStart]   request.Locale: '{If(request.Locale, "NULL/EMPTY")}'")
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStart]   request.ProjectId Is Nothing: {request.ProjectId Is Nothing}")
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStart]   String.IsNullOrEmpty(request.ProjectId): {String.IsNullOrEmpty(request.ProjectId)}")
            System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStart] ProjectId: '{If(request.ProjectId, "NULL")}', Locale: '{If(request.Locale, "NULL")}'")
            Console.Out.Flush()

            ' ✅ STEP 3: Deserialize CompilationResult (+ subflow compilations con lo stesso schema)
            Dim compilationResult As Compiler.FlowCompilationResult = Nothing
            Dim serializerSettings As New JsonSerializerSettings() With {
                .NullValueHandling = NullValueHandling.Ignore,
                .MissingMemberHandling = MissingMemberHandling.Ignore
            }
            serializerSettings.Converters.Add(New Compiler.CompiledTaskListConverter())
            Dim compilationSerializer = JsonSerializer.Create(serializerSettings)

            Try
                ' Try to deserialize directly if it's already a JObject
                If TypeOf request.CompilationResult Is JObject Then
                    Dim jObj = CType(request.CompilationResult, JObject)
                    compilationResult = jObj.ToObject(Of Compiler.FlowCompilationResult)(compilationSerializer)
                Else
                    Throw New InvalidOperationException("CompilationResult must be a JObject. The session cannot start without a valid CompilationResult.")
                End If
            Catch deserializeEx As Exception
                Return ResponseHelpers.CreateErrorResponse($"Failed to deserialize CompilationResult: {deserializeEx.Message}", 400)
            End Try

            Dim subflowCompilations As Dictionary(Of String, Compiler.FlowCompilationResult) = Nothing
            If request.SubflowCompilations IsNot Nothing AndAlso request.SubflowCompilations.Count > 0 Then
                subflowCompilations = New Dictionary(Of String, Compiler.FlowCompilationResult)()
                For Each kvp In request.SubflowCompilations
                    If String.IsNullOrEmpty(kvp.Key) Then
                        Continue For
                    End If
                    Dim subJ = TryCast(kvp.Value, JObject)
                    If subJ Is Nothing Then
                        Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ subflowCompilations['{kvp.Key}'] is not a JSON object, skipped")
                        Continue For
                    End If
                    Try
                        Dim subResult = subJ.ToObject(Of Compiler.FlowCompilationResult)(compilationSerializer)
                        If subResult IsNot Nothing Then
                            subflowCompilations(kvp.Key) = subResult
                        End If
                    Catch subEx As Exception
                        Return ResponseHelpers.CreateErrorResponse(
                            $"Failed to deserialize subflowCompilations['{kvp.Key}']: {subEx.Message}", 400)
                    End Try
                Next
            End If

            ' ✅ STEP 4: Generate session ID
            Dim sessionId = Guid.NewGuid().ToString()

            ' ✅ STEP 4.5: ARCHITECTURAL - Salva translations nel TranslationRepository PRIMA di creare la sessione
            ' Questo garantisce che il repository sia pronto quando CreateSession crea resolveTranslation
            ' CreateSession è puro e non salva nulla - la responsabilità di salvare è del chiamante
            Dim translationRepository = SessionManager.GetTranslationRepository()
            If translationRepository IsNot Nothing AndAlso request.Translations IsNot Nothing AndAlso
               Not String.IsNullOrEmpty(request.ProjectId) AndAlso Not String.IsNullOrEmpty(request.Locale) Then
                Console.WriteLine($"[HandleOrchestratorSessionStart] 💾 Saving {request.Translations.Count} translations to TranslationRepository for projectId '{request.ProjectId}' and locale '{request.Locale}'")
                Dim savedCount = 0
                Dim errorCount = 0
                For Each kvp In request.Translations
                    Try
                        translationRepository.SetTranslation(request.ProjectId, request.Locale, kvp.Key, kvp.Value)
                        savedCount += 1
                    Catch ex As Exception
                        Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ Error saving translation '{kvp.Key}': {ex.Message}")
                        errorCount += 1
                    End Try
                Next
                Console.WriteLine($"[HandleOrchestratorSessionStart] ✅ Translations saved: {savedCount} successful, {errorCount} errors")
            Else
                If translationRepository Is Nothing Then
                    Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ TranslationRepository is Nothing - translations will not be saved")
                ElseIf request.Translations Is Nothing Then
                    Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ Request.Translations is Nothing - no translations to save")
                ElseIf String.IsNullOrEmpty(request.ProjectId) Then
                    Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ Request.ProjectId is empty - translations will not be saved")
                ElseIf String.IsNullOrEmpty(request.Locale) Then
                    Console.WriteLine($"[HandleOrchestratorSessionStart] ⚠️ Request.Locale is empty - translations will not be saved")
                End If
            End If

            ' ✅ STEP 5: Create session in SessionManager (NON avvia orchestrator - vedi HandleOrchestratorSessionStream)
            ' CreateSession è puro: non salva nulla, solo crea la sessione
            ' Le translations DEVONO essere già nel TranslationRepository (salvate sopra)
            Try
                SessionManager.CreateSession(
                    sessionId,
                    compilationResult,
                    request.Tasks,
                    request.Translations,
                    request.ProjectId,
                    request.Locale,
                    subflowCompilations
                )
            Catch sessionEx As Exception
                Return ResponseHelpers.CreateErrorResponse($"Failed to create session: {sessionEx.Message}", 500)
            End Try

            ' ✅ STEP 6: Return success response (simmetrico a HandleTaskSessionStart)
            Dim responseObj = New With {
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            }

            ' ✅ ARCHITECTURAL: Usa ResponseHelpers.CreateSuccessResponse (stesso helper di TaskSession)
            '    NON tocca mai context.Response, garantisce sempre body JSON valido
            Return ResponseHelpers.CreateSuccessResponse(responseObj)

        Catch ex As Exception
            Return ResponseHelpers.CreateErrorResponse($"Unexpected error while starting orchestrator session: {ex.Message}", 500)
        End Try
    End Function

    ''' <summary>
    ''' Handles GET /api/runtime/orchestrator/session/{id}/stream (SSE)
    ''' </summary>
    Private Async Function HandleOrchestratorSessionStream(context As HttpContext, sessionId As String) As System.Threading.Tasks.Task
        Try
            Console.WriteLine($"📡 [HandleOrchestratorSessionStream] SSE connection opened for session: {sessionId}")
            System.Diagnostics.Debug.WriteLine($"📡 [HandleOrchestratorSessionStream] SSE connection opened for session: {sessionId}")
            Console.Out.Flush()

            ' Get session
            Dim session = SessionManager.GetSession(sessionId)
            If session Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionStream] Session not found: {sessionId}")
                System.Diagnostics.Debug.WriteLine($"❌ [HandleOrchestratorSessionStream] Session not found: {sessionId}")
                Console.Out.Flush()
                context.Response.StatusCode = 404
                Await context.Response.WriteAsync($"event: error\ndata: {JsonConvert.SerializeObject(New With {.error = "Session not found"})}\n\n")
                Return
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Session found: {sessionId}, Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
            System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Session found: {sessionId}, Orchestrator is Nothing: {session.Orchestrator Is Nothing}")
            Console.Out.Flush()

            ' ✅ CRITICAL FIX: Assicurati che session.EventEmitter sia lo stesso EventEmitter condiviso
            ' GetSession dovrebbe già aver fatto questo, ma lo verifichiamo comunque per sicurezza
            Dim sharedEmitter = SessionManager.GetOrCreateEventEmitter(sessionId)
            If session.EventEmitter Is Nothing OrElse session.EventEmitter IsNot sharedEmitter Then
                Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] Replacing session.EventEmitter with shared EventEmitter for {sessionId}")
                System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] Replacing EventEmitter")
                Console.Out.Flush()
                session.EventEmitter = sharedEmitter
            End If

            ' ✅ UNIFIED: Usa SseStreamManager come per TaskSession
            Dim sseStreamManager As New ApiServer.Streaming.SseStreamManager()
            sseStreamManager.OpenStream(sessionId, context.Response)

            ' ✅ HANDSHAKE: Garantisce che lo stream sia completamente aperto prima di procedere
            Await context.Response.Body.FlushAsync()

            ' ✅ Register event handlers PRIMA del replay
            ' Questo permette al replay di EventEmitter di funzionare correttamente
            Dim onMessage As Action(Of Object) = Sub(data)
                                                     Try
                                                         Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                         Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] onMessage handler called for session {sessionId}")
                                                         Dim dataJson = JsonConvert.SerializeObject(data)
                                                         Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] Message data: {dataJson}")
                                                         System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] onMessage: {dataJson}")
                                                         Console.Out.Flush()

                                                         Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] Calling SseStreamManager.EmitEvent('message')...")
                                                         System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] Emitting SSE event...")
                                                         Console.Out.Flush()
                                                         sseStreamManager.EmitEvent(sessionId, "message", data)
                                                         Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] SseStreamManager.EmitEvent completed")
                                                         System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] SSE event emitted")
                                                         Console.Out.Flush()
                                                         Console.WriteLine($"═══════════════════════════════════════════════════════════════════════════")
                                                     Catch ex As Exception
                                                         Console.WriteLine($"❌ [SSE] Error in onMessage handler: {ex.Message}")
                                                         Console.WriteLine($"❌ [SSE] Stack trace: {ex.StackTrace}")
                                                         System.Diagnostics.Debug.WriteLine($"❌ [SSE] Error: {ex.Message}")
                                                         Console.Out.Flush()
                                                     End Try
                                                 End Sub

            ' ✅ ARCHITECTURAL: Handler per WaitingForInput - SOLO emissione SSE
            ' ExecutionState.DialogueContexts è l'unica fonte di verità, non impostiamo flag duplicati
            Dim onWaitingForInput As Action(Of Object) = Sub(data)
                                                             Try
                                                                 ' ✅ SOLO emissione SSE per frontend
                                                                 ' ❌ RIMOSSO: session.IsWaitingForInput = True
                                                                 ' ❌ RIMOSSO: session.WaitingForInputData = data
                                                                 ' ExecutionState.DialogueContexts è già stato aggiornato da TaskExecutor
                                                                 sseStreamManager.EmitEvent(sessionId, "waitingForInput", data)
                                                             Catch ex As Exception
                                                                 Console.WriteLine($"❌ [SSE] Error in onWaitingForInput handler: {ex.Message}")
                                                             End Try
                                                         End Sub

            Dim onStateUpdate As Action(Of Object) = Sub(data)
                                                         Try
                                                             sseStreamManager.EmitEvent(sessionId, "stateUpdate", data)
                                                         Catch ex As Exception
                                                             Console.WriteLine($"❌ [SSE] Error in onStateUpdate handler: {ex.Message}")
                                                         End Try
                                                     End Sub

            Dim onComplete As Action(Of Object) = Sub(data)
                                                      Try
                                                          sseStreamManager.EmitEvent(sessionId, "complete", data)
                                                          sseStreamManager.CloseStream(sessionId)
                                                      Catch ex As Exception
                                                          Console.WriteLine($"❌ [SSE] Error in onComplete handler: {ex.Message}")
                                                      End Try
                                                  End Sub

            Dim onError As Action(Of Object) = Sub(data)
                                                   Try
                                                       sseStreamManager.EmitEvent(sessionId, "error", data)
                                                       sseStreamManager.CloseStream(sessionId)
                                                   Catch ex As Exception
                                                       Console.WriteLine($"❌ [SSE] Error in onError handler: {ex.Message}")
                                                   End Try
                                               End Sub

            ' ✅ HANDSHAKE: Register listeners - questo fa replay automatico dei messaggi buffered da EventEmitter
            ' EventEmitter gestisce TUTTO il replay, quindi NON chiamiamo SendBufferedMessages (evita doppio invio)
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] Registering SSE event handlers")
            System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] Registering handlers")
            session.EventEmitter.[On]("message", onMessage)
            session.EventEmitter.[On]("waitingForInput", onWaitingForInput)
            session.EventEmitter.[On]("stateUpdate", onStateUpdate)
            session.EventEmitter.[On]("complete", onComplete)
            session.EventEmitter.[On]("error", onError)
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] All handlers registered - replay completed")
            System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] Handlers registered - replay completed")

            ' ✅ ARCHITECTURAL: Send waitingForInput event if already waiting (prima dell'evento ready)
            ' Leggi da ExecutionState.DialogueContexts, non da flag duplicati
            Dim executionStateStorage = SessionManager.GetExecutionStateStorage()
            If executionStateStorage IsNot Nothing Then
                Dim executionState = executionStateStorage.GetExecutionState(sessionId)
                If executionState IsNot Nothing AndAlso executionState.DialogueContexts IsNot Nothing AndAlso executionState.DialogueContexts.Count > 0 Then
                    Dim taskId = executionState.DialogueContexts.Keys.FirstOrDefault()
                    If Not String.IsNullOrEmpty(taskId) Then
                        Dim waitingData = New With {
                            .taskId = taskId,
                            .timestamp = DateTime.UtcNow.ToString("O")
                        }
                        sseStreamManager.EmitEvent(sessionId, "waitingForInput", waitingData)
                        Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Replayed waitingForInput event for task {taskId} (from ExecutionState)")
                    End If
                End If
            End If

            ' ✅ HANDSHAKE: Notifica al client che lo stream è pronto e l'orchestrator partirà
            sseStreamManager.EmitEvent(sessionId, "ready", New With {.status = "ok"})
            Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Ready event sent - orchestrator will start now")
            System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Ready event sent")

            ' ✅ HANDSHAKE: Avvia l'orchestrator SOLO ORA (dopo che lo stream è pronto e i listener sono registrati)
            ' ✅ THREAD-SAFE: Usa metodo helper di SessionManager che gestisce lock e protezione contro doppio avvio
            Console.WriteLine($"🔵 [HandleOrchestratorSessionStream] About to start orchestrator for session {sessionId}")
            System.Diagnostics.Debug.WriteLine($"🔵 [HandleOrchestratorSessionStream] Starting orchestrator...")
            Console.Out.Flush()
            Dim orchestratorStarted = SessionManager.StartOrchestratorIfNotRunning(sessionId)
            If orchestratorStarted Then
                Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Orchestrator started successfully for session {sessionId}")
                System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Orchestrator started")
            Else
                Console.WriteLine($"⚠️ [HandleOrchestratorSessionStream] Orchestrator not started (already running or error) for session {sessionId}")
                System.Diagnostics.Debug.WriteLine($"⚠️ [HandleOrchestratorSessionStream] Orchestrator not started")
            End If
            Console.Out.Flush()

            ' ✅ NOTA: NON inviamo session.Messages manualmente
            ' I messaggi sono già stati replayed da EventEmitter quando abbiamo registrato l'handler
            ' session.Messages serve solo per persistenza, non per invio SSE

            ' Cleanup on disconnect
            context.RequestAborted.Register(Sub()
                                                Console.WriteLine($"✅ [HandleOrchestratorSessionStream] SSE connection closed for session: {sessionId}")
                                                session.EventEmitter.RemoveListener("message", onMessage)
                                                session.EventEmitter.RemoveListener("waitingForInput", onWaitingForInput)
                                                session.EventEmitter.RemoveListener("stateUpdate", onStateUpdate)
                                                session.EventEmitter.RemoveListener("complete", onComplete)
                                                session.EventEmitter.RemoveListener("error", onError)
                                                sseStreamManager.CloseStream(sessionId)
                                            End Sub)

            ' ✅ Keep connection alive - SseStreamManager gestisce heartbeat automaticamente
            ' Wait for connection to close
            Try
                Await System.Threading.Tasks.Task.Delay(Timeout.Infinite, context.RequestAborted)
            Catch ex As System.Threading.Tasks.TaskCanceledException
                ' Connection closed normally
                Console.WriteLine($"✅ [HandleOrchestratorSessionStream] Connection closed normally for session: {sessionId}")
                System.Diagnostics.Debug.WriteLine($"✅ [HandleOrchestratorSessionStream] Connection closed normally for session: {sessionId}")
            End Try
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleOrchestratorSessionStream] ERROR: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            System.Diagnostics.Debug.WriteLine($"❌ [HandleOrchestratorSessionStream] ERROR: {ex.Message}")
            System.Diagnostics.Debug.WriteLine($"Stack trace: {ex.StackTrace}")
            Console.Out.Flush()
        End Try
    End Function

    ''' <summary>
    ''' Handles POST /api/runtime/orchestrator/session/{id}/input
    ''' </summary>
    Private Async Function HandleOrchestratorSessionInput(context As HttpContext, sessionId As String) As Task(Of IResult)
        Console.WriteLine($"📥 [HandleOrchestratorSessionInput] Received input for session: {sessionId}")

        Try
            Dim reader As New StreamReader(context.Request.Body)
            Dim body = Await reader.ReadToEndAsync()
            Dim request = JsonConvert.DeserializeObject(Of OrchestratorSessionInputRequest)(body)

            If request Is Nothing Then
                Console.WriteLine("❌ [HandleOrchestratorSessionInput] Invalid request")
                Return Results.BadRequest(New With {.error = "Invalid request"})
            End If

            If String.IsNullOrEmpty(request.Input) Then
                Console.WriteLine("❌ [HandleOrchestratorSessionInput] Empty input")
                Return Results.BadRequest(New With {.error = "Input is required"})
            End If

            ' Get session
            Dim session = SessionManager.GetSession(sessionId)
            If session Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Session not found: {sessionId}")
                Return Results.NotFound(New With {.error = "Session not found"})
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionInput] Processing input: {request.Input.Substring(0, Math.Min(100, request.Input.Length))}")

            ' ✅ ARCHITECTURAL: Verifica da ExecutionState (unica fonte di verità)
            ' WaitingTaskId è impostato da RunUntilInput quando RequiresInput=True
            Dim executionStateStorage = SessionManager.GetExecutionStateStorage()
            If executionStateStorage Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionInput] ExecutionStateStorage is not available")
                Return Results.Problem(title:="ExecutionStateStorage not available", detail:="Cannot verify if session is waiting for input", statusCode:=500)
            End If

            Dim executionState = executionStateStorage.GetExecutionState(sessionId)
            If executionState Is Nothing Then
                Console.WriteLine($"⚠️ [HandleOrchestratorSessionInput] ExecutionState not found for session {sessionId}")
                Return Results.BadRequest(New With {.error = "Session is not waiting for input"})
            End If

            ' ✅ Usa WaitingTaskId come fonte di verità primaria (impostato da RunUntilInput)
            ' Fallback su DialogueContexts per compatibilità con sessioni vecchie
            Dim taskId As String = executionState.WaitingTaskId
            If String.IsNullOrEmpty(taskId) Then
                ' Fallback: cerca in DialogueContexts
                If executionState.DialogueContexts IsNot Nothing AndAlso executionState.DialogueContexts.Count > 0 Then
                    taskId = executionState.DialogueContexts.Keys.FirstOrDefault()
                End If
            End If

            If String.IsNullOrEmpty(taskId) Then
                Console.WriteLine($"⚠️ [HandleOrchestratorSessionInput] No task waiting for input (WaitingTaskId=empty, DialogueContexts=empty)")
                Return Results.BadRequest(New With {.error = "Session is not waiting for input"})
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionInput] Found task {taskId} waiting for input")

            ' ✅ ARCHITECTURAL: Crea resolveTranslation function (come in GetSession)
            Dim resolveTranslation As Func(Of String, String) = Nothing
            If Not String.IsNullOrEmpty(session.ProjectId) AndAlso Not String.IsNullOrEmpty(session.Locale) Then
                Dim translationRepository = SessionManager.GetTranslationRepository()
                If translationRepository IsNot Nothing Then
                    resolveTranslation = Function(textKey As String) As String
                                             If String.IsNullOrEmpty(textKey) Then
                                                 Return Nothing
                                             End If
                                             Try
                                                 Return SessionManager.ResolveTranslation(session.ProjectId, session.Locale, textKey)
                                             Catch ex As Exception
                                                 Console.WriteLine($"⚠️ [HandleOrchestratorSessionInput] Error resolving translation for {textKey}: {ex.Message}")
                                                 Return textKey ' Fallback: usa TextKey stesso
                                             End Try
                                         End Function
                End If
            End If

            ' ✅ ARCHITECTURAL: Chiama FlowOrchestrator.ProvideUserInput
            ' TaskExecutor gestisce tutto internamente, FlowOrchestrator delega e propaga
            If session.Orchestrator Is Nothing Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Orchestrator is Nothing")
                Return Results.Problem(title:="Orchestrator not available", detail:="Session orchestrator is not initialized", statusCode:=500)
            End If

            Console.WriteLine($"✅ [HandleOrchestratorSessionInput] Calling FlowOrchestrator.ProvideUserInput for task {taskId}")
            Dim inputProcessed = Await session.Orchestrator.ProvideUserInput(taskId, request.Input, resolveTranslation)

            If Not inputProcessed Then
                Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Failed to process input for task {taskId}")
                Return Results.Problem(title:="Failed to process input", detail:="Orchestrator could not process the input", statusCode:=500)
            End If

            ' ✅ ARCHITECTURAL: ExecutionState viene aggiornato da ProvideUserInput
            ' Se il task è completato, DialogueContexts viene rimosso automaticamente
            ' ❌ RIMOSSO: session.IsWaitingForInput = False (flag duplicato)
            ' ❌ RIMOSSO: session.WaitingForInputData = Nothing (flag duplicato)

            Console.WriteLine($"✅ [HandleOrchestratorSessionInput] Input processed successfully for task {taskId} (ExecutionState updated by ProvideUserInput)")

            Return Results.Ok(New With {
                .success = True,
                .taskId = taskId,
                .timestamp = DateTime.UtcNow.ToString("O")
            })
        Catch ex As Exception
            Console.WriteLine($"❌ [HandleOrchestratorSessionInput] Exception: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            Return Results.Problem(
                title:="Failed to provide input",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

    ' ReadAndParseRequest, CreateTaskSession, HandleTaskSessionStart, HandleTaskSessionStream, HandleTaskSessionInput, HandleTaskSessionDelete moved to ApiServer.Handlers.TaskSessionHandlers

    ''' <summary>
    ''' Handles DELETE /api/runtime/orchestrator/session/{id}
    ''' </summary>
    Private Async Function HandleOrchestratorSessionDelete(context As HttpContext, sessionId As String) As Task(Of IResult)
        Try
            If String.IsNullOrWhiteSpace(sessionId) Then
                Return Results.BadRequest(New With {.error = "Session id is required"})
            End If

            SessionManager.DeleteSession(sessionId)

            Return Results.Ok(New With {
                .success = True,
                .sessionId = sessionId,
                .timestamp = DateTime.UtcNow.ToString("O")
            })
        Catch ex As Exception
            Return Results.Problem(
                title:="Failed to delete session",
                detail:=ex.Message,
                statusCode:=500
            )
        End Try
    End Function

    ' ============================================================================
    ' API Data Models moved to ApiServer.Models namespace
    ' ============================================================================
End Module


