Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

''' <summary>
''' JsonConverter per deserializzare ITask polimorfico
''' Determina il tipo concreto in base ai campi presenti nel JSON
''' </summary>
Public Class ITaskConverter
    Inherits JsonConverter

    Public Overrides ReadOnly Property CanWrite As Boolean
        Get
            Return False ' Solo lettura, scrittura usa serializzazione standard
        End Get
    End Property

    Public Overrides Function CanConvert(objectType As Type) As Boolean
        Return GetType(ITask).IsAssignableFrom(objectType)
    End Function

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As Object, serializer As JsonSerializer) As Object
        If reader.TokenType = JsonToken.Null Then
            Return Nothing
        End If

        ' Carica il JSON in un JObject
        Dim jObject As JObject = JObject.Load(reader)

        ' Determina il tipo concreto in base ai campi presenti
        Dim task As ITask = Nothing

        ' ✅ PRIORITÀ 1: Usa campo "type" (numero) se presente (dal frontend)
        Dim typeToken = jObject("type")
        If typeToken IsNot Nothing AndAlso typeToken.Type = JTokenType.Integer Then
            Dim typeValue = typeToken.Value(Of Integer)()
            If [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
                Dim taskType = CType(typeValue, TaskTypes)
                Select Case taskType
                    Case TaskTypes.SayMessage
                        ' ✅ Estrai textKey da "text", "TextKey" o "parameters[0].value" (se parameterId === "text")
                        Dim textKey As String = ""
                        If jObject("text") IsNot Nothing Then
                            textKey = jObject("text").Value(Of String)()
                        ElseIf jObject("TextKey") IsNot Nothing Then
                            textKey = jObject("TextKey").Value(Of String)()
                        ElseIf jObject("parameters") IsNot Nothing AndAlso jObject("parameters").Type = JTokenType.Array Then
                            ' ✅ Cerca in parameters array per parameterId === "text"
                            For Each param As JObject In jObject("parameters")
                                If param("parameterId") IsNot Nothing AndAlso param("parameterId").Value(Of String)() = "text" Then
                                    If param("value") IsNot Nothing Then
                                        textKey = param("value").Value(Of String)()
                                        Exit For
                                    End If
                                End If
                            Next
                        End If
                        ' ❌ ERRORE BLOCCANTE: TextKey obbligatorio, nessun fallback
                        If String.IsNullOrWhiteSpace(textKey) Then
                            Console.WriteLine($"[ITaskConverter] ⚠️ Warning: SayMessage task has no TextKey, skipping task creation")
                            Return Nothing ' Skip task se non ha TextKey valido
                        End If
                        task = New MessageTask(textKey)
                    Case TaskTypes.CloseSession
                        task = New CloseSessionTask()
                    Case TaskTypes.Transfer
                        task = New TransferTask()
                    Case Else
                        ' Altri tipi non supportati in escalations, usa CloseSessionTask come fallback
                        task = New CloseSessionTask()
                End Select
            End If
        End If

        ' ✅ PRIORITÀ 2: Se non determinato da "type", usa campi specifici
        If task Is Nothing Then
            ' MessageTask ha TextKey, text o parameters[0].value (se parameterId === "text")
            If jObject("TextKey") IsNot Nothing OrElse jObject("text") IsNot Nothing OrElse (jObject("parameters") IsNot Nothing AndAlso jObject("parameters").Type = JTokenType.Array) Then
                Dim textKey As String = ""
                If jObject("TextKey") IsNot Nothing Then
                    textKey = jObject("TextKey").Value(Of String)()
                ElseIf jObject("text") IsNot Nothing Then
                    textKey = jObject("text").Value(Of String)()
                ElseIf jObject("parameters") IsNot Nothing AndAlso jObject("parameters").Type = JTokenType.Array Then
                    ' ✅ Cerca in parameters array per parameterId === "text"
                    For Each param As JObject In jObject("parameters")
                        If param("parameterId") IsNot Nothing AndAlso param("parameterId").Value(Of String)() = "text" Then
                            If param("value") IsNot Nothing Then
                                textKey = param("value").Value(Of String)()
                                Exit For
                            End If
                        End If
                    Next
                End If
                ' ❌ ERRORE BLOCCANTE: TextKey obbligatorio, nessun fallback
                If String.IsNullOrWhiteSpace(textKey) Then
                    Console.WriteLine($"[ITaskConverter] ⚠️ Warning: SayMessage task has no TextKey, skipping task creation")
                    Return Nothing ' Skip task se non ha TextKey valido
                End If
                task = New MessageTask(textKey)
            ' TransferTask ha OperatorId
            ElseIf jObject("OperatorId") IsNot Nothing Then
                task = New TransferTask()
            ' CloseSessionTask (default se nessun campo specifico)
            Else
                task = New CloseSessionTask()
            End If
        End If

        ' Popola le altre proprietà se presenti (usando serializer.Populate)
        If task IsNot Nothing Then
            serializer.Populate(jObject.CreateReader(), task)
        End If

        Return task
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As Object, serializer As JsonSerializer)
        Throw New NotImplementedException("Use default serialization for writing")
    End Sub
End Class
