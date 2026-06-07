Option Strict On
Option Explicit On

Imports System.Collections.Generic

Namespace KbDialogStep
    ''' <summary>Griglia tabella KB (headers + righe).</summary>
    Public Class KbDialogGrid
        Public Property Headers As List(Of String)
        Public Property Rows As List(Of List(Of String))
    End Class

    ''' <summary>Colonna selectorSpec.</summary>
    Public Class SelectorColumnSpec
        Public Property ColumnId As String
        Public Property HeaderLabel As String
        Public Property Role As String
        Public Property PromptType As String
        Public Property SortOrder As Integer
        Public Property PromptTemplate As String
        Public Property AskPolicy As String
        Public Property AutoFillSingleValue As Boolean
    End Class

    Public Class InvalidationTemplateSpec
        Public Property Id As String
        Public Property Approved As Boolean
        Public Property Template As String
    End Class

    Public Class KbSelectorSpec
        Public Property SchemaVersion As Integer = 1
        Public Property Columns As List(Of SelectorColumnSpec)
        Public Property InvalidationTemplates As List(Of InvalidationTemplateSpec)
    End Class

    Public Class KbDialogRuntimeLoadResult
        Public Property ErrorCode As String
        Public Property DocumentId As String
        Public Property DocumentName As String
        Public Property Grid As KbDialogGrid
        Public Property SelectorSpec As KbSelectorSpec

        Public ReadOnly Property HasError As Boolean
            Get
                Return Not String.IsNullOrEmpty(ErrorCode)
            End Get
        End Property
    End Class

    Public Class DialogStepRejectedInfo
        Public Property ColumnId As String
        Public Property Value As String
        Public Property Alternative As String
    End Class

    ''' <summary>Risultato di executeDialogStep (parità contratto Node).</summary>
    Public Class DialogStepResult
        Public Property Status As String
        Public Property Say As String
        Public Property SayCore As String
        Public Property UseCaseId As String
        Public Property UseCaseKind As String
        Public Property Binding As Dictionary(Of String, String)
        Public Property NextColumnId As String
        Public Property NextHeaderLabel As String
        Public Property PromptType As String
        Public Property AskPolicy As String
        Public Property AllowedValues As List(Of String)
        Public Property RemainingRowCount As Integer
        Public Property MatchedRow As Dictionary(Of String, String)
        Public Property MatchedRows As List(Of Dictionary(Of String, String))
        Public Property Rejected As DialogStepRejectedInfo
    End Class
End Namespace
