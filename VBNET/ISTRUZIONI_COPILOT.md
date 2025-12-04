# Istruzioni per il Copilot - DDT Engine VB.NET

## Scopo

Questo documento fornisce istruzioni dettagliate per il Copilot quando assiste nello sviluppo del DDT Engine in VB.NET.

## Documentazione di Riferimento

**IMPORTANTE**: Prima di implementare qualsiasi funzione, consultare sempre:
- `../documentation/Motori.MD` - Specifica completa del DDT Engine con pseudo-codice dettagliato

## Architettura del Progetto

### Struttura
```
VBNET/
├── DDTEngine.Core/          # Core del motore
│   ├── Models/              # Classi di modello
│   ├── Engine/              # Logica del motore
│   └── Helpers/             # Funzioni helper
├── DDTEngine.TestUI/        # Interfaccia Windows Forms per test
└── TestData/                # DDT di esempio
```

### Classi Principali

1. **DDTInstance**: Rappresenta un'istanza di DDT
2. **DDTNode**: Rappresenta un nodo (mainData o subData)
3. **Response**: Rappresenta un response del dialogo
4. **ParseResult**: Risultato del parsing dell'input utente
5. **DDTEngine**: Classe principale che coordina il processo
6. **DataRetriever**: Gestisce GetNextData
7. **ResponseManager**: Gestisce GetResponse e ExecuteResponse
8. **Parser**: Gestisce InterpretUtterance
9. **StateManager**: Gestisce SetState
10. **MemoryManager**: Gestisce la memory centralizzata

## Convenzioni di Codice

1. **Naming**:
   - Classi: PascalCase (es. `DDTInstance`, `DataNode`)
   - Metodi: PascalCase (es. `GetNextData`, `ExecuteResponse`)
   - Variabili: camelCase (es. `currDataNode`, `parseResult`)
   - Costanti: UPPER_CASE

2. **Struttura**:
   - Ogni classe in un file separato
   - Namespace: `DDTEngine.Core`, `DDTEngine.TestUI`, ecc.
   - Usare `Option Strict On` e `Option Explicit On`

3. **LINQ**:
   - Usare LINQ per operazioni su collezioni (es. `FirstOrDefault`, `Where`, `Select`)
   - Preferire sintassi method-based quando possibile

## Logica da Implementare

### 1. GetNextData (DataRetriever.vb)

**Priorità**: Alta

**Logica**:
- Cerca tra tutti i nodi (mainData e subData) escludendo quelli in `acquisitionFailed`
- Stati di attenzione in ordine: `['empty', 'invalid', 'toConfirm', 'toValidate']`
- **MainData composito**: è `empty` solo se TUTTI i subData sono `empty`
- Se mainData è parziale, passa ai subData che necessitano attenzione (bubbling)
- Ritorna il primo nodo che necessita attenzione

**Riferimento**: `Motori.MD` righe 177-231

### 2. GetResponse (ResponseManager.vb)

**Priorità**: Alta

**Logica**:
- Ritorna SEMPRE un response (mai null)
- Gestisce fallback per stati specifici (noMatch → start, ecc.)
- Se non ci sono response disponibili, ritorna termination response con `exitType = 'noMoreAttempts'`
- Gestisce counter e maxRecovery

**Riferimento**: `Motori.MD` righe 236-271

### 3. ExecuteResponse (ResponseManager.vb)

**Priorità**: Alta

**Logica**:
- Se `exitType = 'noResponseNeeded'`, ritorna `false` (continua senza mostrare nulla)
- Sostituisce placeholder `{input}` se presente
- Mostra messaggio (da implementare con interfaccia)
- Esegue azioni se presenti
- Incrementa counter
- Ritorna `true` se c'è exit condition

**Riferimento**: `Motori.MD` righe 276-306

### 4. InterpretUtterance (Parser.vb)

**Priorità**: Alta

**Logica**:
- Carica contract per il nodo corrente
- Carica contract di background
- Gestisce `NoInput` se input vuoto
- **Stato confirmation**: prova prima correzione implicita, poi sì/no
- **Stato invalid**: riprova estrazione e validazione
- Prova prima contract in primo piano (Match)
- Prova contract di background (irrelevantMatch)
- Ritorna `NoMatch` se nessun match

**Riferimento**: `Motori.MD` righe 311-374

### 5. SetState (StateManager.vb)

**Priorità**: Alta

**Logica**:
- Aggiorna sia dialogue state che data state
- **Match**: markAsFilled, gestisce subData, passa a confirmation/validation
- **Confirmed**: markAsConfirmed, passa a validation se necessario
- **Validated**: markAsValidated, markAsCompleted, passa a success
- **Invalid**: markAsInvalid, ritorna conditionId
- **NotConfirmed**: ritorna notConfirmed
- Gestisce transizioni di stato complesse

**Riferimento**: `Motori.MD` righe 379-450

### 6. MemoryManager

**Priorità**: Media

**Logica**:
- Gestisce dictionary di MemoryEntry (value, state, invalidConditionId)
- Metodi: GetDataState, SetDataState, GetValue, SetValue
- Tutti i valori sono salvati in un contesto globale

**Riferimento**: `Motori.MD` sezione Memory Centralizzata

## Stati del Dato

- `empty`: Dato non ancora raccolto
- `filled`: Dato raccolto ma non confermato/validato
- `toConfirm`: Dato in attesa di conferma
- `confirmed`: Dato confermato ma non ancora validato
- `toValidate`: Dato confermato e in attesa di validazione
- `validated`: Dato validato e completato
- `completed`: Dato completamente processato
- `invalid`: Dato non valido (validazione fallita)
- `acquisitionFailed`: Dato non acquisibile (esauriti tutti i tentativi)

## Dialogue States

- `start`: Richiesta iniziale del dato
- `noMatch`: Input non riconosciuto
- `irrelevantMatch`: Match su altro nodo (background)
- `noInput`: Input vuoto
- `confirmation`: Chiede conferma del dato
- `notConfirmed`: Dato non confermato
- `invalid`: Dato non valido
- `conditionN`: Condizione specifica fallita
- `success`: Dato completato

## Note Importanti

1. **GetResponse non deve mai ritornare null**: usare termination response
2. **MainData composito**: empty solo se tutti i subData sono empty
3. **Bubbling**: se mainData è parziale, lavora sui subData
4. **Partial failure**: se un dato fallisce, continua con gli altri
5. **Validazione vs Conferma**: la conferma viene prima della validazione nel flusso
6. **Memory centralizzata**: tutti i valori sono salvati in un contesto globale
7. **Deterministico**: stesso input → stesso output

## TODO Attuali

1. Implementare logica completa in `Parser.InterpretUtterance`
2. Implementare logica completa in `StateManager.SetState`
3. Implementare gestione contract (estrazione dati)
4. Implementare validazione (ValidationHelper)
5. Implementare interfaccia di input/output in `MainForm`
6. Caricare DDT da JSON
7. Visualizzare stati dei dati in `StateViewer`

## Come Aiutare

Quando l'utente chiede aiuto:

1. **Sempre consultare `Motori.MD`** prima di suggerire implementazioni
2. **Seguire il pseudo-codice** presente in `Motori.MD`
3. **Mantenere la coerenza** con la logica descritta
4. **Usare VB.NET idiomatico** (LINQ, collections, ecc.)
5. **Gestire edge cases** (null, empty, ecc.)
6. **Aggiungere commenti** per spiegare la logica complessa
7. **Suggerire test** per verificare il comportamento

## Esempi di Codice

### Esempio: GetNextData con LINQ

```vb
Dim candidate As DDTNode = allCandidates.FirstOrDefault(
    Function(n) _memoryManager.GetDataState(n.Id) = state
)
```

### Esempio: Verifica mainData composito

```vb
If mainData.HasSubData() Then
    Dim allSubsEmpty As Boolean = mainData.SubData.All(
        Function(s) _memoryManager.GetDataState(s.Id) = "empty"
    )
End If
```

### Esempio: Gestione fallback

```vb
If Not currDataNode.Responses.ContainsKey(state) OrElse
   currDataNode.Responses(state).Count = 0 Then
    state = "start"  ' fallback
End If
```

## Riferimenti

- `../documentation/Motori.MD` - Specifica completa
- `README.md` - Panoramica del progetto
- `TestData/DatiPersonali.json` - DDT di esempio






