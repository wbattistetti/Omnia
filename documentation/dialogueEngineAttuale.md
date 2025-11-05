# Dialogue Data Engine - Documentazione Logica

## Indice
1. [Architettura Generale](#architettura-generale)
2. [Stato del Simulatore](#stato-del-simulatore)
3. [Modi di Funzionamento (Modes)](#modi-di-funzionamento-modes)
4. [Inizializzazione](#inizializzazione)
5. [Gestione della Memoria](#gestione-della-memoria)
6. [Estrazione Dati](#estrazione-dati)
7. [Transizioni di Stato](#transizioni-di-stato)
8. [Flusso Completo](#flusso-completo)

---

## Architettura Generale

Il Dialogue Data Engine è un motore di stato deterministico che gestisce dialoghi strutturati per la raccolta di dati. Il sistema è organizzato in tre livelli:

### 1. Engine Layer (Motore di Stato)
- **Funzione principale**: `advance(state, input, extractedVariables)`
- **Responsabilità**: Gestisce la logica pura di transizione di stato, senza dipendenze da UI o React
- **Input**: Stato corrente, testo utente, variabili estratte (opzionale)  A COSA TI SERVONO LE VARIABILI ESTRATTE CIOÈ SONO I RISULTATI CHE HAI ESTRATTO VUOI INTENDO INTENDI GIUSTO QUINDI I VALORI ESTRATTI PIÙ ESATTAMENTE O NO ?
- **Output**: Nuovo stato aggiornato

### 2. Simulator Hook Layer
- **Funzione principale**: `useDDTSimulator(template, config)`
- **Responsabilità**: Wrapper React che espone l'engine al componente UI  ================================NON HO CAPITO QUESTA PARTE SPIEGA MEGLIO
- **Fornisce**: `state`, `send()`, `reset()`, `setConfig()`
- **Gestisce**: Effetti collaterali, logging, delay per typing indicator  ================================ SPIEGA IN DETTAGLIO COSA GESTISCE

### 3. UI Layer   ================================ QUESTA PARTE ANDREBBE COMPLETAMENTE SEPARATA DAL MOTORE GIUSTO?
- **Componente**: `DDEBubbleChat`
- **Responsabilità**: Emette messaggi bot in base allo stato, gestisce input utente
- **Coordina**: `useMessageHandling` per gestire l'invio messaggi

---

## Stato del Simulatore

Lo stato del simulatore (`SimulatorState`) contiene:

### Struttura Dati

**`plan`**: Piano di esecuzione  ================================ COSA INTENDI PER PIANO DI ESECUZIONE ?
- **Funzione**: `buildPlan(nodes)` - COSTRUISCE UN PIANO LINEARE DAI NODI DDT  ================================ IN REALTÀ I NODI CONTENGONO DELLE ISTANZE OGNI NODO HA UNA SUA CONDIZIONE DI ESECUZIONE CIOÈ ENTRI NEL NODO SOLO SE UNA CERTA CONDIZIONE È VERIFICATA CHE TIPICAMENTE È NODO PRECEDENTE COMPLETATO E CONDIZIONE SU UN LINK DI COLLEGAMENTO VERIFICATA QUESTO TI PERMETTE DI FARE UNA MACCHINA A STATI E QUINDI NON È 1 1 DIAGRAMMA CHE VIENE SEGUITO FISSAMENTE SECONDO LA TOPOLOGIA MA UNO POTREBBE SALTARE DA UN PUNTO ALL'ALTRO CAMBIANDO DI CONTESTO OVVIAMENTE QUELLO CHE NON DEVE SUCCEDERE È DI AVERE DUE NODI CONTEMPORANEAMENTE ESEGUITE VOLA ALLO STESSO MOMENTO PERCHÉ È UN'AMBIGUITÀ NON SO SE È CHIARO QUESTA PARTE PERÒ LA POSSIAMO LASCIARE PER DOPO
- **Struttura**:
  - `order`: Array di ID nodi in ordine di esecuzione (main, poi suoi subs)  ================================PER QUANTO DETTO SOPRA IN REALTÀ NON C'È UN ORDINE DI ESECUZIONE FISSO
  - `byId`: Dizionario che mappa ID nodo → definizione nodo
- **Comportamento**: I subs vengono aggiunti dopo il loro main nell'ordine  ================================ I SUB COSA SONO? I SUB DATA?

**`mode`**: Modo corrente del dialogo
- Valori possibili: `CollectingMain`, `CollectingSub`, `ConfirmingMain`, `NotConfirmed`, `SuccessMain`, `Completed`  ================================ QUESTA PARTE OVVIAMENTE PUÒ ESSERE RITERATA SE IL DDT È UN AGGREGATO DI DATI ANZI IL DDT VIENE COMPLETATO QUANDO TUTTI SOTTO DATI SONO RACCOLTI

**`currentIndex`**: Indice nel plan del main corrente  ================================ IN REALTÀ NEL FLOW ORCHESTRATOR (DIALOGUE ENGINE GENERALE) NON C'È UN PIANO MA IL PROSSIMO NODO DA ESEGUIRE È QUELLO UNICO CON LA CONDIZIONE EXECUTIVE LA TRUE
- Indica quale main node è attualmente in elaborazione

**`currentSubId`**: ID del sub-dato corrente (opzionale)
- Definito solo quando `mode === 'CollectingSub'`

**`memory`**: Memoria dei dati raccolti
- Struttura: `{nodeId: {value: any, confirmed: boolean}}`
- `value`: Valore estratto per quel nodo
- `confirmed`: Se il valore è stato confermato dall'utente (true) o solo raccolto (false)

**`transcript`**: Cronologia delle interazioni
- Array di oggetti `{from: 'bot'|'user', text: string, meta?: any}`

**`counters`**: Contatori per escalation
- `notConfirmed`: Numero di volte che l'utente ha rifiutato la conferma

---

## Modi di Funzionamento (Modes)

### 1. CollectingMain
**Scopo**: Raccolta del dato principale (main node)

**Comportamento**:
- Riceve input utente
- Estrae dati usando `extractField()` (se regex disponibile) o `extractOrdered()`  =================== COS'È  EXTRACTORDERED? QUI FORSE AVREBBE PIÙ SENSO UN EXTRACT DATA CHE ESTRAE TUTTI I DATI DALLA INPUT DEL CLIENTE DELL'UTENTE POTREBBE ANCHE ESSERE MICK INITIATIVE E LI METTE NELLE VARIABILI RELATIVE CHE POTREBBERO ESSERE USATE PIÙ AVANTI SE È MIXED INITIATIVE . EXTRACT DATA DOVREBBE AL SUO INTERNO GESTIRE L'ESCALATION A SECONDA DEI VARI POSSIBILITÀ DI ESTRAZIONE REGULAR EXPRESSION SISTEMA A REGOLE NER LLM EMBEDDINGS DEFINITI PER IL TIPO DI DATO ASOSCIATO ALL' ISTANZA CHE SI STA ESEGUENDO

- Popola memory con valori estratti
- Controlla saturation: se tutti i sub required sono presenti → passa a `ConfirmingMain`
- Se manca un sub required → passa a `CollectingSub` per quel sub
- Altrimenti rimane in `CollectingMain`

**Funzioni chiave**:
- `extractOrdered()`: Estrazione mixed-initiative (ordine: constrained kinds prima, poi altri, name per ultimo)
- `applyComposite()`: Applica parsing composito basato su kind (date, name, address)   ============ SPIEGA BENE COSA INTENDI QUI
- `isSaturatedRequired()`: Verifica se tutti i sub required hanno valori  ============== COSA FA SPIEGA BENE
- `nextMissingRequired()`: Trova il primo sub required mancante

### 2. CollectingSub
**Scopo**: Raccolta di un sub-dato specifico mancante

**Comportamento**:
- Riceve input per il sub corrente (`currentSubId`)
- Salva valore in `memory[currentSubId]`
- Ricompone il main value dai sub usando `composeFromSubs()`
- Controlla se ci sono altri sub required mancanti:
  - Se sì → rimane in `CollectingSub`, passa al prossimo sub
  - Se no → passa a `ConfirmingMain`

**Funzioni chiave**:
- `setMemory()`: Salva valore in memory
- `composeFromSubs()`: Ricompone valore main da sub values

### 3. ConfirmingMain
**Scopo**: Conferma del dato principale completo

**Comportamento**:
- Attende input utente (yes/no)
- Se `isYes(input)` → passa a `SuccessMain` (dato confermato)
- Se `isNo(input)` → passa a `NotConfirmed` (dato rifiutato)
- Altrimenti → rimane in `ConfirmingMain` (attende risposta valida)

**Funzioni chiave**:
- `isYes()`: Rileva risposte affermative (yes, y, si, sì, ok)
- `isNo()`: Rileva risposte negative (no, n)
- `setMemory()` con `confirmed: true`: Marca valore come confermato

### 4. NotConfirmed
**Scopo**: Gestione quando l'utente rifiuta la conferma

**Comportamento**:
- Incrementa contatore `notConfirmed`
- Supporta pattern `"choose:<subId>"` per routing diretto a un sub
- Dopo 3 tentativi → forza raccolta del primo sub mancante
- Altrimenti → rimane in `NotConfirmed` per riprovare

**Funzioni chiave**:
- `nextMissingSub()`: Trova il primo sub mancante (se non required)

### 5. SuccessMain
**Scopo**: Dato principale confermato con successo

**Comportamento**:
- Avanza al prossimo main usando `advanceIndex()`
- Torna a `CollectingMain` per il nuovo main
- Se non ci sono più main → passa a `Completed`

**Funzioni chiave**:
- `advanceIndex()`: Avanza al prossimo main nel plan, saltando subs

### 6. Completed
**Scopo**: Dialogo completato

**Comportamento**:
- Nessuna ulteriore elaborazione
- Tutti i dati principali sono stati raccolti e confermati

---

## Inizializzazione

### Funzione: `initEngine(template)`

**Input**: Template DDT (lista di nodi)

**Processo**:
1. Chiama `buildPlan(nodes)` per costruire il piano di esecuzione
2. Inizializza stato:
   - `mode: 'CollectingMain'`
   - `currentIndex: 0` (primo main)
   - `memory: {}` (vuoto)
   - `transcript: []` (vuoto)
   - `counters: {notConfirmed: 0}`

**Output**: Stato iniziale pronto per iniziare il dialogo

---

## Gestione della Memoria

### Funzione: `setMemory(memory, slotId, value, confirmed)`

**Scopo**: Salva o aggiorna un valore in memory

**Parametri**:
- `memory`: Memory corrente
- `slotId`: ID del nodo (main o sub)
- `value`: Valore da salvare (può essere primitivo o oggetto)
- `confirmed`: Se true, marca come confermato; false = solo raccolto

**Comportamento**:
- Crea entry `{value, confirmed}` nel dizionario memory
- Non sovrascrive se valore già presente (a meno che non sia undefined)
- Ritorna nuova memory (immutabile)

### Funzione: `getMemory(memory, slotId)`

**Scopo**: Recupera entry da memory

**Output**: `{value: any, confirmed: boolean}` o `undefined`

### Funzione: `composeFromSubs(node, memory)`

**Scopo**: Ricompone valore main dai sub values

**Processo**:
1. Se il node non ha subs → ritorna `memory[node.id]?.value`
2. Altrimenti, crea oggetto `{subId1: value1, subId2: value2, ...}`
3. Include solo sub che hanno valori definiti

**Uso**: Quando tutti i sub sono presenti, compone il main value per mostrarlo nella conferma

---

## Estrazione Dati

### Funzione: `extractOrdered(state, input, primaryKind)`

**Scopo**: Estrazione mixed-initiative ordinata dall'input

**Processo**:
1. **Determina ordine di estrazione**:
   - Kinds "constrained" (email, phone, date, postal, zip, number, numeric) hanno priorità
   - Primary kind (target corrente) viene tentato per primo se è constrained
   - Altrimenti, constrained kinds prima, poi primary kind
   - Kinds non-constrained dopo
   - Name sempre per ultimo (più ambiguo)

2. **Per ogni kind nell'ordine**:
   - Chiama `applyToKind(kind)` che:
     - Usa `getKind(kind)?.detect()` se disponibile (parser registrato)
     - Altrimenti usa detector built-in (`detectEmailSpan`, `detectPhoneSpan`, `detectDateSpan`, `detectNameFrom`)
     - Se trova match:
       - Salva in memory per il primo node matching del kind
       - Sottrae span dal residual (rimuove testo estratto)
       - Continua con prossimo kind

3. **Iterazione**:
   - Ripete ciclo finché residual cambia (progredisce)
   - Permette estrazione multipla (es. "email@example.com e 16/12/1980")

**Output**: `{memory: Memory, residual: string}`

### Funzioni Detector Built-in

**`detectEmailSpan(text)`**:
- Pattern: `/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi`
- Output: `{value: string, span: [start, end]}`

**`detectPhoneSpan(text)`**:
- Pattern: `/\+?\d[\d\s\-]{6,}/g`
- Normalizza a E.164 quando possibile (default IT)
- Gestisce prefissi: 00, 39, +39

**`detectDateSpan(text)`**:
- Supporta formati:
  - `dd/mm/yyyy` o `dd-mm-yyyy`
  - `dd mese yyyy` (IT/EN)
  - `mese yyyy` (solo mese/anno)
  - `mm/yyyy` (solo mese/anno numerico)
  - `yyyy` (solo anno)
- Normalizza anni 2 cifre: <50 → 2000+, >=50 → 1900+
- Output: `{day?: number, month?: number|string, year?: number, span: [start, end]}`

**`detectNameFrom(text)`**:
- Pattern: "mi chiamo X Y" o "il mio nome è X Y"
- Fallback: Euristiche su token capitalizzati
- Esclude stopwords, mesi, numeri
- Output: `{firstname?: string, lastname?: string, span?: [start, end]}`

### Funzione: `applyComposite(kind, input)`

**Scopo**: Parsing composito basato su kind

**Per `kind === 'name'`**:
- Split su spazi
- Primo token → firstname
- Ultimo token → lastname
- Se solo 1 token → firstname presente, lastname mancante

**Per `kind === 'date'`**:
- Pattern `dd/mm/yyyy` → estrae day, month, year
- Pattern con nomi mesi → mappa nomi a numeri (1-12)
- Se manca componente → lo marca in `missing[]`

**Per `kind === 'address'`**:
- Cerca CAP (5 cifre)
- Split su virgola per street/city
- Euristiche per country
- Output: `{street?, city?, postal_code?, country?}`

**Output**: `{variables: Record<string, any>, complete: boolean, missing: string[]}`

---

## Transizioni di Stato

### Funzione: `advance(state, input, extractedVariables?)`

**Funzione centrale**: Gestisce tutte le transizioni di stato

**Parametri**:
- `state`: Stato corrente
- `input`: Testo input utente
- `extractedVariables`: Opzionale - valori già estratti (da `extractField()`)

**Flusso per Mode**:

#### 1. CollectingMain

**Se `extractedVariables` forniti** (priorità):
- Mappa `extractedVariables` ai sub usando standard keys (day, month, year, firstname, lastname, etc.)
- Salva in memory per ogni sub
- Compone main value da sub values
- Salta `extractOrdered()` e `applyComposite()`

**Altrimenti** (fallback):
- Determina `primaryKind` dal kind del main (o inferisce da label)
- Chiama `extractOrdered(state, input, primaryKind)` per mixed-initiative extraction
- Chiama `extractImplicitCorrection()` per rilevare correzioni
- Chiama `applyComposite(main.kind, corrected)` per parsing composito
- Popola memory con valori estratti

**Decisione finale**:
- `isSaturatedRequired(main, memory)` → se true E non ci sono sub required mancanti:
  - Transizione: `mode: 'ConfirmingMain'`
- `nextMissingRequired(main, memory)` → se trova sub required mancante:
  - Transizione: `mode: 'CollectingSub', currentSubId: missingSub`
- Altrimenti:
  - Rimane in `CollectingMain`

#### 2. CollectingSub

**Processo**:
- Riceve input per sub corrente (`currentSubId`)
- Chiama `extractImplicitCorrection()` per correzioni
- Salva in `memory[currentSubId]` usando `setMemory()`
- Ricompone main value da tutti i sub usando `composeFromSubs()`
- Salva main value composto in `memory[main.id]`

**Decisione**:
- Cerca prossimo sub required mancante
- Se trovato → rimane in `CollectingSub`, aggiorna `currentSubId`
- Se non trovato (tutti required presenti) → transizione: `mode: 'ConfirmingMain'`

#### 3. ConfirmingMain

**Processo**:
- Chiama `isYes(input)` e `isNo(input)`

**Decisione**:
- Se `isYes()`:
  - Marca valore come confermato: `setMemory(memory, main.id, value, true)`
  - Transizione: `mode: 'SuccessMain'`
- Se `isNo()`:
  - Transizione: `mode: 'NotConfirmed', counters.notConfirmed++`
- Altrimenti:
  - Rimane in `ConfirmingMain` (attende risposta valida)

#### 4. NotConfirmed

**Processo**:
- Controlla pattern `"choose:<subId>"` per routing diretto
- Incrementa contatore `notConfirmed`

**Decisione**:
- Se `notConfirmed >= 3`:
  - Trova primo sub mancante (o primo dichiarato)
  - Transizione: `mode: 'CollectingSub', currentSubId: missingSub`
- Altrimenti:
  - Rimane in `NotConfirmed` (riprova conferma)

#### 5. SuccessMain

**Processo**:
- Chiama `advanceIndex(state)` per passare al prossimo main

**Transizione**: `mode: 'CollectingMain'` (per nuovo main)

#### 6. Completed

**Comportamento**: Nessuna transizione (stato finale)

### Funzione: `advanceIndex(state)`

**Scopo**: Avanza al prossimo main nel plan

**Processo**:
1. Incrementa `currentIndex` di 1
2. Salta tutti i subs nell'ordine fino a trovare prossimo main
3. Se non ci sono più main → ritorna `mode: 'Completed'`
4. Se il nuovo main ha subs già tutti presenti:
   - Pre-compone main value per mostrarlo subito in conferma
5. Controlla se nuovo main ha sub required mancanti:
   - Se sì E almeno un sub è presente → inizia con `CollectingSub`
   - Altrimenti → `CollectingMain` o `ConfirmingMain` se già saturated

**Output**: Nuovo stato con `currentIndex` aggiornato e mode appropriato

---

## Funzioni di Supporto

### Funzione: `isSaturated(node, memory)`

**Scopo**: Verifica se un node ha tutti i valori necessari

**Logica**:
- Se node ha subs → controlla che tutti i subs abbiano valori
- Se node è `kind: 'date'` → controlla che value abbia `day`, `month`, `year`
- Altrimenti → controlla che `memory[node.id]?.value` sia definito e non vuoto

### Funzione: `isSaturatedRequired(node, byId, memory)`

**Scopo**: Come `isSaturated()` ma considera solo sub con `required !== false`

**Logica**:
- Filtra subs per `required !== false` (default required = true)
- Controlla che tutti i required abbiano valori
- Se nessun sub required → usa `isSaturated()` normale

### Funzione: `nextMissingSub(node, memory)`

**Scopo**: Trova il primo sub mancante (senza filtro required)

**Output**: `subId` del primo sub senza valore, o `undefined`

### Funzione: `nextMissingRequired(node, byId, memory)`

**Scopo**: Trova il primo sub required mancante

**Output**: `subId` del primo sub required senza valore, o `undefined`

### Funzione: `requiredSubsOf(node, byId)`

**Scopo**: Filtra subs per includere solo quelli con `required !== false`

**Output**: Array di sub IDs required

### Funzione: `extractImplicitCorrection(input)`

**Scopo**: Rileva correzioni implicite nel testo

**Pattern supportati**:
- "not X but Y" → estrae Y
- "intendevo Y" → estrae Y
- "correggo: Y" → estrae Y

**Output**: Testo corretto o `null`

### Funzione: `currentMain(state)`

**Scopo**: Recupera il main node corrente

**Logica**: `state.plan.byId[state.plan.order[state.currentIndex]]`

**Output**: `DDTNode` o `undefined`

---

## Flusso Completo - Esempio Pratico

### Scenario: Raccolta Data di Nascita "16/12/1961"

**1. Inizializzazione**
- `initEngine(template)` → stato iniziale
- `mode: 'CollectingMain'`
- `currentIndex: 0` (main "Data di Nascita")
- `memory: {}`

**2. Utente inserisce "16/12/1961"**
- UI chiama `extractField()` con regex → estrae `{day: 16, month: 12, year: 1961}`
- UI chiama `send("16/12/1961", {day: 16, month: 12, year: 1961})`

**3. Engine: `advance(state, input, extractedVariables)`**
- Mode = `CollectingMain`
- `extractedVariables` forniti → mappa ai sub:
  - `memory[giornoId] = {value: 16, confirmed: false}`
  - `memory[meseId] = {value: 12, confirmed: false}`
  - `memory[annoId] = {value: 1961, confirmed: false}`
- Compone main: `memory[mainId] = {value: {giornoId: 16, meseId: 12, annoId: 1961}, confirmed: false}`
- Controlla saturation: `isSaturatedRequired()` → true (tutti required presenti)
- Transizione: `mode: 'ConfirmingMain'`

**4. UI rileva cambio stato**
- `useEffect` in `DDEBubbleChat` rileva `mode === 'ConfirmingMain'`
- Chiama `resolveConfirm()` → "You entered 16/12/1961 as your date of birth. Is this correct?"
- Emette messaggio bot

**5. Utente risponde "sì"**
- UI chiama `send("sì")` (senza extractedVariables)
- Engine: Mode = `ConfirmingMain`
- `isYes("sì")` → true
- Marca come confermato: `memory[mainId] = {value: {...}, confirmed: true}`
- Transizione: `mode: 'SuccessMain'`

**6. Engine: `advanceIndex()`**
- Incrementa `currentIndex` → 1
- Trova prossimo main (se presente)
- Transizione: `mode: 'CollectingMain'` per nuovo main

**7. UI emette messaggio success**
- Mostra messaggio di successo
- Auto-avanza al prossimo main

---

## Punti Chiave della Logica

### 1. Priorità Estrazione
- Se `extractedVariables` forniti → usa direttamente (da regex/NLP)
- Altrimenti → usa `extractOrdered()` per mixed-initiative

### 2. Saturation Check
- Considera solo sub con `required !== false`
- Default: tutti i sub sono required
- Se tutti required presenti → conferma
- Se manca required → raccolta sub

### 3. Memory Structure
- Sub values: `memory[subId] = {value: X, confirmed: false}`
- Main value: `memory[mainId] = {value: {subId1: X, subId2: Y}, confirmed: true/false}`
- Main value viene ricomposto dai sub quando necessario

### 4. Transizioni Deterministiche
- Ogni mode ha logica chiara per decidere prossimo mode
- Nessuna dipendenza da timing o effetti collaterali
- Stato sempre consistente

### 5. Mixed-Initiative
- Estrazione ordinata permette estrazione multipla
- Subtrazione di span evita doppia estrazione
- Supporta input complessi come "email@example.com e 16/12/1980"

---

## Conclusioni

Il Dialogue Data Engine è un sistema deterministico e testabile che separa completamente la logica di stato dalla presentazione. La funzione `advance()` è pura e gestisce tutte le transizioni in base al mode corrente e ai dati in memory, garantendo comportamento prevedibile e facilmente debuggabile.