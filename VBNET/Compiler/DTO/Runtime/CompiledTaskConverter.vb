Option Strict On
Option Explicit On

Imports System
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine
Imports System.Collections.Generic

''' <summary>
''' JsonConverter per deserializzare CompiledTask polimorfico
''' Legge il campo "templateId" (enum) e crea la classe specifica
''' </summary>
Public Class CompiledTaskConverter
    Inherits JsonConverter

    Public Overrides ReadOnly Property CanWrite As Boolean
        Get
            Return False ' Solo lettura, scrittura usa serializzazione standard
        End Get
    End Property

    Public Overrides Function CanConvert(objectType As Type) As Boolean
        Return GetType(CompiledTask).IsAssignableFrom(objectType)
    End Function

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As Object, serializer As JsonSerializer) As Object
        If reader.TokenType = JsonToken.Null Then
            Return Nothing
        End If

        ' Carica il JSON in un JObject
        Dim jObject As JObject = JObject.Load(reader)

        ' Estrai il TaskType e convertilo in enum
        ' ✅ FIX: Cerca "TaskType" invece di "templateId"
        Dim taskTypeToken = jObject("TaskType")
        If taskTypeToken Is Nothing Then
            ' Fallback: prova con "templateId" per compatibilità
            taskTypeToken = jObject("templateId")
        End If

        If taskTypeToken Is Nothing Then
            Throw New JsonException("Missing 'TaskType' or 'templateId' field in CompiledTask JSON")
        End If

        Dim taskType As TaskTypes
        If taskTypeToken.Type = JTokenType.Integer Then
            ' Già un enum numerato
            taskType = CType(taskTypeToken.Value(Of Integer)(), TaskTypes)
        ElseIf taskTypeToken.Type = JTokenType.String Then
            ' Stringa da convertire
            taskType = ConvertStringToTaskType(taskTypeToken.Value(Of String)())
        Else
            Throw New JsonException($"Invalid TaskType type: {taskTypeToken.Type}")
        End If

        ' Crea l'istanza specifica in base al tipo
        Dim task As CompiledTask
        Select Case taskType
            Case TaskTypes.SayMessage
                task = New CompiledTaskSayMessage()
            Case TaskTypes.UtteranceInterpretation
                task = New CompiledTaskGetData()
            Case TaskTypes.ClassifyProblem
                task = New CompiledTaskClassifyProblem()
            Case TaskTypes.BackendCall
                task = New CompiledTaskBackendCall()
            Case TaskTypes.CloseSession
                task = New CompiledTaskCloseSession()
            Case TaskTypes.Transfer
                task = New CompiledTaskTransfer()
            Case Else
                Throw New JsonException($"Unknown TaskType: {taskType}")
        End Select

        ' ✅ Usa serializer.Populate per popolare TUTTI i campi automaticamente
        '    Questo legge tutte le proprietà dal JSON e le assegna alle proprietà dell'oggetto
        serializer.Populate(jObject.CreateReader(), task)

        Return task
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As Object, serializer As JsonSerializer)
        Throw New NotImplementedException("Use default serialization for writing")
    End Sub

    ''' <summary>
    ''' Converte templateId string in TaskTypes enum
    ''' </summary>
    Private Function ConvertStringToTaskType(templateId As String) As TaskTypes
        If String.IsNullOrEmpty(templateId) Then
            Return TaskTypes.SayMessage
        End If

        Dim normalized = templateId.Trim().ToLower()

        Select Case normalized
            Case "saymessage", "message"
                Return TaskTypes.SayMessage
            Case "closesession", "closesessionaction"
                Return TaskTypes.CloseSession
            Case "transfer"
                Return TaskTypes.Transfer
            Case "utteranceinterpretation", "interpretutterance"
                Return TaskTypes.UtteranceInterpretation
            Case "backendcall", "callbackend", "readfrombackend", "writetobackend"
                Return TaskTypes.BackendCall
            Case "classifyproblem", "problemclassification"
                Return TaskTypes.ClassifyProblem
            Case Else
                Console.WriteLine($"⚠️ [CompiledTaskConverter] Unknown templateId: '{templateId}', defaulting to SayMessage")
                Return TaskTypes.SayMessage
        End Select
    End Function
End Class

