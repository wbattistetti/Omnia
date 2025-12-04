' MessageAction.vb
' Action per inviare un messaggio

Option Strict On
Option Explicit On

Imports System.Linq
Imports System.Text.RegularExpressions

    ''' <summary>
    ''' Action per inviare un messaggio all'utente
    ''' </summary>
    Public Class MessageAction
        Inherits ActionBase

        ''' <summary>
        ''' Testo del messaggio da inviare
        ''' </summary>
        Public Property Text As String

        ''' <summary>
        ''' Chiave di traduzione per il testo (opzionale)
        ''' </summary>
        Public Property TextKey As String

        ''' <summary>
        ''' Costruttore
        ''' </summary>
        Public Sub New()
            Text = ""
            TextKey = ""
        End Sub

        ''' <summary>
        ''' Costruttore con testo
        ''' </summary>
        Public Sub New(text As String)
            Me.Text = text
            Me.TextKey = ""
        End Sub

        Public Overrides ReadOnly Property ActionId As String
            Get
                Return "sayMessage"
            End Get
        End Property

        Public Overrides ReadOnly Property Label As String
            Get
                Return "Message"
            End Get
        End Property

        ''' <summary>
        ''' Esegue l'azione: processa i placeholder e mostra il messaggio
        ''' </summary>
        Public Overrides Sub Execute(dataNode As DDTNode, ddtInstance As DDTInstance, onMessage As Action(Of String))
            If onMessage Is Nothing Then Return

            Dim processedText As String = ProcessPlaceholders(Me.Text, dataNode, ddtInstance)
            If Not String.IsNullOrEmpty(processedText) Then
                onMessage(processedText)
            End If
        End Sub

        ''' <summary>
        ''' Processa i placeholder nel testo (sostituisce {input} e [id] o [parent.child])
        ''' </summary>
        Private Function ProcessPlaceholders(text As String, dataNode As DDTNode, ddtInstance As DDTInstance) As String
            If String.IsNullOrEmpty(text) OrElse ddtInstance Is Nothing Then
                Return text
            End If

            Dim processedText As String = text

        ' Sostituisci placeholder {input} convertendolo in [Name] o [ParentName.ChildName]
        If processedText.Contains("{input}") Then
            Dim nodePath As String = GetNodePath(dataNode)
            If Not String.IsNullOrEmpty(nodePath) Then
                ' Converti {input} in [Name] o [ParentName.ChildName]
                processedText = processedText.Replace("{input}", "[" & nodePath & "]")
            Else
                ' Fallback: se non riesco a costruire il path, usa il valore diretto
                Dim inputValue As String = ""
                If dataNode IsNot Nothing AndAlso dataNode.Value IsNot Nothing Then
                    inputValue = dataNode.Value.ToString()
                End If
                processedText = processedText.Replace("{input}", inputValue)
            End If
        End If

        ' Sostituisci placeholder [id] o [parent.child] con notazione dot
        ' La regex deve accettare anche spazi nel nome (es. "Data di Nascita")
        If processedText.Contains("[") Then
            Dim regex As New System.Text.RegularExpressions.Regex("\[([\w\s.]+)\]")
            processedText = regex.Replace(processedText, Function(match As System.Text.RegularExpressions.Match)
                                                             Dim path As String = match.Groups(1).Value.Trim()
                                                             Dim value As String = GetNodeValueByPath(path, ddtInstance)
                                                             Return If(String.IsNullOrEmpty(value), match.Value, value)
                                                         End Function)
        End If

        Return processedText
    End Function

    ''' <summary>
    ''' Ottiene il path completo del nodo usando Name invece di Id (es. "Nominativo" o "Nominativo.Cognome")
    ''' </summary>
    Private Function GetNodePath(dataNode As DDTNode) As String
        If dataNode Is Nothing Then
            Return ""
        End If

        ' Se è un subData, costruisci il path come parent.child usando i Name
        If dataNode.ParentData IsNot Nothing Then
            Dim parentName As String = If(String.IsNullOrEmpty(dataNode.ParentData.Name), dataNode.ParentData.Id, dataNode.ParentData.Name)
            Dim childName As String = If(String.IsNullOrEmpty(dataNode.Name), dataNode.Id, dataNode.Name)
            Return parentName & "." & childName
        End If

        ' Se è un mainData, usa il Name (o Id come fallback)
        Return If(String.IsNullOrEmpty(dataNode.Name), dataNode.Id, dataNode.Name)
    End Function

    ''' <summary>
    ''' Ottiene il valore di un nodo tramite path usando Name (es. "Nominativo" o "Nominativo.Cognome")
    ''' Supporta anche Id come fallback per compatibilità
    ''' </summary>
    Private Function GetNodeValueByPath(path As String, ddtInstance As DDTInstance) As String
        If String.IsNullOrEmpty(path) OrElse ddtInstance Is Nothing Then
            Return ""
        End If

        Dim pathParts As String() = path.Split("."c)
        Dim mainDataName As String = pathParts(0).Trim()
        Dim subDataName As String = If(pathParts.Length > 1, pathParts(1).Trim(), Nothing)

        ' Cerca il mainData per Name (o Id come fallback) - confronto case-insensitive
        Dim mainDataNode As DDTNode = ddtInstance.MainDataList.FirstOrDefault(
            Function(m) (Not String.IsNullOrEmpty(m.Name) AndAlso String.Equals(m.Name, mainDataName, StringComparison.OrdinalIgnoreCase)) OrElse
                        (Not String.IsNullOrEmpty(m.Id) AndAlso String.Equals(m.Id, mainDataName, StringComparison.OrdinalIgnoreCase)))
        If mainDataNode Is Nothing Then
            Return ""
        End If

        If Not String.IsNullOrEmpty(subDataName) Then
            Dim subDataNode As DDTNode = mainDataNode.SubData.FirstOrDefault(
                Function(s) (Not String.IsNullOrEmpty(s.Name) AndAlso String.Equals(s.Name, subDataName, StringComparison.OrdinalIgnoreCase)) OrElse
                            (Not String.IsNullOrEmpty(s.Id) AndAlso String.Equals(s.Id, subDataName, StringComparison.OrdinalIgnoreCase)))
            If subDataNode IsNot Nothing AndAlso subDataNode.Value IsNot Nothing Then
                Return subDataNode.Value.ToString()
            End If
            Return ""
        End If

        ' Costruisci valore completo del mainData composito
        If mainDataNode.HasSubData() Then
            Dim valueParts As New List(Of String)()
            ' Per la data, costruisci in ordine: giorno, mese, anno
            If mainDataNode.Name.ToLower().Contains("data") Then
                ' Cerca i subData in ordine specifico per la data
                Dim giornoNode As DDTNode = mainDataNode.SubData.FirstOrDefault(Function(s) s.Id = "giorno" OrElse s.Name.ToLower() = "giorno")
                Dim meseNode As DDTNode = mainDataNode.SubData.FirstOrDefault(Function(s) s.Id = "mese" OrElse s.Name.ToLower() = "mese")
                Dim annoNode As DDTNode = mainDataNode.SubData.FirstOrDefault(Function(s) s.Id = "anno" OrElse s.Name.ToLower() = "anno")

                If giornoNode IsNot Nothing AndAlso giornoNode.Value IsNot Nothing Then
                    valueParts.Add(giornoNode.Value.ToString())
                End If
                If meseNode IsNot Nothing AndAlso meseNode.Value IsNot Nothing Then
                    ' Se il mese è un numero, convertilo in nome (opzionale, per ora lascia il numero)
                    valueParts.Add(meseNode.Value.ToString())
                End If
                If annoNode IsNot Nothing AndAlso annoNode.Value IsNot Nothing Then
                    valueParts.Add(annoNode.Value.ToString())
                End If
            Else
                ' Per altri tipi compositi, usa l'ordine dei subData
                For Each subData As DDTNode In mainDataNode.SubData
                    If subData.Value IsNot Nothing Then
                        valueParts.Add(subData.Value.ToString())
                    End If
                Next
            End If
            Return String.Join(" ", valueParts)
        ElseIf mainDataNode.Value IsNot Nothing Then
            Return mainDataNode.Value.ToString()
        End If

        Return ""
    End Function
    End Class


