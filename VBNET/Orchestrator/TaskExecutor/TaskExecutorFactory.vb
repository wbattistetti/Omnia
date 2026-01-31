Option Strict On
Option Explicit On

Imports TaskEngine
Imports Compiler
Imports System.Collections.Generic

''' <summary>
''' Factory per creare l'executor corretto in base al tipo di task
''' </summary>
Public Class TaskExecutorFactory
    ''' <summary>
    ''' Ottiene l'executor appropriato per il tipo di task specificato
    ''' </summary>
    Public Shared Function GetExecutor(taskType As TaskTypes, taskEngine As Motore) As TaskExecutorBase
        Select Case taskType
            Case TaskTypes.ClassifyProblem
                Return New ClassifyProblemTaskExecutor(taskEngine)
            Case TaskTypes.BackendCall
                Return New BackendTaskExecutor(taskEngine)
            Case TaskTypes.UtteranceInterpretation
                Return New DataRequestTaskExecutor(taskEngine)
            Case TaskTypes.SayMessage
                Return New SayMessageTaskExecutor(taskEngine)
            Case TaskTypes.CloseSession
                Return New CloseSessionTaskExecutor(taskEngine)
            Case TaskTypes.Transfer
                Return New TransferTaskExecutor(taskEngine)
            Case Else
                Console.WriteLine($"⚠️ [TaskExecutorFactory] Unknown TaskType {taskType}")
                Return Nothing
        End Select
    End Function
End Class








