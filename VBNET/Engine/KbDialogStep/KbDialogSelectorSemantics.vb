Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports System.Linq

Namespace KbDialogStep
    ''' <summary>Stato sessione disclosure inform (parità Node kbDialogSelectorSemantics.js).</summary>
    Public Class DialogInformPendingState
        Public Property ColId As String
        Public Property Value As String
        Public Property InformKey As String
        Public Property UseCaseId As String
        Public Property Say As String
    End Class

    Public Class DialogLastDisclosedEntry
        Public Property Value As String
        Public Property Say As String
    End Class

    Public Class DialogInformState
        Public Property LastDisclosed As Dictionary(Of String, DialogLastDisclosedEntry)
        Public Property Acknowledged As List(Of String)
        Public Property InformPending As DialogInformPendingState

        Public Sub New()
            LastDisclosed = New Dictionary(Of String, DialogLastDisclosedEntry)(StringComparer.OrdinalIgnoreCase)
            Acknowledged = New List(Of String)
        End Sub
    End Class

    Public Class SelectorAcceptanceWhenSpec
        Public Property MetadataColumnId As String
        Public Property MetadataValue As String
    End Class

    ''' <summary>Semantica valori selettore e stato inform.</summary>
    Public NotInheritable Class KbDialogSelectorSemantics
        Private Shared ReadOnly ExamEmpty As HashSet(Of String) = New HashSet(Of String)(StringComparer.OrdinalIgnoreCase) From {
            "", "nessuno", "none", "no", "-"
        }

        Public Shared Function EmptyInformState() As DialogInformState
            Return New DialogInformState()
        End Function

        Public Shared Function CloneInformState(state As DialogInformState) As DialogInformState
            Dim copy As New DialogInformState()
            If state Is Nothing Then Return copy
            For Each kvp In state.LastDisclosed
                copy.LastDisclosed(kvp.Key) = New DialogLastDisclosedEntry With {
                    .Value = kvp.Value.Value,
                    .Say = kvp.Value.Say
                }
            Next
            copy.Acknowledged.AddRange(state.Acknowledged)
            If state.InformPending IsNot Nothing Then
                copy.InformPending = New DialogInformPendingState With {
                    .ColId = state.InformPending.ColId,
                    .Value = state.InformPending.Value,
                    .InformKey = state.InformPending.InformKey,
                    .UseCaseId = state.InformPending.UseCaseId,
                    .Say = state.InformPending.Say
                }
            End If
            Return copy
        End Function

        Public Shared Function IsEmptySelectorValue(columnId As String, value As String) As Boolean
            Dim v = KbDialogBindings.NormalizeCellValue(value)
            If v.Length = 0 Then Return True
            Dim norm = v.ToLowerInvariant().Replace(" ", "_")
            Dim col = KbDialogBindings.SlugifyColumnId(columnId)
            If col.Contains("esame") AndAlso Not col.Contains("obbligatorio") Then
                Return ExamEmpty.Contains(norm) OrElse norm.StartsWith("non_")
            End If
            Return False
        End Function

        Public Shared Function ComputeInformKey(bindingWhen As Dictionary(Of String, String), colId As String, value As String) As String
            Dim keys = bindingWhen.Keys.OrderBy(Function(k) k).ToList()
            Dim prefix = String.Join("|", keys.Select(Function(k) k & "=" & bindingWhen(k)))
            Return (prefix & "::" & colId & "::" & value).ToLowerInvariant()
        End Function

        Public Shared Function ParseInformResponse(updates As Dictionary(Of String, String)) As String
            If updates Is Nothing Then Return Nothing
            Dim raw As String = Nothing
            If Not updates.TryGetValue("__inform_response", raw) OrElse String.IsNullOrWhiteSpace(raw) Then Return Nothing
            Dim v = raw.Trim().ToLowerInvariant()
            If {"accept", "yes", "si", "sì", "ok", "procedi"}.Contains(v) Then Return "accept"
            If {"reject", "no", "rifiuta", "annulla"}.Contains(v) Then Return "reject"
            Return Nothing
        End Function

        Public Shared Function InvalidateInformForColumns(state As DialogInformState, columnIds As IEnumerable(Of String)) As DialogInformState
            Dim nextState = CloneInformState(state)
            For Each colId In columnIds
                nextState.LastDisclosed.Remove(colId)
                If nextState.InformPending IsNot Nothing AndAlso String.Equals(nextState.InformPending.ColId, colId, StringComparison.OrdinalIgnoreCase) Then
                    nextState.InformPending = Nothing
                End If
            Next
            Dim ids = columnIds.ToList()
            nextState.Acknowledged = nextState.Acknowledged.Where(Function(k) Not ids.Any(Function(c) k.Contains("::" & c & "::"))).ToList()
            Return nextState
        End Function
    End Class
End Namespace
