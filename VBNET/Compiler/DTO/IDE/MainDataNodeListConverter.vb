Option Strict On
Option Explicit On

Imports System
Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Custom JSON converter for List(Of MainDataNode)
''' Handles both single object and array:
''' - If array: deserialize all elements
''' - If single object: wrap in list with one element
''' </summary>
Public Class MainDataNodeListConverter
    Inherits JsonConverter(Of List(Of Compiler.MainDataNode))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of Compiler.MainDataNode), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of Compiler.MainDataNode)
        Dim token = JToken.Load(reader)
        Dim result As New List(Of Compiler.MainDataNode)()

        If token.Type = JTokenType.Array Then
            ' Array: deserialize all elements
            Dim array = CType(token, JArray)
            For Each item In array
                If item.Type = JTokenType.Object Then
                    Dim mainDataNode = item.ToObject(Of Compiler.MainDataNode)(serializer)
                    If mainDataNode IsNot Nothing Then
                        result.Add(mainDataNode)
                    End If
                End If
            Next
        ElseIf token.Type = JTokenType.Object Then
            ' Single object: wrap in list
            Dim mainDataNode = token.ToObject(Of Compiler.MainDataNode)(serializer)
            If mainDataNode IsNot Nothing Then
                result.Add(mainDataNode)
            End If
        End If

        Return result
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of Compiler.MainDataNode), serializer As JsonSerializer)
        ' Write as array (even if single element)
        serializer.Serialize(writer, value)
    End Sub
End Class


