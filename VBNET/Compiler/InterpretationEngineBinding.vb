Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports Compiler.DTO.IDE
Imports TaskEngine

''' <summary>
''' Costruisce la lista ordinata di motori IUtteranceInterpretationEngine dal contratto NLP (ordine = escalation).
''' </summary>
Public Module InterpretationEngineBinding

    ''' <summary>
    ''' Crea i motori per il task in base a <paramref name="ideContract"/>.Engines (ordine preservato).
    ''' </summary>
    Public Function CreateEngines(
        task As CompiledUtteranceTask,
        compiledContract As CompiledNlpContract,
        ideContract As NLPContract,
        table As CanonicalGuidTable
    ) As List(Of IInterpretationEngine)

        If task Is Nothing Then Throw New ArgumentNullException(NameOf(task))
        If compiledContract Is Nothing Then Throw New ArgumentNullException(NameOf(compiledContract))
        If ideContract Is Nothing Then Throw New ArgumentNullException(NameOf(ideContract))
        If table Is Nothing Then Throw New ArgumentNullException(NameOf(table))

        Dim engines As New List(Of IInterpretationEngine)
        If ideContract.Engines Is Nothing Then Return engines

        Dim ordinal As Integer = 0
        For Each eng As NLPEngine In ideContract.Engines
            If eng Is Nothing OrElse Not eng.Enabled Then Continue For
            ordinal += 1
            Dim typeName = If(eng.Type, String.Empty).Trim().ToLowerInvariant()
            Select Case typeName
                Case "grammarflow"
                    Dim dn = $"GrammarFlow #{ordinal} ({If(compiledContract.TemplateName, "contract")})"
                    engines.Add(New CompiledGrammarFlowEngine(dn, task, compiledContract, table, eng.GrammarFlow))
                Case "regex"
                    Dim dn = $"Regex #{ordinal} ({If(compiledContract.TemplateName, "contract")})"
                    engines.Add(New CompiledRegexEngine(dn, task, compiledContract, table))
                Case Else
                    ' Tipi non supportati sono già respinti da NlpContractCompiler.Compile
                    Throw New InvalidOperationException($"Unexpected enabled NLP engine type '{eng.Type}' during binding.")
            End Select
        Next

        Return engines
    End Function

End Module
