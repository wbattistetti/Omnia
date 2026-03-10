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

    Private ReadOnly _compilationResult As FlowCompilationResult

    Public Sub New(compilationResult As FlowCompilationResult)
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
        If condition Is Nothing OrElse condition.Data Is Nothing Then
            Console.WriteLine($"[FlowConditionLoader] ⚠️ Condition '{conditionId}' has no Data")
            Return Nothing
        End If

        ' Build condition data dictionary expected by ConditionEvaluator
        Dim conditionData As New Dictionary(Of String, Object)()

        ' AST is required for DSLInterpreter
        If Not String.IsNullOrEmpty(condition.Data.Ast) Then
            conditionData("ast") = condition.Data.Ast
        End If

        ' Optional: include other fields for debugging
        If Not String.IsNullOrEmpty(condition.Data.UiCode) Then
            conditionData("uiCode") = condition.Data.UiCode
        End If

        If Not String.IsNullOrEmpty(condition.Data.Script) Then
            conditionData("script") = condition.Data.Script
        End If

        Console.WriteLine($"[FlowConditionLoader] ✅ Loaded condition '{conditionId}': HasAST={conditionData.ContainsKey("ast")}, HasUiCode={conditionData.ContainsKey("uiCode")}")
        Return conditionData
    End Function
End Class
