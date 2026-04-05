Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Compiler.DTO.IDE
Imports TaskEngine

''' <summary>
''' Dopo deserializzazione JSON, <see cref="CompiledUtteranceTask.Engines"/> è Nothing (<see cref="Newtonsoft.Json.JsonIgnore"/>).
''' Ripopola i motori da NlpContract + CanonicalGuidTable come in fase di compilazione.
''' </summary>
Public Module UtteranceTaskEnginesRehydration

    ''' <summary>
    ''' Idempotente: se <paramref name="Engines"/> è già valorizzato, non fa nulla. Ricorsivo su <see cref="CompiledUtteranceTask.SubTasks"/>.
    ''' </summary>
    Public Sub EnsureEngines(root As CompiledUtteranceTask)
        If root Is Nothing Then Return
        EnsureEnginesRecursive(root)
    End Sub

    Private Sub EnsureEnginesRecursive(task As CompiledUtteranceTask)
        If task.NlpContract Is Nothing Then Return

        If task.Engines Is Nothing OrElse task.Engines.Count = 0 Then
            EnsureRegexCompiledForRuntime(task.NlpContract)

            Dim table = task.CanonicalGuidTable
            If table Is Nothing Then
                table = BuildDefaultCanonicalGuidTable(task)
            End If

            Dim ide = MirrorNlpContractFromCompiled(task.NlpContract)
            If ide.Engines Is Nothing OrElse ide.Engines.Count = 0 Then Return

            task.Engines = InterpretationEngineBinding.CreateEngines(task, task.NlpContract, ide, table)
        End If

        If task.SubTasks IsNot Nothing Then
            For Each child As CompiledUtteranceTask In task.SubTasks
                EnsureEnginesRecursive(child)
            Next
        End If
    End Sub

    Private Function MirrorNlpContractFromCompiled(c As CompiledNlpContract) As NLPContract
        Return New NLPContract With {
            .TemplateName = c.TemplateName,
            .TemplateId = c.TemplateId,
            .SourceTemplateId = c.SourceTemplateId,
            .SubDataMapping = c.DataMapping,
            .Engines = c.Engines
        }
    End Function

    ''' <summary>
    ''' Tabella canonica di fallback se il JSON non includeva <see cref="CompiledUtteranceTask.CanonicalGuidTable"/> (retrocompatibilità).
    ''' </summary>
    Private Function BuildDefaultCanonicalGuidTable(task As CompiledUtteranceTask) As CanonicalGuidTable
        Dim mainId = If(Not String.IsNullOrEmpty(task.NodeId), task.NodeId, task.Id)
        Dim t As New CanonicalGuidTable With {.MainNodeCanonicalGuid = mainId}
        Dim map = task.NlpContract.DataMapping
        If map Is Nothing Then Return t

        For Each kvp In map
            t.Data.Add(New CanonicalDatumRow With {
                .SubDataMappingKey = kvp.Key,
                .CanonicalGuid = kvp.Key,
                .RegexGroupName = If(kvp.Value?.GroupName, String.Empty)
            })
        Next
        Return t
    End Function

    ''' <summary>
    ''' Regex non serializzate nel JSON: ricompila da <see cref="NLPEngine.Patterns"/>.
    ''' </summary>
    Friend Sub EnsureRegexCompiledForRuntime(contract As CompiledNlpContract)
        If contract Is Nothing Then Return
        If contract.CompiledMainRegex IsNot Nothing Then Return

        Dim rxEngine = contract.Engines?.FirstOrDefault(
            Function(e) e IsNot Nothing AndAlso String.Equals(e.Type, "regex", StringComparison.OrdinalIgnoreCase) AndAlso e.Enabled)
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

End Module
