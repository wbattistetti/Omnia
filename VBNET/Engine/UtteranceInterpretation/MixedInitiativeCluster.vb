Option Strict On
Option Explicit On

Imports System.Linq
Imports Compiler

''' <summary>Cluster MI: statico (compilazione) e attivo (runtime).</summary>
Public Module MixedInitiativeCluster

    ''' <summary>
    ''' Tutti i <see cref="CompiledUtteranceTask"/> top-level del main e dei subflow, dedup per Id, ordine di inserimento (main poi subflow).
    ''' </summary>
    Public Function GetStaticCluster(main As CompiledFlow, Optional subflows As Dictionary(Of String, CompiledFlow) = Nothing) As List(Of CompiledUtteranceTask)
        If main Is Nothing Then Throw New ArgumentNullException(NameOf(main))
        Dim seen As New HashSet(Of String)(StringComparer.Ordinal)
        Dim cluster As New List(Of CompiledUtteranceTask)()
        MergeDedup(seen, cluster, main.Tasks)
        If subflows IsNot Nothing Then
            For Each kvp In subflows
                If kvp.Value IsNot Nothing Then
                    MergeDedup(seen, cluster, kvp.Value.Tasks)
                End If
            Next
        End If
        Return cluster
    End Function

    Private Sub MergeDedup(seen As HashSet(Of String), out As List(Of CompiledUtteranceTask), tasks As IList(Of CompiledTask))
        If tasks Is Nothing Then Return
        For Each t In tasks.OfType(Of CompiledUtteranceTask)
            If t Is Nothing Then Continue For
            Dim id = t.Id
            If String.IsNullOrEmpty(id) Then Continue For
            If seen.Add(id) Then out.Add(t)
        Next
    End Sub

    ''' <summary>
    ''' Task corrente (primo) da grafo compilato vivo + resto del cluster statico non filled, escluso il corrente.
    ''' </summary>
    Public Function GetActiveCluster(
            staticCluster As IReadOnlyList(Of CompiledUtteranceTask),
            state As DialogueState,
            liveCompiledRoot As CompiledUtteranceTask,
            currentFromState As CompiledUtteranceTask
        ) As List(Of IUtteranceTask)

        If staticCluster Is Nothing Then Throw New ArgumentNullException(NameOf(staticCluster))
        If state Is Nothing Then Throw New ArgumentNullException(NameOf(state))
        If liveCompiledRoot Is Nothing Then Throw New ArgumentNullException(NameOf(liveCompiledRoot))
        If currentFromState Is Nothing Then Throw New ArgumentNullException(NameOf(currentFromState))

        Dim resolved = CompiledUtteranceTaskTree.FindById(liveCompiledRoot, currentFromState.Id)
        If resolved Is Nothing Then resolved = currentFromState

        Dim active As New List(Of IUtteranceTask)()
        active.Add(New CompiledTaskAdapter(resolved))

        For Each t In staticCluster
            If t Is Nothing Then Continue For
            If String.Equals(t.Id, resolved.Id, StringComparison.Ordinal) Then Continue For
            If t.IsFilled(state) Then Continue For
            active.Add(New CompiledTaskAdapter(t))
        Next

        Return active
    End Function

End Module
