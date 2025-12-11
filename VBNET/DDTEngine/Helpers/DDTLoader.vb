' DDTLoader.vb
' Helper semplificato per caricare DDTInstance da JSON (Runtime only)
' Le strutture IDE usano DDTCompiler invece

Option Strict On
Option Explicit On

Imports System.IO
Imports System.Text.Json
Imports System.Text.Json.Serialization

    ''' <summary>
    ''' Helper per caricare DDTInstance da file JSON (Runtime)
    ''' Usa deserializzazione diretta in DDTInstance
    ''' </summary>
    Public Class DDTLoader
        ''' <summary>
        ''' Carica un DDTInstance da un file JSON
        ''' </summary>
        Public Shared Function LoadFromJson(filePath As String) As DDTInstance
            If Not File.Exists(filePath) Then
                Throw New FileNotFoundException("File JSON non trovato: " & filePath)
            End If

            Dim jsonText As String = File.ReadAllText(filePath)
            Return LoadFromJsonString(jsonText)
        End Function

        ''' <summary>
        ''' Carica un DDTInstance da una stringa JSON (deserializzazione diretta)
        ''' </summary>
        Public Shared Function LoadFromJsonString(jsonText As String) As DDTInstance
            If String.IsNullOrEmpty(jsonText) Then
                Throw New ArgumentException("JSON text cannot be null or empty", NameOf(jsonText))
            End If

            ' Opzioni per la deserializzazione (case-insensitive, permette commenti)
            Dim options As New JsonSerializerOptions() With {
                .PropertyNameCaseInsensitive = True,
                .ReadCommentHandling = JsonCommentHandling.Skip,
                .AllowTrailingCommas = True
            }

            Dim instance As DDTInstance = JsonSerializer.Deserialize(Of DDTInstance)(jsonText, options)

            If instance Is Nothing Then
                Throw New InvalidOperationException("Impossibile deserializzare il JSON")
            End If

            ' Calcola FullLabel per tutti i nodi (se non già calcolato)
            CalculateFullLabels(instance)

            Return instance
        End Function

        ''' <summary>
        ''' Carica un DDTInstance direttamente da un oggetto .NET
        ''' </summary>
        Public Shared Function LoadFromObject(ddtObj As DDTInstance) As DDTInstance
            If ddtObj Is Nothing Then
                Throw New ArgumentNullException(NameOf(ddtObj), "DDT object cannot be null")
            End If

            ' Calcola FullLabel se non già calcolato
            If ddtObj.MainDataList IsNot Nothing Then
                For Each mainData As DDTNode In ddtObj.MainDataList
                    If String.IsNullOrEmpty(mainData.FullLabel) Then
                        CalculateFullLabels(ddtObj)
                        Exit For
                    End If
                Next
            End If

            Return ddtObj
        End Function

        ''' <summary>
        ''' Calcola FullLabel per tutti i nodi (compile-time)
        ''' </summary>
        Private Shared Sub CalculateFullLabels(instance As DDTInstance)
            If instance.MainDataList IsNot Nothing Then
                For Each mainData As DDTNode In instance.MainDataList
                    CalculateFullLabelForNode(mainData, "")
                Next
            End If
        End Sub

        ''' <summary>
        ''' Calcola il FullLabel per un singolo nodo e i suoi subData (ricorsivo)
        ''' </summary>
        Private Shared Sub CalculateFullLabelForNode(node As DDTNode, parentPath As String)
            ' Calcola FullLabel: se è root, usa solo Name, altrimenti parentPath.Name
            If String.IsNullOrEmpty(parentPath) Then
                node.FullLabel = If(String.IsNullOrEmpty(node.Name), node.Id, node.Name)
            Else
                Dim nodeName As String = If(String.IsNullOrEmpty(node.Name), node.Id, node.Name)
                node.FullLabel = parentPath & "." & nodeName
            End If

            ' Calcola ricorsivamente per subData
            If node.SubData IsNot Nothing Then
                For Each subData As DDTNode In node.SubData
                    CalculateFullLabelForNode(subData, node.FullLabel)
                Next
            End If
        End Sub
    End Class
