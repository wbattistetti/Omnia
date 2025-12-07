Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' Task definition
''' Tipi del mondo IDE - usati solo per deserializzazione JSON
''' </summary>
Public Class Task
    ''' <summary>
    ''' Task ID
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' Task action type (valore numerico dell'enum ActionType)
    ''' Valori: SayMessage=1, CloseSession=2, Transfer=3, GetData=4, BackendCall=5, ClassifyProblem=6
    ''' Usa ActionTypeConverter per convertire stringhe (es. "SayMessage") in Integer
    ''' </summary>
    <JsonConverter(GetType(ActionTypeConverter))>
    Public Property Action As Integer

    ''' <summary>
    ''' Task value (parameters, DDT reference, etc.)
    ''' </summary>
    Public Property Value As Dictionary(Of String, Object)

    Public Sub New()
        Value = New Dictionary(Of String, Object)()
    End Sub
End Class

