Option Strict On
Option Explicit On

Namespace GrammarInterpreter.Models

    ''' <summary>
    ''' Heterogeneous binding for a grammar node
    ''' Supports: slot, semantic-set, semantic-value
    ''' </summary>
    Public Class NodeBinding
        Public Property Type As String ' "slot" | "semantic-set" | "semantic-value"
        Public Property SlotId As String ' For type = "slot"
        Public Property SetId As String ' For type = "semantic-set"
        Public Property ValueId As String ' For type = "semantic-value"
    End Class

End Namespace
