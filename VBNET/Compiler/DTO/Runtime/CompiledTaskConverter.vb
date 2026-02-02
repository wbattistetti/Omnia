Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

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
        ' ❌ ERRORE BLOCCANTE: TaskType OBBLIGATORIO, nessun fallback
        Dim taskTypeToken = jObject("TaskType")
        If taskTypeToken Is Nothing Then
            Throw New JsonException("Missing 'TaskType' field in CompiledTask JSON. TaskType is mandatory and cannot be missing.")
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
                task = New CompiledSayMessageTask()
            Case TaskTypes.UtteranceInterpretation
                task = New CompiledUtteranceTask()
            Case TaskTypes.ClassifyProblem
                task = New CompiledClassifyProblemTask()
            Case TaskTypes.BackendCall
                task = New CompiledBackendCallTask()
            Case TaskTypes.CloseSession
                task = New CompiledCloseSessionTask()
            Case TaskTypes.Transfer
                task = New CompiledTransferTask()
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
        ' ❌ ERRORE BLOCCANTE: templateId OBBLIGATORIO, nessun fallback
        If String.IsNullOrEmpty(templateId) Then
            Throw New JsonException("templateId cannot be null or empty when converting to TaskType. templateId is mandatory.")
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
                ' ❌ ERRORE BLOCCANTE: tipo sconosciuto, nessun fallback
                Throw New JsonException($"Unknown templateId: '{templateId}'. Cannot convert to TaskType. Every templateId must map to a valid TaskType.")
        End Select
    End Function
End Class

