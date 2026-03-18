Option Strict On
Option Explicit On

Imports System.Collections.Generic


''' <summary>
''' State for a specific path during grammar matching
''' Each path maintains its own independent state (position, bindings, garbage used)
''' </summary>
Public Class PathMatchState
        Public Property Text As String ' Full input text
        Public Property Position As Integer ' Current position in text for this path
        Public Property GarbageUsed As Integer ' Number of garbage words used in this path
        Public Property MaxGarbage As Integer ' Maximum garbage words allowed
        Public Property Bindings As Dictionary(Of String, Object) ' Extracted bindings for this path

        Public Sub New()
            Bindings = New Dictionary(Of String, Object)(StringComparer.OrdinalIgnoreCase)
            MaxGarbage = 5 ' Default: 5 words max
        End Sub

        ''' <summary>
        ''' Creates a copy of the path state (used when exploring alternative paths)
        ''' </summary>
        Public Function Clone() As PathMatchState
            Return New PathMatchState() With {
                .Text = Me.Text,
                .Position = Me.Position,
                .GarbageUsed = Me.GarbageUsed,
                .MaxGarbage = Me.MaxGarbage,
                .Bindings = New Dictionary(Of String, Object)(Me.Bindings)
            }
        End Function
    End Class
