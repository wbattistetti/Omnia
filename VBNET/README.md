# DDT Engine - Progetto VB.NET

## Scopo del Progetto

Questo progetto implementa il **DDT Engine (DataDialogueTemplate Engine)** in VB.NET, basato sulla specifica dettagliata nel documento `documentation/Motori.MD`.

Il DDT Engine gestisce dialoghi deterministici per l'acquisizione di dati strutturati, con supporto per:
- MainData e SubData (dati compositi)
- Stati del dialogo (start, noMatch, noInput, confirmation, invalid, success, ecc.)
- Stati dei dati (empty, filled, toConfirm, confirmed, toValidate, validated, completed, acquisitionFailed)
- Validazione e conferma dei dati
- Recovery e gestione degli errori
- Partial failure (continua con altri dati se uno fallisce)

## Struttura del Progetto

```
VBNET/
├── DDTEngine.Core/          # Core del motore
│   ├── Models/              # Classi di modello (DDTInstance, DDTNode, Response, ecc.)
│   ├── Engine/              # Logica del motore (Execute, GetNextData, SetState, ecc.)
│   └── Helpers/             # Funzioni helper  (ValidationHelper)
├── DDTEngine.TestUI/        # Interfaccia Windows Forms per test
│   ├── MainForm.vb          # Form principale con chat
│   └── Controls/             # Controlli personalizzati
├── DDTEngine.Tests/         # Test unitari
└── TestData/                # DDT di esempio per test
    └── DatiPersonali.json    # Esempio: Nome, Cognome, Indirizzo, Telefono
```

## Documentazione di Riferimento

**IMPORTANTE**: Tutta la logica del motore è descritta in dettaglio in:
- `../documentation/Motori.MD` - Specifica completa del DDT Engine

Prima di implementare qualsiasi funzione, consultare `Motori.MD` per:
- Pseudo-codice dettagliato
- Logica di gestione degli stati
- Flusso del ciclo principale
- Decisioni di design

## Architettura Principale

### Flusso del Motore

1. **Execute(DDTInstance)**: Funzione principale che coordina il processo
   - Mostra introduction se presente
   - Ciclo principale: GetNextData → GetResponse → ExecuteResponse → InterpretUtterance → SetState
   - Mostra successResponse se presente alla fine

2. **GetNextData(DDTInstance)**: Trova il prossimo dato da recuperare
   - Cerca tra tutti i nodi (mainData e subData)
   - Esclude nodi in stato `acquisitionFailed`
   - Gestisce mainData compositi: empty solo se tutti i subData sono empty
   - Priorità: empty → invalid → toConfirm → toValidate

3. **GetResponse(currDataNode, state)**: Ottiene il response corretto
   - Basato su dialogue state e counter
   - Ritorna sempre un response (mai null)
   - Se non ci sono più tentativi, ritorna termination response

4. **ExecuteResponse(response, state, currDataNode)**: Esegue il response
   - Mostra il messaggio
   - Incrementa il counter
   - Ritorna `true` se c'è un exit condition

5. **InterpretUtterance(currDataNode, state)**: Esegue solo il parsing
   - Usa estrattori (regex/rules/NER/LLM)
   - Ritorna ParseResult con result e dati estratti

6. **SetState(parseResult, state, currDataNode)**: Gestisce transizioni di stato
   - Aggiorna dialogue state
   - Aggiorna data state (filled, confirmed, validated, ecc.)
   - Ritorna il nuovo dialogue state

### Stati del Dato

- **empty**: Dato non ancora raccolto
- **filled**: Dato raccolto ma non confermato/validato
- **toConfirm**: Dato in attesa di conferma
- **confirmed**: Dato confermato ma non ancora validato
- **toValidate**: Dato confermato e in attesa di validazione
- **validated**: Dato validato e completato
- **completed**: Dato completamente processato
- **invalid**: Dato non valido (validazione fallita)
- **acquisitionFailed**: Dato non acquisibile (esauriti tutti i tentativi)

### Dialogue States

- **start**: Richiesta iniziale del dato
- **noMatch**: Input non riconosciuto
- **irrelevantMatch**: Match su altro nodo (background)
- **noInput**: Input vuoto
- **confirmation**: Chiede conferma del dato
- **notConfirmed**: Dato non confermato
- **invalid**: Dato non valido
- **conditionN**: Condizione specifica fallita
- **success**: Dato completato

## Convenzioni di Codice VB.NET

1. **Naming**:
   - Classi: PascalCase (es. `DDTInstance`, `DataNode`)
   - Metodi: PascalCase (es. `GetNextData`, `ExecuteResponse`)
   - Variabili: camelCase (es. `currDataNode`, `parseResult`)
   - Costanti: UPPER_CASE (es. `ATTENTION_STATES`)

2. **Struttura**:
   - Ogni classe in un file separato
   - Namespace: `DDTEngine.Core`, `DDTEngine.TestUI`, ecc.
   - Usare `Option Strict On` e `Option Explicit On`

3. **Gestione Errori**:
   - Usare Try-Catch per gestire eccezioni
   - Logging per debug

## Come Testare

1. **Interfaccia TestUI**:
   - Aprire `DDTEngine.TestUI` in Visual Studio
   - Eseguire il progetto
   - Usare la chat per testare il motore
   - Visualizzare gli stati dei dati in tempo reale

2. **Test Unitari**:
   - Eseguire i test in `DDTEngine.Tests`
   - Verificare ogni funzione individualmente

3. **Debug**:
   - Usare breakpoint in Visual Studio
   - Verificare il flusso del ciclo principale
   - Controllare gli stati dei dati nella memory

## Istruzioni per il Copilot

Quando aiuti con questo progetto:

1. **Sempre consultare `Motori.MD`** prima di implementare qualsiasi funzione
2. **Seguire il pseudo-codice** presente in `Motori.MD`
3. **Mantenere la coerenza** con la logica descritta nel documento
4. **Usare VB.NET idiomatico** (LINQ, collections, ecc.)
5. **Gestire mainData compositi** correttamente (empty solo se tutti i subData sono empty)
6. **Escludere sempre** i nodi in stato `acquisitionFailed` da GetNextData
7. **GetResponse non deve mai ritornare null** (usare termination response)
8. **SetState deve gestire** sia dialogue state che data state

## DDT di Esempio

Il file `TestData/DatiPersonali.json` contiene un DDT di esempio completo con:
- Nome (subData)
- Cognome (subData)
- Indirizzo (mainData composito con Tipo Via, Nome Via, Numero Civico)
- Telefono (mainData semplice)

Usare questo DDT per testare il motore.

## Note Importanti

- Il motore è **deterministico**: stesso input → stesso output
- La **memory è centralizzata**: tutti i valori sono salvati in un contesto globale
- **Partial failure**: se un dato fallisce, continua con gli altri
- **Bubbling**: se mainData è parziale, lavora sui subData
- **Validazione prima di conferma**: i dati devono essere validati prima di essere confermati (ma la conferma viene prima della validazione nel flusso)

## Prossimi Passi

1. Implementare le classi Models
2. Implementare le funzioni Engine
3. Creare l'interfaccia TestUI
4. Scrivere test unitari
5. Testare con DatiPersonali.json






