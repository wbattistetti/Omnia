' TaskEngine.vb
' Classe principale del Task Engine - Implementa Execute

Option Strict On
Option Explicit On

''' <summary>
''' Classe principale del Task Engine (runtime)
''' Implementa la funzione Execute che coordina il processo di esecuzione task
''' </summary>
Public Class Motore
    Public ReadOnly Property Parser As Parser
    Private ReadOnly _counters As New Dictionary(Of DialogueState, Integer)()
    Private ReadOnly _maxRecovery As New Dictionary(Of DialogueState, Integer)()

    ''' <summary>
    ''' Evento che viene sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    Public Sub New()
        Parser = New Parser()
    End Sub


    ''' <summary>
    ''' Funzione principale che coordina il processo di esecuzione di una serie di task
    ''' </summary>
    Public Sub ExecuteTask(taskInstance As TaskInstance)
        Console.WriteLine($"[MOTORE] ExecuteTask START: TaskList.Count={taskInstance.TaskList.Count}")

        If taskInstance.IsAggregate AndAlso taskInstance.Introduction IsNot Nothing Then
            Console.WriteLine($"[MOTORE] Executing introduction")
            ExecuteResponse(taskInstance.Introduction.Tasks, Nothing, taskInstance)
        End If

        Dim iterationCount As Integer = 0
        While True
            iterationCount += 1
            Dim currTaskNode As TaskNode = GetNextTask(taskInstance)

            If currTaskNode Is Nothing Then
                Console.WriteLine($"[MOTORE] GetNextTask returned Nothing - all tasks completed")
                Exit While
            End If

            Console.WriteLine($"[MOTORE] Iteration {iterationCount}: Selected node Id={currTaskNode.Id}, State={currTaskNode.State}, IsEmpty={currTaskNode.IsEmpty()}")
            Dim tasks = GetResponse(currTaskNode)

            If tasks.Count() = 0 Then
                Console.WriteLine($"[MOTORE] ERROR: GetResponse returned 0 tasks for node {currTaskNode.Id}")
            End If

            Dim isAterminationResponse As Boolean = ExecuteResponse(tasks, currTaskNode, taskInstance)

            If isAterminationResponse Then
                Console.WriteLine($"[MOTORE] Termination response detected, marking as failed")
                MarkAsAcquisitionFailed(currTaskNode)
                Continue While
            End If

            ' Per Chat Simulator: fermati dopo il primo response, l'input arriverà via HTTP
            Console.WriteLine($"[MOTORE] First response executed, waiting for user input")
            Exit While
        End While

        ' ✅ Check if all tasks are completed and execute SuccessResponse
        Dim allCompleted = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
        If allCompleted Then
            Console.WriteLine($"[MOTORE] All tasks completed, checking SuccessResponse")
            If taskInstance.SuccessResponse IsNot Nothing Then
                Console.WriteLine($"[MOTORE] Executing SuccessResponse")
                ExecuteResponse(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance)
            Else
                Console.WriteLine($"[MOTORE] No SuccessResponse defined")
            End If
        Else
            Console.WriteLine($"[MOTORE] Tasks not all completed yet, skipping SuccessResponse")
        End If
    End Sub


    ''' <summary>
    ''' lo step di dialogo dipende dallo stato di acquisizione del task (start, noMatch, NoInput, ecc)
    ''' </summary>
    Private Function GetResponse(currTaskNode As TaskNode) As IEnumerable(Of ITask)
        Console.WriteLine($"[MOTORE] GetResponse: node Id={currTaskNode.Id}, State={currTaskNode.State}, Steps.Count={currTaskNode.Steps.Count}")

        Dim matchingSteps = currTaskNode.Steps.Where(Function(s) s.Type = currTaskNode.State).ToList()

        ' ❌ ERRORE BLOCCANTE: nessun fallback, step deve esistere
        If matchingSteps.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has no step for state {currTaskNode.State}. Each Type must appear exactly once. This indicates a compiler or conversion error.")
        ElseIf matchingSteps.Count > 1 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has {matchingSteps.Count} steps with Type={currTaskNode.State}. Each Type must appear exactly once.")
        End If

        Dim dStep = matchingSteps.Single()
        Console.WriteLine($"[MOTORE] Found step Type={dStep.Type}, Escalations.Count={If(dStep.Escalations IsNot Nothing, dStep.Escalations.Count, 0)}")

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

        Dim escalationCounter = GetEscalationCounter(dStep, currTaskNode.State)
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

        Console.WriteLine($"[MOTORE] GetResponse: returning {escalation.Tasks.Count} tasks from escalation[{escalationCounter}]")
        Return escalation.Tasks
    End Function

    ''' <summary>
    ''' Eseguire il response significa eseguire la serie di tasks di cui è composto
    ''' </summary>
    Private Function ExecuteResponse(tasks As IEnumerable(Of ITask), currTaskNode As TaskNode, taskInstance As TaskInstance) As Boolean
        Console.WriteLine($"[MOTORE] ExecuteResponse: {tasks.Count()} tasks to execute")

        Dim taskIndex As Integer = 0
        For Each task As ITask In tasks
            taskIndex += 1
            Console.WriteLine($"[MOTORE] Executing task {taskIndex}/{tasks.Count()}: {task.GetType().Name}")
            task.Execute(currTaskNode, taskInstance, Sub(msg As String)
                                                         Console.WriteLine($"[MOTORE] Message emitted: {msg}")
                                                         RaiseEvent MessageToShow(Me, New MessageEventArgs(msg))
                                                     End Sub)
        Next
        If currTaskNode IsNot Nothing Then IncrementCounter(currTaskNode)

        Dim hasExitCondition = Utils.HasExitCondition(tasks)
        If hasExitCondition Then
            Console.WriteLine($"[MOTORE] ExecuteResponse: exit condition detected")
        End If
        Return hasExitCondition
    End Function

    ''' <summary>
    ''' Ottiene il counter per il dialogue step dello stato limitato al numero di escalation definite
    ''' </summary>
    Private Function GetEscalationCounter(dStep As DialogueStep, state As DialogueState) As Integer
        If dStep Is Nothing Then
            Return -1
        Else
            If Not _counters.ContainsKey(state) Then
                _counters(state) = 0
            Else
                _counters(state) = Math.Min(_counters(state), dStep.Escalations.Count - 1)
            End If
        End If
        Return _counters(state)
    End Function

    ''' <summary>
    ''' Incrementa il counter per uno stato
    ''' </summary>
    Private Sub IncrementCounter(taskNode As TaskNode)
        Dim matchingSteps = taskNode.Steps.Where(Function(s) s.Type = taskNode.State).ToList()

        If matchingSteps.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {taskNode.Id} has no step for state {taskNode.State}. Each Type must appear exactly once.")
        End If

        If matchingSteps.Count > 1 Then
            Throw New InvalidOperationException($"Invalid task model: Task {taskNode.Id} has {matchingSteps.Count} steps with Type={taskNode.State}. Each Type must appear exactly once.")
        End If

        Dim dStep = matchingSteps.Single()

        Dim escalationsCount As Integer = If(dStep.Escalations Is Nothing, 0, dStep.Escalations.Count)
        If Not _counters.ContainsKey(taskNode.State) Then
            _counters(taskNode.State) = 0
        End If
        _counters(taskNode.State) = Math.Min(_counters(taskNode.State) + 1, escalationsCount - 1)
    End Sub


    Public Function GetNextTask(taskInstance As TaskInstance) As TaskNode
        Console.WriteLine($"[MOTORE] GetNextTask: checking {taskInstance.TaskList.Count} main nodes")

        For Each mainTask As TaskNode In taskInstance.TaskList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            Dim isEmpty = mainTask.IsEmpty()
            Console.WriteLine($"[MOTORE] Checking main node: Id={mainTask.Id}, State={mainTask.State}, IsEmpty={isEmpty}, IsFilled={mainTask.IsFilled}")

            If isEmpty Then
                Console.WriteLine($"[MOTORE] Selected empty main node: {mainTask.Id}")
                Return mainTask
            End If

            ' ✅ Include Success state so that success step can be executed
            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput, DialogueState.Success}.Contains(mainTask.State) Then
                Console.WriteLine($"[MOTORE] Selected main node with state {mainTask.State}: {mainTask.Id}")
                Return mainTask
            End If

            For Each subTask As TaskNode In mainTask.SubTasks.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                Console.WriteLine($"[MOTORE] Checking subTask: Id={subTask.Id}, State={subTask.State}, IsEmpty={subTask.IsEmpty()}, IsFilled={subTask.IsFilled}")
                If subTask.IsEmpty() Then
                    Console.WriteLine($"[MOTORE] Selected empty subTask: {subTask.Id} (parent: {mainTask.Id})")
                    Return subTask
                End If
                ' ✅ Include Success state for subtasks too
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput, DialogueState.Success}.Contains(subTask.State) Then
                    Console.WriteLine($"[MOTORE] Selected subTask with state {subTask.State}: {subTask.Id} (parent: {mainTask.Id})")
                    Return subTask
                End If
            Next
        Next

        Console.WriteLine($"[MOTORE] GetNextTask: No suitable node found")
        Return Nothing
    End Function

    ''' <summary>
    ''' Stato di richiesta conferma: Case ParseResultType.Corrected
    ''' - Nella risposta c’è stata una correzione, quindi non una conferma ma una correzione.
    '''   Esempi:
    '''     "No, ho detto Roma"
    '''     "Ho detto Roma"
    '''     "Roma"
    ''' - In questo caso lo stato non cambia e rimane "Confirmation".
    '''
    ''' Stato di match: Case ParseResultType.Match
    ''' - Qui ci sono varie situazioni da considerare:
    '''   • Il match potrebbe aver riempito un subdata e completato un maindata.
    '''   • Se ha completato il maindata, allora si verificano le condizioni di conferma
    '''     e di validazione del maindata.
    ''' - Per non appesantire troppo:
    '''   • La conferma dei subdata non conviene chiederla mai.
    '''   • La validazione dei subdata va fatta solo a maindata completato.
    '''
    ''' Esempio di dialogo:
    '''   Mi dica la data?
    '''   febbraio 1980
    '''   Giorno?
    '''   31
    '''   31 febbraio 1980?
    '''   sì
    '''   Il febbraio aveva solo 28 giorni, nel 1980. Può dirmi il giorno esatto?
    '''
    ''' Conclusione:
    ''' - I subdata non hanno mai conferma esplicita.
    ''' - La validazione è fatta solo a maindata completato e confermato
    '''   (eventualmente se la conferma è prevista).
    ''' </summary>

    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currTaskNode As TaskNode)
        Console.WriteLine($"[MOTORE] SetState CALLED: parseResult={parseResult.Result}, currentState={currentState}, nodeId={currTaskNode.Id}, IsSubData={currTaskNode.IsSubData}")

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                Console.WriteLine($"[MOTORE] SetState: Corrected - state remains Confirmation")
                'vedi summary

            Case ParseResultType.Match
                Console.WriteLine($"[MOTORE] SetState: Match detected")
                Dim taskNode = currTaskNode
                If taskNode.IsSubData Then
                    Console.WriteLine($"[MOTORE] SetState: Current node is SubData, switching to ParentData")
                    taskNode = currTaskNode.ParentData
                End If

                Console.WriteLine($"[MOTORE] SetState: Checking if taskNode IsFilled: {taskNode.IsFilled}")
                If taskNode.IsFilled Then
                    Console.WriteLine($"[MOTORE] SetState: TaskNode is FILLED")
                    Console.WriteLine($"[MOTORE] SetState: RequiresConfirmation={taskNode.RequiresConfirmation}, RequiresValidation={taskNode.RequiresValidation}")
                    ' Nota: se il currentNode è un subdata allora necessariamente il parentadata non era filled al turno precedente ma può esserlo diventato ora e se ne può chiedere la conferma
                    If taskNode.RequiresConfirmation Then
                        taskNode.State = DialogueState.Confirmation
                        Console.WriteLine($"[MOTORE] SetState: Setting state to Confirmation")
                    ElseIf taskNode.RequiresValidation Then
                        taskNode.State = DialogueState.Invalid
                        Console.WriteLine($"[MOTORE] SetState: Setting state to Invalid")
                    Else
                        taskNode.State = DialogueState.Success
                        Console.WriteLine($"[MOTORE] SetState: ✅ Setting state to SUCCESS")
                    End If
                Else
                    Console.WriteLine($"[MOTORE] SetState: TaskNode is NOT filled, keeping state as Start")
                    ' MainTask parzialmente compilato: mantieni lo stato a Start
                    ' GetNextTask restituirà il prossimo subTask vuoto
                    taskNode.State = DialogueState.Start
                End If

            Case ParseResultType.Confirmed
                Console.WriteLine($"[MOTORE] SetState: Confirmed")
                Console.WriteLine($"[MOTORE] SetState: RequiresValidation={currTaskNode.RequiresValidation}")
                If currTaskNode.RequiresValidation Then
                    currTaskNode.State = DialogueState.Invalid
                    Console.WriteLine($"[MOTORE] SetState: Setting state to Invalid")
                Else
                    currTaskNode.State = DialogueState.Success
                    Console.WriteLine($"[MOTORE] SetState: ✅ Setting state to SUCCESS")
                End If

            Case ParseResultType.NotConfirmed
                currTaskNode.State = DialogueState.NotConfirmed
                Console.WriteLine($"[MOTORE] SetState: Setting state to NotConfirmed")

            Case ParseResultType.NoMatch
                currTaskNode.State = DialogueState.NoMatch
                Console.WriteLine($"[MOTORE] SetState: Setting state to NoMatch")

            Case ParseResultType.NoInput
                currTaskNode.State = DialogueState.NoInput
                Console.WriteLine($"[MOTORE] SetState: Setting state to NoInput")

            Case ParseResultType.IrrelevantMatch
                currTaskNode.State = DialogueState.IrrelevantMatch
                Console.WriteLine($"[MOTORE] SetState: Setting state to IrrelevantMatch")

            Case Else
                Console.WriteLine($"[MOTORE] SetState: ⚠️ Unknown ParseResultType: {parseResult.Result}")
                Debug.Assert(False, "Stato non gestito")
                'non cambia lo stato ma non dovrebbe mai arrivare qui
        End Select

        Console.WriteLine($"[MOTORE] SetState COMPLETE: nodeId={currTaskNode.Id}, newState={currTaskNode.State}")
    End Sub

    ''' <summary>
    ''' Marca il task come acquisitionFailed
    ''' </summary>
    Public Sub MarkAsAcquisitionFailed(currTaskNode As TaskNode)
        'currTaskNode.State = DataState.AcquisitionFailed
    End Sub

    ''' <summary>
    ''' Resetta lo stato interno del motore (contatori) e tutti i valori dell'istanza Task.
    ''' </summary>
    ''' <param name="taskInstance">Istanza Task da resettare (opzionale). Se Nothing, resetta solo i contatori interni.</param>
    Public Sub Reset(Optional taskInstance As TaskInstance = Nothing)
        ' Resetta i contatori interni del motore
        _counters.Clear()
        _maxRecovery.Clear()

        ' Se fornita, resetta anche tutti i valori dell'istanza Task
        If taskInstance IsNot Nothing Then
            taskInstance.Reset()
        End If
    End Sub

End Class

