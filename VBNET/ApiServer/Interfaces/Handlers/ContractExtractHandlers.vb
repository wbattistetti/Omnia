' POST /api/nlp/contract-extract — single VB extraction engine for IDE simulator/debugger.
Option Strict On
Option Explicit On

Imports System.IO
Imports System.Threading.Tasks
Imports Microsoft.AspNetCore.Http
Imports Microsoft.AspNetCore.Mvc
Imports Newtonsoft.Json
Imports TaskEngine

''' <summary>
''' HTTP contract extraction using ParserExtraction (GrammarFlow → regex), same as runtime.
''' </summary>
Public Module ContractExtractHandlers

    Public Class ContractExtractRequest
        Public Property Text As String
        ''' <summary>JSON of CompiledNlpContract (engines, subDataMapping, patterns).</summary>
        Public Property ContractJson As String
        ''' <summary>True = multi-subId composite mapping; False = leaf (single nodeId validation path).</summary>
        Public Property Composite As Boolean
    End Class

    Public Async Function HandleContractExtract(context As HttpContext) As Task(Of IResult)
        Try
            Dim body As String
            Using reader As New StreamReader(context.Request.Body)
                body = Await reader.ReadToEndAsync()
            End Using

            If String.IsNullOrEmpty(body) Then
                Return Results.BadRequest(New With {.error = "Request body is required"})
            End If

            Dim request = JsonConvert.DeserializeObject(Of ContractExtractRequest)(body)
            If request Is Nothing OrElse String.IsNullOrEmpty(request.Text) Then
                Return Results.BadRequest(New With {.error = "text is required"})
            End If
            If String.IsNullOrEmpty(request.ContractJson) Then
                Return Results.BadRequest(New With {.error = "contractJson is required"})
            End If

            Dim contract = JsonConvert.DeserializeObject(Of CompiledNlpContract)(request.ContractJson)
            If contract Is Nothing Then
                Return Results.BadRequest(New With {.error = "Invalid contractJson"})
            End If

            Parser.EnsureCompiledMainRegex(contract)

            Dim minimal As New ContractMinimalParsableTask(contract)
            Dim values As Dictionary(Of String, Object)

            If request.Composite Then
                values = Parser.ExtractCompositeDictionary(request.Text, minimal)
            Else
                values = Parser.ExtractLeafDictionary(request.Text, minimal)
            End If

            Dim hasMatch = values IsNot Nothing AndAlso values.Count > 0
            Return Results.Ok(New With {
                .values = If(values, New Dictionary(Of String, Object)()),
                .hasMatch = hasMatch,
                .engine = "vb"
            })
        Catch ex As Exception
            Return Results.Problem(
                title:="Contract extraction failed",
                detail:=ex.Message,
                statusCode:=500)
        End Try
    End Function

    Private Class ContractMinimalParsableTask
        Implements IParsableTask

        Private ReadOnly _contract As CompiledNlpContract

        Public Sub New(contract As CompiledNlpContract)
            _contract = contract
        End Sub

        Public ReadOnly Property Id As String Implements IParsableTask.Id
            Get
                Return "contract-extract"
            End Get
        End Property

        Public ReadOnly Property NlpContract As CompiledNlpContract Implements IParsableTask.NlpContract
            Get
                Return _contract
            End Get
        End Property

        Public ReadOnly Property SubTasks As List(Of IParsableTask) Implements IParsableTask.SubTasks
            Get
                Return New List(Of IParsableTask)()
            End Get
        End Property

        Public Function HasSubTasks() As Boolean Implements IParsableTask.HasSubTasks
            Return False
        End Function
    End Class

End Module
