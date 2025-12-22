Option Strict On
Option Explicit On

Imports System
Imports System.Collections.Generic
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq
Imports Compiler

''' <summary>
''' JsonConverter per deserializzare List(Of CompiledTask) polimorfico
''' Usa CompiledTaskConverter per ogni elemento
''' </summary>
Public Class CompiledTaskListConverter
    Inherits JsonConverter(Of List(Of CompiledTask))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of CompiledTask), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of CompiledTask)
        If reader.TokenType = JsonToken.Null Then
            Return Nothing
        End If

        Dim list As New List(Of CompiledTask)()
        Dim jArray As JArray = JArray.Load(reader)

        ' Usa CompiledTaskConverter direttamente per deserializzare ogni elemento
        Dim taskConverter As New CompiledTaskConverter()

        For Each item As JToken In jArray
            ' Usa il converter per leggere il JToken e creare l'istanza corretta
            Using jsonReader As JsonReader = item.CreateReader()
                jsonReader.Read() ' Move to first token
                Dim task As CompiledTask = CType(taskConverter.ReadJson(jsonReader, GetType(CompiledTask), Nothing, serializer), CompiledTask)
                If task IsNot Nothing Then
                    list.Add(task)
                End If
            End Using
        Next

        Return list
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of CompiledTask), serializer As JsonSerializer)
        ' Usa serializzazione standard
        serializer.Serialize(writer, value)
    End Sub
End Class

