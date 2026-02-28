Option Strict On
Option Explicit On
Imports Compiler
Imports System.Linq

Namespace TaskEngine

    ''' <summary>
    ''' UtteranceTaskInstance: Wrapper runtime per CompiledUtteranceTask
    ''' Aggiunge stato runtime (counters, value) e metodi helper
    ''' </summary>
    Public Class UtteranceTaskInstance
    ''' <summary>
    ''' Task compilato sottostante
    ''' </summary>
    Public Property CompiledTask As CompiledUtteranceTask

    ''' <summary>
    ''' Valore estratto per questo task
    ''' </summary>
    Public Property Value As Object

    ''' <summary>
    ''' Counter NoInput per questo task
    ''' </summary>
    Public Property NoInputCounter As Integer

    ''' <summary>
    ''' Counter NoMatch per questo task
    ''' </summary>
    Public Property NoMatchCounter As Integer

    ''' <summary>
    ''' Parent task (se questo è un sub-task)
    ''' </summary>
    Public Property Parent As UtteranceTaskInstance

    ''' <summary>
    ''' Sub-tasks (se questo è un task composito)
    ''' </summary>
    Public Property SubTasks As List(Of UtteranceTaskInstance)

    Public Sub New(compiledTask As CompiledUtteranceTask)
        Me.CompiledTask = compiledTask
        Me.Value = Nothing
        Me.NoInputCounter = 0
        Me.NoMatchCounter = 0
        Me.Parent = Nothing
        Me.SubTasks = New List(Of UtteranceTaskInstance)()
    End Sub

    ''' <summary>
    ''' Ottiene uno step per tipo
    ''' </summary>
    Public Function GetStep(stepType As Global.TaskEngine.DialogueStepType) As Global.TaskEngine.DialogueStep
        If CompiledTask.Steps Is Nothing Then
            Throw New InvalidOperationException($"Task '{CompiledTask.Id}' has no steps")
        End If
            Dim foundStep = CompiledTask.Steps.FirstOrDefault(Function(s) s.Type = stepType)
            If foundStep Is Nothing Then
                Throw New InvalidOperationException($"Task '{CompiledTask.Id}' has no step of type '{stepType}'")
            End If
            Return foundStep
        End Function

        ''' <summary>
        ''' Ottiene uno step per tipo (restituisce Nothing se non trovato)
        ''' </summary>
        Public Function GetStepOrNull(stepType As Global.TaskEngine.DialogueStepType) As Global.TaskEngine.DialogueStep
        If CompiledTask.Steps Is Nothing Then
            Return Nothing
        End If
        Return CompiledTask.Steps.FirstOrDefault(Function(s) s.Type = stepType)
    End Function

    ''' <summary>
    ''' Ottiene il prossimo step (per ora restituisce lo stesso step)
    ''' TODO: Implementare logica di navigazione
    ''' </summary>
    Public Function GetNextStep(currentStep As Global.TaskEngine.DialogueStep) As Global.TaskEngine.DialogueStep
        ' Per ora restituisce lo stesso step
        ' TODO: Implementare logica di navigazione tra step
        Return currentStep
    End Function

    ''' <summary>
    ''' Verifica se il task è riempito (ha valore o tutti i sub-task sono riempiti)
    ''' </summary>
    Public Function IsFilled() As Boolean
        If SubTasks IsNot Nothing AndAlso SubTasks.Count > 0 Then
            Return SubTasks.All(Function(st) st.IsFilled())
        End If
        Return Value IsNot Nothing
    End Function

    ''' <summary>
    ''' Verifica se il task è parzialmente riempito (alcuni sub-task sono riempiti ma non tutti)
    ''' </summary>
    Public Function IsPartiallyFilled() As Boolean
        If SubTasks IsNot Nothing AndAlso SubTasks.Count > 0 Then
            Dim filledCount = SubTasks.Where(Function(st) st.IsFilled()).Count()
            Return filledCount > 0 AndAlso filledCount < SubTasks.Count
        End If
        Return False
    End Function

    ''' <summary>
    ''' Verifica se questo è il task principale (non ha parent)
    ''' </summary>
    Public Function IsMainTask() As Boolean
        Return Parent Is Nothing
    End Function
    End Class

End Namespace
