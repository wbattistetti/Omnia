Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports Compiler.DTO.IDE
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
    ''' <param name="allTemplates">Lista di tutti i template necessari per la compilazione (incluso il template referenziato e tutti i sub-template)</param>
    ''' <param name="knownVariableIds">Id variabili progetto/flow: se presente, <c>inputs[].variable</c> non in elenco è trattato come costante in mockTable (stesso modello del TS).</param>
    Public MustOverride Function Compile(
        task As TaskDefinition,
        taskId As String,
        allTemplates As List(Of TaskDefinition),
        Optional knownVariableIds As HashSet(Of String) = Nothing
    ) As CompiledTask

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

