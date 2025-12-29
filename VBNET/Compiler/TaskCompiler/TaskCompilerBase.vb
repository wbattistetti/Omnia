Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports DDTEngine

''' <summary>
''' Base class astratta per tutti i task compiler
''' Ogni tipo di task può avere il suo compiler specifico
''' </summary>
Public MustInherit Class TaskCompilerBase
    ''' <summary>
    ''' Compila un task da Task (IDE) a CompiledTask (Runtime)
    ''' </summary>
    Public MustOverride Function Compile(task As Task, row As RowData, node As FlowNode, taskId As String, flow As Flow) As CompiledTask

    ''' <summary>
    ''' Popola i campi comuni di un CompiledTask
    ''' </summary>
    Protected Sub PopulateCommonFields(compiledTask As CompiledTask, row As RowData, node As FlowNode, taskId As String)
        compiledTask.Id = row.Id
        compiledTask.Condition = Nothing
        compiledTask.State = TaskState.UnExecuted
        compiledTask.Debug = New TaskDebugInfo() With {
            .SourceType = TaskSourceType.Flowchart,
            .NodeId = node.Id,
            .RowId = row.Id,
            .OriginalTaskId = taskId
        }
    End Sub
End Class

