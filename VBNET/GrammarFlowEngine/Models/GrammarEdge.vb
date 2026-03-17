Option Strict On
Option Explicit On
''' <summary>
''' Connection between nodes
''' The VB.NET runtime traverses these edges
''' </summary>
Public Class GrammarEdge
        Public Property Id As String ' UUID
        Public Property Source As String ' Source node ID
        Public Property Target As String ' Target node ID
        Public Property Type As String ' "sequential" | "alternative" | "optional"
        Public Property Label As String ' Optional edge label
        Public Property Order As Integer ' Order for sequential edges (0 = default)
    End Class
