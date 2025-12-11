Option Strict On
Option Explicit On

Imports Newtonsoft.Json
Imports Newtonsoft.Json.Converters
Imports DDTEngine

''' <summary>
''' Custom JSON converter for Task.Action property
''' Converts string action names (e.g., "SayMessage") to Integer (ActionType enum values)
''' </summary>
Public Class ActionTypeConverter
    Inherits JsonConverter(Of Integer)

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As Integer, hasExistingValue As Boolean, serializer As JsonSerializer) As Integer
        If reader.TokenType = JsonToken.Null Then
            Return 0
        End If

        ' If it's already a number, return it directly
        If reader.TokenType = JsonToken.Integer Then
            Return Convert.ToInt32(reader.Value)
        End If

        ' If it's a string, convert it to the corresponding ActionType enum value
        If reader.TokenType = JsonToken.String Then
            Dim actionString As String = reader.Value.ToString()
            Return ConvertActionStringToInteger(actionString)
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
            Return ConvertActionStringToInteger(value)
        End If

        Return 0
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As Integer, serializer As JsonSerializer)
        ' Write as integer
        writer.WriteValue(value)
    End Sub

    ''' <summary>
    ''' Converts action string (e.g., "SayMessage") to ActionType enum integer value
    ''' </summary>
    Private Function ConvertActionStringToInteger(actionString As String) As Integer
        If String.IsNullOrEmpty(actionString) Then
            Return 0
        End If

        ' Normalize the string (remove spaces, case-insensitive)
        Dim normalized = actionString.Trim()

        ' Map string to ActionType enum value
        Select Case normalized.ToLower()
            Case "saymessage", "message"
                Return CInt(TaskTypes.SayMessage)
            Case "closesession", "closesessionaction"
                Return CInt(TaskTypes.CloseSession)
            Case "transfer", "transferaction"
                Return CInt(TaskTypes.Transfer)
            Case "getdata", "getdataaction"
                Return CInt(TaskTypes.GetData)
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
                Console.WriteLine($"⚠️ [ActionTypeConverter] Unknown action string: '{actionString}', defaulting to SayMessage (1)")
                Return CInt(TaskTypes.SayMessage)
        End Select
    End Function
End Class


