Option Strict On
Option Explicit On

''' <summary>
''' ✅ Typed structure for mockTable conditions
''' Represents: IF value(varId) = ExpectedValue
''' Precompiled boolean formula: (varId, expectedValue)
''' </summary>
Public Class CompiledMockCondition
    ''' <summary>
    ''' Variable ID (GUID) in VariableStore
    ''' </summary>
    Public Property VariableId As String

    ''' <summary>
    ''' Expected value to match against VariableStore
    ''' </summary>
    Public Property ExpectedValue As Object

    Public Sub New()
        VariableId = ""
        ExpectedValue = Nothing
    End Sub

    Public Sub New(variableId As String, expectedValue As Object)
        Me.VariableId = variableId
        Me.ExpectedValue = expectedValue
    End Sub
End Class

''' <summary>
''' ✅ Typed structure for mockTable assignments
''' Represents: THEN set varId = Value
''' Precompiled assignment: (varId, value)
''' </summary>
Public Class CompiledMockAssignment
    ''' <summary>
    ''' Variable ID (GUID) in VariableStore
    ''' </summary>
    Public Property VariableId As String

    ''' <summary>
    ''' Value to write to VariableStore
    ''' </summary>
    Public Property Value As Object

    Public Sub New()
        VariableId = ""
        Value = Nothing
    End Sub

    Public Sub New(variableId As String, value As Object)
        Me.VariableId = variableId
        Me.Value = value
    End Sub
End Class

''' <summary>
''' ✅ Typed structure for a compiled mockTable row
''' Represents: IF (all Conditions match) THEN (apply all Assignments)
''' Precompiled boolean formula: AND of all conditions
''' </summary>
Public Class CompiledMockRow
    ''' <summary>
    ''' Row ID (for debugging/logging)
    ''' </summary>
    Public Property Id As String

    ''' <summary>
    ''' List of input conditions (all must match - AND logic)
    ''' </summary>
    Public Property Conditions As List(Of CompiledMockCondition)

    ''' <summary>
    ''' List of output assignments (all applied if row matches)
    ''' </summary>
    Public Property Assignments As List(Of CompiledMockAssignment)

    Public Sub New()
        Id = ""
        Conditions = New List(Of CompiledMockCondition)()
        Assignments = New List(Of CompiledMockAssignment)()
    End Sub

    Public Sub New(id As String)
        Me.Id = id
        Conditions = New List(Of CompiledMockCondition)()
        Assignments = New List(Of CompiledMockAssignment)()
    End Sub
End Class
