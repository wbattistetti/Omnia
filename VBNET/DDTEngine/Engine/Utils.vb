Imports System.Runtime.CompilerServices
Imports System.Text.RegularExpressions

Module Utils
    ' Regex compilata per i placeholder (es. [Nome] o [Parent.Child])
    ' Pattern: trova tutto tra quadre, escludendo quadre annidate
    Private ReadOnly PlaceholderRegex As New Regex("\[([^\[\]]+)\]", RegexOptions.Compiled)
    <Extension>
    Public Function IsEmpty(taskNode As TaskNode) As Boolean
        If taskNode.SubTasks.Any Then
            Return Not taskNode.SubTasks.Any(Function(st) st.Value IsNot Nothing)
        Else
            Return taskNode.Value Is Nothing
        End If
    End Function

    <Extension>
    Public Function IsFilled(taskNode As TaskNode) As Boolean
        If taskNode.SubTasks.Any Then
            Return Not taskNode.SubTasks.Any(Function(st) st.Value Is Nothing)
        Else
            Return taskNode.Value IsNot Nothing
        End If
    End Function

    <Extension>
    Public Function HasExitCondition(tasks As IEnumerable(Of ITask)) As Boolean
        Return tasks.Any(Function(a) TypeOf (a) Is CloseSessionTask OrElse TypeOf (a) Is TransferTask)
    End Function

    <Extension>
    Public Function ExitType(response As Response) As String
        ' TODO: Implementare logica per determinare il tipo di exit condition
        ' Per ora ritorna stringa vuota
        Return ""
    End Function

    <Extension>
    Public Function IsSubData(taskNode As TaskNode) As Boolean
        Return taskNode.ParentData IsNot Nothing
    End Function

    ''' <summary>
    ''' Processa i placeholder nel testo (sostituisce [FullLabel] con valori dal contesto globale)
    ''' Usa FullLabel calcolato a compile-time per lookup diretto nel contesto globale
    ''' Gestisce placeholder annidati iterando finché non ci sono più match
    ''' </summary>
    Public Function ProcessPlaceholders(text As String, taskInstance As TaskInstance, Optional globalContext As IVariableContext = Nothing) As String
        If String.IsNullOrEmpty(text) Then
            Return text
        End If

        ' Crea contesto globale se non fornito (usa solo TaskInstance)
        If globalContext Is Nothing Then
            globalContext = New GlobalVariableContext(taskInstance)
        End If

        Dim processedText As String = text
        Dim maxIterations As Integer = 10  ' Previene loop infiniti
        Dim iteration As Integer = 0

        ' Ciclo While: ripeti finché ci sono placeholder da sostituire
        ' Necessario perché una sostituzione potrebbe creare nuovi placeholder
        While processedText.Contains("[") AndAlso iteration < maxIterations
            iteration += 1
            Dim matches As MatchCollection = PlaceholderRegex.Matches(processedText)

            If matches.Count = 0 Then
                Exit While
            End If

            ' Per ogni match, cerca il valore nel contesto globale usando FullLabel
            For Each match As Match In matches
                Dim fullLabel As String = match.Groups(1).Value.Trim()  ' Es. "Nominativo.Nome"
                Dim value As String = globalContext.GetValue(fullLabel)

                ' ❌ ERRORE BLOCCANTE: placeholder deve essere risolto, nessun fallback
                If String.IsNullOrEmpty(value) Then
                    Throw New InvalidOperationException($"Placeholder '[{fullLabel}]' could not be resolved in task '{taskInstance.Id}'. The placeholder must exist in the global context. This indicates a missing variable or incorrect placeholder name.")
                End If

                processedText = processedText.Replace(match.Value, value)
            Next
        End While

        Return processedText
    End Function

End Module
