Option Strict On
Option Explicit On

Imports DDTEngine
Imports Compiler
Imports System.Collections.Generic

''' <summary>
''' Factory per creare l'executor corretto in base al tipo di task
''' </summary>
Public Class TaskExecutorFactory
    ''' <summary>
    ''' Ottiene l'executor appropriato per il tipo di task specificato
    ''' </summary>
    Public Shared Function GetExecutor(taskType As TaskTypes, ddtEngine As Motore) As TaskExecutorBase
        Select Case taskType
            Case TaskTypes.ClassifyProblem
                Return New ClassifyProblemTaskExecutor(ddtEngine)
            Case TaskTypes.BackendCall
                Return New BackendTaskExecutor(ddtEngine)
            Case TaskTypes.DataRequest
                Return New DataRequestTaskExecutor(ddtEngine)
            Case TaskTypes.SayMessage
                Return New SayMessageTaskExecutor(ddtEngine)
            Case TaskTypes.CloseSession
                Return New CloseSessionTaskExecutor(ddtEngine)
            Case TaskTypes.Transfer
                Return New TransferTaskExecutor(ddtEngine)
            Case Else
                Console.WriteLine($"⚠️ [TaskExecutorFactory] Unknown TaskType {taskType}")
                Return Nothing
        End Select
    End Function
End Class





