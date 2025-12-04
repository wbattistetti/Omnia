' DDTEngine.vb
' Classe principale del DDT Engine - Implementa Execute

Option Strict On
Option Explicit On

Imports System.Linq

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
    ''' Funzione principale che coordina il processo di acquisizione dati
    ''' Basata su: documentation/Motori.MD - Funzione Execute
    ''' </summary>
    Public Sub Execute(ddtInstance As DDTInstance)
        Dim state As DialogueState = DialogueState.Start

        ' Mostra introduction se presente
        If ddtInstance.IsAggregate AndAlso ddtInstance.Introduction IsNot Nothing Then
            ExecuteResponse(ddtInstance.Introduction.Actions, Nothing, ddtInstance)
        End If

        ' Ciclo principale
        While True
            Dim currDataNode As DDTNode = GetNextData(ddtInstance)

            ' Tutti i dati completati o acquisitionFailed
            If currDataNode Is Nothing Then Exit While

            Dim actions = GetResponse(currDataNode)

            Dim termination As Boolean = ExecuteResponse(actions, currDataNode, ddtInstance)

            If termination Then
                ' Exit condition attivata: marca il dato come acquisitionFailed
                ' e continua se ce ne sono con altri dati (partial failure)
                MarkAsAcquisitionFailed(currDataNode)
                Continue While  ' GetNextData prenderà il prossimo dato
            End If

            ' Interpreta l'input utente (solo parsing, nessuna gestione di response)
            Dim parseResult As ParseResult = _parser.InterpretUtterance(currDataNode)

            ' Aggiorna lo stato basandosi sul risultato del parsing
            ' SetState gestisce sia lo stato del dialogo che lo stato del dato
            SetState(parseResult, state, currDataNode)

        End While

        ' Dopo l'uscita dal ciclo: se esiste un success response a livello di DDT, eseguilo
        If ddtInstance.SuccessResponse IsNot Nothing Then
            ExecuteResponse(ddtInstance.SuccessResponse.Actions, Nothing, ddtInstance)
        End If
    End Sub

    ''' <summary>
    ''' Ottiene il response corretto in base allo stato e al counter
    ''' Ritorna sempre un response (mai null)
    ''' </summary>
    'Private Function GetResponse(currDataNode As DDTNode, state As DialogueState) As Response
    '    ' Trova lo step corrispondente allo stato
    '    Dim dStep As DialogueStep = currDataNode.Steps.FirstOrDefault(Function(s) s.Type = state)
    '    Dim currentState As DialogueState = state

    '    ' Gestione fallback per stati specifici
    '    If dStep Is Nothing OrElse dStep.Escalations Is Nothing OrElse dStep.Escalations.Count = 0 Then
    '        Select Case state
    '            Case DialogueState.NoMatch, DialogueState.IrrelevantMatch, DialogueState.NoInput, DialogueState.NotConfirmed
    '                ' Fallback a Start
    '                currentState = DialogueState.Start
    '                dStep = currDataNode.Steps.FirstOrDefault(Function(s) s.Type = currentState)

    '            Case DialogueState.Confirmation, DialogueState.Success
    '                ' Se non c'è response di confirmation/success, ritorna Nothing (termination)
    '                Return Nothing

    '            Case DialogueState.Invalid
    '                ' Fallback a Start per invalid
    '                currentState = DialogueState.Start
    '                dStep = currDataNode.Steps.FirstOrDefault(Function(s) s.Type = currentState)
    '        End Select
    '    End If

    '    ' Se ancora non c'è step dopo fallback, ritorna termination response
    '    If dStep Is Nothing OrElse dStep.Escalations Is Nothing OrElse dStep.Escalations.Count = 0 Then
    '        Return CreateTerminationResponse("noMoreAttempts")
    '    End If

    '    ' Crop counter a maxRecovery e array length
    '    Dim counter As Integer = GetCounter(currentState)
    '    Dim maxRecoveryValue As Integer = GetMaxRecovery(currentState)
    '    Dim maxCounter As Integer = Math.Min(maxRecoveryValue, dStep.Escalations.Count - 1)
    '    counter = Math.Min(counter, maxCounter)

    '    ' Ottieni l'escalation al counter corrente
    '    Dim escalation As Escalation = dStep.Escalations(counter)
    '    If escalation Is Nothing OrElse escalation.Actions Is Nothing Then
    '        Return CreateTerminationResponse("noMoreAttempts")
    '    End If

    '    ' Crea un Response con le Actions dell'escalation
    '    Dim response As New Response()
    '    response.Actions = escalation.Actions.ToList()
    '    Return response
    'End Function
    Private Function GetResponse(currDataNode As DDTNode) As IEnumerable(Of IAction)
        Dim dStep As DialogueStep = currDataNode.Steps.FirstOrDefault(Function(s) s.Type = currDataNode.State)

        Dim counter As Integer = GetCounter(currDataNode, currDataNode.State)

        Dim escalation As Escalation = dStep.Escalations(counter)
        ' Gestione fallback per stati specifici
        Select Case currDataNode.State
            Case DialogueState.NoMatch, DialogueState.IrrelevantMatch, DialogueState.NoInput, DialogueState.NotConfirmed
                If Not dStep.Escalations?.Any Then
                    ' Fallback a Start
                    currDataNode.State = DialogueState.Start
                End If
            Case DialogueState.Confirmation

            Case DialogueState.Invalid
                ' Fallback a Start per invalid
                currDataNode.State = DialogueState.Start
        End Select
        Return currDataNode.Steps.SingleOrDefault(Function(s) s.Type = currDataNode.State).Escalations(counter).Actions
    End Function

    ''' <summary>
    ''' Esegue il response (esegue azioni, incrementa counter)
    ''' Chiama direttamente Execute su ogni action
    ''' </summary>
    Private Function ExecuteResponse(actions As IEnumerable(Of IAction), currDataNode As DDTNode, ddtInstance As DDTInstance) As Boolean

        For Each action As IAction In actions
            ' Chiama direttamente Execute sull'action
            ' Passa un lambda che solleva l'evento MessageToShow
            action.Execute(currDataNode, ddtInstance, Sub(msg As String) RaiseEvent MessageToShow(Me, New MessageEventArgs(msg)))
        Next
        If currDataNode IsNot Nothing Then IncrementCounter(currDataNode) 'eccezione in caso si introduction o success di un aggregato

        ' Controlla se c'è una exit condition
        Return Utils.HasExitCondition(actions)
    End Function

    ''' <summary>
    ''' Ottiene il counter per il dialogue step dello stato
    ''' </summary>
    Private Function GetCounter(dataNode As DDTNode, state As DialogueState) As Integer
        Dim dStep = dataNode.Steps.SingleOrDefault(Function(s) s.Type = state)
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
            If mainData.State = DialogueState.Confirmation Then Return mainData
            If mainData.State = DialogueState.Invalid Then Return mainData
            If mainData.State = DialogueState.NoMatch Then Return mainData
            If mainData.State = DialogueState.NoInput Then Return mainData

            For Each subData As DDTNode In mainData.SubData.Where(Function(st) st.State <> DialogueState.AcquisitionFailed)
                If subData.IsEmpty Then Return subData
                If subData.State = DialogueState.Confirmation Then Return subData
                If subData.State = DialogueState.Invalid Then Return subData
                If subData.State = DialogueState.NoMatch Then Return subData
                If subData.State = DialogueState.NoInput Then Return subData
            Next
        Next
        Return Nothing
    End Function

    Public Sub SetState(parseResult As ParseResult, currentState As DialogueState, currDataNode As DDTNode)
        ' TODO: Implementare la logica completa basata su Motori.MD

        Select Case parseResult.Result
            Case ParseResultType.Corrected
                'non cambia lo stato richiede la conferma per il valore corretto
            Case ParseResultType.Match
                If currDataNode.ParentData IsNot Nothing AndAlso currDataNode.ParentData.IsFilled Then
                    ' Nota: se il currentNode è un subdata allora necessariamente il parentadata non era filled al turno precedente ma può esserlo diventato ora e se ne può chiedere la conferma
                    If currDataNode.ParentData.RequiresConfirmation Then
                        currDataNode.ParentData.State = DialogueState.Confirmation
                    ElseIf currDataNode.ParentData.RequiresValidation Then
                        currDataNode.ParentData.State = DialogueState.Invalid
                    Else
                        currDataNode.ParentData.State = DialogueState.Success
                    End If
                Else
                    ' Se è un mainData composito, controlla se è completamente filled
                    ' Se non è filled, lascia lo stato a Start così che GetNextData possa restituire il prossimo subData vuoto
                    If currDataNode.IsFilled Then
                        If currDataNode.RequiresConfirmation Then
                            currDataNode.State = DialogueState.Confirmation
                        ElseIf currDataNode.RequiresValidation Then
                            currDataNode.State = DialogueState.Invalid
                        Else
                            currDataNode.State = DialogueState.Success
                        End If
                    Else
                        ' MainData parzialmente compilato: mantieni lo stato a Start
                        ' GetNextData restituirà il prossimo subData vuoto
                        currDataNode.State = DialogueState.Start
                    End If
                End If

            Case ParseResultType.Confirmed
                If currDataNode.RequiresValidation Then
                    currDataNode.State = DialogueState.Invalid

                Else
                    currDataNode.State = DialogueState.Success
                End If

            'Case ParseResultType.Validated
            '    currDataNode.State = DataState.Validated
            '    Return DialogueState.Success

            'Case ParseResultType.Invalid
            '    ' TODO: Gestire invalid
            '    Return DialogueState.Invalid

            'Case ParseResultType.NotConfirmed
            '    ' TODO: Gestire not confirmed
            '    Return DialogueState.NotConfirmed

            Case ParseResultType.NoMatch
                currDataNode.State = DialogueState.NoMatch
            Case ParseResultType.NoInput
                currDataNode.State = DialogueState.NoInput
                ' Nessun match o input vuoto

            Case ParseResultType.IrrelevantMatch
                'Return DialogueState.IrrelevantMatch

            Case Else
                'Return currentState
        End Select
    End Sub

    ''' <summary>
    ''' Marca il dato come acquisitionFailed
    ''' </summary>
    Public Sub MarkAsAcquisitionFailed(currDataNode As DDTNode)
        'currDataNode.State = DataState.AcquisitionFailed
    End Sub

    ''' <summary>
    ''' Resetta lo stato interno del motore (contatori, ecc.)
    ''' </summary>
    Public Sub Reset()
        _counters.Clear()
        _maxRecovery.Clear()
    End Sub

End Class

