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
End Class
