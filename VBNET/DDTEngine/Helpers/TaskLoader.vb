' TaskLoader.vb
' Helper for loading TaskUtterance trees from JSON (for testing and legacy use).

Option Strict On
Option Explicit On
Imports System.IO
Imports System.Text.Json

''' <summary>
''' Loads a TaskUtterance tree from a JSON file or string.
''' After loading, calculates FullLabel paths for all nodes.
''' </summary>
Public Class TaskLoader

    ''' <summary>Loads a TaskUtterance from a JSON file.</summary>
    Public Shared Function LoadFromJson(filePath As String) As TaskUtterance
        If Not File.Exists(filePath) Then
            Throw New FileNotFoundException($"JSON file not found: {filePath}")
        End If
        Return LoadFromJsonString(File.ReadAllText(filePath))
    End Function

    ''' <summary>Deserializes a TaskUtterance from a JSON string and computes FullLabels.</summary>
    Public Shared Function LoadFromJsonString(jsonText As String) As TaskUtterance
        If String.IsNullOrEmpty(jsonText) Then
            Throw New ArgumentException("JSON text cannot be null or empty.", NameOf(jsonText))
        End If

        Dim options As New JsonSerializerOptions() With {
            .PropertyNameCaseInsensitive = True,
            .ReadCommentHandling = JsonCommentHandling.Skip,
            .AllowTrailingCommas = True
        }

        Dim root = JsonSerializer.Deserialize(Of TaskUtterance)(jsonText, options)
        If root Is Nothing Then
            Throw New InvalidOperationException("Could not deserialize JSON into TaskUtterance.")
        End If

        CalculateFullLabels(root, "")
        Return root
    End Function

    ''' <summary>Applies FullLabel paths to a pre-built TaskUtterance tree.</summary>
    Public Shared Function LoadFromObject(root As TaskUtterance) As TaskUtterance
        If root Is Nothing Then
            Throw New ArgumentNullException(NameOf(root), "Root TaskUtterance cannot be null.")
        End If
        CalculateFullLabels(root, "")
        Return root
    End Function

    ' -------------------------------------------------------------------------
    ' Private helpers
    ' -------------------------------------------------------------------------

    Private Shared Sub CalculateFullLabels(node As TaskUtterance, parentPath As String)
        node.FullLabel = If(String.IsNullOrEmpty(parentPath), node.Id, $"{parentPath}.{node.Id}")
        For Each child In node.SubTasks
            CalculateFullLabels(child, node.FullLabel)
        Next
    End Sub
End Class
