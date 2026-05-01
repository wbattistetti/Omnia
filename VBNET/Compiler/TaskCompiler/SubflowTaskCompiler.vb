Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports TaskEngine

''' <summary>
''' Compila SubflowTaskDefinition in CompiledSubflowTask (policy S2: solo subflowBindings schema 1).
''' </summary>
Public Class SubflowTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(
        task As TaskDefinition,
        taskId As String,
        allTemplates As List(Of TaskDefinition),
        Optional knownVariableIds As HashSet(Of String) = Nothing
    ) As CompiledTask
        Dim def = TryCast(task, SubflowTaskDefinition)
        If def Is Nothing Then
            Throw New InvalidOperationException(
                $"Subflow task '{taskId}' must deserialize as SubflowTaskDefinition. Actual type: {task.GetType().Name}.")
        End If

        Dim ver = def.SubflowBindingsSchemaVersion.GetValueOrDefault(0)
        If ver <> 1 Then
            Throw New InvalidOperationException(
                $"Subflow task '{taskId}': subflowBindingsSchemaVersion must be 1 (got {ver}).")
        End If

        Dim bindings = If(def.SubflowBindings, New List(Of SubflowBinding)())
        For Each b In bindings
            If b Is Nothing Then Continue For
            Dim c = If(b.InterfaceParameterId, "").Trim()
            Dim p = If(b.ParentVariableId, "").Trim()
            If String.IsNullOrEmpty(c) OrElse String.IsNullOrEmpty(p) Then
                Throw New InvalidOperationException(
                    $"Subflow task '{taskId}': each subflowBinding requires non-empty interfaceParameterId and parentVariableId.")
            End If
            ' Same GUID on both sides is allowed when parent and child share the variable identity (explicit row still required).
        Next

        Dim ct As New CompiledSubflowTask With {
            .FlowId = If(def.FlowId, ""),
            .SubflowBindings = New List(Of SubflowBinding)()
        }
        For Each b In bindings
            If b Is Nothing Then Continue For
            ct.SubflowBindings.Add(
                New SubflowBinding With {
                    .InterfaceParameterId = If(b.InterfaceParameterId, "").Trim(),
                    .ParentVariableId = If(b.ParentVariableId, "").Trim()
                })
        Next
        PopulateCommonFields(ct, taskId)
        Return ct
    End Function
End Class
