Option Strict On
Option Explicit On

Imports System
Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Custom JSON converter for List(Of TaskNode)
''' Handles both single object and array:
''' - If array: deserialize all elements
''' - If single object: wrap in list with one element
''' </summary>
Public Class TaskNodeListConverter
    Inherits JsonConverter(Of List(Of Compiler.TaskNode))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of Compiler.TaskNode), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of Compiler.TaskNode)
        Dim token = JToken.Load(reader)
        Dim result As New List(Of Compiler.TaskNode)()

        If token.Type = JTokenType.Array Then
            ' Array: deserialize all elements
            Dim array = CType(token, JArray)
            For Each item In array
                If item.Type = JTokenType.Object Then
                    Dim taskNode = item.ToObject(Of Compiler.TaskNode)(serializer)
                    If taskNode IsNot Nothing Then
                        result.Add(taskNode)
                    End If
                End If
            Next
        ElseIf token.Type = JTokenType.Object Then
            ' Single object: wrap in list
            Dim taskNode = token.ToObject(Of Compiler.TaskNode)(serializer)
            If taskNode IsNot Nothing Then
                result.Add(taskNode)
            End If
        End If

        Return result
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of Compiler.TaskNode), serializer As JsonSerializer)
        ' Write as array (even if single element)
        serializer.Serialize(writer, value)
    End Sub
End Class
