Option Strict On
Option Explicit On

Imports System.Runtime.CompilerServices

''' <summary>
''' Edge type enumeration for type-safe comparisons
''' </summary>
Public Enum EdgeType
    Sequential = 0
    Alternative = 1
    IsOptional = 2
End Enum

''' <summary>
''' Extension methods for edge type conversion
''' </summary>
Public Module EdgeTypeExtensions
    ''' <summary>
    ''' Converts string edge type to enum
    ''' </summary>
    <Extension()>
    Public Function ToEdgeType(typeString As String) As EdgeType
        If String.IsNullOrEmpty(typeString) Then
            Return EdgeType.Sequential ' Default
        End If

        Select Case typeString.ToLowerInvariant()
            Case "sequential"
                Return EdgeType.Sequential
            Case "alternative"
                Return EdgeType.Alternative
            Case "optional"
                Return EdgeType.IsOptional
            Case Else
                Return EdgeType.Sequential ' Default fallback
        End Select
    End Function

    ''' <summary>
    ''' Converts enum to string (for JSON serialization)
    ''' </summary>
    <Extension()>
    Public Function ToEdgeTypeString(edgeType As EdgeType) As String
        Select Case edgeType
            Case EdgeType.Sequential
                Return "sequential"
            Case EdgeType.Alternative
                Return "alternative"
            Case EdgeType.IsOptional
                Return "optional"
            Case Else
                Return "sequential"
        End Select
    End Function
End Module
