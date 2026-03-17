Option Strict On
Option Explicit On

Imports System.Collections.Generic


''' <summary>
''' Context for matching during grammar interpretation
''' </summary>
Public Class MatchContext
        Public Property Text As String ' Full input text
        Public Property Position As Integer ' Current position in text
        Public Property GarbageUsed As Integer ' Number of garbage words used in this path
        Public Property MaxGarbage As Integer ' Maximum garbage words allowed
        Public Property Bindings As Dictionary(Of String, Object) ' Extracted bindings

        Public Sub New()
            Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            MaxGarbage = 5 ' Default: 5 words max
        End Sub

        ''' <summary>
        ''' Creates a copy of the context
        ''' </summary>
        Public Function Clone() As MatchContext
            Return New MatchContext() With {
                .Text = Me.Text,
                .Position = Me.Position,
                .GarbageUsed = Me.GarbageUsed,
                .MaxGarbage = Me.MaxGarbage,
                .Bindings = New Dictionary(Of String, Object)(Me.Bindings)
            }
        End Function
    End Class
