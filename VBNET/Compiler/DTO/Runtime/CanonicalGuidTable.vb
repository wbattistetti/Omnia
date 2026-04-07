Option Strict On
Option Explicit On
Imports System.Collections.Generic
Imports Newtonsoft.Json

''' <summary>
''' Tabella GUID canonici emessa dal compilatore per un utterance task: variabile/subId/nodeId/gruppi regex
''' allineati senza mapping runtime.
''' </summary>
Public Class CanonicalGuidTable

    ''' <summary>GUID del nodo principale (dato atomico o root del task utterance).</summary>
    <JsonProperty("mainNodeCanonicalGuid")>
    Public Property MainNodeCanonicalGuid As String

    ''' <summary>Righe per sub-campi (SubDataMapping): chiave contratto → GUID canonico.</summary>
    <JsonProperty("data")>
    Public Property Data As List(Of CanonicalDatumRow)

    Public Sub New()
        MainNodeCanonicalGuid = String.Empty
        Data = New List(Of CanonicalDatumRow)()
    End Sub

    ''' <summary>Risolve la chiave SubDataMapping al GUID canonico.</summary>
    Public Function TryResolveBySubMappingKey(subKey As String) As String
        If String.IsNullOrEmpty(subKey) Then Return Nothing
        For Each row In Data
            If String.Equals(row.SubDataMappingKey, subKey, StringComparison.OrdinalIgnoreCase) Then
                Return row.CanonicalGuid
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>Risolve un nome gruppo regex (es. s1) al GUID canonico.</summary>
    Public Function TryResolveByRegexGroupName(groupName As String) As String
        If String.IsNullOrEmpty(groupName) Then Return Nothing
        For Each row In Data
            If Not String.IsNullOrEmpty(row.RegexGroupName) AndAlso
               String.Equals(row.RegexGroupName, groupName, StringComparison.OrdinalIgnoreCase) Then
                Return row.CanonicalGuid
            End If
        Next
        Return Nothing
    End Function

    ''' <summary>
    ''' Risolve una chiave di binding (nome gruppo / slot id) al GUID canonico:
    ''' RegexGroupName, SubDataMappingKey, poi uguaglianza con CanonicalGuid.
    ''' </summary>
    Public Function TryResolveSlotBindingKey(bindingKey As String) As String
        If String.IsNullOrEmpty(bindingKey) Then Return Nothing
        Dim g = TryResolveByRegexGroupName(bindingKey)
        If Not String.IsNullOrEmpty(g) Then Return g
        g = TryResolveBySubMappingKey(bindingKey)
        If Not String.IsNullOrEmpty(g) Then Return g
        For Each row In Data
            If String.Equals(row.CanonicalGuid, bindingKey, StringComparison.OrdinalIgnoreCase) Then
                Return row.CanonicalGuid
            End If
        Next
        Return Nothing
    End Function

End Class

''' <summary>
''' Una riga della tabella: chiave SubDataMapping, GUID unico, nome gruppo regex associato.
''' </summary>
Public Class CanonicalDatumRow

    <JsonProperty("subDataMappingKey")>
    Public Property SubDataMappingKey As String

    <JsonProperty("canonicalGuid")>
    Public Property CanonicalGuid As String

    <JsonProperty("regexGroupName")>
    Public Property RegexGroupName As String

    Public Sub New()
        SubDataMappingKey = String.Empty
        CanonicalGuid = String.Empty
        RegexGroupName = String.Empty
    End Sub

End Class
