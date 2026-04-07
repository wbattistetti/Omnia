Option Strict On
Option Explicit On
Imports Compiler
Imports Common.DSL

''' <summary>
''' ConditionLoader implementation that loads conditions from FlowCompilationResult
''' Used by ConditionEvaluator to evaluate edge conditions at runtime
''' </summary>
Public Class FlowConditionLoader
    Implements IConditionLoader

    Private ReadOnly _compilationResult As CompiledFlow

    Public Sub New(compilationResult As CompiledFlow)
        If compilationResult Is Nothing Then
            Throw New ArgumentNullException(NameOf(compilationResult))
        End If
        _compilationResult = compilationResult
    End Sub

    ''' <summary>
    ''' Loads condition data by condition ID from FlowCompilationResult
    ''' Returns condition data dictionary with "ast", "uiCode", "script" keys
    ''' </summary>
    Public Function LoadCondition(conditionId As String) As Dictionary(Of String, Object) Implements IConditionLoader.LoadCondition
        If String.IsNullOrEmpty(conditionId) Then
            Return Nothing
        End If

        If _compilationResult.Conditions Is Nothing Then
            Console.WriteLine($"[FlowConditionLoader] ⚠️ CompilationResult.Conditions is Nothing")
            Return Nothing
        End If

        If Not _compilationResult.Conditions.ContainsKey(conditionId) Then
            Console.WriteLine($"[FlowConditionLoader] ⚠️ Condition '{conditionId}' not found in CompilationResult.Conditions")
            Console.WriteLine($"[FlowConditionLoader]   Available condition IDs: {String.Join(", ", _compilationResult.Conditions.Keys)}")
            Return Nothing
        End If

        Dim condition = _compilationResult.Conditions(conditionId)
        ' ✅ FASE 2: Use expression.* instead of data.*
        If condition Is Nothing OrElse condition.Expression Is Nothing Then
            Console.WriteLine($"[FlowConditionLoader] ⚠️ Condition '{conditionId}' has no Expression")
            Return Nothing
        End If

        ' Build condition data dictionary expected by ConditionEvaluator
        Dim conditionData As New Dictionary(Of String, Object)()

        ' AST is required for DSLInterpreter
        If Not String.IsNullOrEmpty(condition.Expression.Ast) Then
            conditionData("ast") = condition.Expression.Ast
        End If

        ' ✅ FASE 2: readableCode is NOT stored - generated on-the-fly
        ' Include executableCode for reference (optional)
        If Not String.IsNullOrEmpty(condition.Expression.ExecutableCode) Then
            conditionData("executableCode") = condition.Expression.ExecutableCode
        End If

        If Not String.IsNullOrEmpty(condition.Expression.CompiledCode) Then
            conditionData("compiledCode") = condition.Expression.CompiledCode
        End If

        Console.WriteLine($"[FlowConditionLoader] ✅ Loaded condition '{conditionId}': HasAST={conditionData.ContainsKey("ast")}, HasExecutableCode={conditionData.ContainsKey("executableCode")}, HasCompiledCode={conditionData.ContainsKey("compiledCode")}")
        Return conditionData
    End Function
End Class
