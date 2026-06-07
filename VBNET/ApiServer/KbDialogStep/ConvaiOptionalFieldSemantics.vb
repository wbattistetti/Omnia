Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq
Imports Newtonsoft.Json.Linq

Namespace OmniaDialogStepInfra
    ''' <summary>Regola ConvAI: campi opzionali con "" = assenti (parità Node convaiOptionalFieldSemantics.js).</summary>
    Public NotInheritable Class ConvaiOptionalFieldSemantics
        Public Const RuleId As String = "omnia.convai.optional-empty-string/v1"

        Public Shared Function IsEmptyOptionalSentinel(value As JToken) As Boolean
            If value Is Nothing OrElse value.Type = JTokenType.Null Then Return True
            If value.Type = JTokenType.String AndAlso String.IsNullOrEmpty(value.Value(Of String)()) Then Return True
            If value.Type = JTokenType.Array AndAlso Not value.HasValues Then Return True
            If value.Type = JTokenType.Object AndAlso Not value.HasValues Then Return True
            Return False
        End Function

        Public Shared Function StripEmptyConvaiOptionalFields(value As JToken) As JToken
            If value Is Nothing OrElse value.Type = JTokenType.Null Then Return Nothing
            If value.Type = JTokenType.String AndAlso String.IsNullOrEmpty(value.Value(Of String)()) Then Return Nothing
            If value.Type = JTokenType.Array Then
                Dim nextArr As New JArray()
                For Each item In value
                    Dim stripped = StripEmptyConvaiOptionalFields(item)
                    If stripped Is Nothing OrElse IsEmptyOptionalSentinel(stripped) Then Continue For
                    nextArr.Add(stripped)
                Next
                Return If(nextArr.Count = 0, Nothing, nextArr)
            End If
            If value.Type = JTokenType.Object Then
                Dim out As New JObject()
                For Each prop In CType(value, JObject).Properties()
                    Dim stripped = StripEmptyConvaiOptionalFields(prop.Value)
                    If stripped Is Nothing OrElse IsEmptyOptionalSentinel(stripped) Then Continue For
                    out(prop.Name) = stripped
                Next
                Return If(out.Count = 0, Nothing, out)
            End If
            Return value
        End Function

        Public Shared Sub StripEmptyConvaiOptionalFieldsInPlace(body As JObject)
            If body Is Nothing Then Return
            For Each prop In body.Properties().ToList()
                Dim stripped = StripEmptyConvaiOptionalFields(prop.Value)
                If stripped Is Nothing OrElse IsEmptyOptionalSentinel(stripped) Then
                    prop.Remove()
                Else
                    prop.Value = stripped
                End If
            Next
        End Sub
    End Class
End Namespace
