Option Strict On
Option Explicit On

Imports Compiler.DTO.IDE
Imports Compiler.DTO.Runtime
Imports TaskEngine

''' <summary>
''' Compila SubflowTaskDefinition in CompiledSubflowTask.
''' </summary>
Public Class SubflowTaskCompiler
    Inherits TaskCompilerBase

    Public Overrides Function Compile(task As TaskDefinition, taskId As String, allTemplates As List(Of TaskDefinition)) As CompiledTask
        Dim def = TryCast(task, SubflowTaskDefinition)
        If def Is Nothing Then
            Throw New InvalidOperationException(
                $"Subflow task '{taskId}' must deserialize as SubflowTaskDefinition. Actual type: {task.GetType().Name}.")
        End If

        Dim ct As New CompiledSubflowTask With {
            .FlowId = If(def.FlowId, ""),
            .InputBindings = If(def.InputBindings, New List(Of SubflowIoBinding)()),
            .OutputBindings = If(def.OutputBindings, New List(Of SubflowIoBinding)())
        }
        PopulateCommonFields(ct, taskId)
        Return ct
    End Function
End Class
