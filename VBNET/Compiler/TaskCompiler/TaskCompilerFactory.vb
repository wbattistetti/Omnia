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
        Console.WriteLine($"🔍 [TaskCompilerFactory] GetCompiler called: taskType={taskType}")
        System.Diagnostics.Debug.WriteLine($"🔍 [TaskCompilerFactory] GetCompiler called: taskType={taskType}")
        ' Usa cache per evitare di creare nuovi oggetti ogni volta
        If Not _compilerCache.ContainsKey(taskType) Then
            Console.WriteLine($"🔍 [TaskCompilerFactory] Compiler not in cache, creating new one for taskType={taskType}")
            System.Diagnostics.Debug.WriteLine($"🔍 [TaskCompilerFactory] Compiler not in cache, creating new one for taskType={taskType}")
            Select Case taskType
                Case TaskTypes.DataRequest
                    Console.WriteLine($"✅ [TaskCompilerFactory] Creating DataRequestTaskCompiler for taskType={taskType}")
                    System.Diagnostics.Debug.WriteLine($"✅ [TaskCompilerFactory] Creating DataRequestTaskCompiler for taskType={taskType}")
                    _compilerCache(taskType) = New DataRequestTaskCompiler()
                Case TaskTypes.SayMessage, TaskTypes.ClassifyProblem, TaskTypes.BackendCall, TaskTypes.CloseSession, TaskTypes.Transfer
                    Console.WriteLine($"✅ [TaskCompilerFactory] Creating SimpleTaskCompiler for taskType={taskType}")
                    System.Diagnostics.Debug.WriteLine($"✅ [TaskCompilerFactory] Creating SimpleTaskCompiler for taskType={taskType}")
                    _compilerCache(taskType) = New SimpleTaskCompiler(taskType)
                Case Else
                    ' Fallback: usa SimpleTaskCompiler con SayMessage
                    Console.WriteLine($"⚠️ [TaskCompilerFactory] Unknown TaskType {taskType}, using SayMessage compiler as fallback")
                    System.Diagnostics.Debug.WriteLine($"⚠️ [TaskCompilerFactory] Unknown TaskType {taskType}, using SayMessage compiler as fallback")
                    _compilerCache(taskType) = New SimpleTaskCompiler(TaskTypes.SayMessage)
            End Select
        Else
            Console.WriteLine($"✅ [TaskCompilerFactory] Compiler found in cache for taskType={taskType}, type={_compilerCache(taskType).GetType().Name}")
            System.Diagnostics.Debug.WriteLine($"✅ [TaskCompilerFactory] Compiler found in cache for taskType={taskType}, type={_compilerCache(taskType).GetType().Name}")
        End If

        Return _compilerCache(taskType)
    End Function
End Class

