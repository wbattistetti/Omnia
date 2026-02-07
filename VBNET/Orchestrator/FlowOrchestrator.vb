Option Strict On
Option Explicit On
Imports Compiler

''' <summary>
''' Orchestrator che esegue un flow compilato
''' - Trova task eseguibili (condizione = true)
''' - Esegue task
''' - Chiama Task Engine per task GetData
''' - Gestisce stato globale
''' ✅ STATELESS: ExecutionState viene salvato/caricato da Redis
''' </summary>
Public Class FlowOrchestrator
    Private ReadOnly _compiledTasks As List(Of CompiledTask)
    Private ReadOnly _compilationResult As FlowCompilationResult
    Private ReadOnly _taskEngine As Motore
    Private ReadOnly _taskExecutor As TaskExecutor
    Private ReadOnly _state As ExecutionState
    Private _isRunning As Boolean = False
    Private _entryTaskGroupId As String
    ' ✅ STATELESS: Storage per ExecutionState (opzionale per retrocompatibilità)
    ' Nota: Usa Object invece di IExecutionStateStorage per evitare dipendenza circolare
    Private ReadOnly _executionStateStorage As Object
    Private ReadOnly _sessionId As String

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

    ''' <summary>
    ''' Costruttore per retrocompatibilità (senza storage - stato solo in memoria)
    ''' </summary>
    Public Sub New(compiledTasks As List(Of CompiledTask), taskEngine As Motore)
        _compiledTasks = compiledTasks
        _compilationResult = Nothing
        _taskEngine = taskEngine
        _taskExecutor = New TaskExecutor(taskEngine)
        _executionStateStorage = Nothing
        _sessionId = Nothing
        _state = New ExecutionState()

        ' Collega eventi Task Engine
        AddHandler _taskEngine.MessageToShow, AddressOf OnTaskEngineMessage
    End Sub

    ''' <summary>
    ''' ✅ STATELESS: Costruttore con storage per salvare/caricare ExecutionState da Redis
    ''' </summary>
    Public Sub New(compilationResult As FlowCompilationResult, taskEngine As Motore, Optional sessionId As String = Nothing, Optional executionStateStorage As Object = Nothing)
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
        _executionStateStorage = executionStateStorage
        _sessionId = sessionId

        ' ✅ STATELESS: Carica ExecutionState da Redis se storage disponibile
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                ' Usa reflection per chiamare GetExecutionState senza dipendenza diretta
                Dim getExecutionStateMethod = _executionStateStorage.GetType().GetMethod("GetExecutionState")
                If getExecutionStateMethod IsNot Nothing Then
                    _state = DirectCast(getExecutionStateMethod.Invoke(_executionStateStorage, {_sessionId}), ExecutionState)
                    Console.WriteLine($"[FlowOrchestrator] ✅ Loaded ExecutionState from Redis for session: {_sessionId}")
                Else
                    _state = New ExecutionState()
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to load ExecutionState from Redis: {ex.Message}, using new state")
                _state = New ExecutionState()
            End Try
        Else
            _state = New ExecutionState()
        End If

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

                ' ✅ STATELESS: Salva ExecutionState su Redis dopo ogni modifica
                SaveState()

                RaiseEvent StateUpdated(Me, _state)

                ' ✅ STATELESS: Nessun delay artificiale - il loop è guidato da stato, non da timing
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
                Dim matchingTaskGroups = _compilationResult.TaskGroups.Where(Function(tg) tg.NodeId = _entryTaskGroupId).ToList()
                If matchingTaskGroups.Count = 0 Then
                    Throw New InvalidOperationException($"Entry TaskGroup with NodeId '{_entryTaskGroupId}' not found in compilation result. The entry TaskGroup must exist.")
                ElseIf matchingTaskGroups.Count > 1 Then
                    Throw New InvalidOperationException($"Entry TaskGroup with NodeId '{_entryTaskGroupId}' appears {matchingTaskGroups.Count} times. Each TaskGroup NodeId must be unique.")
                End If
                Dim entryTaskGroup = matchingTaskGroups.Single()
                If Not entryTaskGroup.Executed Then
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

    ''' <summary>
    ''' ✅ STATELESS: Salva ExecutionState su Redis
    ''' </summary>
    Private Sub SaveState()
        If _executionStateStorage IsNot Nothing AndAlso Not String.IsNullOrEmpty(_sessionId) Then
            Try
                ' Usa reflection per chiamare SaveExecutionState senza dipendenza diretta
                Dim saveExecutionStateMethod = _executionStateStorage.GetType().GetMethod("SaveExecutionState")
                If saveExecutionStateMethod IsNot Nothing Then
                    saveExecutionStateMethod.Invoke(_executionStateStorage, {_sessionId, _state})
                End If
            Catch ex As Exception
                Console.WriteLine($"[FlowOrchestrator] ⚠️ Failed to save ExecutionState to Redis: {ex.Message}")
                ' Non solleviamo eccezione per non interrompere l'esecuzione, ma loggiamo l'errore
            End Try
        End If
    End Sub
End Class

