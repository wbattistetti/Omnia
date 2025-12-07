Imports System.Runtime.CompilerServices
Imports System.Text.RegularExpressions

Module Utils
    ' Regex compilata per i placeholder (es. [Nome] o [Parent.Child])
    ' Pattern: trova tutto tra quadre, escludendo quadre annidate
    Private ReadOnly PlaceholderRegex As New Regex("\[([^\[\]]+)\]", RegexOptions.Compiled)
    <Extension>
    Public Function IsEmpty(dataNode As DDTNode) As Boolean
        If dataNode.SubData.Any Then
            Return Not dataNode.SubData.Any(Function(sd) sd.Value IsNot Nothing)
        Else
            Return dataNode.Value Is Nothing
        End If
    End Function

    <Extension>
    Public Function IsFilled(dataNode As DDTNode) As Boolean
        If dataNode.SubData.Any Then
            Return Not dataNode.SubData.Any(Function(sd) sd.Value Is Nothing)
        Else
            Return dataNode.Value IsNot Nothing
        End If
    End Function

    <Extension>
    Public Function HasExitCondition(actions As IEnumerable(Of IAction)) As Boolean
        Return actions.Any(Function(a) TypeOf (a) Is CloseSessionAction OrElse TypeOf (a) Is TransferAction)
    End Function

    <Extension>
    Public Function ExitType(response As Response) As String
        ' TODO: Implementare logica per determinare il tipo di exit condition
        ' Per ora ritorna stringa vuota
        Return ""
    End Function

    <Extension>
    Public Function IsSubData(ddtNode As DDTNode) As Boolean
        Return ddtNode.ParentData IsNot Nothing
    End Function

    ''' <summary>
    ''' Processa i placeholder nel testo (sostituisce [FullLabel] con valori dal contesto globale)
    ''' Usa FullLabel calcolato a compile-time per lookup diretto nel contesto globale
    ''' Gestisce placeholder annidati iterando finché non ci sono più match
    ''' </summary>
    Public Function ProcessPlaceholders(text As String, ddtInstance As DDTInstance, Optional globalContext As IVariableContext = Nothing) As String
        If String.IsNullOrEmpty(text) Then
            Return text
        End If

        ' Crea contesto globale se non fornito (usa solo DDTInstance)
        If globalContext Is Nothing Then
            globalContext = New GlobalVariableContext(ddtInstance)
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

                ' Se trovato, sostituisci; altrimenti il placeholder rimane nel testo
                If Not String.IsNullOrEmpty(value) Then
                    processedText = processedText.Replace(match.Value, value)
                End If
            Next
        End While

        Return processedText
    End Function

End Module
