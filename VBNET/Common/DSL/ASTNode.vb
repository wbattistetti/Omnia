Option Strict On
Option Explicit On
Imports System.Text.Json.Serialization

''' <summary>
''' Minimal AST node - only essential properties for DSL evaluation
''' Matches TypeScript AST structure from frontend parser
''' </summary>
Public Class ASTNode
    <JsonPropertyName("type")>
    Public Property Type As String

    ' Binary operators (left, right)
    <JsonPropertyName("left")>
    Public Property Left As ASTNode

    <JsonPropertyName("right")>
    Public Property Right As ASTNode

    ' Unary operator (operand)
    <JsonPropertyName("operand")>
    Public Property Operand As ASTNode

    ' Function call and variable name
    <JsonPropertyName("name")>
    Public Property Name As String

    ' Function arguments
    <JsonPropertyName("args")>
    Public Property Args As List(Of ASTNode)

    ' Literal value (string, number, boolean)
    <JsonPropertyName("value")>
    Public Property Value As Object

    ' Parenthesized expression
    <JsonPropertyName("expression")>
    Public Property Expression As ASTNode
End Class
