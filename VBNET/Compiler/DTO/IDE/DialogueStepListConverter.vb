Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Custom JSON converter for List(Of DialogueStep)
''' Handles both single object (Record), array, and null:
''' - If object: convert keys to DialogueStep array (e.g., { "start": {...}, "noMatch": {...} } → [{ type: "start", ... }, { type: "noMatch", ... }])
''' - If array: deserialize all elements
''' - If null: return empty list
''' </summary>
Public Class DialogueStepListConverter
    Inherits JsonConverter(Of List(Of Compiler.DialogueStep))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of Compiler.DialogueStep), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of Compiler.DialogueStep)
        Dim token = JToken.Load(reader)
        Dim result As New List(Of Compiler.DialogueStep)()

        If token.Type = JTokenType.Array Then
            ' Array: deserialize all elements
            Dim array = CType(token, JArray)
            For Each item In array
                If item.Type = JTokenType.Object Then
                    Dim dialogueStep = item.ToObject(Of Compiler.DialogueStep)(serializer)
                    If dialogueStep IsNot Nothing Then
                        result.Add(dialogueStep)
                    End If
                End If
            Next
        ElseIf token.Type = JTokenType.Object Then
            ' Object (Record): convert keys to DialogueStep array
            Dim obj = CType(token, JObject)
            For Each prop In obj.Properties()
                Dim stepType = prop.Name
                Dim stepValue = prop.Value

                If stepValue.Type = JTokenType.Object Then
                    ' Create DialogueStep with type from key
                    Dim dialogueStep = stepValue.ToObject(Of Compiler.DialogueStep)(serializer)
                    If dialogueStep IsNot Nothing Then
                        ' Ensure type is set from the key
                        dialogueStep.Type = stepType
                        result.Add(dialogueStep)
                    End If
                End If
            Next
        End If

        Return result
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of Compiler.DialogueStep), serializer As JsonSerializer)
        ' Always write as array
        serializer.Serialize(writer, value)
    End Sub
End Class


