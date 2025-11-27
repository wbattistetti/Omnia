# DDT Engine - Manuale Tecnico

## Indice
1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Stati e Context](#stati-e-context)
4. [Algoritmo Core](#algoritmo-core)
5. [Funzioni Principali](#funzioni-principali)
6. [Gestione Input](#gestione-input)
7. [Transizioni di Stato](#transizioni-di-stato)
8. [Escalation](#escalation)
9. [Memory Management](#memory-management)

---

## Panoramica

Il **DDT Engine** è un motore di dialogo deterministico che raccoglie dati strutturati attraverso una macchina a stati. Gestisce la conversazione con l'utente per raccogliere tutti i dati richiesti da un Dialogue Data Template (DDT).

### Principi Fondamentali

1. **Macchina a Stati Deterministica**: Ogni nodo (main data o sub-data) ha uno stato che determina quale messaggio mostrare
2. **Separazione Step/Context**:
   - **Step** = stato con messaggio (Start, NoMatch, NoInput, Confirmation, NotConfirmed, Success)
   - **Context** = ambito di raccolta (CollectingMain vs CollectingSub)
3. **Memory Centralizzata**: Tutti i valori raccolti sono salvati in `state.memory[nodeId] = { value, confirmed }`
4. **Counters per Escalation**: Ogni nodo ha contatori separati per escalation (noMatch, noInput, notConfirmed)
5. **Contract-based Extraction**: L'estrazione dei dati avviene tramite contract (regex/NER/LLM) che determinano match/noMatch/noInput

### Regola di Modellazione Dati

**IMPORTANTE**: Per mantenere la logica semplice e deterministica:

- **Main atomico**: Nessun sub (es. email, phone, codice fiscale)
- **Main composito**: Almeno 2 sub (es. date con day, month, year)
- **Non usare main con 1 solo sub** (è ridondante: il main coincide con il sub)

---

## Architettura

### Struttura Dati Principale

```typescript
interface DDTEngineState {
  memory: Record<string, { value: any; confirmed: boolean }>;
  counters: Record<string, Counters>;
  currentMainId?: string;
  currentSubId?: string;
  turnState: TurnState;
  context: Context;
}

interface Counters {
  noMatch: number;
  noInput: number;
  notConfirmed: number;
  confirmation: number;
}

type TurnState = 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success' | null;
type Context = 'CollectingMain' | 'CollectingSub';
type TurnEvent = 'Match' | 'NoMatch' | 'NoInput' | 'Confirmed' | 'NotConfirmed' | 'Unknown';
```

### Flusso di Esecuzione

Il motore esegue un ciclo continuo (`runDDT`) fino a quando tutti i dati richiesti sono stati raccolti:

1. **Trova prossimo dato vuoto** → `getNextData()`
2. **Determina stato corrente** → `getNodeState()`
3. **Seleziona risposta** → `getResponse()`
4. **Esegue risposta** → `executeResponse()` → `executeStep()`
5. **Attende input utente** → `processUserInput()`
6. **Processa input** → Contract estrae valore o determina noMatch/noInput
7. **Gestisce transizione** → `getState()` → `updateState()`
8. **Ripete ciclo** o termina se tutti i dati sono raccolti

---

## Stati e Context

### Stati Disponibili

| Stato | Descrizione | Quando si attiva |
|-------|-------------|------------------|
| **Start** | Stato iniziale, chiede il dato | Quando il nodo diventa attivo |
| **NoMatch** | Input non riconosciuto | Contract ritorna `status: 'noMatch'` |
| **NoInput** | Input vuoto | Utente preme Enter senza testo |
| **Confirmation** | Chiede conferma del dato | Dato saturated e confirmation prevista |
| **NotConfirmed** | Dato non confermato | Utente risponde "no" alla confirmation |
| **Success** | Dato completato | Dopo confirmation positiva o se non prevista |

### Context

- **CollectingMain**: Stiamo raccogliendo il dato main (può essere atomico o composito)
- **CollectingSub**: Stiamo raccogliendo un sub del main (solo per dati compositi)

**IMPORTANTE**: Il context NON è uno step, ma un'indicazione di quale nodo è attivo.

---

## Algoritmo Core

### Funzione Principale: `runDDT`

```pseudocode
FUNZIONE runDDT(ddtInstance, callbacks, limits):
    // Inizializzazione
    state = initializeState(ddtInstance)

    // Mostra introduction se presente
    SE ddtInstance.introduction ESISTE:
        playIntroduction(ddtInstance.introduction, callbacks)

    // Ciclo principale
    MENTRE true:
        // 1. Trova prossimo dato da raccogliere
        currData = getNextData(ddtInstance, state)

        SE currData === null:
            // Tutti i dati raccolti
            RITORNA { success: true, value: state.memory }

        // 2. Determina stato corrente del nodo
        nodeState = getNodeState(state, currData.nodeId)
        turnState = nodeState.step
        counters = nodeState.counters

        // 3. Seleziona risposta (step/escalation) da mostrare
        currResponse = getResponse(currData, turnState, counters, limits)

        // 4. Esegui risposta (mostra messaggio, esegui azioni)
        executeResponse(currResponse, callbacks, currData, state)

        // 5. Attendi input e processa per ottenere TurnEvent
        currTurnEvent = processUserInput(currData, callbacks, state, currResponse.stepType)

        // 6. Gestisci NoMatch/NoInput immediatamente
        SE currTurnEvent === 'NoMatch' OPPURE currTurnEvent === 'NoInput':
            // Incrementa counter
            counter = SE currTurnEvent === 'NoMatch' ALLORA counters.noMatch + 1
                      ALTRIMENTI counters.noInput + 1

            // Aggiorna counters nello state
            state.counters[currData.nodeId][currTurnEvent] = counter

            // Mostra escalation
            targetNode = SE currData.isMain ALLORA currData.mainData ALTRIMENTI currData.subData
            stepType = SE currTurnEvent === 'NoMatch' ALLORA 'noMatch' ALTRIMENTI 'noInput'
            step = getStep(targetNode, stepType)
            recovery = getEscalationRecovery(step, stepType, counter)
            executeStep(recovery, callbacks, stepType, counter)

            // Torna a Start per riprovare
            state.turnState = 'Start'
            state.context = SE currData.isMain ALLORA 'CollectingMain' ALTRIMENTI 'CollectingSub'
            CONTINUA // Continua ciclo per chiedere di nuovo

        // 7. Gestisci transizione di stato basata sull'evento
        turnStateDesc = getState(currTurnEvent, currData, turnState, counters, limits, state, ddtInstance)

        // 8. Aggiorna stato globale
        state = updateState(state, turnStateDesc, currData)

        // 9. Se siamo andati a Confirmation, continua ciclo per eseguire step Confirmation
        SE turnStateDesc.turnState === 'Confirmation':
            CONTINUA // Continua ciclo per eseguire step Confirmation

        // 10. Se siamo andati a Success, esegui step Success prima di terminare
        SE turnStateDesc.turnState === 'Success':
            targetNode = SE currData.isMain ALLORA currData.mainData ALTRIMENTI currData.subData
            successStep = getStep(targetNode, 'success')
            SE successStep ESISTE:
                executeStep(successStep, callbacks, 'success', 0)

            // Controlla se ci sono altri dati o termina
            nextData = peekNextData(ddtInstance, state)
            SE nextData === null:
                INTERROMPI // Tutti i dati raccolti
            ALTRIMENTI:
                CONTINUA // Continua con prossimo dato

        // 11. Controlla condizione di uscita
        SE turnStateDesc.turnState === null:
            INTERROMPI

    RITORNA { success: true, value: state.memory }
```

---

## Funzioni Principali

### `getNextData(ddtInstance, state)`

Trova il prossimo dato vuoto da raccogliere.

**Logica**:
1. Itera su tutti i `mainData` nel DDT
2. Per ogni mainData:
   - Se mainData è vuoto → ritorna mainData
   - Se mainData richiede confirmation e non è confirmed → ritorna mainData
   - Se mainData ha subData → controlla se qualche sub required è vuoto
   - Se sub vuoto trovato → ritorna subData
3. Se nessun dato vuoto → ritorna `null` (tutti i dati raccolti)

**Ritorna**: `CurrentData | null` dove `CurrentData = { mainData, subData?, nodeId, isMain }`

### `getNodeState(state, nodeId)`

Determina lo stato corrente di un nodo.

**Logica**:
1. Recupera counters del nodo (o inizializza se non esiste)
2. Determina step basato su `state.turnState` e `state.context`
3. Se context è CollectingSub e nodeId corrisponde a currentSubId → usa turnState
4. Se context è CollectingMain e nodeId corrisponde a currentMainId → usa turnState
5. Altrimenti → step = 'Start'

**Ritorna**: `{ step: TurnState, counters: Counters }`

### `getResponse(currData, turnState, counters, limits)`

Seleziona quale step/escalation mostrare in base allo stato corrente.

**Logica**:
- **Start**: Recupera step 'start', escalationLevel = counters.noMatch
- **NoMatch**: Recupera step 'noMatch', escalationLevel = counters.noMatch + 1, recovery escalation
- **NoInput**: Recupera step 'noInput', escalationLevel = counters.noInput + 1, recovery escalation
- **Confirmation**: Recupera step 'confirmation'
- **NotConfirmed**: Recupera step 'notConfirmed', escalationLevel = counters.notConfirmed + 1, recovery escalation
- **Success**: Recupera step 'success'

**Ritorna**: `Response` con `stepType`, `escalationLevel`, `stepOrEscalation`

### `executeResponse(response, callbacks, currData, state)`

Esegue la risposta selezionata (mostra messaggio, esegue azioni).

**Logica**:
1. Se stepType è 'confirmation', recupera valori dalla memoria per sostituire placeholder `{input}`
2. Chiama `executeStep(response.stepOrEscalation, callbacks, stepType, escalationLevel, inputValue)`

### `processUserInput(currData, callbacks, state, stepType)`

Processa l'input utente e produce un TurnEvent.

**Logica**:
1. Carica contract dal nodo: `loadContract(node)`
2. Attende input: `callbacks.onGetRetrieveEvent(nodeId)`
3. Se stepType è 'confirmation':
   - Se input è "yes" → ritorna 'Confirmed'
   - Se input è "no" → ritorna 'NotConfirmed'
   - Altrimenti → ritorna 'NoMatch'
4. Altrimenti:
   - Se userInputEvent.type === 'match' → chiama `callbacks.onProcessInput(input, node)`
   - Se userInputEvent.type === 'noInput' → ritorna 'NoInput'
   - Se userInputEvent.type === 'noMatch' → ritorna 'NoMatch'
5. Processa recognitionResult:
   - Se status === 'match' e non matchedButInvalid:
     - Se mainData composito e value è oggetto → mappa canonicalKey → subId e salva in memory
     - Altrimenti → salva direttamente in memory
     - Ritorna 'Match'
   - Se status === 'noMatch' → ritorna 'NoMatch'
   - Se status === 'noInput' → ritorna 'NoInput'
   - Se status === 'partialMatch' → tratta come match

**Ritorna**: `TurnEvent`

### `getState(currTurnEvent, currData, prevState, counters, limits, state, ddtInstance)`

Determina la prossima transizione di stato basata sull'evento.

**Logica per ogni TurnEvent**:

- **Match**:
  - Se CollectingSub:
    - Trova sub mancanti: `findMissingRequiredSubs(mainData, state.memory)`
    - Se ci sono sub mancanti → `{ turnState: 'Start', context: 'CollectingSub', nextDataId: missingSubs[0].id }`
    - Se tutti sub filled → Confirmation (se prevista) o Success
  - Se CollectingMain:
    - Se mainData ha subData:
      - Se ci sono sub mancanti → `{ turnState: 'Start', context: 'CollectingSub', nextDataId: missingSubs[0].id }`
      - Se tutti sub filled → Confirmation (se prevista) o Success
    - Se mainData atomico → Confirmation (se prevista) o Success

- **NoMatch**: `{ turnState: 'NoMatch', context: CollectingMain/CollectingSub, counter: counters.noMatch + 1 }`
- **NoInput**: `{ turnState: 'NoInput', context: CollectingMain/CollectingSub, counter: counters.noInput + 1 }`
- **Confirmed**: `{ turnState: 'Success', context: 'CollectingMain', counter: 0 }` + marca come confirmed
- **NotConfirmed**: `{ turnState: 'NotConfirmed', context: 'CollectingMain', counter: counters.notConfirmed + 1 }`
- **Unknown**: Tratta come NoMatch

**Ritorna**: `TurnStateDescriptor`

### `updateState(state, turnStateDesc, currData)`

Aggiorna lo stato globale con la nuova transizione.

**Logica**:
1. Aggiorna `state.turnState = turnStateDesc.turnState`
2. Aggiorna `state.context = turnStateDesc.context`
3. Aggiorna `state.currentMainId` e `state.currentSubId` in base al context
4. Aggiorna counters del nodo corrente in base al turnState

**Ritorna**: `DDTEngineState` aggiornato

---

## Gestione Input

### Processo di Elaborazione

1. **Ricezione Input**: `callbacks.onGetRetrieveEvent(nodeId)` attende input utente
2. **Estrazione**: `callbacks.onProcessInput(input, node)` usa contract per estrarre valore
3. **Risultato Contract**:
```typescript
   {
     status: 'match' | 'noMatch' | 'noInput' | 'partialMatch',
     value?: any,
     matchedButInvalid?: boolean
   }
   ```
4. **Salvataggio Memory**: Se match, `updateMemory(state, nodeId, value)`
5. **Determinazione Evento**: Converte risultato contract in `TurnEvent`

### Match Utile vs Irrilevante

- **Match Utile**: Match sul nodo attivo (main se CollectingMain, sub se CollectingSub)
- **Match Irrilevante**: Match su altro nodo (es. chiedo "Giorno?" ma matcha "mese")
  - Comportamento: Aggiorna memory ma rimane nello stesso step/context

### Mapping CanonicalKey → SubId

Per mainData compositi, il contract estrae valori con chiavi `canonicalKey` ("day", "month", "year"). Il sistema mappa queste chiavi a `subData.id` usando:

```typescript
const subId = getSubIdForCanonicalKey(contract, canonicalKey);
updateMemory(state, subId, value);
```

---

## Transizioni di Stato

### Flusso Normale (Match)

```
Start (CollectingMain)
  ↓ [Match su main atomico]
Confirmation (se prevista) o Success

Start (CollectingMain)
  ↓ [Match su main composito, alcuni sub mancanti]
Start (CollectingSub) → chiede primo sub mancante
  ↓ [Match su sub]
Start (CollectingSub) → chiede prossimo sub mancante
  ↓ [Tutti sub filled]
Confirmation (se prevista) o Success
```

### Escalation (NoMatch/NoInput)

```
Start
  ↓ [NoMatch/NoInput]
NoMatch/NoInput (counter++)
  ↓ [Mostra escalation immediatamente]
Start (stesso context, ripete domanda)
```

### Confirmation

```
Confirmation
  ↓ [Yes → isYes(input)]
Success → avanza al prossimo dato

Confirmation
  ↓ [No → isNo(input)]
NotConfirmed (counter++)
  ↓ [Correzione utente]
Start (CollectingMain o CollectingSub)
```

### NotConfirmed

```
NotConfirmed
  ↓ [Correzione utente con match]
Start (CollectingMain o CollectingSub)
  ↓ [Match]
Confirmation o Success
```

---

## Escalation

### Contatori

Ogni nodo ha contatori separati per escalation:
- `noMatch`: Numero di tentativi noMatch
- `noInput`: Numero di tentativi noInput
- `notConfirmed`: Numero di tentativi notConfirmed

### Recupero Escalation

```typescript
const step = getStep(targetNode, stepType); // 'noMatch', 'noInput', 'notConfirmed'
const recovery = getEscalationRecovery(step, escalationType, level);
```

**Logica**:
1. Recupera step dal nodo
2. Filtra escalations per tipo (se step ha escalations)
3. Seleziona escalation al livello corrente (level - 1, 0-indexed)
4. Se livello supera disponibili, ritorna ultima escalation

### Esecuzione Escalation

```typescript
executeStep(recovery, callbacks, stepType, escalationLevel);
```

L'escalation viene eseguita immediatamente dopo NoMatch/NoInput, prima di tornare a Start.

---

## Memory Management

### Struttura Memory

```typescript
state.memory: {
  [nodeId]: {
    value: any,        // Valore estratto
    confirmed: boolean // Se il dato è stato confermato (solo per main con confirmation)
  }
}
```

### Operazioni Memory

- **Salvataggio**: `updateMemory(state, nodeId, value)` → salva valore, `confirmed = false`
- **Conferma**: `markAsConfirmed(state, nodeId)` → imposta `confirmed = true`
- **Verifica Vuoto**: Controlla se `value` è undefined, null, o stringa vuota

### Helper Functions

- `findMissingRequiredSubs(mainData, memory)`: Trova tutti i sub required vuoti
- `requiresConfirmation(mainData)`: Verifica se il nodo ha step 'confirmation'
- `isYes(input)`: Verifica se input è "sì", "yes", "ok", ecc.
- `isNo(input)`: Verifica se input è "no", "non", "sbagliato", ecc.

---

## Funzioni di Supporto

### Step Management

- `getStep(node, stepType)`: Recupera step dal nodo (supporta array o object)
- `getEscalationRecovery(step, escalationType, level)`: Recupera escalation al livello specificato
- `executeStep(stepOrEscalation, callbacks, stepType, escalationNumber, inputValue)`: Esegue step/escalation
- `executeAction(action, callbacks, stepType, escalationNumber, inputValue)`: Esegue singola azione

### State Management

- `initializeState(ddtInstance)`: Inizializza stato con memory vuoto e counters a 0
- `getNodeState(state, nodeId)`: Determina stato corrente di un nodo
- `updateState(state, turnStateDesc, currData)`: Aggiorna stato globale
- `peekNextData(ddtInstance, state)`: Simula getNextData senza modificare stato

### Contract Management

- `loadContract(node)`: Carica contract dal nodo (regex/NER/LLM)
- `getSubIdForCanonicalKey(contract, canonicalKey)`: Mappa canonicalKey a subId

---

## Esempi di Flusso

### Esempio 1: Main Atomico (Email)

```
1. getNextData() → trova email (vuoto)
2. getNodeState() → { step: 'Start', counters: { noMatch: 0, ... } }
3. getResponse() → step 'start'
4. executeResponse() → mostra "Inserisci la tua email"
5. processUserInput() → utente: "mario@example.com"
   - Contract estrae: { status: 'match', value: 'mario@example.com' }
   - updateMemory(state, 'email', 'mario@example.com')
   - Ritorna 'Match'
6. getState('Match', ...) → { turnState: 'Success', ... }
7. updateState() → aggiorna stato
8. Esegue step 'success'
9. getNextData() → null (tutti i dati raccolti)
10. RITORNA { success: true, value: state.memory }
```

### Esempio 2: Main Composito (Data di Nascita)

```
1. getNextData() → trova date (vuoto)
2. getNodeState() → { step: 'Start', ... }
3. getResponse() → step 'start'
4. executeResponse() → mostra "Inserisci la data di nascita"
5. processUserInput() → utente: "12 dicembre"
   - Contract estrae: { status: 'match', value: { day: 12, month: 'dicembre' } }
   - Mappa: day → subId 'day', month → subId 'month'
   - updateMemory(state, 'day', 12)
   - updateMemory(state, 'month', 'dicembre')
   - Ritorna 'Match'
6. getState('Match', ...) → findMissingRequiredSubs trova 'year' mancante
   → { turnState: 'Start', context: 'CollectingSub', nextDataId: 'year' }
7. updateState() → aggiorna currentSubId = 'year'
8. Ciclo continua...
9. getNextData() → trova sub 'year' (vuoto)
10. getResponse() → step 'start' per sub 'year'
11. executeResponse() → mostra "E l'anno?"
12. processUserInput() → utente: "1980"
    - Contract estrae: { status: 'match', value: 1980 }
    - updateMemory(state, 'year', 1980)
    - Ritorna 'Match'
13. getState('Match', ...) → tutti sub filled
    → { turnState: 'Confirmation', context: 'CollectingMain' }
14. updateState() → aggiorna turnState = 'Confirmation'
15. Ciclo continua...
16. getResponse() → step 'confirmation'
17. executeResponse() → mostra "Hai inserito: 12 dicembre 1980. È corretto?"
18. processUserInput() → utente: "sì"
    - isYes("sì") → ritorna 'Confirmed'
19. getState('Confirmed', ...) → { turnState: 'Success', ... }
20. markAsConfirmed(state, 'date')
21. Esegue step 'success'
22. getNextData() → null
23. RITORNA { success: true, value: state.memory }
```

### Esempio 3: Escalation NoMatch

```
1. getNextData() → trova email
2. getResponse() → step 'start'
3. executeResponse() → mostra "Inserisci la tua email"
4. processUserInput() → utente: "non lo so"
   - Contract estrae: { status: 'noMatch' }
   - Ritorna 'NoMatch'
5. Incrementa counter: state.counters['email'].noMatch = 1
6. Mostra escalation: getEscalationRecovery(step, 'noMatch', 1)
7. executeStep(recovery, ...) → mostra "Non ho capito. Mi serve un indirizzo email valido."
8. state.turnState = 'Start'
9. Ciclo continua...
10. getResponse() → step 'start' (stesso nodo)
11. executeResponse() → mostra di nuovo "Inserisci la tua email"
12. processUserInput() → utente: "mario@example.com"
    - Match → salva e continua
```

---

## Note Implementative

### Contract Loading

Il contract viene caricato da:
1. `originalNode` nel DDT (tramite `findOriginalNode`)
2. Fallback: direttamente dal `node`

### Mapping CanonicalKey → SubId

Per mainData compositi, il contract estrae valori con chiavi `canonicalKey`. Il mapping avviene tramite:
- `contract.subDataMapping` (se presente)
- Fallback: match diretto su `subData.id`, `subData.label`, `subData.name`

### Gestione Confirmation

Quando stepType è 'confirmation':
- Se mainData composito: formatta tutti i valori dei sub: `values.join(' ')`
- Se mainData atomico: usa valore diretto
- Sostituisce placeholder `{input}` nel messaggio di confirmation

---

## Conclusioni

Il DDT Engine implementa una macchina a stati deterministica che gestisce il dialogo per la raccolta di dati strutturati. La separazione tra Step (stati con messaggio) e Context (ambito di raccolta) rende la logica chiara e manutenibile. L'uso di contract per l'estrazione permette flessibilità nell'implementazione (regex, NER, LLM) mantenendo un'interfaccia uniforme.
