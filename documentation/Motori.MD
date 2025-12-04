# Motori - DDT Engine - Implementazione

## Indice
1. [Panoramica](#panoramica)
2. [DDT Engine](#ddt-engine)
3. [Pseudo-Codice Completo](#pseudo-codice-completo)
4. [Funzioni Principali](#funzioni-principali)
5. [Decisioni di Design](#decisioni-di-design)
6. [Note Implementative](#note-implementative)

---

## Panoramica

Questo documento descrive l'**implementazione** del DDT Engine (DataDialogueTemplate Engine).

Per l'architettura generale del sistema, vedi [Architettura Runtime.MD](./Architettura%20Runtime.MD).

### Principi di Implementazione

1. **Logica Deterministica**: Il DDT Engine segue una logica lineare e deterministica
2. **Macchina a Stati**: Ogni DataNode ha uno stato (Dialogue State) che determina quale response mostrare
3. **Memory Centralizzata**: Tutti i valori raccolti sono salvati in un contesto globale (memory)
4. **Multi Layer Data Retrieval**: L'estrazione dei dati avviene utilizzando parser deterministici e/o sistemi statistici (regex/rules/NER/LLM)

### Terminologia

**DDT (DataDialogueTemplate)**: Template che contiene:
1. La struttura di dati che devo raccogliere (es. Dati Personali = Nominativo (Nome, Cognome), Indirizzo (Tipo Via, Nome Via, Numero Civico, ecc.))
2. I prompt template che devo usare per chiedere i vari dati/sottodati e per rispondere ai vari stati in cui posso trovarmi: start, noMatch, noinput, confirm, not valid, success
3. Eventuali regole di validazione
4. Un response di introduzione (opzionale) che viene mostrato all'inizio se `isAggregate` è true
5. Un response di success (opzionale) che viene mostrato alla fine quando tutti i dati sono completati

**DataNode**: Un nodo della struttura del DDT che rappresenta un dato (main o sub). Contiene:
- Il dato da acquisire
- I suoi responses per ogni dialogue state
- Le regole di validazione

**Esempio di struttura DDT**:

```
Dati Personali
  ├─ introduction: "Ora avrei bisogno dei dati personali del paziente"
  ├─ successResponse: "Perfetto, ho raccolto tutti i dati personali. Grazie!"
  │
  ├─ Nominativo (mainData)
  │   ├─ responses (start, noMatch, noInput, confirmation, success)
  │   ├─ Nome (subData)
  │   │   └─ responses (start, noMatch, noInput, confirmation, success)
  │   └─ Cognome (subData)
  │       └─ responses (start, noMatch, noInput, confirmation, success)
  │
  └─ Indirizzo (mainData)
      ├─ responses (start, noMatch, noInput, confirmation, success)
      ├─ Tipo Via (subData)
      │   └─ responses (start, noMatch, noInput, confirmation, success)
      ├─ Nome Via (subData)
      │   └─ responses (start, noMatch, noInput, confirmation, success)
      └─ Numero Civico (subData)
          └─ responses (start, noMatch, noInput, confirmation, success)
```

Ogni DataNode (main o sub) ha i propri responses per ogni dialogue state, permettendo di gestire in modo specifico ogni fase del dialogo per quel particolare dato. Il DDTInstance può avere un `introduction` (mostrato all'inizio) e un `successResponse` (mostrato alla fine quando tutti i dati sono completati).

---

## DDT Engine

### Flusso Principale

Il DDT Engine segue un flusso DETERMINISTICO e LINEARE:

1. **Execute**: Funzione principale che coordina il processo con un ciclo semplice
2. **GetNextData**: Trova il prossimo dato da recuperare basandosi sugli stati del dato
3. **GetResponse**: Ottiene il response corretto in base allo stato del dialogo e al counter
4. **ExecuteResponse**: Esegue il response e incrementa il counter
5. **InterpretUtterance**: Esegue solo il parsing dell'input utente
6. **SetState**: Gestisce le transizioni di stato basandosi sul risultato del parsing

### Dialogue States

Gli stati del dialogo (Dialogue States) determinano quale response mostrare:

| Stato | Descrizione | Quando si attiva |
|-------|-------------|------------------|
| **start** | Stato iniziale, è LA RICHESTA INIZIALE DEL dato | Quando il nodo diventa attivo |
| **noMatch** | Input non riconosciuto | ESTRATTORE ritorna `noMatch` |
| **irrelevantMatch** | Match su altro nodo rispetto a quello espressamente chiesto | Match su contract di background. Esempio: Bot chiede "Quando è nato?" → Utente risponde "Io sono nato a Milano" (risponde con luogo invece di data di nascita) |
| **noInput** | Input vuoto | Utente non inserisce nulla |
| **confirmation** | Chiede conferma del dato | Dato recuperato e confirmation prevista |
| **notConfirmed** | Dato non confermato | Utente risponde "no" alla confirmation |
| **invalid** | Dato non valido | Validazione fallita |
| **conditionN** | Condizione specifica fallita | Validazione specifica fallita (es. condition1, condition2) |
| **success** | Dato completato | Dopo validated (se success response esiste) |

### Stati del Dato

Ogni dato (main o sub) ha uno stato interno che determina se deve essere recuperato, confermato o validato:

| Stato | Descrizione |
|-------|-------------|
| **empty** | Dato non ancora raccolto |
| **filled** | Dato raccolto ma non ancora confermato (se richiede conferma) |
| **toConfirm** | Dato raccolto e in attesa di conferma |
| **confirmed** | Dato confermato ma non ancora validato (se richiede validazione) |
| **toValidate** | Dato confermato e in attesa di validazione |
| **validated** | Dato validato e completato |
| **acquisitionFailed** | Dato non acquisibile (esauriti tutti i tentativi) |

### Logica di Base

Il DDT Engine procede a fare domande fino a che ha tutti i dati riempiti (per la struttura del DDT in questione), confermati (opzionale) e validati (opzionale).

Si ferma, ovvero esce dal `Execute(DDTInstance)`, quando ha tutto (success) oppure quando ha terminato tutti i tentativi di recovery.

**Gestione dei dati non catturabili**: Se un mainData non si riesce a catturare dopo tutti i tentativi di recovery, invece di uscire completamente dal DDT, il motore potrebbe passare al prossimo dato del DDT. Alla fine, quando tutti gli altri dati sono stati raccolti, torna a richiedere il dato che non si riusciva a catturare. Questo permette di raccogliere il maggior numero possibile di informazioni prima di eventualmente trasferire all'operatore.

**Nota**: Quando sono in conferma, quello che devo estrarre dalla risposta dell'utente è principalmente sì/no, ma può esserci anche una correzione implicita: "No, ho detto Roma, non Milano!".

---

## Pseudo-Codice Completo

### Funzione Principale: Execute

```pseudocode
FUNZIONE Execute(DDTInstance):
    state = 'start'

    SE DDTInstance.isAggregate E DDTInstance.introduction ESISTE:
        executeResponse(DDTInstance.introduction)
        // Esempio: "Ora avrei bisogno dei dati personali del paziente"

    // Ciclo principale
    MENTRE true:
        currDataNode = GetNextData(DDTInstance)
        // Primo mainData vuoto o non acquirable o non valido o primo subData vuoto o non valido
        // Oppure primo mainData/subData non confermato o non validato

        SE currDataNode === null:
            // Tutti i dati completati o acquisitionFailed: i dati sono già nel contesto globale
            INTERROMPI

        // Ottieni il response corretto in base allo stato e al counter
        // GetResponse ritorna sempre un response (mai null): se non ci sono più tentativi,
        // ritorna un termination response con exit condition
        currResponse = GetResponse(currDataNode, state)

        // Esegui il response (mostra messaggio, esegue azioni, incrementa counter)
        termination = ExecuteResponse(currResponse, state, currDataNode)

        SE termination === true:
            // Exit condition attivata: marca il dato come acquisitionFailed
            // e continua se ce ne sono con altri dati (partial failure)
            markAsAcquisitionFailed(currDataNode)
            state = 'start'  // Reset state per il prossimo dato
            CONTINUA  // GetNextData prenderà il prossimo dato

        // Interpreta l'input utente (solo parsing, nessuna gestione di response)
        parseResult = InterpretUtterance(currDataNode, state)

        // Aggiorna lo stato basandosi sul risultato del parsing
        // SetState gestisce sia lo stato del dialogo che lo stato del dato
        state = SetState(parseResult, state, currDataNode)

    // Dopo l'uscita dal ciclo: se esiste un success response a livello di DDT, eseguilo
    // Questo è la chiusura finale del DDT (es. "Perfetto, ho raccolto tutti i dati personali. Grazie!")
    SE DDTInstance.successResponse ESISTE:
        executeResponse(DDTInstance.successResponse)

```

### Funzione: GetNextData

```pseudocode
FUNZIONE GetNextData(DDTInstance):
    // Stati che richiedono attenzione, in ordine di priorità
    attentionStates = ['empty', 'invalid', 'toConfirm', 'toValidate']

    // Raccogli tutti i nodi candidati (mainData e subData) escludendo quelli in acquisitionFailed
    allCandidates = []

===================================
    devi cercare il primo maindata o subdata empty, o il primo maindata to confirm (o il sudata to confirm ma solo se il subdta ha un validation criterion) o invalid

    quindi devi mettere delle funzioni MainData.isEmpty

    PER OGNI mainData IN DDTInstance.mainData.where(stato <> AcqusitonFailed):
        mainState = getDataState(mainData.id)


        // Se mainData è composito (ha subData), gestisci la logica di bubbling
        SE mainData.subData !== null E mainData.subData.length > 0:
            // MainData composito: è empty solo se TUTTI i subData sono empty
            allSubsEmpty = true
            hasSubsNeedingAttention = false

            PER OGNI subData IN mainData.subData:
                subState = getDataState(subData.id)

                SE subState === 'acquisitionFailed':
                    CONTINUA  // Salta subData falliti

                SE subState !== 'empty':
                    allSubsEmpty = false

                // Se subData ha bisogno di attenzione, aggiungilo ai candidati
                SE subState IN attentionStates:
                    hasSubsNeedingAttention = true
                    allCandidates.push(subData)

            // Se tutti i subData sono empty, il mainData è empty
            SE allSubsEmpty E NOT hasSubsNeedingAttention:
                SE 'empty' IN attentionStates:
                    allCandidates.push(mainData)
            // Altrimenti il mainData è parziale: i subData che necessitano attenzione sono già stati aggiunti
        ALTRIMENTI:
            // MainData semplice: aggiungilo se ha bisogno di attenzione
            SE mainState IN attentionStates:
                allCandidates.push(mainData)

    // Cerca il primo candidato con uno degli stati di attenzione (in ordine di priorità)
    PER OGNI state IN attentionStates:
        candidate = allCandidates.FirstOrDefault(n => getDataState(n.id) === state)
        SE candidate !== null:
            RITORNA candidate

    RITORNA null  // Tutti i dati completati
```

### Funzione: GetResponse

```pseudocode
FUNZIONE GetResponse(currDataNode, state):
    // currDataNode è direttamente il DDTNode (DataNode) con tutte le sue proprietà
    // Il response da attivare dipende dallo stato del dialogo
    // Per ogni stato verifica se ci sono response specifici,
    // se no fa un fallback a quello che c'è

    CASO state:
        'noMatch', 'irrelevantMatch', 'noInput':
            SE currDataNode.responses(state).count === 0:
                state = 'start'  // fallback

        'confirmation', 'success':
            SE currDataNode.responses(state).count === 0:
                // Se non c'è response di confirmation/success, ritorna un termination response
                // che indica che non occorre confermare/mostrare success
                RITORNA createTerminationResponse('noResponseNeeded')

        'notConfirmed':
            SE currDataNode.responses(state).count === 0:
                state = 'start'  // fallback

        'invalid', 'condition1', 'condition2', ...:
            SE currDataNode.responses(state).count === 0:
                state = 'start'  // fallback

    // Crop counter a maxRecovery e array length
    counter = counters(state)
    counter = min(counter, maxRecovery(state), currDataNode.responses(state).count - 1)

    // Verifica che ci sia un response disponibile dopo il crop
    SE currDataNode.responses(state).count === 0:
        // Nessun response disponibile dopo tutti i fallback: esauriti i tentativi
        RITORNA createTerminationResponse('noMoreAttempts')

    RITORNA currDataNode.responses(state)[counter]
```

### Funzione: ExecuteResponse

```pseudocode
FUNZIONE ExecuteResponse(response, state, currDataNode):
    SE response ESISTE:
        // Se è un termination response con 'noResponseNeeded', non fare nulla e continua
        SE response.hasExitCondition E response.exitType === 'noResponseNeeded':
            RITORNA false  // Continua senza mostrare nulla

        // Sostituisce placeholder {input} se presente
        SE response.hasPlaceholder('{input}'):
            inputValue = getFormattedValue(currDataNode)
            response.message = replacePlaceholder(response.message, '{input}', inputValue)

        // Mostra messaggio (solo se presente)
        SE response.message !== null:
            showMessage(response.message)

        // Esegue azioni se presenti
        // Qui praticamente deve eseguire tutta la serie di task contenuti nel response,
        // attivando l'executor opportuno a seconda del task
        PER OGNI action IN response.actions:
            executeAction(action)
            // Es. SayMessage, BackendCall, EndCall, TransferToOperator, SendEmail, SendSMS, ecc.

        // Incrementa counter per questo stato (crop incluso)
        recoveryCounter(state) = min(recoveryCounter(state) + 1, maxRecovery(state))

        // Controlla se c'è una exit condition
        SE response.hasExitCondition:
            RITORNA true  // Termina l'esecuzione (marca dato come acquisitionFailed in Execute)

    RITORNA false  // Continua l'esecuzione
```

### Funzione: InterpretUtterance

```pseudocode
FUNZIONE InterpretUtterance(currDataNode, state):
    // currDataNode è direttamente il DDTNode con tutte le sue proprietà
    // Carica contract: se abbiamo iniziativa mista, i contract caricati potrebbero essere:
    // - Il contract in primo piano (quello per cui si è fatta la richiesta esplicita)
    // - I contracts di background (capaci di catturare iniziativa mista, sidetalks, comandi, cambi di contesto, ecc.)
    contract = loadContract(currDataNode)
    backgroundContracts = loadBackgroundContracts(DDTInstance)

    userInput = waitForUserInput()

    SE userInput === null OPPURE userInput === '':
        RITORNA { result: 'NoInput' }

    // Se siamo in stato di conferma, prova prima la correzione implicita e poi sì/no
    SE state === 'confirmation':
        // Prima prova se è una correzione implicita
        dataResult = contract.extract(userInput)
        SE dataResult.status === 'match':
            // Correzione implicita: "No, ho detto Roma, non Milano!"
            updateMemoryFromExtraction(dataResult, currDataNode)
            RITORNA { result: 'Confirmed' }  // Considera confermato con il nuovo valore

        // Altrimenti prova sì/no
        SE isYes(userInput):
            RITORNA { result: 'Confirmed' }
        ALTRIMENTI SE isNo(userInput):
            RITORNA { result: 'NotConfirmed' }
        ALTRIMENTI:
            RITORNA { result: 'NoMatch' }

    // Se siamo in stato di validazione, esegui le validazioni
    SE state === 'invalid' OPPURE state IN ['condition1', 'condition2', ...]:
        // L'utente ha già fornito un input, quindi riprova l'estrazione
        extractionResult = contract.extract(userInput)
        SE extractionResult.status === 'match':
            updateMemoryFromExtraction(extractionResult, currDataNode)
            // Esegui le validazioni
            validationResult = executeAllValidations(currDataNode)
            SE validationResult.valid:
                RITORNA { result: 'Validated' }
            ALTRIMENTI:
                RITORNA { result: 'Invalid', conditionId: validationResult.failedConditionId }
        ALTRIMENTI:
            RITORNA { result: 'NoMatch' }

    // Prova prima il contract in primo piano
    extractionResult = contract.extract(userInput)

    SE extractionResult.status === 'match':
        // Match sul contract in primo piano = Match "pieno"
        updateMemoryFromExtraction(extractionResult, currDataNode)
        RITORNA { result: 'Match' }

    // Prova i contract di background
    PER OGNI bgContract IN backgroundContracts:
        bgResult = bgContract.extract(userInput)
        SE bgResult.status === 'match':
            // Match su contract di background = Match "irrilevante"
            updateMemoryFromExtraction(bgResult, bgResult.matchedNodeId)
            RITORNA { result: 'irrelevantMatch' }

    // Nessun match trovato
    RITORNA { result: 'NoMatch' }
```

### Funzione: SetState

```pseudocode
FUNZIONE SetState(parseResult, currentState, currDataNode):
    // Aggiorna sia lo stato del dialogo che lo stato del dato basandosi sul risultato del parsing
    // currDataNode è direttamente il DDTNode con tutte le sue proprietà

    CASO parseResult.result:
        'Match':
            // Dato recuperato: aggiorna lo stato del dato
            markAsFilled(currDataNode)

            // Se è un mainData con subData, continua a raccogliere subData
            SE currDataNode.subData !== null E currDataNode.subData.length > 0:
                missingSubs = findMissingRequiredSubs(currDataNode)
                SE missingSubs.length > 0:
                    RITORNA 'start'  // Continua a raccogliere subData, stato dato rimane 'filled'

            // Se richiede conferma, passa allo stato di conferma
            SE requiresConfirmation(currDataNode):
                setDataState(currDataNode, 'toConfirm')
                RITORNA 'confirmation'
            ALTRIMENTI SE hasValidation(currDataNode):
                // Se non richiede conferma ma ha validazione, passa direttamente alla validazione
                setDataState(currDataNode, 'toValidate')
                RITORNA currentState  // Lo stato del dialogo rimane invariato, la validazione verrà gestita nel prossimo ciclo
            ALTRIMENTI:
                // Dato completato senza conferma né validazione
                markAsCompleted(currDataNode)
                RITORNA currentState

        'NoMatch':
            RITORNA 'noMatch'

        'irrelevantMatch':
            RITORNA 'irrelevantMatch'

        'NoInput':
            RITORNA 'noInput'

        'Confirmed':
            // Dato confermato: aggiorna lo stato del dato
            markAsConfirmed(currDataNode)

            // Se richiede validazione, passa alla validazione
            SE hasValidation(currDataNode):
                setDataState(currDataNode, 'toValidate')
                RITORNA currentState  // Lo stato del dialogo rimane invariato, la validazione verrà gestita nel prossimo ciclo
            ALTRIMENTI:
                // Dato completato dopo conferma
                markAsCompleted(currDataNode)
                RITORNA currentState

        'NotConfirmed':
            // Gestione recovery per notConfirmed
            SE currDataNode.responses('notConfirmed').count > 0:
                RITORNA 'notConfirmed'
            ALTRIMENTI SE currDataNode.responses('noMatch').count > 0:
                RITORNA 'noMatch'
            ALTRIMENTI:
                // Riacquisizione: fallback a 'start'
                RITORNA 'start'

        'Invalid':
            // Validazione fallita: aggiorna lo stato del dato e ritorna lo stato della condizione fallita
            markAsInvalid(currDataNode, parseResult.conditionId)
            RITORNA parseResult.conditionId  // Es. 'invalid' o 'condition1', 'condition2', ecc.

        'Validated':
            // Dato validato: aggiorna lo stato del dato
            markAsValidated(currDataNode)
            markAsCompleted(currDataNode)
            RITORNA 'success'  // Opzionale: mostra success response se presente

        DEFAULT:
            RITORNA 'noMatch'
```

---

## Funzioni Principali

### Funzioni Helper

```pseudocode
FUNZIONE updateMemoryFromExtraction(extractionResult, currDataNode):
    // Se è un mainData composito (con subData), aggiorna i subData
    SE currDataNode.subData !== null E currDataNode.subData.length > 0 E currDataNode.isComposite():
        PER OGNI (canonicalKey, value) IN extractionResult.value:
            subId = getSubIdForCanonicalKey(contract, canonicalKey)
            updateMemory(subId, value)
    ALTRIMENTI:
        updateMemory(currDataNode.id, extractionResult.value)

FUNZIONE requiresConfirmation(currDataNode):
    RITORNA currDataNode.responses('confirmation').count > 0

FUNZIONE hasValidation(currDataNode):
    RITORNA currDataNode.validationConditions.count > 0

FUNZIONE getDataState(nodeId):
    memoryEntry = getMemoryValue(nodeId)
    SE memoryEntry === null:
        RITORNA 'empty'
    ALTRIMENTI:
        RITORNA memoryEntry.state  // 'filled', 'toConfirm', 'confirmed', 'toValidate', 'validated', 'completed', 'acquisitionFailed'

FUNZIONE setDataState(currDataNode, newState):
    // Accetta currDataNode (DDTNode) e aggiorna lo stato nella memory
    updateMemory(currDataNode.id, { state: newState })

FUNZIONE markAsFilled(currDataNode):
    setDataState(currDataNode, 'filled')

FUNZIONE markAsConfirmed(currDataNode):
    setDataState(currDataNode, 'confirmed')

FUNZIONE markAsValidated(currDataNode):
    setDataState(currDataNode, 'validated')

FUNZIONE markAsCompleted(currDataNode):
    setDataState(currDataNode, 'completed')

FUNZIONE markAsInvalid(currDataNode, conditionId):
    setDataState(currDataNode, 'invalid')
    updateMemory(currDataNode.id, { invalidConditionId: conditionId })

FUNZIONE markAsAcquisitionFailed(currDataNode):
    setDataState(currDataNode, 'acquisitionFailed')

FUNZIONE createTerminationResponse(exitType):
    // Crea un response speciale con exit condition
    // exitType può essere: 'noMoreAttempts' (esauriti i tentativi) o 'noResponseNeeded' (non serve response)
    RITORNA {
        message: null,  // Nessun messaggio da mostrare
        actions: [],
        hasExitCondition: true,
        exitType: exitType  // 'noMoreAttempts' o 'noResponseNeeded'
    }

FUNZIONE executeAllValidations(currDataNode):
    validationConditions = getValidationConditions(currDataNode)

    PER OGNI condition IN validationConditions:
        SE NOT executeValidation(condition, currDataNode):
            RITORNA { valid: false, failedConditionId: condition.id }

    RITORNA { valid: true }

FUNZIONE getValidationConditions(currDataNode):
    RITORNA currDataNode.validationConditions

FUNZIONE executeValidation(condition, currDataNode):
    values = getMemoryValues(currDataNode.id)
    result = evaluateCondition(condition.script, values, condition.variables)
    RITORNA result

FUNZIONE findMissingRequiredSubs(currDataNode):
    // currDataNode è un mainData con subData
    missing = []
    PER OGNI subData IN currDataNode.subData:
        SE subData.required E getDataState(subData.id) === 'empty':
            missing.push(subData)
    RITORNA missing

FUNZIONE isYes(input):
    yesWords = ['sì', 'si', 'yes', 'ok', 'corretto', 'giusto', 'vero', 'esatto']
    RITORNA yesWords.includes(input.toLowerCase().trim())

FUNZIONE isNo(input):
    noWords = ['no', 'non', 'sbagliato', 'errato', 'falso', 'nope']
    RITORNA noWords.includes(input.toLowerCase().trim())

FUNZIONE counters(state):
    RITORNA recoveryCounter(state)

FUNZIONE maxRecovery(state):
    RITORNA maxRecoveryLimits(state)
```

---

## Decisioni di Design

### 1. Logica Lineare e Semplificata

- **Execute**: Ciclo principale semplice e lineare senza funzioni annidate
- **GetNextData**: Basato sugli stati del dato (empty, toConfirm, toValidate) invece che su controlli multipli
- **InterpretUtterance**: Solo parsing, nessuna gestione di response o transizioni di stato
- **SetState**: Gestisce tutte le transizioni di stato (sia dialogo che dato) basandosi sul risultato del parsing

### 2. Separazione delle Responsabilità

- **GetResponse**: Gestisce escalation, counter, fallback in modo semplice
- **ExecuteResponse**: Esegue il response e incrementa il counter
- **InterpretUtterance**: Solo parsing, nessuna logica di business
- **SetState**: Centralizza tutte le transizioni di stato (dialogo e dato) e aggiorna la memory

### 2.1. Struttura currDataNode

- **currDataNode** è direttamente il DDTNode (DataNode) con tutte le sue proprietà: `id`, `responses`, `validationConditions`, `subData`, ecc.
- Non serve più `getDialogueNode`: si accede direttamente a `currDataNode.responses`, `currDataNode.validationConditions`, ecc.
- `GetNextData` ritorna direttamente il nodo invece di un wrapper con `{ mainData, subData, isMain, nodeId }`

### 3. Stati del Dato vs Stati del Dialogo

- **Stati del Dato** (filled, toConfirm, confirmed, toValidate, validated): Rappresentano lo stato interno del dato nella memory
- **Stati del Dialogo** (start, noMatch, confirmation, invalid, ecc.): Rappresentano lo stato del dialogo e determinano quale response mostrare
- GetNextData usa gli stati del dato per determinare quale dato recuperare
- GetResponse usa gli stati del dialogo per determinare quale response mostrare

### 4. Counter Management

- Il counter viene incrementato in `ExecuteResponse`, non in `GetResponse`
- Il counter viene croppato automaticamente a `maxRecovery(state)`
- Non serve controllare `> maxRecovery` perché il crop è già fatto

### 5. Fallback Chain

- `irrelevantMatch` → `noMatch` → `start`
- `notConfirmed` → `noMatch` → `start` (se non esiste response specifico)
- `noMatch`/`noInput` → `start` (se non esiste response specifico)
- `invalid`/`conditionN` → `start` (se non esiste response specifico)

### 6. Validazione

- Le validazioni vengono eseguite in sequenza
- Se una fallisce, il dato viene marcato come non valido e lo stato diventa `'invalid'` o `'conditionN'`
- `GetResponse` sa quale response prendere per questi stati
- La validazione viene eseguita quando il dato è in stato `toValidate`

### 7. Success

- Non serve gestire esplicitamente il success
- Quando lo stato è `'validated'`, `GetResponse` prende automaticamente il success response se presente

### 8. Memory

- I dati sono salvati in un contesto globale (memory)
- Ogni dato ha uno stato interno (empty, filled, toConfirm, confirmed, toValidate, validated, completed, acquisitionFailed)
- Non serve ritornare i dati: sono già nel contesto
- Quando tutti i dati sono completati o acquisitionFailed, l'esecuzione termina naturalmente

### 9. Partial Failure

- Quando un dato non può essere acquisito (esauriti tutti i tentativi), viene marcato come `'acquisitionFailed'`
- `GetNextData` esclude automaticamente i dati con stato `'acquisitionFailed'`
- Se tutti i dati sono `'acquisitionFailed'` o completati, `GetNextData` ritorna `null` e l'esecuzione termina
- Questo permette di raccogliere il maggior numero possibile di informazioni prima di eventualmente trasferire all'operatore

---

## Note Implementative

### Struttura Responses

Ogni DDTNode (currDataNode) ha `currDataNode.responses(state)` che è un array di responses per quello stato:

```pseudocode
currDataNode.responses = {
    'start': [response1, response2, ...],
    'noMatch': [escalation1, escalation2, ...],
    'noInput': [escalation1, escalation2, ...],
    'confirmation': [response1],
    'notConfirmed': [escalation1, escalation2, ...],
    'success': [response1],
    'invalid': [response1, response2, ...],
    'condition1': [response1, response2, ...],  // per validazione fallita
    'condition2': [response1, response2, ...],
    ...
}
```

### Counter per Stato

Ogni stato ha il suo counter:
- `counters('noMatch')` → counter per noMatch
- `counters('noInput')` → counter per noInput
- `counters('notConfirmed')` → counter per notConfirmed
- `counters('start')` → counter per start (usato dopo fallback)
- `counters('invalid')` → counter per invalid
- `counters('conditionN')` → counter per conditionN

### Exit Conditions

Le exit conditions (end call, transfer call) sono gestite in `ExecuteResponse` e ritornano `termination = true` per terminare l'esecuzione.

### Valori di Ritorno

- `GetResponse` ritorna: sempre `Response` (mai `null`). Se non ci sono più tentativi, ritorna un termination response con `hasExitCondition = true` e `exitType = 'noMoreAttempts'`. Se non serve response (es. confirmation/success senza response), ritorna un termination response con `exitType = 'noResponseNeeded'`
- `ExecuteResponse` ritorna: `true` (termination) oppure `false` (continua). Se il response ha `exitType = 'noResponseNeeded'`, ritorna `false` senza mostrare nulla
- `InterpretUtterance` ritorna: `{ result: 'Match' | 'NoMatch' | 'NoInput' | 'Confirmed' | 'NotConfirmed' | 'Validated' | 'Invalid', conditionId?: string }`
- `SetState` ritorna: `string` (nuovo stato del dialogo). La funzione aggiorna anche lo stato del dato nella memory (filled, toConfirm, confirmed, toValidate, validated, completed, invalid) in base al risultato del parsing

---