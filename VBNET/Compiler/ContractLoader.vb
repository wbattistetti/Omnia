Option Strict On
Option Explicit On

Imports DDTEngine

''' <summary>
''' Carica nlpContract per un nodo DDT
''' Supporta caricamento da:
''' - JSON (se presente nel nodo)
''' - Database (TODO: implementare)
''' - Template cache (TODO: implementare)
''' </summary>
Public Class ContractLoader
    ''' <summary>
    ''' Carica nlpContract per un nodo
    ''' </summary>
    Public Function LoadContract(node As DDTNode) As NLPContract
        ' PRIORITÀ 1: Contract già presente nel nodo (caricato da JSON)
        If node.NlpContract IsNot Nothing Then
            Return node.NlpContract
        End If

        ' PRIORITÀ 2: Carica da database/template (TODO: implementare)
        ' Per ora ritorna Nothing se non presente nel JSON
        ' Il Parser userà fallback a regex hardcoded

        Return Nothing
    End Function

    ''' <summary>
    ''' Carica contract da database (TODO: implementare)
    ''' </summary>
    Private Function LoadContractFromDatabase(templateId As String) As NLPContract
        ' TODO: Implementare caricamento da MongoDB/database
        Return Nothing
    End Function
End Class

