' DDTEngine.vb
' Classe principale del DDT Engine - Implementa Execute

Option Strict On
Option Explicit On

Imports System.IO
Imports System.Linq
Imports System.Reflection.PortableExecutable

''' <summary>
''' Classe principale del DDT Engine
''' Implementa la funzione Execute che coordina il processo di acquisizione dati
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
    ''' Funzione principale che coordina il processo di acquisizione di una serie di dati seguendo le regole di prompting: DDT (Data Dialogue Template)
    ''' </summary>
    Public Sub ExecuteDDT(ddtInstance As DDTInstance)
        Dim state As DialogueState = DialogueState.Start

        If ddtInstance.IsAggregate AndAlso ddtInstance.Introduction IsNot Nothing Then
            ExecuteResponse(ddtInstance.Introduction.Actions, Nothing, ddtInstance)
        End If

        While True
            Dim currDataNode As DDTNode = GetNextData(ddtInstance)

            If currDataNode Is Nothing Then Exit While  ' Tutti i dati completati o acquisitionFailed

            Dim actions = GetResponse(currDataNode)

            Dim isAterminationResponse As Boolean = ExecuteResponse(actions, currDataNode, ddtInstance)

            If isAterminationResponse Then
                ' Exit condition attivata: marca il dato come acquisitionFailed
                ' e continua se ce ne sono con altri dati (partial failure)
                MarkAsAcquisitionFailed(currDataNode)
                Continue While  ' GetNextData prenderà il prossimo dato
            End If

            ' Interpreta l'input utente (solo parsing, nessuna gestione di response)
            Dim parseResult As ParseResult = _parser.InterpretUtterance(currDataNode)

            ' Aggiorna lo stato basandosi sul risultato del parsing: il prossimo response dipenderà dallo stato
            SetState(parseResult, state, currDataNode)

        End While

        If ddtInstance.SuccessResponse IsNot Nothing Then
            ExecuteResponse(ddtInstance.SuccessResponse.Actions, Nothing, ddtInstance)
        End If
    End Sub


    ''' <summary>
    ''' lo step di dialogo dipende dallo stato di acquisizione del dato (start, noMatch, NoInput, ecc)
    ''' </summary>
    Private Function GetResponse(currDataNode As DDTNode) As IEnumerable(Of IAction)
        Dim dStep = currDataNode.Steps.FirstOrDefault(Function(s) s.Type = currDataNode.State)  'migliorare per gestore  validation conditions multiple

        Select Case currDataNode.State
            Case DialogueState.NoMatch, DialogueState.IrrelevantMatch, DialogueState.NoInput, DialogueState.NotConfirmed
                If Not dStep.Escalations?.Any Then
                    ' Fallback a Start
                    currDataNode.State = DialogueState.Start
                End If
        End Select

        Dim escalationCounter = GetEscalationCounter(dStep, currDataNode.State)
        Dim escalation = dStep.Escalations(escalationCounter)
        Return currDataNode.Steps.SingleOrDefault(Function(s) s.Type = currDataNode.State).Escalations(escalationCounter).Actions

    End Function

    ''' <summary>
    ''' Eseguire il response significa eseguire la serie di actions di cui è composto
    ''' </summary>
    Private Function ExecuteResponse(actions As IEnumerable(Of IAction), currDataNode As DDTNode, ddtInstance As DDTInstance) As Boolean

        For Each action As IAction In actions
            ' Passa un lambda che solleva l'evento MessageToShow
            action.Execute(currDataNode, ddtInstance, Sub(msg As String) RaiseEvent MessageToShow(Me, New MessageEventArgs(msg)))
        Next
        If currDataNode IsNot Nothing Then IncrementCounter(currDataNode) 'eccezione in caso si introduction o success di un aggregato

        ' Controlla se c'è una exit condition che rende il response un termination response
        Return Utils.HasExitCondition(actions)
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
    Private Sub IncrementCounter(dataNode As DDTNode)
        Dim dStep = dataNode.Steps.SingleOrDefault(Function(s) s.Type = dataNode.State)
        Dim escalationsCount As Integer = If(dStep.Escalations Is Nothing, 0, dStep.Escalations.Count)
        If Not _counters.ContainsKey(dataNode.State) Then
            _counters(dataNode.State) = 0
        End If
        _counters(dataNode.State) = Math.Min(_counters(dataNode.State) + 1, escalationsCount - 1)
    End Sub


    Private Function GetNextData(ddtInstance As DDTInstance) As DDTNode
        Dim allCandidates As New List(Of DDTNode)()

        For Each mainData As DDTNode In ddtInstance.MainDataList.Where(Function(dt) dt.State <> DialogueState.AcquisitionFailed)
            If mainData.IsEmpty Then Return mainData
            If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(mainData.State) Then Return mainData

            For Each subData As DDTNode In mainData.SubData.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If subData.IsEmpty Then Return subData
                If {DialogueState.Confirmation, DialogueState.Invalid, DialogueState.NoMatch, DialogueState.NoInput}.Contains(subData.State) Then Return subData
            Next
        Next
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

    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currDataNode As DDTNode)
        ' TODO: Implementare la logica completa basata su Motori.MD

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                'vedi summary

            Case ParseResultType.Match
                'vedi summary
                Dim ddtNode = currDataNode
                If ddtNode.IsSubData Then ddtNode = currDataNode.ParentData

                If ddtNode.IsFilled Then
                    ' Nota: se il currentNode è un subdata allora necessariamente il parentadata non era filled al turno precedente ma può esserlo diventato ora e se ne può chiedere la conferma
                    If ddtNode.RequiresConfirmation Then
                        ddtNode.State = DialogueState.Confirmation
                    ElseIf ddtNode.RequiresValidation Then
                        ddtNode.State = DialogueState.Invalid
                    Else
                        ddtNode.State = DialogueState.Success
                    End If
                Else
                    ' MainData parzialmente compilato: mantieni lo stato a Start
                    ' GetNextData restituirà il prossimo subData vuoto
                    ddtNode.State = DialogueState.Start
                End If

            Case ParseResultType.Confirmed
                If currDataNode.RequiresValidation Then
                    currDataNode.State = DialogueState.Invalid

                Else
                    currDataNode.State = DialogueState.Success
                End If

            Case ParseResultType.NotConfirmed
                currDataNode.State = DialogueState.NotConfirmed

            Case ParseResultType.NoMatch
                currDataNode.State = DialogueState.NoMatch

            Case ParseResultType.NoInput
                currDataNode.State = DialogueState.NoInput

            Case ParseResultType.IrrelevantMatch
                currDataNode.State = DialogueState.IrrelevantMatch

            Case Else
                Debug.Assert(False, "Stato non gestito")
                'non cambia lo stato ma non dovrebbe mai arrivare qui
        End Select
    End Sub

    ''' <summary>
    ''' Marca il dato come acquisitionFailed
    ''' </summary>
    Public Sub MarkAsAcquisitionFailed(currDataNode As DDTNode)
        'currDataNode.State = DataState.AcquisitionFailed
    End Sub

    ''' <summary>
    ''' Resetta lo stato interno del motore (contatori) e tutti i valori dell'istanza DDT.
    ''' </summary>
    ''' <param name="ddtInstance">Istanza DDT da resettare (opzionale). Se Nothing, resetta solo i contatori interni.</param>
    Public Sub Reset(Optional ddtInstance As DDTInstance = Nothing)
        ' Resetta i contatori interni del motore
        _counters.Clear()
        _maxRecovery.Clear()

        ' Se fornita, resetta anche tutti i valori dell'istanza DDT
        If ddtInstance IsNot Nothing Then
            ddtInstance.Reset()
        End If
    End Sub

End Class

