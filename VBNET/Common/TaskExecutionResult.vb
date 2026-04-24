Option Strict On
Option Explicit On

''' <summary>
''' Risultato dell'esecuzione di un task
''' Spostato in Common per essere condiviso tra Orchestrator e Engine
''' </summary>
Public Class TaskExecutionResult
    Public Property Success As Boolean
    Public Property Err As String

    ''' <summary>
    ''' Indica se il task richiede input asincrono (es. GetData)
    ''' Quando True, l'esecuzione del TaskGroup viene sospesa
    ''' </summary>
    Public Property RequiresInput As Boolean = False

    ''' <summary>
    ''' ID del task che sta attendendo input (se RequiresInput = True)
    ''' </summary>
    Public Property WaitingTaskId As String = Nothing

    ''' <summary>
    ''' ✅ ARCHITECTURAL: Indica se il task è completato
    ''' Solo TaskExecutor decide questo, basandosi su DialogueState.IsCompleted o logica interna del task
    ''' FlowOrchestrator NON decide, legge solo questo valore
    ''' </summary>
    Public Property IsCompleted As Boolean = False

    ''' <summary>JSON serializzato <see cref="RuntimeConvaiException"/> per propagazione verso FlowOrchestrator.</summary>
    Public Property ErrDetailJson As String
End Class
