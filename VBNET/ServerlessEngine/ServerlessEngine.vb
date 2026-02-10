' ServerlessEngine.vb
' Motore step-based, stateless, serverless-friendly
' Logica copiata e trasformata da Motore.vb senza modifiche semantiche

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Linq
Imports System.Runtime.CompilerServices
Imports ServerlessEngine

''' <summary>
''' Motore di esecuzione step-based, stateless, serverless-friendly
'''
''' CARATTERISTICHE:
''' - Nessun loop interno
''' - Nessuna attesa (no BlockingCollection)
''' - Nessun Task.Run
''' - Nessuno stato interno nella classe
''' - Tutto lo stato è passato tramite ExecutionState
''' - Esegue un solo step per chiamata
'''
''' LOGICA:
''' La logica è identica al motore attuale (Motore.vb), ma trasformata in step singoli.
''' Ogni metodo corrisponde a una parte del loop While True in Motore.ExecuteTask.
''' </summary>
Public Class ServerlessEngine
    ''' <summary>
    ''' Parser per interpretare l'input utente
    ''' </summary>
    Public ReadOnly Property Parser As Parser

    ''' <summary>
    ''' Evento che viene sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        Parser = New Parser()
    End Sub

    ''' <summary>
    ''' Esegue un singolo step dell'esecuzione del task
    '''
    ''' CORRISPONDENZA CON MOTORE ATTUALE:
    ''' Questo metodo sostituisce il loop While True in Motore.ExecuteTask (riga 55-99)
    ''' Ogni chiamata esegue un solo step, il loop è gestito esternamente dalla Facade
    '''
    ''' STEP POSSIBILI:
    ''' 1. "Introduction" - Esegue introduction se presente (Motore.vb, riga 50-52)
    ''' 2. "FindNextTask" - Trova prossimo task (Motore.vb, riga 57)
    ''' 3. "GetResponse" - Recupera response per task corrente (Motore.vb, riga 65)
    ''' 4. "ExecuteResponse" - Esegue response (Motore.vb, riga 71)
    ''' 5. "CheckCompletion" - Verifica completamento (Motore.vb, riga 80-94)
    ''' 6. "Complete" - Esecuzione completata
    ''' </summary>
    ''' <param name="state">Stato completo dell'esecuzione (stateless)</param>
    ''' <param name="taskInstance">Istanza del task da eseguire</param>
    ''' <param name="input">Input utente (opzionale, usato solo per SetState)</param>
    ''' <returns>Risultato dello step eseguito</returns>
    Public Function ExecuteTaskStep(state As ExecutionState, taskInstance As TaskInstance, Optional input As String = Nothing) As StepResult
        Dim result As New StepResult()

        ' ✅ STEP 1: Check Introduction
        ' CORRISPONDENZA: Motore.vb, riga 50-52
        ' Se l'introduction non è stata eseguita e deve essere eseguita, eseguila
        If Not state.IntroductionExecuted Then
            If taskInstance.IsAggregate AndAlso taskInstance.Introduction IsNot Nothing Then
                Console.WriteLine($"[ServerlessEngine] ▶️ STEP: Introduction")
                result.StepType = "Introduction"
                result.Tasks = taskInstance.Introduction.Tasks
                result.Messages = New List(Of String)()

                ' Esegui introduction (logica identica a Motore.ExecuteResponse, riga 164-181)
                Dim hasExitCondition = ExecuteResponseInternal(taskInstance.Introduction.Tasks, Nothing, taskInstance, result.Messages, state)
                result.HasTerminationResponse = hasExitCondition
                result.ContinueExecution = True ' Introduction non blocca l'esecuzione

                state.IntroductionExecuted = True
                Return result
            End If
            state.IntroductionExecuted = True ' Marca come eseguita anche se non presente
        End If

        ' ✅ STEP 2: Find Next Task
        ' CORRISPONDENZA: Motore.vb, riga 57
        ' Trova il prossimo task da eseguire (logica identica a Motore.GetNextTask, riga 223-258)
        state.IterationCount += 1
        Console.WriteLine($"[ServerlessEngine] ▶️ STEP: FindNextTask (iteration {state.IterationCount})")

        Dim currTaskNode As TaskNode = GetNextTaskInternal(taskInstance)
        state.CurrentTaskNode = currTaskNode

        If currTaskNode Is Nothing Then
            Console.WriteLine($"[ServerlessEngine] ✅ No more tasks, execution complete")
            result.StepType = "Complete"
            result.ContinueExecution = False
            state.IsCompleted = True

            ' ✅ CORRISPONDENZA: Motore.vb, riga 101-109 (fallback check)
            ' Verifica finale se tutti i task sono completati e esegui SuccessResponse
            Dim allCompletedFinal = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
            If allCompletedFinal AndAlso Not state.SuccessResponseExecuted Then
                Console.WriteLine($"[ServerlessEngine] 🎉 All tasks completed (final check)")
                If taskInstance.SuccessResponse IsNot Nothing Then
                    Console.WriteLine($"[ServerlessEngine] 📢 Executing SuccessResponse")
                    Dim successMessages As New List(Of String)()
                    ExecuteResponseInternal(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance, successMessages, state)
                    result.Messages.AddRange(successMessages)
                    state.SuccessResponseExecuted = True
                End If
            End If

            Return result
        End If

        Console.WriteLine($"[ServerlessEngine] 🔄 Iteration {state.IterationCount}: Node={currTaskNode.Id}, State={currTaskNode.State}")

        ' ✅ STEP 3: Get Response
        ' CORRISPONDENZA: Motore.vb, riga 65
        ' Recupera la response per il task corrente (logica identica a Motore.GetResponse, riga 116-159)
        Console.WriteLine($"[ServerlessEngine] ▶️ STEP: GetResponse")
        result.StepType = "GetResponse"

        Dim tasks = GetResponseInternal(currTaskNode, state)
        result.Tasks = tasks

        If tasks.Count() = 0 Then
            Console.WriteLine($"[ServerlessEngine] ❌ ERROR: GetResponse returned 0 tasks for node {currTaskNode.Id}")
            result.ErrorMessage = $"GetResponse returned 0 tasks for node {currTaskNode.Id}"
            result.ContinueExecution = False
            Return result
        End If

        ' ✅ STEP 4: Execute Response
        ' CORRISPONDENZA: Motore.vb, riga 71
        ' Esegue la response (logica identica a Motore.ExecuteResponse, riga 164-181)
        Console.WriteLine($"[ServerlessEngine] ▶️ STEP: ExecuteResponse")
        result.StepType = "ExecuteResponse"
        result.Messages = New List(Of String)()

        Dim isAterminationResponse As Boolean = ExecuteResponseInternal(tasks, currTaskNode, taskInstance, result.Messages, state)
        result.HasTerminationResponse = isAterminationResponse

        ' ✅ CORRISPONDENZA: Motore.vb, riga 73-77
        ' Se c'è termination response, marca come failed
        If isAterminationResponse Then
            Console.WriteLine($"[ServerlessEngine] ⚠️ Termination response detected, marking as failed")
            MarkAsAcquisitionFailedInternal(currTaskNode)
            state.HasTerminationResponse = True
            result.ContinueExecution = True ' Continua con il prossimo task
            Return result
        End If

        ' ✅ STEP 5: Check Completion
        ' CORRISPONDENZA: Motore.vb, riga 80-94
        ' Se lo stato è Success, verifica se tutti i task sono completati
        If currTaskNode.State = DialogueState.Success Then
            Console.WriteLine($"[ServerlessEngine] ✅ Success step executed, checking completion...")
            result.StepType = "CheckCompletion"

            Dim allCompleted = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
            If allCompleted Then
                Console.WriteLine($"[ServerlessEngine] 🎉 All tasks completed!")
                state.IsCompleted = True
                result.IsCompleted = True

                ' ✅ CORRISPONDENZA: Motore.vb, riga 85-88
                ' Esegui SuccessResponse se presente
                If taskInstance.SuccessResponse IsNot Nothing AndAlso Not state.SuccessResponseExecuted Then
                    Console.WriteLine($"[ServerlessEngine] 📢 Executing SuccessResponse")
                    Dim successMessages As New List(Of String)()
                    ExecuteResponseInternal(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance, successMessages, state)
                    result.Messages.AddRange(successMessages)
                    state.SuccessResponseExecuted = True
                End If

                result.ContinueExecution = False
                Return result
            Else
                Console.WriteLine($"[ServerlessEngine] ⚠️ Success step executed, but other tasks still pending")
                result.ContinueExecution = True ' Continua con il prossimo task
                Return result
            End If
        End If

        ' ✅ CORRISPONDENZA: Motore.vb, riga 96-98
        ' Per Chat Simulator: fermati dopo il primo response, l'input arriverà via HTTP
        Console.WriteLine($"[ServerlessEngine] ⏸️ Waiting for user input")
        result.ContinueExecution = False ' Ferma l'esecuzione, aspetta input
        Return result
    End Function

    ''' <summary>
    ''' Trova il prossimo task da eseguire
    ''' CORRISPONDENZA: Motore.vb, riga 223-258 (GetNextTask)
    ''' Logica identica, copiata senza modifiche
    ''' </summary>
    Private Function GetNextTaskInternal(taskInstance As TaskInstance) As TaskNode
        For Each mainTask As TaskNode In taskInstance.TaskList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            If IsTaskNodeEmpty(mainTask) Then
                Console.WriteLine($"[ServerlessEngine] 📍 Selected empty node: {mainTask.Id}")
                Return mainTask
            End If

            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(mainTask.State) Then
                Console.WriteLine($"[ServerlessEngine] 📍 Selected node: {mainTask.Id}, State={mainTask.State}")
                Return mainTask
            End If

            If mainTask.State = DialogueState.Success Then
                Console.WriteLine($"[ServerlessEngine] 📍 Selected node with Success state: {mainTask.Id} (will execute Success step)")
                Return mainTask
            End If

            For Each subTask As TaskNode In mainTask.SubTasks.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If IsTaskNodeEmpty(subTask) Then
                    Console.WriteLine($"[ServerlessEngine] 📍 Selected empty subTask: {subTask.Id}")
                    Return subTask
                End If
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(subTask.State) Then
                    Console.WriteLine($"[ServerlessEngine] 📍 Selected subTask: {subTask.Id}, State={subTask.State}")
                    Return subTask
                End If
                If subTask.State = DialogueState.Success Then
                    Console.WriteLine($"[ServerlessEngine] 📍 Selected subTask with Success state: {subTask.Id} (will execute Success step)")
                    Return subTask
                End If
            Next
        Next

        Console.WriteLine($"[ServerlessEngine] ✅ No more tasks to execute")
        Return Nothing
    End Function

    ''' <summary>
    ''' Recupera la response per il task corrente
    ''' CORRISPONDENZA: Motore.vb, riga 116-159 (GetResponse)
    ''' Logica identica, copiata senza modifiche
    ''' </summary>
    Private Function GetResponseInternal(currTaskNode As TaskNode, state As ExecutionState) As IEnumerable(Of ITask)
        Dim matchingSteps = currTaskNode.Steps.Where(Function(s) s.Type = currTaskNode.State).ToList()

        ' ❌ ERRORE BLOCCANTE: nessun fallback, step deve esistere
        If matchingSteps.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has no step for state {currTaskNode.State}. Each Type must appear exactly once. This indicates a compiler or conversion error.")
        ElseIf matchingSteps.Count > 1 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has {matchingSteps.Count} steps with Type={currTaskNode.State}. Each Type must appear exactly once.")
        End If

        Dim dStep = matchingSteps.Single()
        Console.WriteLine($"[ServerlessEngine] 📋 Step: Type={dStep.Type}, Escalations={If(dStep.Escalations IsNot Nothing, dStep.Escalations.Count, 0)}")

        ' ❌ ERRORE BLOCCANTE: nessun fallback per escalation vuote
        Select Case currTaskNode.State
            Case DialogueState.NoMatch, DialogueState.IrrelevantMatch, DialogueState.NoInput, DialogueState.NotConfirmed
                If dStep.Escalations Is Nothing OrElse dStep.Escalations.Count = 0 Then
                    Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has step Type={currTaskNode.State} with no escalations. Escalations are mandatory for this step type.")
                End If
        End Select

        ' ❌ ERRORE BLOCCANTE: step deve avere escalations
        If dStep.Escalations Is Nothing OrElse dStep.Escalations.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has step Type={dStep.Type} with no escalations. Escalations are mandatory.")
        End If

        Dim escalationCounter = GetEscalationCounterInternal(dStep, currTaskNode.State, state)
        ' ❌ ERRORE BLOCCANTE: escalation counter deve essere valido
        If escalationCounter < 0 OrElse escalationCounter >= dStep.Escalations.Count Then
            Throw New InvalidOperationException($"Invalid escalation counter: {escalationCounter} for task {currTaskNode.Id}, step Type={dStep.Type}. Escalations.Count={dStep.Escalations.Count}. This indicates a counter management error.")
        End If

        Dim escalation = dStep.Escalations(escalationCounter)
        ' ❌ ERRORE BLOCCANTE: escalation e tasks devono esistere
        If escalation Is Nothing Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has escalation[{escalationCounter}] that is Nothing.")
        End If
        If escalation.Tasks Is Nothing OrElse escalation.Tasks.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has escalation[{escalationCounter}] with no tasks. Tasks are mandatory.")
        End If

        Console.WriteLine($"[ServerlessEngine] 📋 Returning {escalation.Tasks.Count} tasks from escalation[{escalationCounter}]")
        Return escalation.Tasks
    End Function

    ''' <summary>
    ''' Esegue la response (serie di tasks)
    ''' CORRISPONDENZA: Motore.vb, riga 164-181 (ExecuteResponse)
    ''' Logica identica, copiata senza modifiche
    ''' </summary>
    Private Function ExecuteResponseInternal(tasks As IEnumerable(Of ITask), currTaskNode As TaskNode, taskInstance As TaskInstance, messages As List(Of String), Optional state As ExecutionState = Nothing) As Boolean
        Dim taskIndex As Integer = 0
        For Each task As ITask In tasks
            taskIndex += 1
            Console.WriteLine($"[ServerlessEngine] ⚙️ Executing task {taskIndex}/{tasks.Count()}: {task.GetType().Name}")
            task.Execute(currTaskNode, taskInstance, Sub(msg As String)
                                                         Console.WriteLine($"[ServerlessEngine] 💬 Message: '{msg}'")
                                                         messages.Add(msg)
                                                         RaiseEvent MessageToShow(Me, New MessageEventArgs(msg))
                                                     End Sub)
        Next
        If currTaskNode IsNot Nothing AndAlso state IsNot Nothing Then
            IncrementCounterInternal(currTaskNode, currTaskNode.State, state)
        End If

        Dim hasExitCondition = HasExitConditionForTasks(tasks)
        If hasExitCondition Then
            Console.WriteLine($"[ServerlessEngine] ⚠️ Exit condition detected")
        End If
        Return hasExitCondition
    End Function

    ''' <summary>
    ''' Ottiene il counter per il dialogue step dello stato
    ''' CORRISPONDENZA: Motore.vb, riga 186-197 (GetEscalationCounter)
    ''' Logica identica, ma usa state.Counters invece di _counters
    ''' </summary>
    Private Function GetEscalationCounterInternal(dStep As DialogueStep, state As DialogueState, executionState As ExecutionState) As Integer
        If dStep Is Nothing Then
            Return -1
        Else
            If Not executionState.Counters.ContainsKey(state) Then
                executionState.Counters(state) = 0
            Else
                executionState.Counters(state) = Math.Min(executionState.Counters(state), dStep.Escalations.Count - 1)
            End If
        End If
        Return executionState.Counters(state)
    End Function

    ''' <summary>
    ''' Incrementa il counter per uno stato
    ''' CORRISPONDENZA: Motore.vb, riga 202-220 (IncrementCounter)
    ''' Logica identica, ma usa executionState.Counters invece di _counters
    ''' </summary>
    Private Sub IncrementCounterInternal(taskNode As TaskNode, dialogueState As DialogueState, executionState As ExecutionState)
        Dim matchingSteps = taskNode.Steps.Where(Function(s) s.Type = taskNode.State).ToList()

        If matchingSteps.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {taskNode.Id} has no step for state {taskNode.State}. Each Type must appear exactly once.")
        End If

        If matchingSteps.Count > 1 Then
            Throw New InvalidOperationException($"Invalid task model: Task {taskNode.Id} has {matchingSteps.Count} steps with Type={taskNode.State}. Each Type must appear exactly once.")
        End If

        Dim dStep = matchingSteps.Single()

        Dim escalationsCount As Integer = If(dStep.Escalations Is Nothing, 0, dStep.Escalations.Count)
        If Not executionState.Counters.ContainsKey(taskNode.State) Then
            executionState.Counters(taskNode.State) = 0
        End If
        executionState.Counters(taskNode.State) = Math.Min(executionState.Counters(taskNode.State) + 1, escalationsCount - 1)
    End Sub

    ''' <summary>
    ''' Marca il task come acquisitionFailed
    ''' CORRISPONDENZA: Motore.vb, riga 358-360 (MarkAsAcquisitionFailed)
    ''' Logica identica, copiata senza modifiche
    ''' </summary>
    Private Sub MarkAsAcquisitionFailedInternal(currTaskNode As TaskNode)
        'currTaskNode.State = DataState.AcquisitionFailed
        ' Nota: Nel motore attuale questa funzione è vuota, manteniamo lo stesso comportamento
    End Sub

    ''' <summary>
    ''' Aggiorna lo stato del task in base al risultato del parsing
    ''' CORRISPONDENZA: Motore.vb, riga 293-353 (SetState)
    ''' Logica identica, copiata senza modifiche
    ''' </summary>
    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currTaskNode As TaskNode)
        Console.WriteLine($"[ServerlessEngine] 🔍 ParseResult: {parseResult.Result}, Node={currTaskNode.Id}, CurrentState={currentState}")

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                ' State remains Confirmation

            Case ParseResultType.Match
                Dim taskNode = currTaskNode
                If IsTaskNodeSubData(taskNode) Then
                    taskNode = currTaskNode.ParentData
                End If

                If IsTaskNodeFilled(taskNode) Then
                    If taskNode.RequiresConfirmation Then
                        taskNode.State = DialogueState.Confirmation
                        Console.WriteLine($"[ServerlessEngine] 🔄 State → Confirmation (requires confirmation)")
                    ElseIf taskNode.RequiresValidation Then
                        taskNode.State = DialogueState.Invalid
                        Console.WriteLine($"[ServerlessEngine] 🔄 State → Invalid (requires validation)")
                    Else
                        taskNode.State = DialogueState.Success
                        Console.WriteLine($"[ServerlessEngine] ✅ State → SUCCESS (task filled)")
                    End If
                Else
                    taskNode.State = DialogueState.Start
                    Console.WriteLine($"[ServerlessEngine] 🔄 State → Start (task not filled yet)")
                End If

            Case ParseResultType.Confirmed
                If currTaskNode.RequiresValidation Then
                    currTaskNode.State = DialogueState.Invalid
                    Console.WriteLine($"[ServerlessEngine] 🔄 State → Invalid (requires validation)")
                Else
                    currTaskNode.State = DialogueState.Success
                    Console.WriteLine($"[ServerlessEngine] ✅ State → SUCCESS (confirmed)")
                End If

            Case ParseResultType.NotConfirmed
                currTaskNode.State = DialogueState.NotConfirmed
                Console.WriteLine($"[ServerlessEngine] 🔄 State → NotConfirmed")

            Case ParseResultType.NoMatch
                currTaskNode.State = DialogueState.NoMatch
                Console.WriteLine($"[ServerlessEngine] 🔄 State → NoMatch")

            Case ParseResultType.NoInput
                currTaskNode.State = DialogueState.NoInput
                Console.WriteLine($"[ServerlessEngine] 🔄 State → NoInput")

            Case ParseResultType.IrrelevantMatch
                currTaskNode.State = DialogueState.IrrelevantMatch
                Console.WriteLine($"[ServerlessEngine] 🔄 State → IrrelevantMatch")

            Case Else
                Console.WriteLine($"[ServerlessEngine] ⚠️ Unknown ParseResultType: {parseResult.Result}")
                Debug.Assert(False, "Stato non gestito")
        End Select

        Console.WriteLine($"[ServerlessEngine] ✅ Final state: Node={currTaskNode.Id}, State={currTaskNode.State}")
    End Sub
End Class

''' <summary>
''' Funzioni helper per TaskNode (duplicati da Utils.vb perché Utils è Friend)
''' </summary>
Module ServerlessEngineHelpers
    ''' <summary>
    ''' Verifica se un TaskNode è vuoto
    ''' </summary>
    Public Function IsTaskNodeEmpty(taskNode As TaskNode) As Boolean
        If taskNode.SubTasks IsNot Nothing AndAlso taskNode.SubTasks.Any() Then
            Return Not taskNode.SubTasks.Any(Function(st) st.Value IsNot Nothing)
        Else
            Return taskNode.Value Is Nothing
        End If
    End Function

    ''' <summary>
    ''' Verifica se un TaskNode è riempito
    ''' </summary>
    Public Function IsTaskNodeFilled(taskNode As TaskNode) As Boolean
        If taskNode.SubTasks IsNot Nothing AndAlso taskNode.SubTasks.Any() Then
            Return Not taskNode.SubTasks.Any(Function(st) st.Value Is Nothing)
        Else
            Return taskNode.Value IsNot Nothing
        End If
    End Function

    ''' <summary>
    ''' Verifica se un TaskNode è subdata
    ''' </summary>
    Public Function IsTaskNodeSubData(taskNode As TaskNode) As Boolean
        Return taskNode.ParentData IsNot Nothing
    End Function

    ''' <summary>
    ''' Verifica se i tasks hanno una exit condition
    ''' </summary>
    Public Function HasExitConditionForTasks(tasks As IEnumerable(Of ITask)) As Boolean
        Return tasks.Any(Function(a) TypeOf (a) Is CloseSessionTask OrElse TypeOf (a) Is TransferTask)
    End Function
End Module
