Option Strict On
Option Explicit On

Imports System
Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Custom JSON converter for List(Of StepGroup)
''' Handles both single object (Record), array, and null:
''' - If object: convert keys to StepGroup array (e.g., { "start": {...}, "noMatch": {...} } → [{ type: "start", ... }, { type: "noMatch", ... }])
''' - If array: deserialize all elements
''' - If null: return empty list
''' </summary>
Public Class StepGroupListConverter
    Inherits JsonConverter(Of List(Of Compiler.StepGroup))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of Compiler.StepGroup), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of Compiler.StepGroup)
        Dim token = JToken.Load(reader)
        Dim result As New List(Of Compiler.StepGroup)()

        If token.Type = JTokenType.Array Then
            ' Array: deserialize all elements
            Dim array = CType(token, JArray)
            For Each item In array
                If item.Type = JTokenType.Object Then
                    Dim stepGroup = item.ToObject(Of Compiler.StepGroup)(serializer)
                    If stepGroup IsNot Nothing Then
                        result.Add(stepGroup)
                    End If
                End If
            Next
        ElseIf token.Type = JTokenType.Object Then
            ' Object (Record): convert keys to StepGroup array
            Dim obj = CType(token, JObject)
            For Each prop In obj.Properties()
                Dim stepType = prop.Name
                Dim stepValue = prop.Value

                If stepValue.Type = JTokenType.Object Then
                    ' Create StepGroup with type from key
                    Dim stepGroup = stepValue.ToObject(Of Compiler.StepGroup)(serializer)
                    If stepGroup IsNot Nothing Then
                        ' Ensure type is set from the key
                        stepGroup.Type = stepType
                        result.Add(stepGroup)
                    End If
                End If
            Next
        End If

        Return result
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of Compiler.StepGroup), serializer As JsonSerializer)
        ' Always write as array
        serializer.Serialize(writer, value)
    End Sub
End Class


