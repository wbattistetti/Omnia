Option Strict On
Option Explicit On
Imports System.Linq
Imports Compiler.DTO.IDE
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
    Private ReadOnly _assembler As TaskAssembler

    Public Sub New()
        _assembler = New TaskAssembler()
    End Sub

    ''' <summary>
    ''' Compila un Task da stringa JSON
    ''' </summary>
    Public Function Compile(taskJson As String) As TaskCompilationResult
        If String.IsNullOrEmpty(taskJson) Then
            Throw New ArgumentException("Task JSON cannot be null or empty", NameOf(taskJson))
        End If

        Dim settings As New JsonSerializerSettings() With {
            .NullValueHandling = NullValueHandling.Ignore,
            .MissingMemberHandling = MissingMemberHandling.Ignore
        }
        settings.Converters.Add(New TaskNodeListConverter())
        settings.Converters.Add(New DialogueStepListConverter())

        Dim assembled As TaskTreeExpanded = JsonConvert.DeserializeObject(Of TaskTreeExpanded)(taskJson, settings)
        If assembled Is Nothing Then
            Throw New InvalidOperationException("Impossibile deserializzare TaskTreeExpanded dal JSON")
        End If

        Dim rootTask As CompiledUtteranceTask = _assembler.Compile(assembled)

        ' 3. Valida struttura (placeholder, regex, ecc.)
        ' NOTE: Contracts are already compiled by TaskAssembler from DataContract in memory
        Dim validationErrors As List(Of String) = ValidateTask(rootTask)

        Dim result As New TaskCompilationResult()
        result.Task = rootTask
        result.ValidationErrors = validationErrors
        result.IsValid = (validationErrors.Count = 0)
        Return result
    End Function

    ' NOTE: Contracts are already loaded from memory during TaskAssembler.Compile()
    ' No need for separate contract loading - DataContract is read directly from UtteranceTaskDefinition/TaskNode

    ''' <summary>
    ''' Valida la struttura del Task (ricorsivo)
    ''' </summary>
    Private Function ValidateTask(task As CompiledUtteranceTask) As List(Of String)
        Dim errors As New List(Of String)()
        ValidateTaskRecursive(task, errors)
        Return errors
    End Function

    ''' <summary>
    ''' Valida un CompiledUtteranceTask e ricorsivamente i suoi subTasks
    ''' </summary>
    Private Sub ValidateTaskRecursive(compiledTask As CompiledUtteranceTask, errors As List(Of String))
        ' Valida placeholder nei messaggi
        If compiledTask.Steps IsNot Nothing Then
            For Each dstep As TaskEngine.CompiledDialogueStep In compiledTask.Steps
                If dstep.Escalations IsNot Nothing Then
                    For Each escalation As TaskEngine.Escalation In dstep.Escalations
                        If escalation.Tasks IsNot Nothing Then
                            For Each itask As TaskEngine.ITask In escalation.Tasks
                                If TypeOf itask Is MessageTask Then
                                    Dim msgTask As MessageTask = DirectCast(itask, MessageTask)

                                    ' ❌ ERRORE: TextKey obbligatorio
                                    If String.IsNullOrWhiteSpace(msgTask.TextKey) Then
                                        errors.Add($"Task '{compiledTask.Id}': MessageTask has empty or missing TextKey. TextKey is mandatory and cannot be empty.")
                                    End If

                                    ' ✅ Valida placeholder nel testo (dopo risoluzione a runtime)
                                    ' Nota: il testo non è ancora disponibile a compile-time, quindi validiamo solo la struttura
                                End If
                            Next
                        End If
                    Next
                End If
            Next
        End If

        ' Valida regex nel contract (se presente)
        If compiledTask.NlpContract IsNot Nothing AndAlso compiledTask.NlpContract.Engines IsNot Nothing Then
            Dim regexContract = compiledTask.NlpContract.Engines.FirstOrDefault(Function(c) c.Type = "regex" AndAlso c.Enabled)
            If regexContract IsNot Nothing Then
                ValidateRegexPatterns(regexContract, compiledTask, errors)
            End If
        End If

        ' Ricorsivo per subTasks
        If compiledTask.SubTasks IsNot Nothing Then
            For Each subTask As CompiledUtteranceTask In compiledTask.SubTasks
                ValidateTaskRecursive(subTask, errors)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida placeholder nel testo
    ''' </summary>
    Private Sub ValidatePlaceholders(text As String, compiledTask As CompiledUtteranceTask, errors As List(Of String))
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
    Private Sub ValidateRegexPatterns(regexContract As NLPEngine, task As CompiledUtteranceTask, errors As List(Of String))
        If regexContract.Patterns IsNot Nothing Then
            For Each pattern As String In regexContract.Patterns
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
    Public Property Task As CompiledUtteranceTask

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

