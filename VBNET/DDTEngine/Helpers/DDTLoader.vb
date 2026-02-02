' TaskLoader.vb
' Helper semplificato per caricare TaskInstance da JSON (Runtime only)
' Le strutture IDE usano TaskCompiler invece

Option Strict On
Option Explicit On

Imports System.IO
Imports System.Text.Json
Imports System.Text.Json.Serialization

    ''' <summary>
    ''' Helper per caricare TaskInstance da file JSON (Runtime)
    ''' Usa deserializzazione diretta in TaskInstance
    ''' </summary>
    Public Class TaskLoader
        ''' <summary>
        ''' Carica un TaskInstance da un file JSON
        ''' </summary>
        Public Shared Function LoadFromJson(filePath As String) As TaskInstance
            If Not File.Exists(filePath) Then
                Throw New FileNotFoundException("File JSON non trovato: " & filePath)
            End If

            Dim jsonText As String = File.ReadAllText(filePath)
            Return LoadFromJsonString(jsonText)
        End Function

        ''' <summary>
        ''' Carica un TaskInstance da una stringa JSON (deserializzazione diretta)
        ''' </summary>
        Public Shared Function LoadFromJsonString(jsonText As String) As TaskInstance
            If String.IsNullOrEmpty(jsonText) Then
                Throw New ArgumentException("JSON text cannot be null or empty", NameOf(jsonText))
            End If

            ' Opzioni per la deserializzazione (case-insensitive, permette commenti)
            Dim options As New JsonSerializerOptions() With {
                .PropertyNameCaseInsensitive = True,
                .ReadCommentHandling = JsonCommentHandling.Skip,
                .AllowTrailingCommas = True
            }

            Dim instance As TaskInstance = JsonSerializer.Deserialize(Of TaskInstance)(jsonText, options)

            If instance Is Nothing Then
                Throw New InvalidOperationException("Impossibile deserializzare il JSON")
            End If

            ' Calcola FullLabel per tutti i nodi (se non già calcolato)
            CalculateFullLabels(instance)

            Return instance
        End Function

        ''' <summary>
        ''' Carica un TaskInstance direttamente da un oggetto .NET
        ''' </summary>
        Public Shared Function LoadFromObject(taskObj As TaskInstance) As TaskInstance
            If taskObj Is Nothing Then
                Throw New ArgumentNullException(NameOf(taskObj), "Task object cannot be null")
            End If

            ' Calcola FullLabel se non già calcolato
            If taskObj.TaskList IsNot Nothing Then
                For Each mainTask As TaskNode In taskObj.TaskList
                    If String.IsNullOrEmpty(mainTask.FullLabel) Then
                        CalculateFullLabels(taskObj)
                        Exit For
                    End If
                Next
            End If

            Return taskObj
        End Function

        ''' <summary>
        ''' Calcola FullLabel per tutti i nodi (compile-time)
        ''' </summary>
        Private Shared Sub CalculateFullLabels(instance As TaskInstance)
            If instance.TaskList IsNot Nothing Then
                For Each mainTask As TaskNode In instance.TaskList
                    CalculateFullLabelForNode(mainTask, "")
                Next
            End If
        End Sub

        ''' <summary>
        ''' Calcola il FullLabel per un singolo nodo e i suoi subTasks (ricorsivo)
        ''' </summary>
        Private Shared Sub CalculateFullLabelForNode(node As TaskNode, parentPath As String)
            ' Calcola FullLabel: usa sempre Id
            If String.IsNullOrEmpty(parentPath) Then
                node.FullLabel = node.Id
            Else
                node.FullLabel = parentPath & "." & node.Id
            End If

            ' Calcola ricorsivamente per subTasks
            If node.SubTasks IsNot Nothing Then
                For Each subTask As TaskNode In node.SubTasks
                    CalculateFullLabelForNode(subTask, node.FullLabel)
                Next
            End If
        End Sub
    End Class
