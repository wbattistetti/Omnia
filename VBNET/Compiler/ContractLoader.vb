Option Strict On
Option Explicit On

Imports TaskEngine

''' <summary>
''' Carica nlpContract per un nodo Task
''' Supporta caricamento da:
''' - JSON (se presente nel nodo)
''' - Database (TODO: implementare)
''' - Template cache (TODO: implementare)
''' </summary>
Public Class ContractLoader
    ''' <summary>
    ''' Carica nlpContract per un nodo
    ''' Ritorna NLPContract base (verrà compilato da TaskCompiler)
    ''' </summary>
    Public Function LoadContract(node As TaskEngine.TaskUtterance) As NLPContract
        ' PRIORITÀ 1: Contract già presente nel nodo (caricato da JSON)
        ' Se è già CompiledNlpContract, ritorna la base
        If node.NlpContract IsNot Nothing Then
            If TypeOf node.NlpContract Is CompiledNlpContract Then
                ' Già compilato, ritorna la base (ma non dovrebbe accadere qui)
                Return CType(node.NlpContract, CompiledNlpContract)
            Else
                ' Base contract, ritorna direttamente
                Return node.NlpContract
            End If
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

