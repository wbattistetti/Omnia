Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports DDTEngine

''' <summary>
''' DDTAssembler: trasforma strutture IDE (AssembledDDT) in strutture Runtime (DDTInstance)
''' Responsabilità:
''' - Mappare campi uno a uno
''' - Normalizzare cardinalità (mainData singolo → MainDataList)
''' - Convertire tipi (StepGroup → DialogueStep)
''' - Gestire default e validazioni
''' </summary>
Public Class DDTAssembler

    ''' <summary>
    ''' Trasforma AssembledDDT (IDE) in DDTInstance (Runtime)
    ''' </summary>
    Public Function ToRuntime(assembled As Compiler.AssembledDDT) As DDTInstance
        If assembled Is Nothing Then
            Throw New ArgumentNullException(NameOf(assembled), "AssembledDDT cannot be Nothing")
        End If

        Dim instance As New DDTInstance() With {
            .Id = assembled.Id,
            .Label = assembled.Label,
            .Translations = If(assembled.Translations, New Dictionary(Of String, String)()),
            .MainDataList = New List(Of DDTNode)(),
            .IsAggregate = (assembled.Introduction IsNot Nothing)
        }

        ' ✅ FIX: mainData è ora sempre una lista (normalizzata dal converter)
        ' Gestisce sia oggetto singolo che array
        If assembled.MainData IsNot Nothing Then
            For Each mainDataNode In assembled.MainData
                If mainDataNode IsNot Nothing Then
                    Dim mainNode = ConvertNode(mainDataNode, Nothing)
                    instance.MainDataList.Add(mainNode)
                End If
            Next
        End If

        ' Converti Introduction (StepGroup → Response)
        If assembled.Introduction IsNot Nothing Then
            instance.Introduction = ConvertStepGroupToResponse(assembled.Introduction)
        End If

        ' Calcola FullLabel per tutti i nodi (compile-time)
        CalculateFullLabels(instance)

        Return instance
    End Function

    ''' <summary>
    ''' Converte MainDataNode (IDE) in DDTNode (Runtime)
    ''' </summary>
    Private Function ConvertNode(ideNode As Compiler.MainDataNode, parentNode As DDTNode) As DDTNode
        Dim runtimeNode As New DDTNode() With {
            .Id = ideNode.Id,
            .Name = ideNode.Name,
            .Label = ideNode.Label,
            .Type = ideNode.Type,
            .Required = ideNode.Required,
            .Condition = ideNode.Condition,
            .Synonyms = If(ideNode.Synonyms, New List(Of String)()),
            .Constraints = If(ideNode.Constraints, New List(Of Object)()),
            .Steps = New List(Of DialogueStep)(),
            .SubData = New List(Of DDTNode)(),
            .State = DialogueState.Start,
            .Value = Nothing,
            .ParentData = parentNode
        }

        ' Converti Steps (StepGroup[] → DialogueStep[])
        If ideNode.Steps IsNot Nothing Then
            For Each stepGroup As Compiler.StepGroup In ideNode.Steps
                runtimeNode.Steps.Add(ConvertStepGroup(stepGroup))
            Next
        End If

        ' Converti SubData (ricorsivo)
        If ideNode.SubData IsNot Nothing Then
            For Each subNode As Compiler.MainDataNode In ideNode.SubData
                runtimeNode.SubData.Add(ConvertNode(subNode, runtimeNode))
            Next
        End If

        Return runtimeNode
    End Function

    ''' <summary>
    ''' Converte StepGroup (IDE) in DialogueStep (Runtime)
    ''' </summary>
    Private Function ConvertStepGroup(stepGroup As Compiler.StepGroup) As DialogueStep
        Dim dialogueStep As New DialogueStep() With {
            .Type = ConvertStepType(stepGroup.Type),
            .Escalations = New List(Of DDTEngine.Escalation)()
        }

        ' Converti Escalations (IDE.Escalation → DDTEngine.Escalation)
        If stepGroup.Escalations IsNot Nothing Then
            For Each ideEscalation As Compiler.Escalation In stepGroup.Escalations
                dialogueStep.Escalations.Add(ConvertEscalation(ideEscalation))
            Next
        End If

        Return dialogueStep
    End Function

    ''' <summary>
    ''' Converte stringa step type in DialogueState enum
    ''' </summary>
    Private Function ConvertStepType(typeStr As String) As DialogueState
        If String.IsNullOrEmpty(typeStr) Then
            Return DialogueState.Start
        End If

        Select Case typeStr.ToLower()
            Case "start"
                Return DialogueState.Start
            Case "nomatch"
                Return DialogueState.NoMatch
            Case "noinput"
                Return DialogueState.NoInput
            Case "confirmation"
                Return DialogueState.Confirmation
            Case "success"
                Return DialogueState.Success
            Case "introduction"
                Return DialogueState.Start
            Case Else
                Return DialogueState.Start
        End Select
    End Function

    ''' <summary>
    ''' Converte Escalation (IDE) in Escalation (Runtime)
    ''' </summary>
    Private Function ConvertEscalation(ideEscalation As Compiler.Escalation) As DDTEngine.Escalation
        Dim runtimeEscalation As New DDTEngine.Escalation() With {
            .EscalationId = ideEscalation.EscalationId,
            .Actions = New List(Of IAction)()
        }

        ' Converti Actions (Action[] → IAction[])
        If ideEscalation.Actions IsNot Nothing Then
            For Each ideAction As Compiler.Action In ideEscalation.Actions
                Dim runtimeAction = ConvertAction(ideAction)
                If runtimeAction IsNot Nothing Then
                    runtimeEscalation.Actions.Add(runtimeAction)
                End If
            Next
        End If

        Return runtimeEscalation
    End Function

    ''' <summary>
    ''' Converte Action (IDE) in IAction (Runtime)
    ''' </summary>
    Private Function ConvertAction(ideAction As Compiler.Action) As IAction
        ' Gestisci sayMessage e askQuestion
        If ideAction.ActionId = "sayMessage" OrElse ideAction.ActionId = "askQuestion" Then
            Dim textParam = ideAction.Parameters?.FirstOrDefault(Function(p) p.ParameterId = "text")
            If textParam IsNot Nothing Then
                Return New MessageAction(textParam.Value)
            End If
        End If

        ' TODO: Gestire altri tipi di Action (CloseSessionAction, TransferAction, etc.)

        Return Nothing
    End Function

    ''' <summary>
    ''' Converte StepGroup in Response (per Introduction)
    ''' </summary>
    Private Function ConvertStepGroupToResponse(stepGroup As Compiler.StepGroup) As Response
        Dim response As New Response()

        ' Prendi la prima escalation del primo step
        If stepGroup.Escalations IsNot Nothing AndAlso stepGroup.Escalations.Count > 0 Then
            Dim firstEscalation = stepGroup.Escalations(0)
            If firstEscalation.Actions IsNot Nothing Then
                For Each ideAction As Compiler.Action In firstEscalation.Actions
                    Dim runtimeAction = ConvertAction(ideAction)
                    If runtimeAction IsNot Nothing Then
                        response.Actions.Add(runtimeAction)
                    End If
                Next
            End If
        End If

        Return response
    End Function

    ''' <summary>
    ''' Calcola FullLabel per tutti i nodi (compile-time)
    ''' </summary>
    Private Sub CalculateFullLabels(instance As DDTInstance)
        If instance.MainDataList IsNot Nothing Then
            For Each mainData As DDTNode In instance.MainDataList
                CalculateFullLabelForNode(mainData, "")
            Next
        End If
    End Sub

    ''' <summary>
    ''' Calcola FullLabel ricorsivamente per un nodo
    ''' </summary>
    Private Sub CalculateFullLabelForNode(node As DDTNode, parentPath As String)
        Dim currentPath As String
        If String.IsNullOrEmpty(parentPath) Then
            currentPath = node.Name
        Else
            currentPath = $"{parentPath}.{node.Name}"
        End If

        node.FullLabel = currentPath

        ' Ricorsivo per subData
        If node.SubData IsNot Nothing Then
            For Each subNode As DDTNode In node.SubData
                CalculateFullLabelForNode(subNode, currentPath)
            Next
        End If
    End Sub
End Class

