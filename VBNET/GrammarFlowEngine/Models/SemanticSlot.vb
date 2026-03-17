Option Strict On
Option Explicit On

''' <summary>
''' Semantic output slot
''' Example: from_city, to_city, intent, date
''' </summary>
Public Class SemanticSlot
        Public Property Id As String ' UUID
        Public Property Name As String ' Slot name (e.g., "from_city")
        Public Property Type As String ' "string" | "number" | "date" | "boolean" | "object"
    End Class
