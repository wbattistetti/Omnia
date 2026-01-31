' TaskEngine.vb
' Classe principale del Task Engine - Implementa Execute

Option Strict On
Option Explicit On

Imports System.IO
Imports System.Linq
Imports System.Reflection.PortableExecutable

''' <summary>
''' Classe principale del Task Engine (runtime)
''' Implementa la funzione Execute che coordina il processo di esecuzione task
''' </summary>
Public Class Motore
    Private ReadOnly _parser As Parser
    Private ReadOnly _counters As New Dictionary(Of DialogueState, Integer)()
    Private ReadOnly _maxRecovery As New Dictionary(Of DialogueState, Integer)()

    ''' <summary>
    ''' Evento che viene sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Event MessageToShow As EventHandler(Of MessageEventArgs)

    Public Sub New()
        _parser = New Parser()
    End Sub


    ''' <summary>
    ''' Funzione principale che coordina il processo di esecuzione di una serie di task
    ''' </summary>
    Public Sub ExecuteTask(taskInstance As TaskInstance)
        Console.WriteLine($"[RUNTIME][TaskEngine] ExecuteTask started: TaskList.Count={taskInstance.TaskList.Count}, IsAggregate={taskInstance.IsAggregate}")
        Dim state As DialogueState = DialogueState.Start

        If taskInstance.IsAggregate AndAlso taskInstance.Introduction IsNot Nothing Then
            Console.WriteLine($"[RUNTIME][TaskEngine] Executing introduction tasks")
            ExecuteResponse(taskInstance.Introduction.Tasks, Nothing, taskInstance)
        End If

        Dim iterationCount As Integer = 0
        While True
            iterationCount += 1
            Console.WriteLine($"[RUNTIME][TaskEngine] Iteration {iterationCount}: Calling GetNextTask...")
            Dim currTaskNode As TaskNode = GetNextTask(taskInstance)

            If currTaskNode Is Nothing Then
                Console.WriteLine($"[RUNTIME][TaskEngine] GetNextTask returned Nothing - exiting loop")
                Exit While  ' Tutti i task completati o acquisitionFailed
            End If

            Dim isEmpty = currTaskNode.IsEmpty()
            Console.WriteLine($"[RUNTIME][TaskEngine] GetNextTask returned node: Id={currTaskNode.Id}, State={currTaskNode.State}, IsEmpty={isEmpty}")
            Dim tasks = GetResponse(currTaskNode)
            Console.WriteLine($"[RUNTIME][TaskEngine] GetResponse returned {tasks.Count()} tasks")

            Dim isAterminationResponse As Boolean = ExecuteResponse(tasks, currTaskNode, taskInstance)
            Console.WriteLine($"[RUNTIME][TaskEngine] ExecuteResponse completed, isTermination={isAterminationResponse}")

            If isAterminationResponse Then
                ' Exit condition attivata: marca il task come acquisitionFailed
                ' e continua se ce ne sono con altri task (partial failure)
                MarkAsAcquisitionFailed(currTaskNode)
                Continue While  ' GetNextTask prenderà il prossimo task
            End If

            ' ✅ Per Chat Simulator: fermati dopo il primo response, non aspettare input
            ' L'input arriverà via HTTP, non dalla coda locale
            Console.WriteLine($"[RUNTIME][TaskEngine] First response executed - stopping execution (waiting for HTTP input)")
            Exit While  ' Fermati qui, l'input arriverà via HTTP dal frontend

            ' ❌ CODICE ORIGINALE (non usato per Chat Simulator):
            ' Interpreta l'input utente (solo parsing, nessuna gestione di response)
            ' NOTA: Questo blocca aspettando input dalla coda locale - non usato per Chat Simulator
            ' Dim parseResult As ParseResult = _parser.InterpretUtterance(currTaskNode)
            ' SetState(parseResult, state, currTaskNode)

        End While

        If taskInstance.SuccessResponse IsNot Nothing Then
            Console.WriteLine($"[RUNTIME][TaskEngine] Executing success response")
            ExecuteResponse(taskInstance.SuccessResponse.Tasks, Nothing, taskInstance)
        End If
        Console.WriteLine($"[RUNTIME][TaskEngine] ExecuteTask completed")
    End Sub


    ''' <summary>
    ''' lo step di dialogo dipende dallo stato di acquisizione del task (start, noMatch, NoInput, ecc)
    ''' </summary>
    Private Function GetResponse(currTaskNode As TaskNode) As IEnumerable(Of ITask)
        Console.WriteLine($"[RUNTIME][TaskEngine] GetResponse: node State={currTaskNode.State}, Steps.Count={currTaskNode.Steps.Count}")

        Dim dStep = currTaskNode.Steps.FirstOrDefault(Function(s) s.Type = currTaskNode.State)

        If dStep Is Nothing Then
            Console.WriteLine($"[RUNTIME][TaskEngine] ERROR: No step found for state {currTaskNode.State}")
            ' Prova fallback a Start
            dStep = currTaskNode.Steps.FirstOrDefault(Function(s) s.Type = DialogueState.Start)
            If dStep Is Nothing Then
                Console.WriteLine($"[RUNTIME][TaskEngine] ERROR: No Start step found either!")
                Return New List(Of ITask)()  ' Ritorna lista vuota invece di lanciare eccezione
            End If
            Console.WriteLine($"[RUNTIME][TaskEngine] Using Start step as fallback")
            currTaskNode.State = DialogueState.Start
        End If

        Select Case currTaskNode.State
            Case DialogueState.NoMatch, DialogueState.IrrelevantMatch, DialogueState.NoInput, DialogueState.NotConfirmed
                If Not dStep.Escalations?.Any Then
                    ' Fallback a Start
                    currTaskNode.State = DialogueState.Start
                    dStep = currTaskNode.Steps.FirstOrDefault(Function(s) s.Type = DialogueState.Start)
                End If
        End Select

        If dStep Is Nothing OrElse dStep.Escalations Is Nothing OrElse dStep.Escalations.Count = 0 Then
            Console.WriteLine($"[RUNTIME][TaskEngine] ERROR: Step has no escalations!")
            Return New List(Of ITask)()
        End If

        Dim escalationCounter = GetEscalationCounter(dStep, currTaskNode.State)
        If escalationCounter < 0 OrElse escalationCounter >= dStep.Escalations.Count Then
            Console.WriteLine($"[RUNTIME][TaskEngine] ERROR: Invalid escalation counter: {escalationCounter}, Escalations.Count={dStep.Escalations.Count}")
            Return New List(Of ITask)()
        End If

        Dim escalation = dStep.Escalations(escalationCounter)
        If escalation Is Nothing OrElse escalation.Tasks Is Nothing Then
            Console.WriteLine($"[RUNTIME][TaskEngine] ERROR: Escalation or Tasks is Nothing!")
            Return New List(Of ITask)()
        End If

        Console.WriteLine($"[RUNTIME][TaskEngine] GetResponse: returning {escalation.Tasks.Count} tasks from escalation {escalationCounter}")
        Return escalation.Tasks
    End Function

    ''' <summary>
    ''' Eseguire il response significa eseguire la serie di tasks di cui è composto
    ''' </summary>
    Private Function ExecuteResponse(tasks As IEnumerable(Of ITask), currTaskNode As TaskNode, taskInstance As TaskInstance) As Boolean
        Console.WriteLine($"[RUNTIME][TaskEngine] ExecuteResponse: {tasks.Count()} tasks to execute")
        Dim taskIndex As Integer = 0
        For Each task As ITask In tasks
            taskIndex += 1
            Console.WriteLine($"[RUNTIME][TaskEngine] Executing task {taskIndex}/{tasks.Count()}: {task.GetType().Name}")
            ' Passa un lambda che solleva l'evento MessageToShow
            task.Execute(currTaskNode, taskInstance, Sub(msg As String)
                                                        Console.WriteLine($"[RUNTIME][TaskEngine] Task generated message: '{msg}'")
                                                        RaiseEvent MessageToShow(Me, New MessageEventArgs(msg))
                                                    End Sub)
        Next
        If currTaskNode IsNot Nothing Then IncrementCounter(currTaskNode) 'eccezione in caso si introduction o success di un aggregato

        ' Controlla se c'è una exit condition che rende il response un termination response
        Return Utils.HasExitCondition(tasks)
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
        Dim dStep = taskNode.Steps.SingleOrDefault(Function(s) s.Type = taskNode.State)
        Dim escalationsCount As Integer = If(dStep.Escalations Is Nothing, 0, dStep.Escalations.Count)
        If Not _counters.ContainsKey(taskNode.State) Then
            _counters(taskNode.State) = 0
        End If
        _counters(taskNode.State) = Math.Min(_counters(taskNode.State) + 1, escalationsCount - 1)
    End Sub


    Private Function GetNextTask(taskInstance As TaskInstance) As TaskNode
        Console.WriteLine($"[RUNTIME][TaskEngine] GetNextTask: checking {taskInstance.TaskList.Count} main nodes")
        Dim allCandidates As New List(Of TaskNode)()

        For Each mainTask As TaskNode In taskInstance.TaskList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            Dim isEmpty = mainTask.IsEmpty()
            Console.WriteLine($"[RUNTIME][TaskEngine] Checking main node: Id={mainTask.Id}, State={mainTask.State}, IsEmpty={isEmpty}, Value={If(mainTask.Value Is Nothing, "Nothing", mainTask.Value.ToString())}")
            If isEmpty Then
                Console.WriteLine($"[RUNTIME][TaskEngine] Returning empty main node")
                Return mainTask
            End If
            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(mainTask.State) Then
                Console.WriteLine($"[RUNTIME][TaskEngine] Returning main node with state {mainTask.State}")
                Return mainTask
            End If

            For Each subTask As TaskNode In mainTask.SubTasks.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If subTask.IsEmpty() Then Return subTask
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(subTask.State) Then Return subTask
            Next
        Next
        Console.WriteLine($"[RUNTIME][TaskEngine] GetNextTask: No suitable node found, returning Nothing")
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
        ' TODO: Implementare la logica completa basata su Motori.MD

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                'vedi summary

            Case ParseResultType.Match
                'vedi summary
                Dim taskNode = currTaskNode
                If taskNode.IsSubData Then taskNode = currTaskNode.ParentData

                If taskNode.IsFilled Then
                    ' Nota: se il currentNode è un subdata allora necessariamente il parentadata non era filled al turno precedente ma può esserlo diventato ora e se ne può chiedere la conferma
                    If taskNode.RequiresConfirmation Then
                        taskNode.State = DialogueState.Confirmation
                    ElseIf taskNode.RequiresValidation Then
                        taskNode.State = DialogueState.Invalid
                    Else
                        taskNode.State = DialogueState.Success
                    End If
                Else
                    ' MainTask parzialmente compilato: mantieni lo stato a Start
                    ' GetNextTask restituirà il prossimo subTask vuoto
                    taskNode.State = DialogueState.Start
                End If

            Case ParseResultType.Confirmed
                If currTaskNode.RequiresValidation Then
                    currTaskNode.State = DialogueState.Invalid

                Else
                    currTaskNode.State = DialogueState.Success
                End If

            Case ParseResultType.NotConfirmed
                currTaskNode.State = DialogueState.NotConfirmed

            Case ParseResultType.NoMatch
                currTaskNode.State = DialogueState.NoMatch

            Case ParseResultType.NoInput
                currTaskNode.State = DialogueState.NoInput

            Case ParseResultType.IrrelevantMatch
                currTaskNode.State = DialogueState.IrrelevantMatch

            Case Else
                Debug.Assert(False, "Stato non gestito")
                'non cambia lo stato ma non dovrebbe mai arrivare qui
        End Select
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

