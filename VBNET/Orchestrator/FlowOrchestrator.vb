Option Strict On
Option Explicit On

Imports TaskEngine
Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports Compiler

''' <summary>
''' Orchestrator che esegue un flow compilato
''' - Trova task eseguibili (condizione = true)
''' - Esegue task
''' - Chiama Task Engine per task GetData
''' - Gestisce stato globale
''' </summary>
Public Class FlowOrchestrator
    Private ReadOnly _compiledTasks As List(Of CompiledTask)
    Private ReadOnly _compilationResult As FlowCompilationResult
    Private ReadOnly _taskEngine As Motore
    Private ReadOnly _taskExecutor As TaskExecutor
    Private ReadOnly _state As ExecutionState
    Private _isRunning As Boolean = False
    Private _entryTaskGroupId As String

    ''' <summary>
    ''' Evento sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of String)

    ''' <summary>
    ''' Evento sollevato quando lo stato viene aggiornato
    ''' </summary>
    Public Event StateUpdated As EventHandler(Of ExecutionState)

    ''' <summary>
    ''' Evento sollevato quando l'esecuzione è completata
    ''' </summary>
    Public Event ExecutionCompleted As EventHandler

    ''' <summary>
    ''' Evento sollevato quando c'è un errore
    ''' </summary>
    Public Event ExecutionError As EventHandler(Of Exception)

    Public Sub New(compiledTasks As List(Of CompiledTask), taskEngine As Motore)
        _compiledTasks = compiledTasks
        _compilationResult = Nothing
        _taskEngine = taskEngine
        _taskExecutor = New TaskExecutor(taskEngine)
        _state = New ExecutionState()

        ' Collega eventi Task Engine
        AddHandler _taskEngine.MessageToShow, AddressOf OnTaskEngineMessage
    End Sub

    Public Sub New(compilationResult As FlowCompilationResult, taskEngine As Motore)
        _compilationResult = compilationResult
        If compilationResult IsNot Nothing AndAlso compilationResult.Tasks IsNot Nothing Then
            _compiledTasks = compilationResult.Tasks
            _entryTaskGroupId = compilationResult.EntryTaskGroupId
        Else
            _compiledTasks = New List(Of CompiledTask)()
            _entryTaskGroupId = Nothing
        End If
        _taskEngine = taskEngine
        _taskExecutor = New TaskExecutor(taskEngine)
        _state = New ExecutionState()

        ' Collega eventi Task Engine
        AddHandler _taskEngine.MessageToShow, AddressOf OnTaskEngineMessage
    End Sub

    ''' <summary>
    ''' Executes the entire dialogue flow
    ''' Finds and executes tasks sequentially until completion or error
    ''' </summary>
    Public Async Function ExecuteDialogueAsync() As System.Threading.Tasks.Task
        If _isRunning Then Return

        _isRunning = True

        Try
            Console.WriteLine($"🚀 [FlowOrchestrator] Starting dialogue with {If(_compiledTasks IsNot Nothing, _compiledTasks.Count, 0)} tasks")
            RaiseEvent StateUpdated(Me, _state)

            Dim iterationCount As Integer = 0
            While _isRunning
                iterationCount += 1
                Dim nextTask As CompiledTask = FindNextExecutableTask()

                If nextTask Is Nothing Then Exit While

                _taskExecutor.SetMessageCallback(Sub(text, stepType, escalationNumber)
                                                     RaiseEvent MessageToShow(Me, text)
                                                 End Sub)

                Dim result = _taskExecutor.ExecuteTask(nextTask, _state)

                If Not result.Success Then
                    Throw New Exception($"Task execution failed: {result.Err}")
                End If

                _state.ExecutedTaskIds.Add(nextTask.Id)
                _state.CurrentNodeId = nextTask.Id
                RaiseEvent StateUpdated(Me, _state)

                Await System.Threading.Tasks.Task.Delay(10)
            End While

            Console.WriteLine($"✅ [FlowOrchestrator] Dialogue completed after {iterationCount} iterations")
            RaiseEvent ExecutionCompleted(Me, Nothing)

        Catch ex As Exception
            Console.WriteLine($"❌ [FlowOrchestrator] Error: {ex.Message}")
            RaiseEvent ExecutionError(Me, ex)
            Throw
        Finally
            _isRunning = False
        End Try
    End Function

    ''' <summary>
    ''' Trova il prossimo task eseguibile (condizione = true, non ancora eseguito)
    ''' </summary>
    Private Function FindNextExecutableTask() As CompiledTask
        If _compilationResult IsNot Nothing Then
            Dim taskGroupsToCheck As New List(Of TaskGroup)()

            ' Check entry TaskGroup first if it exists
            If Not String.IsNullOrEmpty(_entryTaskGroupId) Then
                Dim entryTaskGroup = _compilationResult.TaskGroups.FirstOrDefault(Function(tg) tg.NodeId = _entryTaskGroupId)
                If entryTaskGroup IsNot Nothing AndAlso Not entryTaskGroup.Executed Then
                    taskGroupsToCheck.Add(entryTaskGroup)
                End If

                For Each tg In _compilationResult.TaskGroups
                    If tg.NodeId <> _entryTaskGroupId Then
                        taskGroupsToCheck.Add(tg)
                    End If
                Next
            Else
                taskGroupsToCheck = _compilationResult.TaskGroups
            End If

            ' Find first non-executed TaskGroup with satisfied condition
            For Each taskGroup In taskGroupsToCheck
                If Not taskGroup.Executed Then
                    Dim canExecute As Boolean = True
                    If taskGroup.ExecCondition IsNot Nothing Then
                        ' TODO: Evaluate condition using ConditionEvaluator
                        canExecute = True
                    End If

                    If canExecute Then
                        For Each task In taskGroup.Tasks
                            If Not _state.ExecutedTaskIds.Contains(task.Id) Then
                                Dim taskCanExecute As Boolean = True
                                If task.Condition IsNot Nothing Then
                                    ' TODO: Evaluate task condition
                                    taskCanExecute = True
                                End If

                                If taskCanExecute Then
                                    Return task
                                End If
                            End If
                        Next

                        taskGroup.Executed = True
                    End If
                End If
            Next
        Else
            ' Fallback: flat list search
            For Each task In _compiledTasks
                If Not _state.ExecutedTaskIds.Contains(task.Id) Then
                    Dim canExecute As Boolean = True
                    If task.Condition IsNot Nothing Then
                        ' TODO: Evaluate condition
                        canExecute = True
                    End If

                    If canExecute Then
                        Return task
                    End If
                End If
            Next
        End If

        Return Nothing
    End Function

    ''' <summary>
    ''' Handler per messaggi dal Task Engine
    ''' </summary>
    Private Sub OnTaskEngineMessage(sender As Object, e As MessageEventArgs)
        RaiseEvent MessageToShow(Me, e.Message)
    End Sub

    ''' <summary>
    ''' Ferma l'esecuzione
    ''' </summary>
    Public Sub [Stop]()
        _isRunning = False
    End Sub
End Class

