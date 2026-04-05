Option Strict On
Option Explicit On
Imports System.Collections.Generic

''' <summary>
''' Errore di compilazione utterance con <see cref="CompilationError"/> strutturati per il report UI.
''' </summary>
Public Class UtteranceTaskCompilationException
    Inherits Exception

    Public ReadOnly Property Errors As IReadOnlyList(Of CompilationError)

    Public Sub New(message As String)
        MyBase.New(message)
        Errors = New List(Of CompilationError)()
    End Sub

    Public Sub New(message As String, ParamArray structured As CompilationError())
        MyBase.New(message)
        Errors = If(structured Is Nothing, New List(Of CompilationError)(), New List(Of CompilationError)(structured))
    End Sub

    Public Sub New(message As String, structured As IEnumerable(Of CompilationError))
        MyBase.New(message)
        Errors = If(structured Is Nothing, New List(Of CompilationError)(), New List(Of CompilationError)(structured))
    End Sub

    Public Sub New(message As String, inner As Exception, ParamArray structured As CompilationError())
        MyBase.New(message, inner)
        Errors = If(structured Is Nothing, New List(Of CompilationError)(), New List(Of CompilationError)(structured))
    End Sub

End Class
