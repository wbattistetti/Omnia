Option Strict On
Option Explicit On
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

''' <summary>
''' Custom JSON converter for List(Of DialogueStep)
'''
''' MODELLO DEFINITIVO (CHIAVE ELIMINATA):
''' - Formato ufficiale: SOLO array di oggetti con step.Type
''' - Chiave del dizionario: ELIMINATA dal modello (non esiste più)
''' - step.Type: unica fonte di verità
'''
''' Gestisce:
''' - Array: deserializza direttamente (formato ufficiale)
''' - Oggetto (legacy): estrae valori ma usa SEMPRE step.Type, ignora completamente la chiave
''' - Null: ritorna lista vuota
''' </summary>
Public Class DialogueStepListConverter
    Inherits JsonConverter(Of List(Of Compiler.DialogueStep))

    Public Overrides Function ReadJson(reader As JsonReader, objectType As Type, existingValue As List(Of Compiler.DialogueStep), hasExistingValue As Boolean, serializer As JsonSerializer) As List(Of Compiler.DialogueStep)
        Dim token = JToken.Load(reader)
        Dim result As New List(Of Compiler.DialogueStep)()

        If token.Type = JTokenType.Null Then
            Return result
        End If

        If token.Type = JTokenType.Array Then
            ' ✅ FORMATO UFFICIALE: Array di oggetti con step.Type
            Dim array = CType(token, JArray)
            For Each item In array
                If item.Type = JTokenType.Object Then
                    Dim dialogueStep = item.ToObject(Of Compiler.DialogueStep)(serializer)
                    If dialogueStep IsNot Nothing Then
                        ' ✅ step.Type è già corretto (fonte di verità)
                        result.Add(dialogueStep)
                    End If
                End If
            Next
        ElseIf token.Type = JTokenType.Object Then
            ' ⚠️ FORMATO LEGACY (solo per retrocompatibilità temporanea con input esistenti)
            ' ✅ CRITICAL: Chiave ELIMINATA dal modello - ignora completamente
            ' ✅ Usa SEMPRE step.Type dall'oggetto (unica fonte di verità)
            Dim obj = CType(token, JObject)
            For Each prop In obj.Properties()
                Dim stepValue = prop.Value

                If stepValue.Type = JTokenType.Object Then
                    ' ✅ Deserializza l'oggetto step
                    Dim dialogueStep = stepValue.ToObject(Of Compiler.DialogueStep)(serializer)
                    If dialogueStep IsNot Nothing Then
                        ' ✅ CRITICAL: Chiave ELIMINATA - NON usarla mai
                        ' ✅ step.Type è già corretto dall'oggetto (unica fonte di verità)
                        ' ❌ NON fare: dialogueStep.Type = prop.Name (chiave non esiste più)
                        result.Add(dialogueStep)
                    End If
                End If
            Next
        End If

        Return result
    End Function

    Public Overrides Sub WriteJson(writer As JsonWriter, value As List(Of Compiler.DialogueStep), serializer As JsonSerializer)
        ' ✅ SEMPRE serializza come array (formato ufficiale, chiave eliminata)
        serializer.Serialize(writer, value)
    End Sub
End Class


