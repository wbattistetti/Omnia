Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports TaskEngine

''' <summary>
''' JsonConverter for polymorphic ITask deserialization.
''' Determines the concrete type based on the fields present in the JSON.
''' Uses case-insensitive field lookup to handle both camelCase (frontend) and PascalCase (backend).
''' Fails immediately with a clear error if the JSON is unrecognizable — no silent fallbacks.
''' </summary>
Public Class ITaskConverter
    Inherits JsonConverter

    Public Overrides ReadOnly Property CanWrite As Boolean
        Get
            Return False ' Read-only — writing uses standard JSON.NET serialization.
        End Get
    End Property

    Public Overrides Function CanConvert(objectType As Type) As Boolean
        Return GetType(ITask).IsAssignableFrom(objectType)
    End Function

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As Object, serializer As JsonSerializer) As Object
        If reader.TokenType = JsonToken.Null Then
            Return Nothing
        End If

        Dim jObject As JObject = JObject.Load(reader)
        Dim task As ITask = Nothing

        ' PRIORITY 1: integer "type" field (sent by the frontend IDE).
        Dim typeToken = GetField(jObject, "type")
        If typeToken IsNot Nothing AndAlso typeToken.Type = JTokenType.Integer Then
            Dim typeValue = typeToken.Value(Of Integer)()

            If Not [Enum].IsDefined(GetType(TaskTypes), typeValue) Then
                Throw New InvalidOperationException(
                    $"ITaskConverter: unknown task type value {typeValue}. " &
                    $"JSON: {jObject.ToString(Formatting.None)}")
            End If

            Dim taskType = CType(typeValue, TaskTypes)
            Select Case taskType
                Case TaskTypes.SayMessage
                    task = New MessageTask(ExtractTextKey(jObject))

                Case TaskTypes.CloseSession
                    task = New CloseSessionTask()

                Case TaskTypes.Transfer
                    task = New TransferTask()

                Case Else
                    Throw New InvalidOperationException(
                        $"ITaskConverter: task type '{taskType}' ({typeValue}) is not supported inside escalations. " &
                        $"Only SayMessage, CloseSession and Transfer are valid. " &
                        $"JSON: {jObject.ToString(Formatting.None)}")
            End Select
        End If

        ' PRIORITY 2: no "type" integer — identify by fields present in the JSON.
        If task Is Nothing Then
            Dim hasTextKey = GetField(jObject, "TextKey") IsNot Nothing
            Dim hasText = GetField(jObject, "text") IsNot Nothing
            Dim hasParameters = GetField(jObject, "parameters") IsNot Nothing AndAlso
                                GetField(jObject, "parameters").Type = JTokenType.Array
            Dim hasOperatorId = GetField(jObject, "OperatorId") IsNot Nothing

            If hasTextKey OrElse hasText OrElse hasParameters Then
                task = New MessageTask(ExtractTextKey(jObject))

            ElseIf hasOperatorId Then
                task = New TransferTask()

            Else
                Throw New InvalidOperationException(
                    $"ITaskConverter: cannot determine task type — no recognized fields found " &
                    $"(TextKey, text, parameters, OperatorId, type). " &
                    $"JSON: {jObject.ToString(Formatting.None)}")
            End If
        End If

        serializer.Populate(jObject.CreateReader(), task)
        Return task
    End Function

    ''' <summary>
    ''' Case-insensitive field lookup on a JObject.
    ''' Handles both camelCase (frontend) and PascalCase (backend) field names.
    ''' </summary>
    Private Shared Function GetField(jObject As JObject, fieldName As String) As JToken
        ' Try exact match first (fast path).
        Dim token = jObject(fieldName)
        If token IsNot Nothing Then Return token

        ' Case-insensitive fallback.
        For Each prop As JProperty In jObject.Properties()
            If String.Equals(prop.Name, fieldName, StringComparison.OrdinalIgnoreCase) Then
                Return prop.Value
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>
    ''' Extracts the TextKey (translation GUID) from a SayMessage JSON object.
    ''' Tries "TextKey" / "textKey", then "text", then parameters[parameterId="text"].value.
    ''' Throws immediately if no valid key is found — no silent fallbacks.
    ''' </summary>
    Private Shared Function ExtractTextKey(jObject As JObject) As String
        Dim textKey As String = ""

        Dim textKeyToken = GetField(jObject, "TextKey")
        Dim textToken = GetField(jObject, "text")
        Dim parametersToken = GetField(jObject, "parameters")

        If textKeyToken IsNot Nothing Then
            textKey = textKeyToken.Value(Of String)()

        ElseIf textToken IsNot Nothing Then
            textKey = textToken.Value(Of String)()

        ElseIf parametersToken IsNot Nothing AndAlso parametersToken.Type = JTokenType.Array Then
            For Each param As JObject In parametersToken
                Dim paramIdToken = GetField(param, "parameterId")
                Dim valueToken = GetField(param, "value")
                If paramIdToken IsNot Nothing AndAlso
                   String.Equals(paramIdToken.Value(Of String)(), "text", StringComparison.OrdinalIgnoreCase) AndAlso
                   valueToken IsNot Nothing Then
                    textKey = valueToken.Value(Of String)()
                    Exit For
                End If
            Next
        End If

        If String.IsNullOrWhiteSpace(textKey) Then
            Throw New InvalidOperationException(
                $"ITaskConverter: SayMessage task has no TextKey. " &
                $"Expected one of: 'TextKey'/'textKey', 'text', or parameters[parameterId='text'].value. " &
                $"JSON: {jObject.ToString(Formatting.None)}")
        End If

        Return textKey
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As Object, serializer As JsonSerializer)
        Throw New NotImplementedException("Use default serialization for writing.")
    End Sub
End Class
