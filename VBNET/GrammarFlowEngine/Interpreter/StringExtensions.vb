Option Strict On
Option Explicit On

Imports System.Runtime.CompilerServices
Imports System.Collections.Generic
Imports System.Linq

''' <summary>
''' Extension methods for String to improve code readability
''' </summary>
Public Module StringExtensions

    ''' <summary>
    ''' Counts words in a string
    ''' </summary>
    <Extension()>
    Public Function CountWords(text As String) As Integer
        If String.IsNullOrEmpty(text) Then Return 0
        Return text.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).Length
    End Function

    ''' <summary>
    ''' Gets words from text starting at position
    ''' </summary>
    <Extension()>
    Public Function GetWordsAt(text As String, position As Integer) As List(Of String)
        Dim remainingText = text.Substring(position).Trim()
        If String.IsNullOrEmpty(remainingText) Then
            Return New List(Of String)()
        End If

        Return remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).ToList()
    End Function

    ''' <summary>
    ''' Gets position after consuming N words from start position
    ''' </summary>
    <Extension()>
    Public Function GetPositionAfterWords(text As String, startPosition As Integer, wordCount As Integer) As Integer
        Dim remainingText = text.Substring(startPosition).Trim()
        If String.IsNullOrEmpty(remainingText) Then
            Return startPosition
        End If

        Dim words = remainingText.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries)
        If wordCount >= words.Length Then
            Return text.Length ' End of text
        End If

        ' Find actual position in original text
        Dim currentPos = startPosition
        Dim wordsFound = 0
        While currentPos < text.Length AndAlso wordsFound < wordCount
            If Char.IsWhiteSpace(text(currentPos)) Then
                currentPos += 1
                While currentPos < text.Length AndAlso Char.IsWhiteSpace(text(currentPos))
                    currentPos += 1
                End While
                wordsFound += 1
            Else
                currentPos += 1
            End If
        End While

        ' Skip whitespace
        While currentPos < text.Length AndAlso Char.IsWhiteSpace(text(currentPos))
            currentPos += 1
        End While

        Return currentPos
    End Function

    ''' <summary>
    ''' Counts words between two positions in a string
    ''' </summary>
    <Extension()>
    Public Function CountWordsBetween(text As String, startPos As Integer, endPos As Integer) As Integer
        If endPos <= startPos OrElse endPos > text.Length Then
            Return 0
        End If

        Dim segment = text.Substring(startPos, endPos - startPos).Trim()
        If String.IsNullOrEmpty(segment) Then
            Return 0
        End If

        Return segment.Split({" "c, vbTab, vbCr, vbLf}, StringSplitOptions.RemoveEmptyEntries).Length
    End Function

End Module
