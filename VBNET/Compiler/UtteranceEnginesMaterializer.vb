Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports System.Text.RegularExpressions
Imports Compiler.DTO.IDE
Imports TaskEngine

''' <summary>
''' Ricostruzione deterministica dei motori da <see cref="CompiledUtteranceTask.NlpContract"/> e
''' <see cref="CompiledUtteranceTask.CanonicalGuidTable"/> (persistiti nel JSON). Nessun stato runtime esterno.
''' </summary>
Public Module UtteranceEnginesMaterializer

    Public Sub MaterializeTree(root As CompiledUtteranceTask)
        If root Is Nothing Then Return
        MaterializeRecursive(root)
    End Sub

    Private Sub MaterializeRecursive(task As CompiledUtteranceTask)
        Materialize(task)
        If task.SubTasks Is Nothing Then Return
        For Each child As CompiledUtteranceTask In task.SubTasks
            MaterializeRecursive(child)
        Next
    End Sub

    ''' <summary>Imposta <see cref="CompiledUtteranceTask._enginesRuntime"/> da solo contratto serializzato.</summary>
    Public Sub Materialize(task As CompiledUtteranceTask)
        If task Is Nothing Then Return
        If task._enginesRuntime IsNot Nothing Then Return

        If task.NlpContract Is Nothing Then
            task._enginesRuntime = New List(Of IInterpretationEngine)()
            Return
        End If

        CompileRegexFromSerializedPatterns(task.NlpContract)

        Dim table = task.CanonicalGuidTable
        If table Is Nothing Then
            table = BuildDefaultCanonicalGuidTable(task)
        End If

        Dim ide = MirrorNlpContractFromCompiled(task.NlpContract)
        If ide.Engines Is Nothing OrElse ide.Engines.Count = 0 Then
            task._enginesRuntime = New List(Of IInterpretationEngine)()
            Return
        End If

        task._enginesRuntime = InterpretationEngineBinding.CreateEngines(task, task.NlpContract, ide, table)
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

    ''' <summary>Pattern regex nel JSON (<see cref="NLPEngine.Patterns"/>); oggetti <see cref="Regex"/> ricostruiti qui.</summary>
    Public Sub CompileRegexFromSerializedPatterns(contract As CompiledNlpContract)
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
