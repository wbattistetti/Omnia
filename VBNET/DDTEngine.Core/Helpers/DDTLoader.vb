' DDTLoader.vb
' Helper per caricare DDTInstance da JSON

Option Strict On
Option Explicit On

Imports System.IO
Imports System.Text.Json

    ''' <summary>
    ''' Helper per caricare DDTInstance da file JSON
    ''' </summary>
    Public Class DDTLoader
        ''' <summary>
        ''' Carica un DDTInstance da un file JSON
        ''' </summary>
        Public Shared Function LoadFromJson(filePath As String) As DDTInstance
            If Not File.Exists(filePath) Then
                Throw New FileNotFoundException("File JSON non trovato: " & filePath)
            End If

            Dim jsonText As String = File.ReadAllText(filePath)

            ' Opzioni per la deserializzazione (case-insensitive, permette commenti)
            Dim options As New JsonSerializerOptions() With {
                .PropertyNameCaseInsensitive = True,
                .ReadCommentHandling = JsonCommentHandling.Skip,
                .AllowTrailingCommas = True
            }

            Dim dto As DDTInstanceDTO = JsonSerializer.Deserialize(Of DDTInstanceDTO)(jsonText, options)

            If dto Is Nothing Then
                Throw New InvalidOperationException("Impossibile deserializzare il JSON")
            End If

            Return ConvertDTOToInstance(dto)
        End Function

        ''' <summary>
        ''' Converte DTO in DDTInstance, trasformando "text" in MessageAction
        ''' </summary>
        Private Shared Function ConvertDTOToInstance(dto As DDTInstanceDTO) As DDTInstance
            Dim instance As New DDTInstance() With {
                .IsAggregate = dto.IsAggregate,
                .Introduction = ConvertResponseDTO(dto.Introduction),
                .SuccessResponse = ConvertResponseDTO(dto.SuccessResponse),
                .MainDataList = New List(Of DDTNode)()
            }

            ' Converti tutti i mainData
            If dto.MainData IsNot Nothing Then
                For Each mainDataDTO As DDTNodeDTO In dto.MainData
                instance.MainDataList.Add(ConvertNodeDTO(mainDataDTO, Nothing))
            Next
            End If

            Return instance
        End Function

        ''' <summary>
        ''' Converte ResponseDTO in Response, trasformando "text" in MessageAction
        ''' </summary>
        Private Shared Function ConvertResponseDTO(dto As ResponseDTO) As Response
            If dto Is Nothing Then
                Return Nothing
            End If

            Dim response As New Response()

            ' Se c'è "text", crea una MessageAction
            If Not String.IsNullOrEmpty(dto.Text) Then
                response.Actions.Add(New MessageAction(dto.Text))
            End If

            ' Se ci sono già "actions" nel JSON (per compatibilità futura)
            ' TODO: Implementare conversione di altre action types se necessario

            Return response
        End Function

    ''' <summary>
    ''' Converte DDTNodeDTO in DDTNode
    ''' </summary>
    Private Shared Function ConvertNodeDTO(dto As DDTNodeDTO, parentNode As DDTNode) As DDTNode
        Dim node As New DDTNode() With {
                .Id = dto.Id,
                .Name = dto.Name,
                .ParentData = parentNode,
                .Required = dto.Required,
                .RequiresConfirmation = dto.RequiresConfirmation,
                .RequiresValidation = dto.RequiresValidation,
                .ValidationConditions = If(dto.ValidationConditions, New List(Of ValidationCondition)()),
                .SubData = New List(Of DDTNode)(),
                .Steps = New List(Of DialogueStep)()
            }

        ' Converti subData
        If dto.SubData IsNot Nothing Then
            For Each subDataDTO As DDTNodeDTO In dto.SubData
                node.SubData.Add(ConvertNodeDTO(subDataDTO, node))
            Next
        End If

        ' Converti steps (nuova struttura) o responses (vecchia struttura per compatibilità)
        If dto.Steps IsNot Nothing AndAlso dto.Steps.Count > 0 Then
            ' Usa la nuova struttura steps
            For Each stepDTO As DialogueStepDTO In dto.Steps
                node.Steps.Add(ConvertStepDTO(stepDTO))
            Next
        ElseIf dto.Responses IsNot Nothing AndAlso dto.Responses.Count > 0 Then
            ' Converti la vecchia struttura responses in steps
            For Each kvp As KeyValuePair(Of String, List(Of ResponseDTO)) In dto.Responses
                Dim stepType As DialogueState = ConvertStringToDialogueState(kvp.Key)
                Dim escalations = New List(Of Escalation)
                Dim dialogueStep As New DialogueStep() With {
                        .Type = stepType,
                        .Escalations = New List(Of Escalation)()
                    }

                ' Converti ogni response in escalation
                For Each responseDTO As ResponseDTO In kvp.Value
                    Dim escalation As New Escalation() With {
                            .EscalationId = "",
                            .Actions = New List(Of IAction)()
                        }

                    ' Se c'è "text", crea una MessageAction
                    If Not String.IsNullOrEmpty(responseDTO.Text) Then
                        escalation.Actions.Add(New MessageAction(responseDTO.Text))
                    End If

                    dialogueStep.Escalations.Add(escalation)
                Next

                node.Steps.Add(dialogueStep)
            Next
        End If

        Return node
    End Function

    ''' <summary>
    ''' Converte una stringa in DialogueState enum
    ''' </summary>
    Private Shared Function ConvertStringToDialogueState(stateStr As String) As DialogueState
            If String.IsNullOrEmpty(stateStr) Then
                Return DialogueState.Start
            End If

            Dim typeStr As String = stateStr.ToLower()
            Select Case typeStr
                Case "start"
                    Return DialogueState.Start
                Case "nomatch"
                    Return DialogueState.NoMatch
                Case "noinput"
                    Return DialogueState.NoInput
                Case "confirmation"
                    Return DialogueState.Confirmation
                Case "notconfirmed"
                    Return DialogueState.NotConfirmed
                Case "invalid"
                    Return DialogueState.Invalid
                Case "success"
                    Return DialogueState.Success
                Case "irrelevantmatch"
                    Return DialogueState.IrrelevantMatch
                Case Else
                    Return DialogueState.Start ' Default fallback
            End Select
        End Function

        ''' <summary>
        ''' Converte DialogueStepDTO in DialogueStep
        ''' </summary>
        Private Shared Function ConvertStepDTO(dto As DialogueStepDTO) As DialogueStep
            Dim dialogueStep As New DialogueStep()

            ' Converti type string in DialogueState enum
            If Not String.IsNullOrEmpty(dto.Type) Then
                Dim typeStr As String = dto.Type.ToLower()
                Select Case typeStr
                    Case "start"
                        dialogueStep.Type = DialogueState.Start
                    Case "nomatch"
                        dialogueStep.Type = DialogueState.NoMatch
                    Case "noinput"
                        dialogueStep.Type = DialogueState.NoInput
                    Case "confirmation"
                        dialogueStep.Type = DialogueState.Confirmation
                    Case "notconfirmed"
                        dialogueStep.Type = DialogueState.NotConfirmed
                    Case "invalid"
                        dialogueStep.Type = DialogueState.Invalid
                    Case "success"
                        dialogueStep.Type = DialogueState.Success
                    Case "irrelevantmatch"
                        dialogueStep.Type = DialogueState.IrrelevantMatch
                    Case Else
                        dialogueStep.Type = DialogueState.Start ' Default fallback
                End Select
            End If

            ' Converti escalations
            If dto.Escalations IsNot Nothing Then
                For Each escalationDTO As EscalationDTO In dto.Escalations
                    dialogueStep.Escalations.Add(ConvertEscalationDTO(escalationDTO))
                Next
            End If

            Return dialogueStep
        End Function

        ''' <summary>
        ''' Converte EscalationDTO in Escalation
        ''' </summary>
        Private Shared Function ConvertEscalationDTO(dto As EscalationDTO) As Escalation
            Dim escalation As New Escalation() With {
                .EscalationId = If(dto.EscalationId, ""),
                .Actions = New List(Of IAction)()
            }

            ' Converti actions
            If dto.Actions IsNot Nothing Then
                For Each actionObj As Object In dto.Actions
                    ' TODO: Implementare conversione completa delle actions dal JSON
                    ' Per ora, se è un oggetto con "actionId" e "parameters", crea MessageAction
                    ' Questo è un placeholder - va implementato correttamente
                    Dim actionDict As Dictionary(Of String, Object) = TryCast(actionObj, Dictionary(Of String, Object))
                    If actionDict IsNot Nothing AndAlso actionDict.ContainsKey("actionId") Then
                        Dim actionId As String = actionDict("actionId").ToString()
                        If actionId = "sayMessage" OrElse actionId = "askQuestion" Then
                            ' Cerca il parametro "text"
                            If actionDict.ContainsKey("parameters") Then
                                Dim paramsList As List(Of Object) = TryCast(actionDict("parameters"), List(Of Object))
                                If paramsList IsNot Nothing Then
                                    For Each paramObj As Object In paramsList
                                        Dim paramDict As Dictionary(Of String, Object) = TryCast(paramObj, Dictionary(Of String, Object))
                                        If paramDict IsNot Nothing AndAlso paramDict.ContainsKey("parameterId") AndAlso paramDict("parameterId").ToString() = "text" Then
                                            Dim textValue As String = If(paramDict.ContainsKey("value"), paramDict("value").ToString(), "")
                                            If Not String.IsNullOrEmpty(textValue) Then
                                                escalation.Actions.Add(New MessageAction(textValue))
                                            End If
                                        End If
                                    Next
                                End If
                            End If
                        End If
                    End If
                Next
            End If

            Return escalation
        End Function
    End Class

