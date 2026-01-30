Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports DDTEngine

''' <summary>
''' Compilatore DDT: trasforma strutture IDE in strutture Runtime
''' - Deserializza JSON in TaskTreeRuntime (IDE, ex AssembledDDT)
''' - Trasforma TaskTreeRuntime in DDTInstance (Runtime)
''' - Carica nlpContract per ogni nodo
''' - Valida struttura
''' - Pre-compila regex
''' </summary>
Public Class DDTCompiler
    Private ReadOnly _contractLoader As ContractLoader
    Private ReadOnly _assembler As DDTAssembler

    Public Sub New()
        _contractLoader = New ContractLoader()
        _assembler = New DDTAssembler()
    End Sub

    ''' <summary>
    ''' Compila un DDT da stringa JSON
    ''' </summary>
    Public Function Compile(ddtJson As String) As DDTCompilationResult
        Console.WriteLine($"🔍 [COMPILER][DDTCompiler] Compile called, ddtJson length={If(ddtJson IsNot Nothing, ddtJson.Length, 0)}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTCompiler] Compile called, ddtJson length={If(ddtJson IsNot Nothing, ddtJson.Length, 0)}")

        If String.IsNullOrEmpty(ddtJson) Then
            Throw New ArgumentException("DDT JSON cannot be null or empty", NameOf(ddtJson))
        End If

        ' 1. Deserializza JSON in TaskTreeRuntime (struttura IDE tipizzata, ex AssembledDDT)
        Console.WriteLine($"🔍 [COMPILER][DDTCompiler] Step 1: Deserializing JSON to TaskTreeRuntime...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTCompiler] Step 1: Deserializing JSON to TaskTreeRuntime...")
        Dim settings As New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore,
            .MissingMemberHandling = MissingMemberHandling.Ignore
        }
        ' ✅ Register custom converters (also specified as attributes, but explicit registration ensures they work)
        settings.Converters.Add(New MainDataNodeListConverter())
        settings.Converters.Add(New DialogueStepListConverter())

        Dim assembled As Compiler.TaskTreeRuntime = JsonConvert.DeserializeObject(Of Compiler.TaskTreeRuntime)(ddtJson, settings)
        If assembled Is Nothing Then
            Throw New InvalidOperationException("Impossibile deserializzare TaskTreeRuntime dal JSON")
        End If

        Console.WriteLine($"✅ [COMPILER][DDTCompiler] TaskTreeRuntime deserialized: Id={assembled.Id}, Data IsNot Nothing={assembled.Data IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTCompiler] TaskTreeRuntime deserialized: Id={assembled.Id}, Data IsNot Nothing={assembled.Data IsNot Nothing}")
        If assembled.Data IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][DDTCompiler] TaskTreeRuntime.Data.Count={assembled.Data.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTCompiler] TaskTreeRuntime.Data.Count={assembled.Data.Count}")
        End If

        ' 2. Trasforma TaskTreeRuntime (IDE) → Task ricorsivo (Runtime)
        Console.WriteLine($"🔍 [COMPILER][DDTCompiler] Step 2: Compiling TaskTreeRuntime to Task using DDTAssembler.Compile...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][DDTCompiler] Step 2: Compiling TaskTreeRuntime to Task using DDTAssembler.Compile...")
        Dim rootTask As RuntimeTask = _assembler.Compile(assembled)
        Console.WriteLine($"✅ [COMPILER][DDTCompiler] Task created: Id={If(String.IsNullOrEmpty(rootTask.Id), "NULL", rootTask.Id)}, SubTasks.Count={If(rootTask.SubTasks IsNot Nothing, rootTask.SubTasks.Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][DDTCompiler] Task created: Id={If(String.IsNullOrEmpty(rootTask.Id), "NULL", rootTask.Id)}, SubTasks.Count={If(rootTask.SubTasks IsNot Nothing, rootTask.SubTasks.Count, 0)}")

        ' 3. Carica nlpContract per tutti i nodi (ricorsivo)
        LoadContractsForTask(rootTask)

        ' 4. Valida struttura (placeholder, regex, ecc.)
        Dim validationErrors As List(Of String) = ValidateTask(rootTask)

        Dim result As New DDTCompilationResult()
        result.Task = rootTask
        result.ValidationErrors = validationErrors
        result.IsValid = (validationErrors.Count = 0)
        Return result
    End Function

    ''' <summary>
    ''' Carica nlpContract per tutti i nodi del Task (ricorsivo)
    ''' </summary>
    Private Sub LoadContractsForTask(task As RuntimeTask)
        LoadContractForTask(task)
    End Sub

    ''' <summary>
    ''' Carica e compila nlpContract per un RuntimeTask e ricorsivamente per i suoi subTasks
    ''' </summary>
    Private Sub LoadContractForTask(task As RuntimeTask)
        ' Se il contract non è già presente, prova a caricarlo e compilarlo
        ' TODO: ContractLoader deve essere modificato per accettare Task invece di DDTNode
        ' Per ora, se NlpContract è Nothing, non facciamo nulla (verrà caricato a runtime se necessario)
        ' Il ContractLoader attuale usa DDTNode, quindi dobbiamo adattarlo o creare un nuovo loader

        ' Ricorsivo per subTasks
        If task.SubTasks IsNot Nothing Then
            For Each subTask As RuntimeTask In task.SubTasks
                LoadContractForTask(subTask)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida la struttura del Task (ricorsivo)
    ''' </summary>
    Private Function ValidateTask(task As RuntimeTask) As List(Of String)
        Dim errors As New List(Of String)()
        ValidateTaskRecursive(task, errors)
        Return errors
    End Function

    ''' <summary>
    ''' Valida un RuntimeTask e ricorsivamente i suoi subTasks
    ''' </summary>
    Private Sub ValidateTaskRecursive(runtimeTask As RuntimeTask, errors As List(Of String))
        ' Valida placeholder nei messaggi
        If runtimeTask.Steps IsNot Nothing Then
            For Each dstep As DDTEngine.DialogueStep In runtimeTask.Steps
                If dstep.Escalations IsNot Nothing Then
                    For Each escalation As DDTEngine.Escalation In dstep.Escalations
                        If escalation.Tasks IsNot Nothing Then
                            For Each itask As ITask In escalation.Tasks
                                If TypeOf itask Is MessageTask Then
                                    Dim msgTask As MessageTask = DirectCast(itask, MessageTask)
                                    ValidatePlaceholders(msgTask.Text, runtimeTask, errors)
                                End If
                            Next
                        End If
                    Next
                End If
            Next
        End If

        ' Valida regex nel contract (se presente)
        If runtimeTask.NlpContract IsNot Nothing AndAlso runtimeTask.NlpContract.Regex IsNot Nothing Then
            ValidateRegexPatterns(runtimeTask.NlpContract.Regex, runtimeTask, errors)
        End If

        ' Ricorsivo per subTasks
        If runtimeTask.SubTasks IsNot Nothing Then
            For Each subTask As RuntimeTask In runtimeTask.SubTasks
                ValidateTaskRecursive(subTask, errors)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida placeholder nel testo
    ''' </summary>
    Private Sub ValidatePlaceholders(text As String, runtimeTask As RuntimeTask, errors As List(Of String))
        If String.IsNullOrEmpty(text) Then Return

        ' Pattern: [FullLabel]
        Dim placeholderPattern As New Text.RegularExpressions.Regex("\[([^\]]+)\]")
        Dim matches As Text.RegularExpressions.MatchCollection = placeholderPattern.Matches(text)

        For Each match As Text.RegularExpressions.Match In matches
            Dim fullLabel As String = match.Groups(1).Value
            ' TODO: Verifica che FullLabel esista nel DDT
            ' Per ora solo log
        Next
    End Sub

    ''' <summary>
    ''' Valida pattern regex nel contract
    ''' </summary>
    Private Sub ValidateRegexPatterns(regexConfig As RegexConfig, task As RuntimeTask, errors As List(Of String))
        If regexConfig.Patterns IsNot Nothing Then
            For Each pattern As String In regexConfig.Patterns
                Try
                    Dim testRegex As New Text.RegularExpressions.Regex(pattern)
                Catch ex As Exception
                    errors.Add($"Task '{task.Id}': Pattern regex invalido: {pattern}. Errore: {ex.Message}")
                End Try
            Next
        End If
    End Sub
End Class

''' <summary>
''' DDT Compilation Result: Output of DDTCompiler
''' </summary>
Public Class DDTCompilationResult
    ''' <summary>
    ''' Task root compilato (struttura ricorsiva)
    ''' </summary>
    Public Property Task As RuntimeTask

    ''' <summary>
    ''' Lista di errori di validazione
    ''' </summary>
    Public Property ValidationErrors As List(Of String)

    ''' <summary>
    ''' Indica se la compilazione è valida
    ''' </summary>
    Public Property IsValid As Boolean

    Public Sub New()
        ValidationErrors = New List(Of String)()
    End Sub
End Class

