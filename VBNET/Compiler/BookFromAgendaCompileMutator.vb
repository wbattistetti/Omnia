Option Strict On
Option Explicit On

Imports Compiler.DTO.IDE

''' <summary>
''' Compile-time: valorizza SEND projectId vuoto su Backend Call verso bookfromagenda usando metadata flusso.
''' </summary>
Public Module BookFromAgendaCompileMutator

    Public Sub Apply(backendDef As BackendCallTaskDefinition, flow As Flow)
        If backendDef Is Nothing OrElse flow Is Nothing Then Return
        Dim ep = backendDef.Endpoint
        If ep Is Nothing OrElse Not ep.ContainsKey("url") Then Return
        Dim url = ep("url")?.ToString()
        If String.IsNullOrWhiteSpace(url) Then Return
        If url.IndexOf("bookfromagenda", StringComparison.OrdinalIgnoreCase) < 0 Then Return

        Dim cliente = If(flow.OmniaClientSlug, "").Trim()
        Dim nome = If(flow.OmniaProjectName, "").Trim()
        Dim ver = If(flow.OmniaReleaseVersion, "").Trim()
        If String.IsNullOrWhiteSpace(cliente) Then cliente = "default"
        If String.IsNullOrWhiteSpace(nome) Then nome = "project"
        If String.IsNullOrWhiteSpace(ver) Then ver = "0"

        Dim inputs = backendDef.Inputs
        If inputs Is Nothing Then Return

        For Each row As Dictionary(Of String, Object) In inputs
            Dim api = If(row.ContainsKey("apiParam"), row("apiParam")?.ToString(), "")
            If Not String.Equals(api, "projectId", StringComparison.Ordinal) Then Continue For
            Dim varVal = If(row.ContainsKey("variable"), row("variable")?.ToString(), "")
            If Not String.IsNullOrWhiteSpace(varVal) Then Continue For
            row("variable") = BookFromAgendaProjectIdUtil.GenerateProjectId(cliente, nome, ver)
        Next
    End Sub

    ''' <summary>
    ''' Dopo Apply: compile-time richiede SEND projectId valorizzato per BookFromAgenda.
    ''' </summary>
    Public Sub ValidateDesignTimeProjectId(backendDef As BackendCallTaskDefinition)
        If backendDef Is Nothing Then Return
        Dim ep = backendDef.Endpoint
        If ep Is Nothing OrElse Not ep.ContainsKey("url") Then Return
        Dim url = ep("url")?.ToString()
        If String.IsNullOrWhiteSpace(url) Then Return
        If url.IndexOf("bookfromagenda", StringComparison.OrdinalIgnoreCase) < 0 Then Return

        Dim inputs = backendDef.Inputs
        If inputs Is Nothing Then
            Throw New InvalidOperationException("BookFromAgenda Backend Call: SEND inputs mancanti — compile richiede projectId.")
        End If
        For Each row As Dictionary(Of String, Object) In inputs
            Dim api = If(row.ContainsKey("apiParam"), row("apiParam")?.ToString(), "")
            If Not String.Equals(api, "projectId", StringComparison.Ordinal) Then Continue For
            Dim varVal = If(row.ContainsKey("variable"), row("variable")?.ToString(), "")
            If String.IsNullOrWhiteSpace(varVal) Then
                Throw New InvalidOperationException(
                    "BookFromAgenda: SEND projectId è obbligatorio a design-time (valorizzare il binding o passare omniaClientSlug / omniaProjectName / omniaReleaseVersion per auto-generazione).")
            End If
            Return
        Next
        Throw New InvalidOperationException("BookFromAgenda: manca la riga SEND per apiParam projectId.")
    End Sub

End Module
