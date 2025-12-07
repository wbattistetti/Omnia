Option Strict On
Option Explicit On

Imports System.Collections.Generic
Imports DDTEngine

''' <summary>
''' Compilatore DDT: carica e prepara DDTInstance per il runtime
''' - Carica DDT da JSON
''' - Carica nlpContract per ogni nodo (da JSON o DB)
''' - Valida struttura
''' - Pre-compila regex
''' - Calcola FullLabel (già fatto da DDTLoader)
''' </summary>
Public Class DDTCompiler
    Private ReadOnly _contractLoader As ContractLoader

    Public Sub New()
        _contractLoader = New ContractLoader()
    End Sub

    ''' <summary>
    ''' Compila un DDT da stringa JSON
    ''' </summary>
    Public Function Compile(ddtJson As String) As DDTCompilationResult
        If String.IsNullOrEmpty(ddtJson) Then
            Throw New ArgumentException("DDT JSON cannot be null or empty", NameOf(ddtJson))
        End If

        ' 1. Carica DDT base da JSON string
        Dim instance As DDTInstance = DDTLoader.LoadFromJsonString(ddtJson)

        ' 2. Carica nlpContract per tutti i nodi
        LoadContractsForAllNodes(instance)

        ' 3. Valida struttura (placeholder, regex, ecc.)
        Dim validationErrors As List(Of String) = ValidateInstance(instance)

        Dim result As New DDTCompilationResult()
        result.Instance = instance
        result.ValidationErrors = validationErrors
        result.IsValid = (validationErrors.Count = 0)
        Return result
    End Function

    ''' <summary>
    ''' Carica nlpContract per tutti i nodi del DDT
    ''' </summary>
    Private Sub LoadContractsForAllNodes(instance As DDTInstance)
        If instance.MainDataList IsNot Nothing Then
            For Each mainData As DDTNode In instance.MainDataList
                LoadContractForNode(mainData)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Carica nlpContract per un nodo e ricorsivamente per i suoi subData
    ''' </summary>
    Private Sub LoadContractForNode(node As DDTNode)
        ' Se il contract non è già presente, prova a caricarlo
        If node.NlpContract Is Nothing Then
            node.NlpContract = _contractLoader.LoadContract(node)
        End If

        ' Ricorsivo per subData
        If node.SubData IsNot Nothing Then
            For Each subData As DDTNode In node.SubData
                LoadContractForNode(subData)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida la struttura del DDT
    ''' </summary>
    Private Function ValidateInstance(instance As DDTInstance) As List(Of String)
        Dim errors As New List(Of String)()

        If instance.MainDataList IsNot Nothing Then
            For Each mainData As DDTNode In instance.MainDataList
                ValidateNode(mainData, errors)
            Next
        End If

        Return errors
    End Function

    ''' <summary>
    ''' Valida un nodo e ricorsivamente i suoi subData
    ''' </summary>
    Private Sub ValidateNode(node As DDTNode, errors As List(Of String))
        ' Valida placeholder nei messaggi
        If node.Steps IsNot Nothing Then
            For Each dstep As DialogueStep In node.Steps
                If dstep.Escalations IsNot Nothing Then
                    For Each escalation As Escalation In dstep.Escalations
                        If escalation.Actions IsNot Nothing Then
                            For Each action As IAction In escalation.Actions
                                If TypeOf action Is MessageAction Then
                                    Dim msgAction As MessageAction = DirectCast(action, MessageAction)
                                    ValidatePlaceholders(msgAction.Text, node, errors)
                                End If
                            Next
                        End If
                    Next
                End If
            Next
        End If

        ' Valida regex nel contract (se presente)
        If node.NlpContract IsNot Nothing AndAlso node.NlpContract.Regex IsNot Nothing Then
            ValidateRegexPatterns(node.NlpContract.Regex, node, errors)
        End If

        ' Ricorsivo per subData
        If node.SubData IsNot Nothing Then
            For Each subData As DDTNode In node.SubData
                ValidateNode(subData, errors)
            Next
        End If
    End Sub

    ''' <summary>
    ''' Valida placeholder nel testo
    ''' </summary>
    Private Sub ValidatePlaceholders(text As String, node As DDTNode, errors As List(Of String))
        If String.IsNullOrEmpty(text) Then Return

        ' Pattern: [FullLabel]
        Dim placeholderPattern As New Text.RegularExpressions.Regex("\[([^\]]+)\]")
        Dim matches As Text.RegularExpressions.MatchCollection = placeholderPattern.Matches(text)

        For Each match As Text.RegularExpressions.Match In matches
            Dim fullLabel As String = match.Groups(1).Value
            ' TODO: Verifica che FullLabel esista nel DDT
            ' Per ora solo log
        Next
    End Sub

    ''' <summary>
    ''' Valida pattern regex nel contract
    ''' </summary>
    Private Sub ValidateRegexPatterns(regexConfig As RegexConfig, node As DDTNode, errors As List(Of String))
        If regexConfig.Patterns IsNot Nothing Then
            For Each pattern As String In regexConfig.Patterns
                Try
                    Dim testRegex As New Text.RegularExpressions.Regex(pattern)
                Catch ex As Exception
                    errors.Add($"Nodo '{node.Name}' (ID: {node.Id}): Pattern regex invalido: {pattern}. Errore: {ex.Message}")
                End Try
            Next
        End If
    End Sub
End Class

''' <summary>
''' DDT Compilation Result: Output of DDTCompiler
''' </summary>
Public Class DDTCompilationResult
    ''' <summary>
    ''' Istanza DDT compilata
    ''' </summary>
    Public Property Instance As DDTInstance

    ''' <summary>
    ''' Lista di errori di validazione
    ''' </summary>
    Public Property ValidationErrors As List(Of String)

    ''' <summary>
    ''' Indica se la compilazione è valida
    ''' </summary>
    Public Property IsValid As Boolean

    Public Sub New()
        ValidationErrors = New List(Of String)()
    End Sub
End Class

