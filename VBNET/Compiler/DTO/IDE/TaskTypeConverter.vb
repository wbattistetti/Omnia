Option Strict On
Option Explicit On

Imports Newtonsoft.Json
Imports Newtonsoft.Json.Converters
Imports DDTEngine

''' <summary>
''' Custom JSON converter for TaskType conversion (legacy support)
''' Converts string task names (e.g., "SayMessage", "DataRequest") to Integer (TaskTypes enum values)
''' NOTE: Task now uses templateId (string) directly, but this converter is kept for backward compatibility
''' TODO: Consider removing this converter if no longer needed
''' </summary>
Public Class TaskTypeConverter
    Inherits JsonConverter(Of Integer)

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As Integer, hasExistingValue As Boolean, serializer As JsonSerializer) As Integer
        If reader.TokenType = JsonToken.Null Then
            Return 0
        End If

        ' If it's already a number, return it directly
        If reader.TokenType = JsonToken.Integer Then
            Return Convert.ToInt32(reader.Value)
        End If

        ' If it's a string, convert it to the corresponding TaskTypes enum value
        If reader.TokenType = JsonToken.String Then
            Dim taskString As String = reader.Value.ToString()
            Return ConvertTaskStringToInteger(taskString)
        End If

        ' If it's something else, try to parse it
        Dim value As String = reader.Value?.ToString()
        If Not String.IsNullOrEmpty(value) Then
            ' Try to parse as integer first
            Dim intValue As Integer
            If Integer.TryParse(value, intValue) Then
                Return intValue
            End If
            ' Otherwise, try to convert from string
            Return ConvertTaskStringToInteger(value)
        End If

        Return 0
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As Integer, serializer As JsonSerializer)
        ' Write as integer
        writer.WriteValue(value)
    End Sub

    ''' <summary>
    ''' Converts task string (e.g., "SayMessage", "DataRequest") to TaskTypes enum integer value
    ''' </summary>
    Private Function ConvertTaskStringToInteger(taskString As String) As Integer
        If String.IsNullOrEmpty(taskString) Then
            Return 0
        End If

        ' Normalize the string (remove spaces, case-insensitive)
        Dim normalized = taskString.Trim()

        ' Map string to TaskTypes enum value
        Select Case normalized.ToLower()
            Case "saymessage", "message"
                Return CInt(TaskTypes.SayMessage)
            Case "closesession", "closesessionaction"
                Return CInt(TaskTypes.CloseSession)
            Case "transfer", "transferaction"
                Return CInt(TaskTypes.Transfer)
            Case "utteranceinterpretation", "interpretutterance"
                Return CInt(TaskTypes.UtteranceInterpretation)
            Case "backendcall", "callbackend", "backendcallaction"
                Return CInt(TaskTypes.BackendCall)
            Case "classifyproblem", "classifyproblemaction"
                Return CInt(TaskTypes.ClassifyProblem)
            Case Else
                ' Try to parse as integer (in case frontend sends numeric string)
                Dim intValue As Integer
                If Integer.TryParse(normalized, intValue) Then
                    Return intValue
                End If
                ' Default to SayMessage if unknown
                Console.WriteLine($"⚠️ [TaskTypeConverter] Unknown task string: '{taskString}', defaulting to SayMessage (1)")
                Return CInt(TaskTypes.SayMessage)
        End Select
    End Function
End Class


