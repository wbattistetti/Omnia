Option Strict On
Option Explicit On

Imports DDTEngine
Imports System.Collections.Generic
Imports System.Threading.Tasks
Imports Compiler

''' <summary>
''' Orchestrator che esegue un flow compilato
''' - Trova task eseguibili (condizione = true)
''' - Esegue task
''' - Chiama DDT Engine per task GetData
''' - Gestisce stato globale
''' </summary>
Public Class FlowOrchestrator
    Private ReadOnly _compiledTasks As List(Of CompiledTask)
    Private ReadOnly _compilationResult As FlowCompilationResult
    Private ReadOnly _ddtEngine As Motore
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

    Public Sub New(compiledTasks As List(Of CompiledTask), ddtEngine As Motore)
        _compiledTasks = compiledTasks
        _compilationResult = Nothing
        _ddtEngine = ddtEngine
        _taskExecutor = New TaskExecutor(ddtEngine)
        _state = New ExecutionState()

        ' Collega eventi DDT Engine
        AddHandler _ddtEngine.MessageToShow, AddressOf OnDDTMessage
    End Sub

    Public Sub New(compilationResult As FlowCompilationResult, ddtEngine As Motore)
        _compilationResult = compilationResult
        If compilationResult IsNot Nothing AndAlso compilationResult.Tasks IsNot Nothing Then
            _compiledTasks = compilationResult.Tasks
            _entryTaskGroupId = compilationResult.EntryTaskGroupId
        Else
            _compiledTasks = New List(Of CompiledTask)()
            _entryTaskGroupId = Nothing
        End If
        _ddtEngine = ddtEngine
        _taskExecutor = New TaskExecutor(ddtEngine)
        _state = New ExecutionState()

        Console.WriteLine($"🔧 [FlowOrchestrator] Created with {If(_compiledTasks IsNot Nothing, _compiledTasks.Count, 0)} tasks, EntryTaskGroupId: {_entryTaskGroupId}")

        ' Collega eventi DDT Engine
        AddHandler _ddtEngine.MessageToShow, AddressOf OnDDTMessage
    End Sub

    ''' <summary>
    ''' Avvia l'esecuzione del flow
    ''' </summary>
    Public Async Function StartAsync() As System.Threading.Tasks.Task
        If _isRunning Then
            Console.WriteLine($"⚠️ [FlowOrchestrator] Already running, ignoring StartAsync call")
            Return
        End If

        _isRunning = True
        Console.WriteLine($"🚀 [FlowOrchestrator] Starting execution...")

        Try
            ' Notifica stato iniziale
            RaiseEvent StateUpdated(Me, _state)

            ' Loop principale: trova e esegue task
            Await RunLoopAsync()

            Console.WriteLine($"✅ [FlowOrchestrator] Execution completed")
            RaiseEvent ExecutionCompleted(Me, Nothing)
        Catch ex As Exception
            Console.WriteLine($"❌ [FlowOrchestrator] Execution error: {ex.Message}")
            Console.WriteLine($"Stack trace: {ex.StackTrace}")
            RaiseEvent ExecutionError(Me, ex)
        Finally
            _isRunning = False
            Console.WriteLine($"🛑 [FlowOrchestrator] Execution stopped")
        End Try
    End Function

    ''' <summary>
    ''' Loop principale di esecuzione
    ''' </summary>
    Private Async Function RunLoopAsync() As System.Threading.Tasks.Task
        Dim iterationCount As Integer = 0
        While _isRunning
            iterationCount += 1
            Console.WriteLine($"🔄 [FlowOrchestrator] Loop iteration {iterationCount}")

            ' Trova prossimo task eseguibile
            Dim nextTask As CompiledTask = FindNextExecutableTask()

            If nextTask Is Nothing Then
                ' Nessun task eseguibile, completa
                Console.WriteLine($"✅ [FlowOrchestrator] No more executable tasks, completing execution")
                Exit While
            End If

            Console.WriteLine($"▶️ [FlowOrchestrator] Executing task: {nextTask.Id}, Action: {nextTask.Type}")

            ' Esegui task
            ' Imposta callback per messaggi
            _taskExecutor.SetMessageCallback(Sub(text, stepType, escalationNumber)
                                                 Console.WriteLine($"📨 [FlowOrchestrator] Message callback called: {text.Substring(0, Math.Min(100, text.Length))}")
                                                 RaiseEvent MessageToShow(Me, text)
                                             End Sub)

            Dim result As TaskExecutionResult = _taskExecutor.ExecuteTask(nextTask, _state)

            If Not result.Success Then
                Console.WriteLine($"❌ [FlowOrchestrator] Task execution failed: {result.Error}")
                Throw New Exception($"Task execution failed: {result.Error}")
            End If

            Console.WriteLine($"✅ [FlowOrchestrator] Task executed successfully: {nextTask.Id}")

            ' Aggiorna stato
            _state.ExecutedTaskIds.Add(nextTask.Id)
            _state.CurrentNodeId = nextTask.Id ' TODO: Usare il NodeId corretto dal TaskGroup

            ' Se il task ha output, aggiungilo al variableStore
            If result.Output IsNot Nothing Then
                ' TODO: Estrarre variabili dall'output e aggiungerle al variableStore
            End If

            RaiseEvent StateUpdated(Me, _state)

            ' Piccola pausa per evitare loop infiniti
            Await System.Threading.Tasks.Task.Delay(10)
        End While

        Console.WriteLine($"🏁 [FlowOrchestrator] RunLoop completed after {iterationCount} iterations")
    End Function

    ''' <summary>
    ''' Trova il prossimo task eseguibile (condizione = true, non ancora eseguito)
    ''' </summary>
    Private Function FindNextExecutableTask() As CompiledTask
        ' Se abbiamo un CompilationResult, usa la struttura TaskGroup
        If _compilationResult IsNot Nothing Then
            Console.WriteLine($"🔍 [FlowOrchestrator] Finding next executable task. EntryTaskGroupId: {_entryTaskGroupId}, TaskGroups count: {_compilationResult.TaskGroups.Count}")

            ' Se abbiamo un EntryTaskGroupId, inizia da quello
            Dim taskGroupsToCheck As List(Of TaskGroup) = New List(Of TaskGroup)()
            If Not String.IsNullOrEmpty(_entryTaskGroupId) Then
                ' Trova il TaskGroup di entry usando FirstOrDefault
                Dim entryTaskGroup = _compilationResult.TaskGroups.FirstOrDefault(Function(tg) tg.NodeId = _entryTaskGroupId)
                If entryTaskGroup IsNot Nothing Then
                    taskGroupsToCheck.Add(entryTaskGroup)
                    Console.WriteLine($"📍 [FlowOrchestrator] Starting from entry TaskGroup: {_entryTaskGroupId}")
                Else
                    ' Entry TaskGroup non trovato, controlla tutti
                    taskGroupsToCheck = _compilationResult.TaskGroups
                    Console.WriteLine($"📍 [FlowOrchestrator] Entry TaskGroup not found, checking all TaskGroups")
                End If
            Else
                ' Altrimenti, controlla tutti i TaskGroup in ordine
                taskGroupsToCheck = _compilationResult.TaskGroups
                Console.WriteLine($"📍 [FlowOrchestrator] No entry TaskGroup, checking all TaskGroups")
            End If

            ' Trova il primo TaskGroup non eseguito con condizione soddisfatta
            For Each taskGroup In taskGroupsToCheck
                Console.WriteLine($"🔍 [FlowOrchestrator] Checking TaskGroup: {taskGroup.NodeId}, Executed: {taskGroup.Executed}, Tasks count: {taskGroup.Tasks.Count}")

                If Not taskGroup.Executed Then
                    ' Valuta condizione del TaskGroup
                    Dim canExecute As Boolean = True
                    If taskGroup.ExecCondition IsNot Nothing Then
                        ' TODO: Valutare condizione usando ConditionEvaluator
                        ' Per ora assumiamo che sia sempre true
                        canExecute = True
                    End If

                    If canExecute Then
                        ' Trova il primo task non eseguito nel TaskGroup
                        For Each task In taskGroup.Tasks
                            Console.WriteLine($"🔍 [FlowOrchestrator] Checking task: {task.Id}, Action: {task.Type}, Already executed: {_state.ExecutedTaskIds.Contains(task.Id)}")

                            If Not _state.ExecutedTaskIds.Contains(task.Id) Then
                                ' Valuta condizione del task
                                Dim taskCanExecute As Boolean = True
                                If task.Condition IsNot Nothing Then
                                    ' TODO: Valutare condizione del task
                                    taskCanExecute = True
                                End If

                                If taskCanExecute Then
                                    Console.WriteLine($"✅ [FlowOrchestrator] Found executable task: {task.Id}, Action: {task.Type}")
                                    Return task
                                End If
                            End If
                        Next

                        ' Se tutti i task del TaskGroup sono eseguiti, marca come eseguito
                        taskGroup.Executed = True
                        Console.WriteLine($"✅ [FlowOrchestrator] TaskGroup {taskGroup.NodeId} completed")
                    End If
                End If
            Next

            Console.WriteLine($"⚠️ [FlowOrchestrator] No executable task found")
        Else
            ' Fallback: cerca nella lista flat di task
            For Each task In _compiledTasks
                If Not _state.ExecutedTaskIds.Contains(task.Id) Then
                    ' Valuta condizione
                    Dim canExecute As Boolean = True
                    If task.Condition IsNot Nothing Then
                        ' TODO: Valutare condizione
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
    ''' Handler per messaggi dal DDT Engine
    ''' </summary>
    Private Sub OnDDTMessage(sender As Object, e As MessageEventArgs)
        RaiseEvent MessageToShow(Me, e.Message)
    End Sub

    ''' <summary>
    ''' Ferma l'esecuzione
    ''' </summary>
    Public Sub [Stop]()
        _isRunning = False
    End Sub
End Class

