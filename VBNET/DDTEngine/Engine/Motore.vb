' TaskEngine.vb
' Classe principale del Task Engine - Implementa Execute

Option Strict On
Option Explicit On
' ✅ FASE 2: Import per ILogger (opzionale, per backward compatibility)
#If False Then
Imports ApiServer.Interfaces
Imports ApiServer.Logging
#End If

''' <summary>
''' Classe principale del Task Engine (runtime)
''' Implementa la funzione Execute che coordina il processo di esecuzione task
''' </summary>
Public Class Motore
    Public ReadOnly Property Parser As Parser
    Private ReadOnly _counters As New Dictionary(Of DialogueState, Integer)()
    Private ReadOnly _maxRecovery As New Dictionary(Of DialogueState, Integer)()
    ' ✅ FASE 2: Logger opzionale (per backward compatibility)
    Private ReadOnly _logger As Object = Nothing

    ''' <summary>
    ''' Evento che viene sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    ''' <summary>
    ''' Costruttore standard (backward compatible)
    ''' </summary>
    Public Sub New()
        Parser = New Parser()
    End Sub

    ''' <summary>
    ''' ✅ FASE 2: Costruttore con logger (per future estensioni)
    ''' </summary>
    Public Sub New(logger As Object)
        Parser = New Parser()
        _logger = logger
    End Sub


    ''' <summary>
    ''' Funzione principale che coordina il processo di esecuzione di una serie di task
    ''' </summary>
    Public Sub ExecuteTask(taskInstance As TaskInstance)
        Console.WriteLine($"[MOTORE] ▶️ ExecuteTask START: {taskInstance.TaskList.Count} tasks")

        If taskInstance.IsAggregate AndAlso taskInstance.Introduction IsNot Nothing Then
            ExecuteResponse(taskInstance.Introduction.Tasks, Nothing, taskInstance)
        End If

        Dim iterationCount As Integer = 0
        While True
            iterationCount += 1
            Dim currTaskNode As TaskNode = GetNextTask(taskInstance)

            If currTaskNode Is Nothing Then
                Console.WriteLine($"[MOTORE] ✅ No more tasks, execution complete")
                Exit While
            End If

            Console.WriteLine($"[MOTORE] 🔄 Iteration {iterationCount}: Node={currTaskNode.Id}, State={currTaskNode.State}")
            Dim tasks = GetResponse(currTaskNode)

            If tasks.Count() = 0 Then
                Console.WriteLine($"[MOTORE] ❌ ERROR: GetResponse returned 0 tasks for node {currTaskNode.Id}")
            End If

            Dim isAterminationResponse As Boolean = ExecuteResponse(tasks, currTaskNode, taskInstance)

            If isAterminationResponse Then
                Console.WriteLine($"[MOTORE] ⚠️ Termination response detected, marking as failed")
                MarkAsAcquisitionFailed(currTaskNode)
                Continue While
            End If

            ' ✅ STATELESS: Se lo stato è Success, verifica se tutti i task sono completati
            If currTaskNode.State = DialogueState.Success Then
                Console.WriteLine($"[MOTORE] ✅ Success step executed, checking completion...")
                Dim allCompleted = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
                If allCompleted Then
                    Console.WriteLine($"[MOTORE] 🎉 All tasks completed!")
                    If taskInstance.SuccessResponse IsNot Nothing Then
                        Console.WriteLine($"[MOTORE] 📢 Executing SuccessResponse")
                        ExecuteResponse(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance)
                    End If
                    Exit While
                Else
                    Console.WriteLine($"[MOTORE] ⚠️ Success step executed, but other tasks still pending")
                    Continue While
                End If
            End If

            ' Per Chat Simulator: fermati dopo il primo response, l'input arriverà via HTTP
            Console.WriteLine($"[MOTORE] ⏸️ Waiting for user input")
            Exit While
        End While

        ' ✅ Check if all tasks are completed and execute SuccessResponse (fallback check)
        Dim allCompletedFinal = taskInstance.TaskList.All(Function(t) t.State = DialogueState.Success OrElse t.State = DialogueState.AcquisitionFailed)
        If allCompletedFinal Then
            Console.WriteLine($"[MOTORE] 🎉 All tasks completed (final check)")
            If taskInstance.SuccessResponse IsNot Nothing Then
                Console.WriteLine($"[MOTORE] 📢 Executing SuccessResponse")
                ExecuteResponse(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance)
            End If
        End If
    End Sub


    ''' <summary>
    ''' lo step di dialogo dipende dallo stato di acquisizione del task (start, noMatch, NoInput, ecc)
    ''' </summary>
    Private Function GetResponse(currTaskNode As TaskNode) As IEnumerable(Of ITask)
        Dim matchingSteps = currTaskNode.Steps.Where(Function(s) s.Type = currTaskNode.State).ToList()

        ' ❌ ERRORE BLOCCANTE: nessun fallback, step deve esistere
        If matchingSteps.Count = 0 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has no step for state {currTaskNode.State}. Each Type must appear exactly once. This indicates a compiler or conversion error.")
        ElseIf matchingSteps.Count > 1 Then
            Throw New InvalidOperationException($"Invalid task model: Task {currTaskNode.Id} has {matchingSteps.Count} steps with Type={currTaskNode.State}. Each Type must appear exactly once.")
        End If

        Dim dStep = matchingSteps.Single()
        Console.WriteLine($"[MOTORE] 📋 Step: Type={dStep.Type}, Escalations={If(dStep.Escalations IsNot Nothing, dStep.Escalations.Count, 0)}")

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

        Console.WriteLine($"[MOTORE] 📋 Returning {escalation.Tasks.Count} tasks from escalation[{escalationCounter}]")
        Return escalation.Tasks
    End Function

    ''' <summary>
    ''' Eseguire il response significa eseguire la serie di tasks di cui è composto
    ''' </summary>
    Private Function ExecuteResponse(tasks As IEnumerable(Of ITask), currTaskNode As TaskNode, taskInstance As TaskInstance) As Boolean
        Dim taskIndex As Integer = 0
        For Each task As ITask In tasks
            taskIndex += 1
            Console.WriteLine($"[MOTORE] ⚙️ Executing task {taskIndex}/{tasks.Count()}: {task.GetType().Name}")
            task.Execute(currTaskNode, taskInstance, Sub(msg As String)
                                                         Console.WriteLine($"[MOTORE] 💬 Message: '{msg}'")
                                                         RaiseEvent MessageToShow(Me, New MessageEventArgs(msg))
                                                     End Sub)
        Next
        If currTaskNode IsNot Nothing Then IncrementCounter(currTaskNode)

        Dim hasExitCondition = Utils.HasExitCondition(tasks)
        If hasExitCondition Then
            Console.WriteLine($"[MOTORE] ⚠️ Exit condition detected")
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
        For Each mainTask As TaskNode In taskInstance.TaskList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            If mainTask.IsEmpty() Then
                Console.WriteLine($"[MOTORE] 📍 Selected empty node: {mainTask.Id}")
                Return mainTask
            End If

            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(mainTask.State) Then
                Console.WriteLine($"[MOTORE] 📍 Selected node: {mainTask.Id}, State={mainTask.State}")
                Return mainTask
            End If

            If mainTask.State = DialogueState.Success Then
                Console.WriteLine($"[MOTORE] 📍 Selected node with Success state: {mainTask.Id} (will execute Success step)")
                Return mainTask
            End If

            For Each subTask As TaskNode In mainTask.SubTasks.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If subTask.IsEmpty() Then
                    Console.WriteLine($"[MOTORE] 📍 Selected empty subTask: {subTask.Id}")
                    Return subTask
                End If
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(subTask.State) Then
                    Console.WriteLine($"[MOTORE] 📍 Selected subTask: {subTask.Id}, State={subTask.State}")
                    Return subTask
                End If
                If subTask.State = DialogueState.Success Then
                    Console.WriteLine($"[MOTORE] 📍 Selected subTask with Success state: {subTask.Id} (will execute Success step)")
                    Return subTask
                End If
            Next
        Next

        Console.WriteLine($"[MOTORE] ✅ No more tasks to execute")
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
        Console.WriteLine($"[MOTORE] 🔍 ParseResult: {parseResult.Result}, Node={currTaskNode.Id}, CurrentState={currentState}")

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                ' State remains Confirmation

            Case ParseResultType.Match
                Dim taskNode = currTaskNode
                If taskNode.IsSubData Then
                    taskNode = currTaskNode.ParentData
                End If

                If taskNode.IsFilled Then
                    If taskNode.RequiresConfirmation Then
                        taskNode.State = DialogueState.Confirmation
                        Console.WriteLine($"[MOTORE] 🔄 State → Confirmation (requires confirmation)")
                    ElseIf taskNode.RequiresValidation Then
                        taskNode.State = DialogueState.Invalid
                        Console.WriteLine($"[MOTORE] 🔄 State → Invalid (requires validation)")
                    Else
                        taskNode.State = DialogueState.Success
                        Console.WriteLine($"[MOTORE] ✅ State → SUCCESS (task filled)")
                    End If
                Else
                    taskNode.State = DialogueState.Start
                    Console.WriteLine($"[MOTORE] 🔄 State → Start (task not filled yet)")
                End If

            Case ParseResultType.Confirmed
                If currTaskNode.RequiresValidation Then
                    currTaskNode.State = DialogueState.Invalid
                    Console.WriteLine($"[MOTORE] 🔄 State → Invalid (requires validation)")
                Else
                    currTaskNode.State = DialogueState.Success
                    Console.WriteLine($"[MOTORE] ✅ State → SUCCESS (confirmed)")
                End If

            Case ParseResultType.NotConfirmed
                currTaskNode.State = DialogueState.NotConfirmed
                Console.WriteLine($"[MOTORE] 🔄 State → NotConfirmed")

            Case ParseResultType.NoMatch
                currTaskNode.State = DialogueState.NoMatch
                Console.WriteLine($"[MOTORE] 🔄 State → NoMatch")

            Case ParseResultType.NoInput
                currTaskNode.State = DialogueState.NoInput
                Console.WriteLine($"[MOTORE] 🔄 State → NoInput")

            Case ParseResultType.IrrelevantMatch
                currTaskNode.State = DialogueState.IrrelevantMatch
                Console.WriteLine($"[MOTORE] 🔄 State → IrrelevantMatch")

            Case Else
                Console.WriteLine($"[MOTORE] ⚠️ Unknown ParseResultType: {parseResult.Result}")
                Debug.Assert(False, "Stato non gestito")
        End Select

        Console.WriteLine($"[MOTORE] ✅ Final state: Node={currTaskNode.Id}, State={currTaskNode.State}")
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

