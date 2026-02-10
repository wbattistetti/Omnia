' ServerlessEngineFacade.vb
' Facciata compatibile con l'API del motore attuale
' Usa internamente ServerlessEngine.ExecuteTaskStep in un loop esterno

Option Strict On
Option Explicit On
Imports TaskEngine
Imports System.Linq
Imports System.Runtime.CompilerServices

''' <summary>
''' Facciata compatibile con l'API del motore attuale (Motore.ExecuteTask)
'''
''' CORRISPONDENZA:
''' Questa classe simula il comportamento di Motore.ExecuteTask (riga 47-110)
''' usando internamente ServerlessEngine.ExecuteTaskStep in un loop esterno
'''
''' UTILITÀ:
''' - Mantiene compatibilità con codice esistente
''' - Permette confronto diretto con Motore.ExecuteTask per golden test
''' - Serve come ponte per evitare regressioni durante la migrazione
''' </summary>
Public Class ServerlessEngineFacade
    Private ReadOnly _engine As ServerlessEngine
    Private _messageToShowHandlers As EventHandler(Of MessageEventArgs)

    ''' <summary>
    ''' Costruttore
    ''' </summary>
    Public Sub New()
        _engine = New ServerlessEngine()
        ' Collega l'evento del motore interno per inoltrarlo
        AddHandler _engine.MessageToShow, Sub(sender, e)
                                               RaiseEvent MessageToShow(sender, e)
                                           End Sub
    End Sub

    ''' <summary>
    ''' Parser per interpretare l'input utente
    ''' </summary>
    Public ReadOnly Property Parser As Parser
        Get
            Return _engine.Parser
        End Get
    End Property

    ''' <summary>
    ''' Evento che viene sollevato quando un messaggio deve essere mostrato
    ''' </summary>
    Public Custom Event MessageToShow As EventHandler(Of MessageEventArgs)
        AddHandler(value As EventHandler(Of MessageEventArgs))
            _messageToShowHandlers = CType([Delegate].Combine(_messageToShowHandlers, value), EventHandler(Of MessageEventArgs))
        End AddHandler
        RemoveHandler(value As EventHandler(Of MessageEventArgs))
            _messageToShowHandlers = CType([Delegate].Remove(_messageToShowHandlers, value), EventHandler(Of MessageEventArgs))
        End RemoveHandler
        RaiseEvent(sender As Object, e As MessageEventArgs)
            If _messageToShowHandlers IsNot Nothing Then
                _messageToShowHandlers.Invoke(sender, e)
            End If
        End RaiseEvent
    End Event

    ''' <summary>
    ''' Esegue il task completo (compatibile con Motore.ExecuteTask)
    '''
    ''' CORRISPONDENZA:
    ''' Questo metodo simula il loop While True in Motore.ExecuteTask (riga 55-99)
    ''' chiamando ripetutamente ServerlessEngine.ExecuteTaskStep finché ContinueExecution = False
    '''
    ''' LOGICA:
    ''' 1. Crea ExecutionState iniziale
    ''' 2. Loop: chiama ExecuteTaskStep finché ContinueExecution = True
    ''' 3. Raccoglie tutti i messaggi emessi
    ''' 4. Ritorna quando l'esecuzione è completata o in attesa di input
    ''' </summary>
    ''' <param name="taskInstance">Istanza del task da eseguire</param>
    Public Sub ExecuteTask(taskInstance As TaskInstance)
        Console.WriteLine($"[ServerlessEngineFacade] ▶️ ExecuteTask START: {taskInstance.TaskList.Count} tasks")

        ' Crea stato iniziale
        Dim state As New ExecutionState()

        ' Loop principale: esegui step finché ContinueExecution = True
        ' CORRISPONDENZA: Motore.vb, riga 55-99 (While True loop)
        While True
            Dim stepResult = _engine.ExecuteTaskStep(state, taskInstance)

            ' Aggiungi messaggi allo stato
            If stepResult.Messages IsNot Nothing Then
                state.Messages.AddRange(stepResult.Messages)
            End If

            ' Se l'esecuzione deve fermarsi, esci dal loop
            ' CORRISPONDENZA: Motore.vb, riga 59-62, 73-77, 89, 98
            If Not stepResult.ContinueExecution Then
                Console.WriteLine($"[ServerlessEngineFacade] ⏸️ Execution stopped: StepType={stepResult.StepType}, IsCompleted={stepResult.IsCompleted}")
                Exit While
            End If

            ' Se c'è un errore, ferma l'esecuzione
            If Not String.IsNullOrEmpty(stepResult.ErrorMessage) Then
                Console.WriteLine($"[ServerlessEngineFacade] ❌ ERROR: {stepResult.ErrorMessage}")
                Exit While
            End If
        End While

        Console.WriteLine($"[ServerlessEngineFacade] ✅ ExecuteTask COMPLETE: Messages.Count={state.Messages.Count}, IsCompleted={state.IsCompleted}")
    End Sub

    ''' <summary>
    ''' Trova il prossimo task da eseguire (compatibile con Motore.GetNextTask)
    ''' </summary>
    Public Function GetNextTask(taskInstance As TaskInstance) As TaskNode
        ' Crea uno stato temporaneo per trovare il prossimo task
        ' Nota: Questo è un workaround, idealmente GetNextTask dovrebbe essere stateless
        ' Per ora manteniamo compatibilità con l'API esistente
        Dim state As New ExecutionState()
        Dim tempEngine As New ServerlessEngine()

        ' Usa la logica interna di GetNextTaskInternal
        ' Nota: Questo richiede esporre GetNextTaskInternal come Public o creare un metodo helper
        ' Per ora, usiamo un approccio semplificato: chiamiamo ExecuteTaskStep fino a trovare un task
        ' TODO: Refactor per esporre GetNextTaskInternal come Public Shared method

        ' Workaround: usa reflection o esponi il metodo come Public
        ' Per ora, implementiamo la logica direttamente (copiata da Motore.GetNextTask)
        For Each mainTask As TaskNode In taskInstance.TaskList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            If IsTaskNodeEmpty(mainTask) Then
                Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected empty node: {mainTask.Id}")
                Return mainTask
            End If

            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(mainTask.State) Then
                Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected node: {mainTask.Id}, State={mainTask.State}")
                Return mainTask
            End If

            If mainTask.State = DialogueState.Success Then
                Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected node with Success state: {mainTask.Id} (will execute Success step)")
                Return mainTask
            End If

            For Each subTask As TaskNode In mainTask.SubTasks.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If IsTaskNodeEmpty(subTask) Then
                    Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected empty subTask: {subTask.Id}")
                    Return subTask
                End If
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(subTask.State) Then
                    Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected subTask: {subTask.Id}, State={subTask.State}")
                    Return subTask
                End If
                If subTask.State = DialogueState.Success Then
                    Console.WriteLine($"[ServerlessEngineFacade] 📍 Selected subTask with Success state: {subTask.Id} (will execute Success step)")
                    Return subTask
                End If
            Next
        Next

        Console.WriteLine($"[ServerlessEngineFacade] ✅ No more tasks to execute")
        Return Nothing
    End Function

    ''' <summary>
    ''' Aggiorna lo stato del task in base al risultato del parsing (compatibile con Motore.SetState)
    ''' </summary>
    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currTaskNode As TaskNode)
        _engine.SetState(parseResult, currentState, currTaskNode)
    End Sub

    ''' <summary>
    ''' Marca il task come acquisitionFailed (compatibile con Motore.MarkAsAcquisitionFailed)
    ''' </summary>
    Public Sub MarkAsAcquisitionFailed(currTaskNode As TaskNode)
        ' Nota: Nel motore attuale questa funzione è vuota, manteniamo lo stesso comportamento
    End Sub

    ''' <summary>
    ''' Resetta lo stato interno del motore (compatibile con Motore.Reset)
    ''' </summary>
    Public Sub Reset(Optional taskInstance As TaskInstance = Nothing)
        ' Nota: In ServerlessEngine non c'è stato interno da resettare
        ' Se fornita, resetta solo l'istanza Task
        If taskInstance IsNot Nothing Then
            taskInstance.Reset()
        End If
    End Sub
End Class

''' <summary>
''' Funzioni helper per TaskNode (duplicati da Utils.vb perché Utils è Friend)
''' </summary>
Module ServerlessEngineFacadeHelpers
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
End Module
