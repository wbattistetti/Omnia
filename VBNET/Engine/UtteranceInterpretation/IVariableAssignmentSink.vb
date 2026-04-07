Option Strict On
Option Explicit On


''' <summary>
''' Punto di estensione per l'assegnazione variabili DOPO il parsing.
''' L'orchestratore di questo modulo non chiama automaticamente il sink: lo invoca il codice di integrazione
''' (futuro) così parsing e persistenza restano separati.
''' </summary>
Public Interface IVariableAssignmentSink

        ''' <summary>Riceve i valori estratti per un task (identificativo logico, es. task instance id).</summary>
        Sub Assign(taskId As String, values As IReadOnlyDictionary(Of String, Object))

    End Interface
