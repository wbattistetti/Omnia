Option Strict On
Option Explicit On
Imports System.Text.Json

''' <summary>
''' Minimal DSL interpreter - evaluates AST directly without compiling to JavaScript
''' Safe, deterministic, and debuggable
''' </summary>
Public Class DSLInterpreter
    Private ReadOnly variableStore As Dictionary(Of String, Object)

    ''' <summary>
    ''' Creates a new DSL interpreter with variable store
    ''' </summary>
    Public Sub New(variableStore As Dictionary(Of String, Object))
        Me.variableStore = variableStore
    End Sub

    ''' <summary>
    ''' Evaluates AST and returns boolean result
    ''' Safe fallback: returns False on any error
    ''' </summary>
    Public Function Evaluate(ast As ASTNode) As Boolean
        Try
            Dim result = EvaluateNode(ast)
            Return ConvertToBoolean(result)
        Catch ex As Exception
            Console.WriteLine($"[DSLInterpreter] Error evaluating AST: {ex.Message}")
            Return False
        End Try
    End Function

    ''' <summary>
    ''' Recursive AST evaluation
    ''' </summary>
    Private Function EvaluateNode(node As ASTNode) As Object
        If node Is Nothing Then Return False

        Select Case node.Type.ToLowerInvariant()
            ' Literals
            Case "literal"
                Return node.Value

            ' Variables - replace with value from variableStore
            Case "variable"
                Dim varName = node.Name
                If String.IsNullOrEmpty(varName) Then Return Nothing
                If variableStore.ContainsKey(varName) Then
                    Return variableStore(varName)
                End If
                Return Nothing

            ' Functions
            Case "function"
                Return EvaluateFunction(node)

            ' Comparisons
            Case "equals"
                Return AreEqual(EvaluateNode(node.Left), EvaluateNode(node.Right))

            Case "notequals"
                Return Not AreEqual(EvaluateNode(node.Left), EvaluateNode(node.Right))

            Case "greaterthan"
                Return CompareNumeric(EvaluateNode(node.Left), EvaluateNode(node.Right), Function(a, b) a > b)

            Case "lessthan"
                Return CompareNumeric(EvaluateNode(node.Left), EvaluateNode(node.Right), Function(a, b) a < b)

            Case "greaterthanorequal"
                Return CompareNumeric(EvaluateNode(node.Left), EvaluateNode(node.Right), Function(a, b) a >= b)

            Case "lessthanorequal"
                Return CompareNumeric(EvaluateNode(node.Left), EvaluateNode(node.Right), Function(a, b) a <= b)

            ' Logical operators
            Case "and"
                Return ConvertToBoolean(EvaluateNode(node.Left)) AndAlso ConvertToBoolean(EvaluateNode(node.Right))

            Case "or"
                Return ConvertToBoolean(EvaluateNode(node.Left)) OrElse ConvertToBoolean(EvaluateNode(node.Right))

            Case "not"
                Return Not ConvertToBoolean(EvaluateNode(node.Operand))

            Case "parenthesized"
                Return EvaluateNode(node.Expression)

            Case Else
                Console.WriteLine($"[DSLInterpreter] Unknown node type: {node.Type}")
                Return False
        End Select
    End Function

    ''' <summary>
    ''' Evaluates function call - only essential functions
    ''' </summary>
    Private Function EvaluateFunction(node As ASTNode) As Object
        Dim fnName = node.Name.ToUpperInvariant()
        Dim args = New List(Of Object)
        If node.Args IsNot Nothing Then
            For Each arg In node.Args
                args.Add(EvaluateNode(arg))
            Next
        End If

        If args.Count = 0 Then Return Nothing

        Select Case fnName
            ' String functions
            Case "LCASE"
                Return If(args(0) Is Nothing, "", args(0).ToString().ToLowerInvariant())

            Case "UCASE"
                Return If(args(0) Is Nothing, "", args(0).ToString().ToUpperInvariant())

            Case "TRIM"
                Return If(args(0) Is Nothing, "", args(0).ToString().Trim())

            Case "LEN"
                Return If(args(0) Is Nothing, 0, args(0).ToString().Length)

            Case "CONTAINS"
                If args.Count < 2 Then Return False
                Dim str = If(args(0) Is Nothing, "", args(0).ToString())
                Dim substr = If(args(1) Is Nothing, "", args(1).ToString())
                Return str.Contains(substr)

            Case "STARTSWITH"
                If args.Count < 2 Then Return False
                Dim str = If(args(0) Is Nothing, "", args(0).ToString())
                Dim substr = If(args(1) Is Nothing, "", args(1).ToString())
                Return str.StartsWith(substr)

            Case "ENDSWITH"
                If args.Count < 2 Then Return False
                Dim str = If(args(0) Is Nothing, "", args(0).ToString())
                Dim substr = If(args(1) Is Nothing, "", args(1).ToString())
                Return str.EndsWith(substr)

            ' Numeric functions
            Case "INT"
                Return CInt(Math.Floor(ConvertToDouble(args(0))))

            Case Else
                Console.WriteLine($"[DSLInterpreter] Unknown function: {fnName}")
                Return Nothing
        End Select
    End Function

    ''' <summary>
    ''' Converts value to boolean
    ''' </summary>
    Private Function ConvertToBoolean(value As Object) As Boolean
        If value Is Nothing Then Return False
        If TypeOf value Is Boolean Then Return DirectCast(value, Boolean)
        If TypeOf value Is String Then Return Not String.IsNullOrEmpty(DirectCast(value, String))
        If IsNumeric(value) Then Return ConvertToDouble(value) <> 0.0
        Return False
    End Function

    ''' <summary>
    ''' Checks if value is numeric
    ''' </summary>
    Private Function IsNumeric(value As Object) As Boolean
        Return TypeOf value Is Integer OrElse TypeOf value Is Long OrElse
               TypeOf value Is Double OrElse TypeOf value Is Decimal
    End Function

    ''' <summary>
    ''' Converts value to double
    ''' </summary>
    Private Function ConvertToDouble(value As Object) As Double
        If value Is Nothing Then Return 0.0
        If TypeOf value Is Double Then Return DirectCast(value, Double)
        If TypeOf value Is Integer Then Return CDbl(DirectCast(value, Integer))
        If TypeOf value Is Long Then Return CDbl(DirectCast(value, Long))
        If TypeOf value Is Decimal Then Return CDbl(DirectCast(value, Decimal))
        If TypeOf value Is String Then
            Dim result As Double
            If Double.TryParse(DirectCast(value, String), result) Then Return result
        End If
        Return 0.0
    End Function

    ''' <summary>
    ''' Compares two values for equality (with type coercion)
    ''' </summary>
    Private Function AreEqual(left As Object, right As Object) As Boolean
        If left Is Nothing AndAlso right Is Nothing Then Return True
        If left Is Nothing OrElse right Is Nothing Then Return False

        ' Same type - direct comparison
        If left.GetType() = right.GetType() Then
            Return left.Equals(right)
        End If

        ' Numeric comparison
        If IsNumeric(left) AndAlso IsNumeric(right) Then
            Return ConvertToDouble(left) = ConvertToDouble(right)
        End If

        ' String comparison
        Return left.ToString() = right.ToString()
    End Function

    ''' <summary>
    ''' Compares two values as numbers
    ''' </summary>
    Private Function CompareNumeric(left As Object, right As Object, comparer As Func(Of Double, Double, Boolean)) As Boolean
        Return comparer(ConvertToDouble(left), ConvertToDouble(right))
    End Function
End Class
