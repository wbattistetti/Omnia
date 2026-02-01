Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' Compilatore Task: trasforma strutture IDE in strutture Runtime
''' - Deserializza JSON in TaskTreeExpanded (IDE - AST montato)
''' - Trasforma TaskTreeExpanded in RuntimeTask (Runtime)
''' - Carica nlpContract per ogni nodo
''' - Valida struttura
''' - Pre-compila regex
''' </summary>
Public Class TaskCompiler
    Private ReadOnly _contractLoader As ContractLoader
    Private ReadOnly _assembler As TaskAssembler

    Public Sub New()
        _contractLoader = New ContractLoader()
        _assembler = New TaskAssembler()
    End Sub

    ''' <summary>
    ''' Compila un Task da stringa JSON
    ''' </summary>
    Public Function Compile(taskJson As String) As TaskCompilationResult
        Console.WriteLine($"🔍 [COMPILER][TaskCompiler] Compile called, taskJson length={If(taskJson IsNot Nothing, taskJson.Length, 0)}")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskCompiler] Compile called, taskJson length={If(taskJson IsNot Nothing, taskJson.Length, 0)}")

        If String.IsNullOrEmpty(taskJson) Then
            Throw New ArgumentException("Task JSON cannot be null or empty", NameOf(taskJson))
        End If

        ' 1. Deserializza JSON in TaskTreeExpanded (struttura IDE tipizzata - AST montato)
        Console.WriteLine($"🔍 [COMPILER][TaskCompiler] Step 1: Deserializing JSON to TaskTreeExpanded...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskCompiler] Step 1: Deserializing JSON to TaskTreeExpanded...")
        Dim settings As New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore,
            .MissingMemberHandling = MissingMemberHandling.Ignore
        }
        ' ✅ Register custom converters (also specified as attributes, but explicit registration ensures they work)
        settings.Converters.Add(New TaskNodeListConverter())
        settings.Converters.Add(New DialogueStepListConverter())

        Dim assembled As Compiler.TaskTreeExpanded = JsonConvert.DeserializeObject(Of Compiler.TaskTreeExpanded)(taskJson, settings)
        If assembled Is Nothing Then
            Throw New InvalidOperationException("Impossibile deserializzare TaskTreeExpanded dal JSON")
        End If

        Console.WriteLine($"✅ [COMPILER][TaskCompiler] TaskTreeExpanded deserialized: Id={assembled.Id}, Nodes IsNot Nothing={assembled.Nodes IsNot Nothing}")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskCompiler] TaskTreeExpanded deserialized: Id={assembled.Id}, Nodes IsNot Nothing={assembled.Nodes IsNot Nothing}")
        If assembled.Nodes IsNot Nothing Then
            Console.WriteLine($"🔍 [COMPILER][TaskCompiler] TaskTreeExpanded.Nodes.Count={assembled.Nodes.Count}")
            System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskCompiler] TaskTreeExpanded.Nodes.Count={assembled.Nodes.Count}")
        End If

        ' 2. Trasforma TaskTreeExpanded (IDE - AST montato) → Task ricorsivo (Runtime)
        Console.WriteLine($"🔍 [COMPILER][TaskCompiler] Step 2: Compiling TaskTreeExpanded to Task using TaskAssembler.Compile...")
        System.Diagnostics.Debug.WriteLine($"🔍 [COMPILER][TaskCompiler] Step 2: Compiling TaskTreeExpanded to Task using TaskAssembler.Compile...")
        Dim rootTask As RuntimeTask = _assembler.Compile(assembled)
        Console.WriteLine($"✅ [COMPILER][TaskCompiler] Task created: Id={If(String.IsNullOrEmpty(rootTask.Id), "NULL", rootTask.Id)}, SubTasks.Count={If(rootTask.SubTasks IsNot Nothing, rootTask.SubTasks.Count, 0)}")
        System.Diagnostics.Debug.WriteLine($"✅ [COMPILER][TaskCompiler] Task created: Id={If(String.IsNullOrEmpty(rootTask.Id), "NULL", rootTask.Id)}, SubTasks.Count={If(rootTask.SubTasks IsNot Nothing, rootTask.SubTasks.Count, 0)}")

        ' 3. Carica nlpContract per tutti i nodi (ricorsivo)
        LoadContractsForTask(rootTask)

        ' 4. Valida struttura (placeholder, regex, ecc.)
        Dim validationErrors As List(Of String) = ValidateTask(rootTask)

        Dim result As New TaskCompilationResult()
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
        ' TODO: ContractLoader deve essere modificato per accettare Task invece di TaskNode
        ' Per ora, se NlpContract è Nothing, non facciamo nulla (verrà caricato a runtime se necessario)
        ' Il ContractLoader attuale usa TaskNode, quindi dobbiamo adattarlo o creare un nuovo loader

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
            For Each dstep As TaskEngine.DialogueStep In runtimeTask.Steps
                If dstep.Escalations IsNot Nothing Then
                    For Each escalation As TaskEngine.Escalation In dstep.Escalations
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
''' Task Compilation Result: Output of TaskCompiler
''' </summary>
Public Class TaskCompilationResult
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

