Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports DDTEngine

''' <summary>
''' Factory per creare il compiler corretto in base al tipo di task
''' </summary>
Public Class TaskCompilerFactory
    Private Shared ReadOnly _compilerCache As New Dictionary(Of TaskTypes, TaskCompilerBase)()

    ''' <summary>
    ''' Ottiene il compiler appropriato per il tipo di task specificato
    ''' </summary>
    Public Shared Function GetCompiler(taskType As TaskTypes) As TaskCompilerBase
        ' Usa cache per evitare di creare nuovi oggetti ogni volta
        If Not _compilerCache.ContainsKey(taskType) Then
            Select Case taskType
                Case TaskTypes.DataRequest
                    _compilerCache(taskType) = New DataRequestTaskCompiler()
                Case TaskTypes.SayMessage, TaskTypes.ClassifyProblem, TaskTypes.BackendCall, TaskTypes.CloseSession, TaskTypes.Transfer
                    _compilerCache(taskType) = New SimpleTaskCompiler(taskType)
                Case Else
                    ' Fallback: usa SimpleTaskCompiler con SayMessage
                    Console.WriteLine($"⚠️ [TaskCompilerFactory] Unknown TaskType {taskType}, using SayMessage compiler as fallback")
                    _compilerCache(taskType) = New SimpleTaskCompiler(TaskTypes.SayMessage)
            End Select
        End If

        Return _compilerCache(taskType)
    End Function
End Class

