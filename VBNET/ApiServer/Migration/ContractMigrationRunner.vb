Option Strict On
Option Explicit On
Imports System.Text.RegularExpressions
Imports Newtonsoft.Json.Linq
Imports StackExchange.Redis

Namespace ApiServer.Migration

    ''' <summary>
    ''' Phase 2 migration tool: adds GroupName to NLP contract SubDataMapping entries
    ''' that are still using the semantic CanonicalKey as the regex group name.
    '''
    ''' HOW TO USE:
    ''' -----------
    ''' This module is NEVER called automatically by the runtime.
    ''' Call ContractMigrationRunner.Run(...) manually from a one-off script,
    ''' a test harness, or the CLI before deploying the Phase 3 Wizard changes.
    '''
    ''' The migration is idempotent: keys that already have GUID GroupNames are
    ''' left untouched.
    '''
    ''' SAFETY GATE:
    ''' Set EnableContractMigration = True to allow writes.
    ''' When False (the default) the runner operates in dry-run mode regardless
    ''' of the dryRun parameter.
    ''' </summary>
    Public Class ContractMigrationRunner

        ' ── Safety gate ──────────────────────────────────────────────────────
        ''' <summary>
        ''' Master switch. Must be set to True before the runner will write
        ''' any changes to Redis. Default is False (dry-run only).
        ''' </summary>
        Public Shared Property EnableContractMigration As Boolean = False

        ' ── Constants ────────────────────────────────────────────────────────
        Private Shared ReadOnly GuidGroupPattern As New Regex(
            "^g_[a-f0-9]{12}$",
            RegexOptions.IgnoreCase Or RegexOptions.Compiled)

        Private Shared ReadOnly NamedGroupRe As New Regex(
            "\(\?<([^>]+)>",
            RegexOptions.Compiled)

        ' ── Public entry point ───────────────────────────────────────────────

        ''' <summary>
        ''' Runs the contract migration against the given Redis instance.
        ''' Returns a MigrationReport summarising what was (or would be) changed.
        ''' </summary>
        ''' <param name="redisConnectionString">Redis connection string (e.g. "localhost:6379")</param>
        ''' <param name="keyPrefix">Key prefix used by the application (e.g. "omnia:")</param>
        ''' <param name="dryRun">
        ''' When True, changes are computed but not written to Redis.
        ''' Note: when EnableContractMigration is False, dryRun is forced to True.
        ''' </param>
        Public Shared Function Run(
                redisConnectionString As String,
                keyPrefix As String,
                Optional dryRun As Boolean = True) As MigrationReport

            If String.IsNullOrWhiteSpace(redisConnectionString) Then
                Throw New ArgumentException("redisConnectionString cannot be empty.", NameOf(redisConnectionString))
            End If
            If String.IsNullOrWhiteSpace(keyPrefix) Then
                Throw New ArgumentException("keyPrefix cannot be empty.", NameOf(keyPrefix))
            End If

            ' Safety gate: override dryRun to True if the master switch is off.
            Dim effectiveDryRun = dryRun OrElse Not EnableContractMigration

            Dim report As New MigrationReport()
            Dim connection = ConnectionMultiplexer.Connect(redisConnectionString)
            Dim db = connection.GetDatabase()
            Dim server = connection.GetServer(connection.GetEndPoints()(0))

            Dim scanPattern = $"{keyPrefix}dialog:*"
            Dim keys = server.Keys(pattern:=scanPattern)

            For Each key As RedisKey In keys
                MigrateKey(db, key, report, effectiveDryRun)
            Next

            connection.Dispose()
            Return report
        End Function

        ' ── Private helpers ──────────────────────────────────────────────────

        Private Shared Sub MigrateKey(
                db As IDatabase,
                key As RedisKey,
                report As MigrationReport,
                dryRun As Boolean)

            Try
                Dim raw As RedisValue = db.StringGet(key)
                If Not raw.HasValue Then
                    report.SkippedNoData.Add(CStr(key))
                    Return
                End If

                Dim doc As JToken = JToken.Parse(raw.ToString())
                Dim changed = WalkAndMigrate(doc, CStr(key), report)

                If Not changed Then
                    report.AlreadyMigrated.Add(CStr(key))
                    Return
                End If

                If Not dryRun Then
                    db.StringSet(key, doc.ToString(Newtonsoft.Json.Formatting.None))
                End If

                report.Migrated.Add(CStr(key))

            Catch ex As Exception
                report.Errors(CStr(key)) = ex.Message
            End Try
        End Sub

        ''' <summary>
        ''' Recursively walks a RuntimeTask JToken tree.
        ''' Returns True when any change was made.
        ''' </summary>
        Private Shared Function WalkAndMigrate(
                node As JToken,
                path As String,
                report As MigrationReport) As Boolean

            If node Is Nothing OrElse node.Type <> JTokenType.Object Then Return False

            Dim obj = CType(node, JObject)
            Dim changed = False

            ' Look for nlpContract (Newtonsoft TypeNameHandling preserves field names)
            For Each contractKey In {"nlpContract", "NlpContract"}
                Dim contractToken = obj(contractKey)
                If contractToken IsNot Nothing AndAlso contractToken.Type = JTokenType.Object Then
                    If MigrateContract(CType(contractToken, JObject), $"{path}.{contractKey}", report) Then
                        changed = True
                    End If
                End If
            Next

            ' Recurse into subTasks
            For Each subKey In {"subTasks", "SubTasks"}
                Dim subToken = obj(subKey)
                If subToken IsNot Nothing AndAlso subToken.Type = JTokenType.Array Then
                    Dim arr = CType(subToken, JArray)
                    For i As Integer = 0 To arr.Count - 1
                        If WalkAndMigrate(arr(i), $"{path}.subTasks[{i}]", report) Then
                            changed = True
                        End If
                    Next
                End If
            Next

            Return changed
        End Function

        ''' <summary>
        ''' Inspects a single nlpContract JObject.
        ''' Returns True when a change was made.
        ''' </summary>
        Private Shared Function MigrateContract(
                contract As JObject,
                contractPath As String,
                report As MigrationReport) As Boolean

            Dim subMappingToken = contract("subDataMapping")
            If subMappingToken Is Nothing OrElse subMappingToken.Type <> JTokenType.Object Then
                Return False  ' leaf node — no composite mapping
            End If

            Dim subMapping = CType(subMappingToken, JObject)

            ' Collect patterns
            Dim regexToken = contract("regex")
            Dim patterns As New List(Of String)()
            Dim patternArray As JArray = Nothing

            If regexToken IsNot Nothing AndAlso regexToken.Type = JTokenType.Object Then
                Dim pArr = CType(regexToken, JObject)("patterns")
                If pArr IsNot Nothing AndAlso pArr.Type = JTokenType.Array Then
                    patternArray = CType(pArr, JArray)
                    For Each pt As JToken In patternArray
                        patterns.Add(pt.ToString())
                    Next
                End If
            End If

            Dim changed = False

            For Each prop As JProperty In subMapping.Properties().ToList()
                Dim subId    = prop.Name
                Dim infoObj  = TryCast(prop.Value, JObject)
                If infoObj Is Nothing Then
                    report.Anomalies.Add(
                        $"{contractPath}.subDataMapping[{subId}]: value is not an object — skipped.")
                    Continue For
                End If

                Dim existingGroup = CStr(If(infoObj("groupName")?.ToString(), ""))
                If IsGuid(existingGroup) Then
                    ' Already migrated — verify pattern coherence.
                    Dim found = patterns.Any(Function(p) p.Contains($"(?<{existingGroup}>"))
                    If Not found AndAlso patterns.Count > 0 Then
                        report.Anomalies.Add(
                            $"{contractPath}.subDataMapping[{subId}]: " &
                            $"groupName='{existingGroup}' is a GUID but not found in any pattern.")
                    End If
                    Continue For
                End If

                Dim canonical = CStr(If(infoObj("canonicalKey")?.ToString(), ""))
                If String.IsNullOrWhiteSpace(canonical) Then
                    report.Anomalies.Add(
                        $"{contractPath}.subDataMapping[{subId}]: " &
                        "no groupName and no canonicalKey — cannot migrate, skipped.")
                    Continue For
                End If

                ' Generate new GUID
                Dim newGuid = GenerateGroupName()
                infoObj("groupName") = New JValue(newGuid)
                changed = True

                ' Rewrite patterns
                Dim presentInPatterns = patterns.Any(Function(p) p.Contains($"(?<{canonical}>"))
                If Not presentInPatterns AndAlso patterns.Count > 0 Then
                    report.Anomalies.Add(
                        $"{contractPath}.subDataMapping[{subId}]: " &
                        $"canonicalKey='{canonical}' not found in any pattern as a group name — " &
                        "groupName assigned but patterns not rewritten.")
                End If

                If presentInPatterns Then
                    For i As Integer = 0 To patterns.Count - 1
                        patterns(i) = patterns(i).Replace(
                            $"(?<{canonical}>",
                            $"(?<{newGuid}>")
                    Next
                End If
            Next

            ' Write back patterns if changed
            If changed AndAlso patternArray IsNot Nothing AndAlso patterns.Count > 0 Then
                patternArray.Clear()
                For Each p As String In patterns
                    patternArray.Add(New JValue(p))
                Next
            End If

            Return changed
        End Function

        Private Shared Function IsGuid(value As String) As Boolean
            Return Not String.IsNullOrEmpty(value) AndAlso GuidGroupPattern.IsMatch(value)
        End Function

        Private Shared Function GenerateGroupName() As String
            Return "g_" & Guid.NewGuid().ToString("N").Substring(0, 12)
        End Function

    End Class

    ' ── Report DTO ───────────────────────────────────────────────────────────

    ''' <summary>
    ''' Summary of a migration run.
    ''' </summary>
    Public Class MigrationReport
        ''' <summary>Keys that were changed (or would be changed in dry-run).</summary>
        Public ReadOnly Property Migrated As New List(Of String)()

        ''' <summary>Keys where all GroupNames were already GUIDs.</summary>
        Public ReadOnly Property AlreadyMigrated As New List(Of String)()

        ''' <summary>Keys that exist in Redis but had no parseable contract data.</summary>
        Public ReadOnly Property SkippedNoData As New List(Of String)()

        ''' <summary>Keys that failed with an exception. Key = Redis key, Value = error message.</summary>
        Public ReadOnly Property Errors As New Dictionary(Of String, String)()

        ''' <summary>Non-fatal observations (pattern/mapping mismatches, missing canonicalKey, etc.).</summary>
        Public ReadOnly Property Anomalies As New List(Of String)()

        ''' <summary>Prints a formatted report to the console.</summary>
        Public Sub PrintToConsole(Optional dryRun As Boolean = False)
            Dim label = If(dryRun, "[DRY-RUN] ", "")
            Console.WriteLine()
            Console.WriteLine(New String("═"c, 60))
            Console.WriteLine($"  {label}MIGRATION REPORT")
            Console.WriteLine(New String("═"c, 60))
            Console.WriteLine($"  ✅ Migrated          : {Migrated.Count}")
            Console.WriteLine($"  ⬜ Already migrated  : {AlreadyMigrated.Count}")
            Console.WriteLine($"  ⬛ Skipped (no data) : {SkippedNoData.Count}")
            Console.WriteLine($"  ❌ Errors            : {Errors.Count}")
            Console.WriteLine($"  ⚠️  Anomalies         : {Anomalies.Count}")

            If Errors.Count > 0 Then
                Console.WriteLine()
                Console.WriteLine("  ── Errors ──────────────────────────────────────────")
                For Each kvp As KeyValuePair(Of String, String) In Errors
                    Console.WriteLine($"    {kvp.Key}: {kvp.Value}")
                Next
            End If

            If Anomalies.Count > 0 Then
                Console.WriteLine()
                Console.WriteLine("  ── Anomalies ────────────────────────────────────────")
                For Each anomaly As String In Anomalies
                    Console.WriteLine($"    ⚠️  {anomaly}")
                Next
            End If

            Console.WriteLine(New String("═"c, 60))
        End Sub
    End Class

End Namespace
