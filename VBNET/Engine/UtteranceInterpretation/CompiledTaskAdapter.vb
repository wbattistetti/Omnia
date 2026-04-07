Option Strict On
Option Explicit On

Imports Compiler
Imports TaskEngine

''' <summary>Adatta <see cref="CompiledUtteranceTask"/> a <see cref="IUteranceTask"/> (escalation → primo <see cref="EngineResult"/> con successo).</summary>
Public Class CompiledTaskAdapter
    Implements IUtteranceTask

    Private ReadOnly _task As CompiledUtteranceTask

    Public Sub New(t As CompiledUtteranceTask)
        If t Is Nothing Then Throw New ArgumentNullException(NameOf(t))
        _task = t
    End Sub

    Public ReadOnly Property TaskId As String Implements IUtteranceTask.TaskId
        Get
            Return _task.Id
        End Get
    End Property

    Public Function Parse(utterance As String) As EngineResult Implements IUtteranceTask.Parse
        Dim u = If(utterance, String.Empty).Trim()
        If _task.Engines Is Nothing Then Return EngineResult.NoMatch(u)

        For Each eng In _task.Engines
            Dim r = eng.Parse(u)
            If r IsNot Nothing AndAlso r.Success Then
                Return r
            End If
        Next

        Return EngineResult.NoMatch(u)
    End Function

    Public Function IsFilled(state As DialogueState) As Boolean Implements IUtteranceTask.IsFilled
        Return _task.IsFilled(state)
    End Function

End Class
