# DDT Engine - Logica del Motore di Dialogo

## Indice
1. [Panoramica](#panoramica)
2. [Stati del Nodo](#stati-del-nodo)
3. [Transizioni di Stato](#transizioni-di-stato)
4. [Gestione Input Utente](#gestione-input-utente)
5. [Correzione Implicita](#correzione-implicita)
6. [Conferme Parziali](#conferme-parziali)
7. [Validazione Post-Match](#validazione-post-match)
8. [Timeout e Silenzio](#timeout-e-silenzio)
9. [Mixed Initiative](#mixed-initiative)
10. [Escalation e Recovery](#escalation-e-recovery)
11. [Esempi Pratici](#esempi-pratici)

---

## Panoramica

Il DDT Engine gestisce il dialogo per la raccolta di dati strutturati attraverso una macchina a stati deterministica. Ogni nodo (main data) e sub-nodo (sub-data) ha uno stato che determina quale messaggio mostrare e quale azione eseguire.

### Principi Fondamentali

1. **Step = stati con messaggio**: Lo step di un nodo corrisponde direttamente a uno step nel DDT (Start, NoMatch, NoInput, Confirmation, NotConfirmed, Success)
2. **Context = ambito di raccolta**: Il context determina quale nodo stiamo raccogliendo (collectingMain vs collectingSub)
3. **Counters separati**: Ogni step ha i propri contatori di escalation (noMatch, noInput, confirmation, notConfirmed)
4. **Eventi contract → stato**: Il contract (regex/NER/LLM) decide se c'è stato match, noMatch, o noInput
5. **Gestione correzione**: In NotConfirmed l'utente può correggere e tornare a Start

### Regola di Modellazione Dati

**IMPORTANTE**: Per mantenere la logica semplice e deterministica:

- **Main atomico**: Nessun sub (es. email, phone, codice fiscale)
- **Main composito**: Almeno 2 sub (es. date con day, month, year)

**Non usare main con 1 solo sub** (è ridondante: il main coincide con il sub).

---

## Stati del Nodo

Ogni nodo (main o sub) può trovarsi in uno dei seguenti stati:

### Distinzione Step vs Context

**IMPORTANTE**:
- **Step** = stati che hanno un messaggio associato (Start, NoMatch, NoInput, Confirmation, Success)
- **Context** = ambito di raccolta (collectingMain vs collectingSub)
- Questa separazione elimina la confusione e rende la macchina a stati più pulita

### Stati Principali

| Stato | Descrizione | Quando si attiva |
|-------|-------------|------------------|
| **Start** | Sto chiedendo questo dato | Stato iniziale quando il nodo diventa attivo |
| **NoMatch** | Input ricevuto ma contract non ha fatto match | Contract ritorna `status: 'noMatch'` |
| **NoInput** | Input vuoto ricevuto | Utente preme Enter senza testo |
| **Confirmation** | Chiedo conferma del dato raccolto | Dato saturated e confirmation prevista |
| **NotConfirmed** | Dato non confermato (dopo confirmation negativa) | Utente risponde "no" alla confirmation |
| **Success** | Dato riempito e confermato (ultimo step) | Dopo confirmation positiva o se non prevista |

### Struttura NodeState

```typescript
interface NodeState {
  step: 'Start' | 'NoMatch' | 'NoInput' | 'Confirmation' | 'NotConfirmed' | 'Success';
  counters: {
    noMatch: number;        // Contatore escalation noMatch
    noInput: number;        // Contatore escalation noInput
    confirmation: number;   // Contatore escalation in confirmation
    notConfirmed: number;   // Contatore escalation in notConfirmed
  };
}
```

### Context: collectingMain vs collectingSub

Il **context** determina quale nodo stiamo raccogliendo:
- **collectingMain**: Stiamo raccogliendo il dato main (dato atomico o composito)
- **collectingSub**: Stiamo raccogliendo un sub del main (solo per dati compositi)

Il context è determinato da:
- `mode === 'CollectingMain'` → context = collectingMain
- `mode === 'CollectingSub'` → context = collectingSub
- `currentSubId` definito → context = collectingSub
- `currentSubId` undefined → context = collectingMain

**Il context NON è uno step**, ma un'indicazione di quale nodo è attivo.

### Stati per Nodo Main vs Sub

- **Main node**: Può essere in tutti gli stati sopra elencati
- **Sub node**: Può essere in `Start`, `NoMatch`, `NoInput`, `Success` (non ha Confirmation/NotConfirmed propri, la confirmation è sempre sul main)

### Note sull'Estrazione (Temporanea)

**ATTENZIONE**: Le regole di estrazione attualmente sono **hardcoded** nel codice (regex in `detectDateSpan`, `detectEmailSpan`, ecc.) per permettere di testare la logica del motore.

In futuro, l'estrazione userà **contract sofisticati** (regex/NER/LLM) definiti nel DDT tramite `dataContracts`/`constraints`, rendendo il sistema completamente configurabile senza modifiche al codice.

---

## Transizioni di Stato

### Flusso Principale: Start → Success

```
Start (collectingMain)
  ↓ (match utile)
Start (collectingSub) - se main composito con subs mancanti
  ↓ (tutti required filled)
Confirmation (se prevista) o direttamente →
  ↓ (yes) o (no confirmation)
Success
```

### Escalation: Start → NoMatch/NoInput

```
Start (context: collectingMain o collectingSub)
  ↓ (noMatch)
NoMatch (counter++ sul nodo in contesto)
  ↓ (recovery escalation)
Start (ripete domanda con escalation, stesso context)
```

```
Start (context: collectingMain o collectingSub)
  ↓ (noInput)
NoInput (counter++ sul nodo in contesto)
  ↓ (recovery escalation)
Start (ripete domanda con escalation, stesso context)
```

### Correzione: Confirmation → NotConfirmed

```
Confirmation
  ↓ (no)
NotConfirmed (counter++)
  ↓ (correzione utente)
Start (torna a chiedere)
```

### Regole di Transizione

#### NoMatch totale
- **Step** = NoMatch
- **Escalation** sul nodo in contesto
- **Contatore** incrementato sul nodo in contesto (main se collectingMain, sub se collectingSub)
- Dopo escalation, se ci sono ancora dati mancanti → torna a Start con stesso context

#### NoInput
- Stesso principio di NoMatch: escalation e incremento contatore sul nodo in contesto

#### Match irrilevante
- **Non cambia step** (rimane Start)
- **Ripete lo stesso prompt** nello stesso context
- Esempio: chiedo "Giorno?" (collectingSub su day), utente dice "dicembre" (matcha month, non day) → rimane Start su day, ripete "Giorno?"

#### Match utile
- **Aggiorna memoria** e calcola saturazione:
  - Se main completo → Confirmation (se esiste) o Success
  - Se main parziale → passa al primo sub mancante, step = Start, context = collectingSub
  - Se sei già in sub → aggiorni il sub, poi controlli il parent:
    - Se completo → Confirmation/Success
    - Se incompleto → prossimo sub, step = Start, context = collectingSub

### Transizioni Dettagliate

#### 1. Start → Start (collectingSub)
**Condizione**:
- Nodo main con subs
- Alcuni sub hanno valori, altri no
- Almeno un sub required è mancante

**Azione**:
- Stato main → `Start`
- `currentSubId` → primo sub required mancante
- Context → collectingSub
- Chiede quel sub specifico

#### 2. Start → Confirmation
**Condizione**:
- Dato saturated (tutti required filled)
- Confirmation prevista nel DDT

**Azione**:
- Stato → `Confirmation`
- Mostra messaggio di confirmation con valore raccolto
- Attende risposta yes/no

#### 3. Start → Success
**Condizione**:
- Dato saturated
- Confirmation NON prevista

**Azione**:
- Stato → `Success`
- Esegue step Success (se presente nel DDT, altrimenti vuoto)
- Avanza al prossimo main

#### 4. NoMatch → Start
**Condizione**:
- Recovery escalation disponibile per il livello corrente
- Counter noMatch incrementato
- Utente fornisce nuovo input

**Azione**:
- Mostra recovery escalation
- Stato → `Start` (stesso context)
- Ripete la domanda originale

#### 5. NoInput → Start
**Condizione**:
- Recovery escalation disponibile per il livello corrente
- Counter noInput incrementato
- Utente fornisce nuovo input

**Azione**:
- Mostra recovery escalation
- Stato → `Start` (stesso context)
- Ripete la domanda originale

#### 6. Confirmation → Success
**Condizione**:
- Utente risponde "yes" (isYes(input) === true)

**Azione**:
- Marca dato come confermato: `memory[nodeId].confirmed = true`
- Stato → `Success`
- Esegue step Success
- Avanza al prossimo main

#### 7. Confirmation → NotConfirmed
**Condizione**:
- Utente risponde "no" (isNo(input) === true)

**Azione**:
- Stato → `NotConfirmed`
- Counter notConfirmed++
- Mostra recovery notConfirmed (se disponibile)

#### 8. NotConfirmed → Start
**Condizione**:
- Utente fornisce correzione (match su sub o main)

**Azione**:
- Aggiorna memory con valore corretto
- Stato → `Start` (context collectingSub se corretto un sub specifico, altrimenti collectingMain)
- Counters NON resettati
- Sub già matcheati rimangono

---

## Gestione Input Utente

### Processo di Elaborazione Input

1. **Ricezione Input**
   - Input utente viene passato a `advance(state, input, extractedVariables?)`

2. **Estrazione tramite Contract**
   - Se `extractedVariables` forniti → usa direttamente (priorità)
   - Altrimenti → chiama `extractOrdered()` per mixed-initiative extraction
   - **Regex extraction**: Usa sempre solo il `mainPattern` (pattern[0]) per permettere correzione implicita
   - **Logica ambiguità**: Se match singolo e valore ambiguo, risolve in base al sub attivo (vedi sezione "Logica di Ambiguità")
   - Contract (regex/NER/LLM) ritorna:
     ```typescript
     {
       status: 'match' | 'noMatch' | 'partialMatch',
       value?: any,
       matchedButInvalid?: boolean  // Nuovo flag per validazione
     }
     ```

3. **Determinazione Evento**
   - Input vuoto → `noInput`
   - `status === 'match'` → match
   - `status === 'noMatch'` → noMatch
   - `matchedButInvalid === true` → noMatch (anche se status è 'match')

4. **Aggiornamento Memory**
   - Se match → scrive in `memory[nodeId]` o `memory[subId]`
   - Se noMatch/noInput → non aggiorna memory

5. **Transizione Stato**
   - Basata su evento e stato corrente
   - Incrementa counters se necessario

### Logica per Mode CollectingMain

```typescript
if (state.mode === 'CollectingMain') {
  // 1. Estrazione
  const extracted = extractOrdered(state, input, primaryKind);

  // 2. Verifica match
  const hasMatch = extracted.memory !== state.memory;

  if (hasMatch) {
    // Match: aggiorna memory
    state = { ...state, memory: extracted.memory };

    // 3. Verifica saturation
    const saturated = isSaturatedRequired(main, mem);
    const missing = nextMissingRequired(main, mem);

    if (saturated && !missing) {
      // Tutto filled → Confirmation o Success
      return { ...state, mode: 'ConfirmingMain' }; // o Success se no confirmation
    } else if (missing) {
      // Alcuni sub mancanti → ToComplete
      return { ...state, mode: 'CollectingSub', currentSubId: missing };
    }
    // Altrimenti rimane in CollectingMain
  } else {
    // NoMatch: escalation
    return handleNoMatch(state, main);
  }
}
```

### Logica per Context collectingSub

**IMPORTANTE**: Quando siamo in context `collectingSub` (con sub attivo), la logica è diversa da `collectingMain`.

#### Estrazione in collectingSub

Quando siamo in `collectingSub` con sub attivo:
- **Deve estrarre TUTTI i subs del main**, non solo quello attivo
- L'utente può rispondere alla domanda diretta E fornire altri subs nella stessa frase
- Esempio: chiedo "Giorno?" (context: collectingSub su day), utente dice "dicembre 12" → matcha sia month che day

```typescript
// In handleCollecting()
const isCollectingSub = sub !== undefined;
const extracted = extractOrdered(state, input, primaryKind, isCollectingSub, main);
```

#### Match su Altro Sub

**Scenario**: Context `collectingSub`, `currentSubId = "day"` (chiedo "Giorno?"), Input: "dicembre" (matcha month, non day)

**Comportamento**:
1. Match su month → aggiorna memory
2. Rivaluta il main: quali subs mancano ancora?
3. Se day manca ancora → **match irrilevante**: rimani su day (ripeti "Giorno?")
4. **NON incrementa counter noMatch** del sub day, perché c'è stato un match (anche se su altro sub)

```typescript
if (sub) {
  // Check if the active sub matched (per distinguere match utile da irrilevante)
  const activeSubMatched = mem[sub.id]?.value !== undefined &&
                           mem[sub.id]?.value !== state.memory[sub.id]?.value;

  // Find next missing required sub
  const nextRequiredMissing = requiredIds.find((s) => {
    const m = state.memory[s];
    return !m || m.value === undefined || m.value === null || String(m.value).length === 0;
  });

  if (nextRequiredMissing) {
    // Match irrilevante: se il sub attivo non ha matchato, rimani su quello stesso
    if (nextRequiredMissing === sub.id && !activeSubMatched) {
      // Match irrilevante → non cambia step, ripete prompt stesso context
      return setNodeState(
        { ...state, currentSubId: sub.id },
        main.id,
        (ns) => ({ ...ns, step: 'Start' })
      );
    }
    // Match utile → passa al prossimo sub mancante
    return setNodeState(
      { ...state, currentSubId: nextRequiredMissing },
      main.id,
      (ns) => ({ ...ns, step: 'Start' })
    );
  }
  // All subs filled → go to confirmation
}
```

#### NoMatch Totale in collectingSub

**Scenario**: Context `collectingSub`, `currentSubId = "day"` (chiedo "Giorno?"), Input: "boh" (noMatch totale)

**Comportamento**:
1. **NoMatch sul nodo in contesto** (sub "day", non main)
2. Incrementa counter `noMatch` del sub "day"
3. Mostra escalation `noMatch` del sub (es. "Non ho capito. Mi serve il giorno.")
4. Dopo escalation, se day manca ancora → torna a Start con context collectingSub su day

**Perché sul sub?** Perché stiamo raccogliendo quel sub specifico. Il fallimento riguarda quel sub, non il main nel suo insieme.

```typescript
if (!matchOccurred) {
  // NoMatch totale → incrementa contatore sul nodo in contesto (main o sub)
  const contextNode = sub || main;
  const noMatchState = handleNoMatch(state, contextNode);

  // Preserva currentSubId se eravamo in collectingSub
  const preservedState = state.currentSubId
    ? { ...noMatchState, currentSubId: state.currentSubId }
    : noMatchState;

  return { ...preservedState, mode: mapStateToMode(preservedState, main) };
}
```

#### Riepilogo Logica collectingSub

| Situazione | Comportamento |
|------------|---------------|
| **Match sul sub attivo** | Aggiorna memory → trova prossimo sub mancante → se tutti filled → Confirmation |
| **Match su altro sub** | Aggiorna memory → rivaluta → se sub attivo manca ancora → rimani su quello (match irrilevante) |
| **NoMatch totale** | NoMatch sul sub attivo → incrementa counter sub → mostra escalation sub → poi torna a Start se sub mancante |
| **Estrazione** | Estrae TUTTI i subs del main (non solo quello attivo) |
| **Escalation** | NoMatch/NoInput sul nodo in contesto (sub se collectingSub, main se collectingMain) |

---

## Correzione Implicita

### Definizione

Quando l'utente fornisce una correzione durante la raccolta di un dato, e questa correzione contiene almeno un match (di qualsiasi tipo), il sistema deve:
1. Applicare la correzione
2. **Ripetere la domanda attiva** (non cambiare stato)
3. Non incrementare counter noMatch

### Esempio

```
Bot: "E l'anno?"
User: "Scusa mi sono sbagliato è novembre"  ← contiene match (novembre = mese)
Bot: "E l'anno?"  ← ripete la domanda attiva
```

### Logica di Rilevamento

```typescript
function handleImplicitCorrection(
  input: string,
  state: SimulatorState,
  currentTarget: 'main' | 'sub'
): { isCorrection: boolean; hasAnyMatch: boolean; correctedValue?: any } {
  // 1. Rileva pattern di correzione
  const correctionPattern = extractImplicitCorrection(input);
  if (!correctionPattern) {
    return { isCorrection: false, hasAnyMatch: false };
  }

  // 2. Estrai TUTTI i possibili match dalla frase di correzione
  const allMatches = extractOrdered(state, correctionPattern, primaryKind);
  const hasAnyMatch = allMatches.memory !== state.memory;

  if (hasAnyMatch) {
    // 3. Applica correzione a memory
    // 4. Ritorna flag per ripetere domanda attiva
    return {
      isCorrection: true,
      hasAnyMatch: true,
      correctedValue: allMatches.memory
    };
  }

  // Se non c'è match → trattare come noMatch normale
  return { isCorrection: true, hasAnyMatch: false };
}
```

### Comportamento

**Se c'è almeno un match nella correzione**:
- Applica la correzione in memory
- **Ripete la domanda attiva** (stesso stato, stesso currentSubId se sub)
- **NON incrementa counter noMatch**
- Mostra il messaggio "ask" originale

**Se NON c'è match nella correzione**:
- Trattare come noMatch normale
- Incrementa counter noMatch
- Mostra escalation noMatch

### Integrazione in advance()

```typescript
if (state.mode === 'CollectingSub') {
  // 1. Verifica correzione implicita
  const correction = handleImplicitCorrection(input, state, 'sub');

  if (correction.isCorrection && correction.hasAnyMatch) {
    // Applica correzione
    state = { ...state, memory: correction.correctedValue };

    // RIPETI domanda attiva (stesso stato, stesso subId)
    // Non cambia stato, non incrementa counter
    return state;  // UI mostrerà di nuovo resolveAsk() per questo sub
  }

  // Altrimenti procedi con logica normale...
}
```

---

## Conferme Parziali

### Definizione

Durante la confirmation, l'utente può confermare solo una parte del dato e correggere l'altra.

### Pattern Riconosciuti

- "Sì, il giorno è corretto ma l'anno è 1981"
- "Il mese va bene, ma l'anno è 1980"
- "Ok per il giorno, correggo l'anno: 1981"

### Logica di Estrazione

```typescript
function extractPartialConfirmation(input: string): {
  isPartial: boolean;
  confirmedParts?: string[];  // ["day", "month"]
  correctedParts?: { [subId: string]: any };  // { year: 1981 }
} {
  // Pattern: "Sì, X è corretto ma Y è Z"
  const pattern1 = /(?:sì|ok|yes|corretto|va bene)[\s,]*([^,]+?)(?:è corretto|va bene|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;

  // Pattern: "X va bene, ma Y è Z"
  const pattern2 = /([^,]+?)(?:va bene|è corretto|ok)[\s,]*ma[\s,]*([^,]+?)[\s,]*è[\s,]*([^\s,]+)/i;

  // Estrai parti confermate e corrette
  // ...

  return { isPartial, confirmedParts, correctedParts };
}
```

### Comportamento

1. **Rileva pattern di conferma parziale**
2. **Estrai parti confermate**: mantieni in memory
3. **Estrai parti corrette**: aggiorna solo quelle in memory
4. **Transizione**:
   - Se corretto un sub → `CollectingSub` per quel sub
   - Se corretto main (senza sub) → `Normal` per il main
5. **Counters**: NON resettati

### Esempio

```
Bot: "18 dicembre 1980, giusto?"
User: "Sì, il giorno è corretto ma l'anno è 1981"

Azione:
1. Mantieni day=18, month="dicembre"
2. Aggiorna year=1981
3. Transizione: CollectingSub per year (se year è sub) o Normal (se main)
4. Chiede di nuovo solo l'anno per conferma finale
```

### Integrazione in advance()

```typescript
if (state.mode === 'ConfirmingMain') {
  // 1. Verifica conferma parziale
  const partial = extractPartialConfirmation(input);

  if (partial.isPartial) {
    // 2. Aggiorna solo parti corrette
    let mem = state.memory;
    for (const [subId, value] of Object.entries(partial.correctedParts)) {
      mem = setMemory(mem, subId, value, false);
    }

    // 3. Ricompone main
    mem = setMemory(mem, main.id, composeFromSubs(main, mem), false);

    // 4. Transizione
    const correctedSubId = Object.keys(partial.correctedParts)[0];
    if (correctedSubId && main.subs?.includes(correctedSubId)) {
      return { ...state, memory: mem, mode: 'CollectingSub', currentSubId: correctedSubId };
    } else {
      return { ...state, memory: mem, mode: 'Normal' };
    }
  }

  // Altrimenti gestisci yes/no normale...
}
```

---

## Validazione Post-Match

### Definizione

Un contract può matchare un valore ma questo può essere invalido (es. "32 dicembre 1980" → matcha come data ma è invalida).

### Flag matchedButInvalid

Il contract deve esporre un flag `matchedButInvalid`:

```typescript
interface ContractResult {
  status: 'match' | 'noMatch' | 'partialMatch';
  value?: any;
  matchedButInvalid?: boolean;  // Nuovo flag
}
```

### Comportamento

```typescript
// In extractField o nel contract
if (matched && !valid) {
  return {
    status: 'noMatch',  // Trattare come noMatch
    matchedButInvalid: true
  };
}
```

### Logica in advance()

```typescript
// Dopo estrazione
if (extracted.status === 'match' && extracted.matchedButInvalid) {
  // Trattare come noMatch
  return handleNoMatch(state, main);
}
```

---

## Logica di Ambiguità e Match Irrilevante

### Panoramica

Il motore di estrazione usa **sempre il mainPattern** (pattern principale) per permettere la correzione implicita. Quando il mainPattern matcha un singolo gruppo e quel valore può essere ambiguo (es. "12" può essere giorno o mese), il sistema usa la logica di ambiguità per risolvere il valore in base al contesto attivo.

### Uso del MainPattern

**IMPORTANTE**: Il motore usa **sempre solo il mainPattern** (pattern[0]) per l'estrazione, anche quando c'è un sub attivo. Questo permette:

1. **Correzione implicita**: Se l'utente dice "prima novembre, ora dicembre", il mainPattern può catturare l'intera stringa e ridefinire i valori coerentemente
2. **Uniformità**: Un solo punto di verità, meno complessità
3. **Opzionalità integrata**: Il mainPattern con gruppi opzionali può gestire sia input completi sia parziali

I pattern specifici (dayPattern, monthPattern, yearPattern) rimangono nel contract per supporto/debug, ma **non vengono usati nell'estrazione normale**.

### Configurazione Ambiguità nel Contract

Il contract deve definire:

```typescript
regex: {
    patterns: [mainPattern, dayPattern, monthPattern, yearPattern],  // Pattern specifici mantenuti per supporto
    patternModes: ['main', 'day', 'month', 'year'],

    // ✅ Regex per rilevare valori ambigui
    ambiguityPattern: '^(?<ambiguous>\\b(?:0?[1-9]|1[0-2])\\b)$',  // Matcha numeri 1-12

    // ✅ Configurazione ambiguità
    ambiguity: {
        ambiguousValues: {
            pattern: '^(?:0?[1-9]|1[0-2])$',
            description: 'Numbers 1-12 can be interpreted as day or month'
        },
        ambiguousCanonicalKeys: ['day', 'month']  // Solo day e month sono ambigui
    }
}
```

### Flusso di Risoluzione Ambiguità

1. **Match con mainPattern**: Il mainPattern matcha l'input
2. **Conta gruppi estratti**: Se c'è un solo gruppo estratto → possibile ambiguità
3. **Verifica ambiguità**: Applica `ambiguityPattern` al testo originale
   - Se matcha → valore è ambiguo
   - Altrimenti → non ambiguo, usa valore originale
4. **Risoluzione con contesto**: Se ambiguo:
   - Ottiene `canonicalKey` del sub attivo (`activeSubId`)
   - Verifica se quel `canonicalKey` è in `ambiguousCanonicalKeys`
   - Se sì → **match rilevante**: assegna valore al sub attivo
   - Se no → **match irrilevante**: ritorna `hasMatch: false`

### Esempi di Comportamento

#### Esempio 1: Match Rilevante
```
Input: "12"
Sub attivo: day (canonicalKey: "day")
MainPattern matcha: { day: "12" } (singolo gruppo)
AmbiguityPattern matcha: "12" → TRUE (ambiguo)
ResolveWithContext:
  - canonicalKey attivo = "day"
  - "day" È IN ambiguousCanonicalKeys ['day', 'month'] → TRUE
  - Risultato: { canonicalKey: "day", value: "12", isRelevant: true }
Output: { values: { day: "12" }, hasMatch: true }
```

#### Esempio 2: Match Irrilevante
```
Input: "12"
Sub attivo: year (canonicalKey: "year")
MainPattern matcha: { day: "12" } (singolo gruppo)
AmbiguityPattern matcha: "12" → TRUE (ambiguo)
ResolveWithContext:
  - canonicalKey attivo = "year"
  - "year" NON È IN ambiguousCanonicalKeys ['day', 'month'] → FALSE
  - Risultato: { isRelevant: false }
Output: { values: {}, hasMatch: false }
Comportamento: NoMatch → ripete prompt per year
```

#### Esempio 3: Match Multi-Gruppo (Non Ambiguo)
```
Input: "12 aprile 1980"
Sub attivo: day
MainPattern matcha: { day: "12", month: "aprile", year: "1980" } (multi-gruppo)
Logica ambiguità: NON applicata (multi-gruppo)
Output: { values: { day: "12", month: "aprile", year: "1980" }, hasMatch: true }
```

#### Esempio 4: Valore Non Ambiguo
```
Input: "1980"
Sub attivo: year
MainPattern matcha: { year: "1980" } (singolo gruppo)
AmbiguityPattern matcha: "1980" → FALSE (non ambiguo, non è 1-12)
Logica ambiguità: NON applicata (non ambiguo)
Output: { values: { year: "1980" }, hasMatch: true }
```

### Match Irrilevante vs NoMatch

**Match Irrilevante**:
- Il mainPattern **ha matchato** qualcosa
- Ma il valore matchato è ambiguo e il sub attivo **non è tra quelli ambigui**
- Comportamento: ritorna `hasMatch: false` → il motore va in NoMatch e ripete il prompt
- **NON incrementa il contatore noMatch** (c'è stato un match, anche se irrilevante)

**NoMatch Totale**:
- Il mainPattern **non ha matchato** nulla
- Comportamento: ritorna `hasMatch: false` → il motore va in NoMatch e incrementa il contatore

### Integrazione nel Motore

La logica di ambiguità è implementata in `tryRegexExtraction()`:

```typescript
// 1. Usa sempre solo mainPattern
const mainPattern = contract.regex.patterns[0];
const match = text.match(new RegExp(mainPattern, 'i'));

// 2. Estrai gruppi
const extractedGroups = /* ... */;
const groupCount = Object.keys(extractedGroups).length;

// 3. Se match singolo, verifica ambiguità
if (groupCount === 1) {
    if (checkAmbiguity(text, contract)) {
        const resolved = resolveWithContext(value, canonicalKey, activeSubId, contract);
        if (!resolved.isRelevant) {
            return { values: {}, hasMatch: false };  // Match irrilevante
        }
        values[resolved.canonicalKey] = resolved.value;
    } else {
        values[matchedCanonicalKey] = matchedValue;  // Non ambiguo
    }
} else {
    // Multi-gruppo → usa tutti i valori
    Object.assign(values, extractedGroups);
}
```

---

## Timeout e Silenzio

### Definizione

Se l'utente non risponde per un periodo di tempo configurato, il sistema deve triggerare automaticamente un `noInput`.

### Configurazione

```typescript
interface TimeoutConfig {
  enabled: boolean;
  durationMs: number;  // Default: 30000 (30 secondi)
  perStep?: boolean;   // Timeout diverso per step?
}
```

### Implementazione

```typescript
// In useDDTSimulator o DDEBubbleChat
useEffect(() => {
  if (!timeoutConfig.enabled) return;

  // Reset timer a ogni input
  const timer = setTimeout(() => {
    // Triggera noInput
    send('');  // Input vuoto = noInput
  }, timeoutConfig.durationMs);

  return () => clearTimeout(timer);
}, [state.mode, state.currentSubId, userInput]);
```

### Comportamento

1. **Timer attivo** solo in stati `Normal` o `CollectingSub`
2. **Reset** a ogni input utente
3. **Scadenza** → chiama `send('')` (noInput)
4. **Counter noInput** incrementato normalmente

---

## Mixed Initiative

### Definizione

L'utente può fornire dati non esplicitamente richiesti in quel momento. Questi dati vengono comunque estratti e salvati.

### Logica extractOrdered()

La funzione `extractOrdered()` estrae TUTTI i dati possibili dall'input, non solo quello attivo:

1. **Ordine di estrazione**:
   - Prima: constrained kinds (email, phone, date, postal, numeric)
   - Poi: primaryKind (se non constrained)
   - Infine: altri kinds (name, address, text)

2. **Sottrazione di span**: Dopo ogni match, rimuove lo span dal residual per evitare doppi match

3. **Scrittura in memory**: Scrive in memory per qualsiasi nodo matching, anche se non attivo

### Comportamento per Dati Non Richiesti

**Se dato matchato ma non attivo**:
- Scrive in memory con `confirmed: false`
- **Non chiede confirmation immediata** (aspetta che diventi attivo)
- Quando diventa attivo:
  - Se già filled → va direttamente a Confirmation (se prevista)
  - Se non prevista confirmation → va a Success

### Esempio

```
Bot: "Può dire la data per favore?"
User: "18 dicembre 1980 e abito a Milano"

Azione:
1. Data: match completo → memory[date] = {day: 18, month: 12, year: 1980}
2. Indirizzo: match completo → memory[address] = {city: "Milano"}
3. Stato: data è attiva → va a Confirmation per data
4. Indirizzo: non attivo → rimane in memory, confirmed: false
5. Quando indirizzo diventa attivo → se prevista confirmation, chiede confirmation
```

---

## Escalation e Recovery

### Struttura Escalation nel DDT

Ogni step nel DDT può avere escalation con recovery:

```typescript
interface DDTStep {
  type: 'start' | 'noMatch' | 'noInput' | 'confirmation' | 'notConfirmed' | 'success';
  escalations?: Escalation[];
}

interface Escalation {
  level: number;  // 1, 2, 3, ...
  recovery: {
    textKey: string;
    actions?: Action[];
  };
}
```

### Logica di Recovery

```typescript
function getEscalationRecovery(
  step: DDTStep,
  stepType: 'noMatch' | 'noInput' | 'notConfirmed',
  counter: number
): Recovery | null {
  // Cerca escalation per il livello corrente
  const escalation = step.escalations?.find(e => e.level === counter);

  if (escalation) {
    return escalation.recovery;
  }

  // Fallback: usa l'ultima escalation disponibile
  const lastEscalation = step.escalations?.slice(-1)[0];
  return lastEscalation?.recovery || null;
}
```

### Comportamento

1. **Counter incrementato** quando si verifica l'evento (noMatch, noInput, notConfirmed)
2. **Cerca recovery** per il livello del counter
3. **Se trovata**: mostra recovery, stato → Start (quando utente fornisce nuovo input)
4. **Se non trovata**: usa l'ultima disponibile o ripete domanda originale

### Counters Non Resettati

I counters **NON vengono mai resettati** durante le correzioni:
- Correzione in NotConfirmed → counters mantenuti
- Sub già matcheati → rimangono in memory
- Solo quando si passa al prossimo main → counters resettati per il nuovo main

---

## Esempi Pratici

### Esempio 1: Raccolta Data Completa

```
Stato iniziale: Start, context: collectingMain (main: date)

Bot: "Può dire la data di nascita per favore?"
User: "dicembre 1980"

Azione:
- Match: month="dicembre", year=1980
- Memory: {date: {month: 12, year: 1980}, day: null}
- Stato: Start, context: collectingSub (manca day)
- currentSubId: "day"
- Chiede: "E il giorno?"

User: "dicembre"  ← Match su altro sub (month), non su day

Azione:
- Estrazione: extractAllSubs=true → estrae tutti i subs del main
- Match: month="dicembre" (già presente, ma rivaluta)
- Memory: {date: {month: 12, year: 1980}, day: null}
- Rivaluta: day manca ancora
- Match irrilevante: rimane Start, context: collectingSub su day
- Chiede di nuovo: "E il giorno?"  ← NON va in noMatch perché c'è stato un match
- Counter noMatch del sub "day" NON incrementato

User: "18"

Azione:
- Match: day=18
- Memory: {date: {day: 18, month: 12, year: 1980}}
- Stato: Confirmation (tutti filled)
- Bot: "18 dicembre 1980, giusto?"

User: "Sì"

Azione:
- Memory: {date: {day: 18, month: 12, year: 1980}, confirmed: true}
- Stato: Success
- Avanza al prossimo main
```

### Esempio 2: Correzione Implicita

```
Stato: Start, context: collectingSub (currentSubId: year)

Bot: "E l'anno?"
User: "Scusa mi sono sbagliato è novembre"

Azione:
- Rileva correzione: "è novembre"
- Match: month="novembre" (anche se chiedevo year)
- Memory: aggiorna month=11
- Stato: RIMANE Start, context: collectingSub (year)
- Bot: "E l'anno?"  ← RIPETE domanda attiva

User: "1980"

Azione:
- Match: year=1980
- Memory: {date: {day: 18, month: 11, year: 1980}}
- Stato: Confirmation
```

### Esempio 3: Conferma Parziale

```
Stato: ConfirmingMain

Bot: "18 dicembre 1980, giusto?"
User: "Sì, il giorno è corretto ma l'anno è 1981"

Azione:
- Rileva conferma parziale
- Mantiene: day=18, month=12
- Corregge: year=1981
- Memory: {date: {day: 18, month: 12, year: 1981}}
- Stato: Start, context: collectingSub (year)
- Bot: "E l'anno?"  ← chiede solo l'anno per conferma finale
```

### Esempio 4: NoMatch in collectingSub

```
Stato: Start, context: collectingSub, currentSubId = "day" (main: date)

Bot: "E il giorno?"
User: "boh"  ← NoMatch totale

Azione:
- Estrazione: extractAllSubs=true → nessun match su nessun sub
- NoMatch sul nodo in contesto (sub "day", non main)
- Counter noMatch del sub "day": 1
- Escalation noMatch per "day" (prima escalation se counter=1)
- Bot: "Non ho capito. Mi serve il giorno."  ← escalation sul sub
- Dopo escalation: torna a Start con context collectingSub su day
- Stato: Start, context: collectingSub, currentSubId = "day"

User: "18"

Azione:
- Match: day=18
- Memory: {date: {day: 18, month: 12, year: 1980}}
- Stato: Confirmation (tutti filled)
- Bot: "18 dicembre 1980, giusto?"
```

### Esempio 5: NoMatch con Escalation (collectingMain)

```
Stato: Start, context: collectingMain (main: email)

Bot: "Qual è la sua email?"
User: "non lo so"

Azione:
- Contract: noMatch
- NoMatch sul nodo in contesto (main "email")
- Counter noMatch: 1
- Recovery escalation level 1: "Mi serve un indirizzo email valido. Può darmelo?"
- Stato: Start (ripete domanda, stesso context)

User: "mario@example.com"

Azione:
- Contract: match
- Memory: {email: "mario@example.com"}
- Stato: Success (se no confirmation) o Confirmation
```

### Esempio 6: Mixed Initiative

```
Stato: Start, context: collectingMain (main: date)

Bot: "Può dire la data di nascita per favore?"
User: "18 dicembre 1980 e abito a Milano"

Azione:
- Data: match completo → memory[date] = {day: 18, month: 12, year: 1980}
- Indirizzo: match → memory[address] = {city: "Milano"}, confirmed: false
- Stato: Confirmation per data (attiva)

User: "Sì"

Azione:
- Data: confirmed: true
- Stato: Success per data → avanza
- Indirizzo: rimane in memory, non ancora attivo

Bot: "E il suo indirizzo?"
User: (indirizzo già in memory)

Azione:
- Indirizzo già filled → va direttamente a Confirmation (se prevista)
- Bot: "Milano, giusto?"
```

---

## Note di Implementazione

### Priorità di Estrazione

1. **extractedVariables forniti** (da extractField) → usa direttamente
2. **extractOrdered()** → mixed-initiative extraction
3. **extractImplicitCorrection()** → per correzioni
4. **applyComposite()** → parsing composito per kind

### Gestione Memory

- `setMemory(memory, nodeId, value, confirmed)` → scrive in memory
- `memory[nodeId].confirmed` → flag di conferma
- `memory[nodeId].value` → valore effettivo

### Transizioni Atomiche

Ogni transizione di stato è atomica:
- Non si può essere in due stati contemporaneamente
- Lo stato viene aggiornato completamente prima di procedere

### Logging e Debug

Tutte le transizioni devono essere loggate:
- Stato precedente → stato successivo
- Counter incrementati
- Memory aggiornata
- Match/noMatch rilevati

---

## Funzionalità Future (Non Implementate Ora)

### Side Talk / Help
- Step "Help" nel DDT
- Rilevamento domande utente ("Perché mi chiedi questo?")
- Risposta e ritorno allo stato precedente

### UserDoesNotRemember
- Step "UserDoesNotRemember"
- Recovery/escalation dedicate
- Skip dato se opzionale

### UserNotWilling
- Step "UserNotWilling"
- Solo per dati opzionali
- Success con valore `%SkippedData%`

---

## Conclusioni

Questa logica permette di gestire un dialogo veramente human-like con:
- Gestione corretta di match, noMatch, noInput
- Correzione implicita senza perdere il contesto
- Conferme parziali per dati complessi
- Mixed initiative per conversazioni naturali
- Escalation e recovery per gestire errori
- Timeout per gestire silenzio prolungato

La macchina a stati è deterministica e prevedibile, facilitando debug e manutenzione.


