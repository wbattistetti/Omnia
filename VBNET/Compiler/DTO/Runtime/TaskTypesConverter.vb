Option Strict On
Option Explicit On

Imports System
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports DDTEngine

''' <summary>
''' JsonConverter per convertire stringhe (es. "SayMessage", "GetData") in TaskTypes enum
''' Gestisce la deserializzazione da JSON frontend (string) a enum VB.NET
''' </summary>
Public Class TaskTypesConverter
    Inherits JsonConverter(Of TaskTypes)

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As TaskTypes, hasExistingValue As Boolean, serializer As JsonSerializer) As TaskTypes
        If reader.TokenType = JsonToken.Null Then
            Return TaskTypes.SayMessage ' Default
        End If

        ' Se è già un numero (enum serializzato come numero)
        If reader.TokenType = JsonToken.Integer Then
            Dim intValue = Convert.ToInt32(reader.Value)
            If [Enum].IsDefined(GetType(TaskTypes), intValue) Then
                Return CType(intValue, TaskTypes)
            End If
        End If

        ' Se è una stringa (dal frontend: "SayMessage", "GetData", ecc.)
        If reader.TokenType = JsonToken.String Then
            Dim stringValue = If(reader.Value?.ToString(), "").Trim()
            Return ConvertStringToTaskType(stringValue)
        End If

        ' Default
        Return TaskTypes.SayMessage
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As TaskTypes, serializer As JsonSerializer)
        ' Serializza come numero (enum value)
        writer.WriteValue(CInt(value))
    End Sub

    ''' <summary>
    ''' Converte stringa semantica (es. "SayMessage", "GetData") in TaskTypes enum
    ''' </summary>
    Private Function ConvertStringToTaskType(stringValue As String) As TaskTypes
        If String.IsNullOrEmpty(stringValue) Then
            Return TaskTypes.SayMessage
        End If

        Dim normalized = stringValue.Trim().ToLower()

        Select Case normalized
            Case "saymessage", "message"
                Return TaskTypes.SayMessage
            Case "closesession", "closesessionaction"
                Return TaskTypes.CloseSession
            Case "transfer"
                Return TaskTypes.Transfer
            Case "getdata", "datarequest", "askquestion"
                Return TaskTypes.GetData
            Case "backendcall", "callbackend", "readfrombackend", "writetobackend"
                Return TaskTypes.BackendCall
            Case "classifyproblem", "problemclassification"
                Return TaskTypes.ClassifyProblem
            Case Else
                Console.WriteLine($"⚠️ [TaskTypesConverter] Unknown templateId string: '{stringValue}', defaulting to SayMessage")
                Return TaskTypes.SayMessage
        End Select
    End Function
End Class


