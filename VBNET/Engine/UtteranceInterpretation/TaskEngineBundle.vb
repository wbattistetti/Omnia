Option Strict On
Option Explicit On

Imports Compiler

''' <summary>
''' Descrittore: id task + motori ordinati (escalation) + task compilato.
''' </summary>
Public NotInheritable Class TaskEngineBundle

        Private ReadOnly _taskId As String
    Private ReadOnly _engines As IReadOnlyList(Of IInterpretationEngine)
    Private ReadOnly _utteranceTask As CompiledUtteranceTask

    Public ReadOnly Property TaskId As String
        Get
            Return _taskId
        End Get
    End Property

    Public ReadOnly Property Engines As IReadOnlyList(Of IInterpretationEngine)
        Get
            Return _engines
        End Get
    End Property

    Public ReadOnly Property ParsableTask As CompiledUtteranceTask
        Get
            Return _utteranceTask
        End Get
    End Property

    Public Sub New(taskId As String, engines As IReadOnlyList(Of IInterpretationEngine), utteranceTask As CompiledUtteranceTask)
        If String.IsNullOrWhiteSpace(taskId) Then Throw New ArgumentNullException(NameOf(taskId))
        _taskId = taskId
        _engines = If(engines, New List(Of IInterpretationEngine)())
        _utteranceTask = utteranceTask
        End Sub

    End Class
