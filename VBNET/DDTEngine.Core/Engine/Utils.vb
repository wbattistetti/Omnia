Imports System.Diagnostics.Metrics
Imports System.Runtime.CompilerServices
Imports System.Runtime.InteropServices.JavaScript.JSType

Module Utils
    <Extension>
    Public Function IsEmpty(dataNode As DDTNode) As Boolean
        If dataNode.SubData.Any Then
            Return Not dataNode.SubData.Any(Function(sd) sd.Value IsNot Nothing)
        Else
            Return dataNode.Value Is Nothing
        End If
    End Function

    <Extension>
    Public Function IsFilled(dataNode As DDTNode) As Boolean
        If dataNode.SubData.Any Then
            Return Not dataNode.SubData.Any(Function(sd) sd.Value Is Nothing)
        Else
            Return dataNode.Value IsNot Nothing
        End If
    End Function

    <Extension>
    Public Function HasExitCondition(actions As IEnumerable(Of IAction)) As Boolean
        Return actions.Any(Function(a) TypeOf (a) Is CloseSessionAction OrElse TypeOf (a) Is TransferAction)
    End Function

    <Extension>
    Public Function ExitType(response As Response) As String
        ' TODO: Implementare logica per determinare il tipo di exit condition
        ' Per ora ritorna stringa vuota
        Return ""
    End Function

End Module
