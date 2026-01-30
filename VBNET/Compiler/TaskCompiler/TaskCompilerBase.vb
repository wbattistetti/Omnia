Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports TaskEngine

''' <summary>
''' Base class astratta per tutti i task compiler
''' Ogni tipo di task può avere il suo compiler specifico
''' </summary>
Public MustInherit Class TaskCompilerBase
    ''' <summary>
    ''' Compila un task da Task (IDE) a CompiledTask (Runtime)
    ''' Il compiler si occupa solo della compilazione logica del task.
    ''' I metadata del flowchart (row, node) vengono aggiunti dal chiamante dopo la compilazione.
    ''' </summary>
    ''' <param name="task">Il task da compilare</param>
    ''' <param name="taskId">L'ID del task da compilare</param>
    ''' <param name="flow">Il flow completo con tutti i template necessari</param>
    Public MustOverride Function Compile(task As Task, taskId As String, flow As Flow) As CompiledTask

    ''' <summary>
    ''' Popola i campi comuni di un CompiledTask (solo logica base, senza metadata flowchart)
    ''' </summary>
    Protected Sub PopulateCommonFields(compiledTask As CompiledTask, taskId As String)
        ' Imposta ID base e stato iniziale
        compiledTask.Id = taskId
        compiledTask.Condition = Nothing
        compiledTask.State = TaskState.UnExecuted

        ' Debug info base (senza metadata flowchart - vengono aggiunti dal chiamante se necessario)
        compiledTask.Debug = New TaskDebugInfo() With {
            .SourceType = TaskSourceType.Direct,
            .NodeId = Nothing,
            .RowId = Nothing,
            .OriginalTaskId = taskId
        }
    End Sub
End Class

