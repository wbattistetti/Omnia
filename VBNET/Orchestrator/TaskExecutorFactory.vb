Option Strict On
Option Explicit On

''' <summary>
''' Factory per creare l'executor corretto in base al tipo di task
''' </summary>
Public Class TaskExecutorFactory
    ''' <summary>
    ''' Ottiene l'executor appropriato per il tipo di task specificato
    ''' </summary>
    Public Shared Function GetExecutor(taskType As TaskTypes) As TaskExecutorBase
        Select Case taskType
            Case TaskTypes.ClassifyProblem
                Return New ClassifyProblemTaskExecutor()
            Case TaskTypes.BackendCall
                Return New BackendCallTaskExecutor()
            Case TaskTypes.UtteranceInterpretation
                Return New UtteranceTaskExecutor()
            Case TaskTypes.SayMessage
                Return New SayMessageTaskExecutor()
            Case TaskTypes.CloseSession
                Return New CloseSessionTaskExecutor()
            Case TaskTypes.Transfer
                Return New TransferTaskExecutor()
            Case Else
                Console.WriteLine($"⚠️ [TaskExecutorFactory] Unknown TaskType {taskType}")
                Return Nothing
        End Select
    End Function
End Class








