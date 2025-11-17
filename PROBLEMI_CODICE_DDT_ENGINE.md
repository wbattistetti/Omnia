# Problemi nel Codice DDT Engine - Analisi per Esperto

## Problema Principale

**Scenario**: Quando l'utente dice "dicembre" mentre il sistema chiede il giorno (sub "day"), il sistema va erroneamente in `noMatch` anche se le grammatiche hanno riconosciuto "dicembre" come mese.

### Comportamento Atteso

Secondo la documentazione (`DDT Engine.md`, sezione "Match su Altro Sub"):
- Quando in `ToComplete` con sub attivo, se l'utente matcha un sub diverso da quello richiesto (es. "dicembre" matcha month mentre chiediamo day)
- Il sistema deve riconoscere che c'è stato un match (anche se non sul sub attivo)
- **NON deve andare in noMatch**
- Deve rimanere sul sub attivo e ripetere la domanda

### Comportamento Attuale

Il sistema va in `noMatch` e incrementa il counter del sub attivo, causando escalation inutile.

---

## Analisi Tecnica

### 1. Implementazione di `hasMatch` in `extractOrdered`

**File**: `src/components/DialogueDataEngine/engine.ts`

**Problema**: Abbiamo aggiunto un flag `hasMatch` che viene impostato a `true` quando una grammatica matcha qualcosa:

```typescript
function extractOrdered(...): { memory: Memory; residual: string; hasMatch: boolean } {
  let hasMatch = false;

  const applyToKind = (kind: string) => {
    if (kind === 'date') {
      const hit = detectDateSpan(residual);
      if (hit) {
        hasMatch = true; // ← Impostato quando grammatica matcha
        // ... scrive in memory solo se memory[sid]?.value === undefined
      }
    }
  };

  return { memory, residual, hasMatch };
}
```

**Problema identificato**:
- `hasMatch = true` viene impostato quando la grammatica matcha
- Ma la scrittura in memory avviene solo se `memory[sid]?.value === undefined`
- Se il valore è già presente (es. month=12 già in memory), NON scrive
- Quindi: `hasMatch = true` ma `memoryChanged = false`

### 2. Utilizzo di `matchOccurred` in `handleCollecting`

**File**: `src/components/DialogueDataEngine/engine.ts`, riga ~935

```typescript
const matchOccurred = extracted?.hasMatch || false;

if (!memoryChanged && !matchOccurred) {
  // No match → handle noMatch
}
```

**Problema**:
- `extracted` viene definito solo nel blocco `else` (riga ~805)
- Se il codice entra nel blocco `if (extractedVariables)` invece di `else`, `extracted` è `undefined`
- Quindi `matchOccurred` è sempre `false` in quel caso

**Fix parziale applicato**:
- Abbiamo dichiarato `extracted` fuori dal blocco `if/else` (riga ~744)
- Ma il problema persiste: dai log vediamo che entra comunque in noMatch

### 3. Logica di Scrittura in Memory per Date

**File**: `src/components/DialogueDataEngine/engine.ts`, riga ~376-392

```typescript
if (hit.month !== undefined) {
  let monthValue = hit.month;
  // ... normalizzazione ...
  if (label === 'month' || label.includes('month') || ...) {
    memory = setMemory(memory, sid, monthValue, false);
    // ← NON controlla se memory[sid]?.value === undefined
  }
}
```

**Problema**:
- Per date, la scrittura NON controlla se il valore è già presente
- Scrive sempre, anche se il valore è lo stesso
- Ma `setMemory` potrebbe non aggiornare se il valore è identico?
- Questo causerebbe `memoryChanged = false` anche se `hasMatch = true`

### 4. Verifica di `setMemory`

**Domanda critica**: La funzione `setMemory` aggiorna la memory anche se il valore è identico?

Se `setMemory(memory, sid, 12, false)` viene chiamato quando `memory[sid].value = 12`:
- Aggiorna la memory (causando `memoryChanged = true`)?
- O non aggiorna (causando `memoryChanged = false`)?

---

## Test Case Fallito

**Test**: `engine ToComplete flow > ToComplete: chiedo "Giorno?", utente dice "dicembre" → matcha month, rimane su day`

**Input**:
1. Stato iniziale: `ToComplete`, `currentSubId = "day"`, `memory = {month: 12, year: 1980}`
2. Utente dice: "dicembre"
3. Atteso: `dayState.counters.noMatch = 0` (NON incrementato)
4. Attuale: `dayState.counters.noMatch = 1` (incrementato erroneamente)

**Log di debug**:
```
[DEBUG] matchOccurred check {
  hasExtracted: true,
  extractedHasMatch: ???,  // ← Non vediamo questo valore nei log!
  matchOccurred: false,    // ← Dovrebbe essere true!
  memoryChanged: false
}
[DEBUG] noMatch condition { ... }
[DEBUG] ToComplete noMatch on sub { ... }
```

---

## Domande per l'Esperto

1. **Perché `extracted.hasMatch` è `false` quando la grammatica matcha "dicembre"?**
   - La grammatica `detectDateSpan("dicembre")` dovrebbe matchare month
   - `hasMatch = true` viene impostato quando `hit` è truthy
   - Ma forse `hit` è `undefined` in questo caso?

2. **La funzione `setMemory` aggiorna la memory anche se il valore è identico?**
   - Se `memory[sid].value = 12` e chiamo `setMemory(memory, sid, 12, false)`
   - La memory viene aggiornata (causando `memoryChanged = true`)?
   - O rimane invariata (causando `memoryChanged = false`)?

3. **C'è un problema di scope o timing con `extracted`?**
   - `extracted` viene definito nel blocco `else` ma usato dopo
   - Abbiamo dichiarato `extracted` fuori, ma forse c'è ancora un problema?

4. **La logica di `detectDateSpan` funziona correttamente per "dicembre" da solo?**
   - Forse la funzione non matcha "dicembre" senza un contesto (es. "dicembre 1980")?

---

## File Coinvolti

1. `src/components/DialogueDataEngine/engine.ts`
   - Funzione `extractOrdered` (riga ~234)
   - Funzione `handleCollecting` (riga ~694)
   - Logica di scrittura in memory per date (riga ~376-392)

2. `src/components/DialogueDataEngine/__tests__/engine.test.ts`
   - Test fallito: riga ~138-156

3. `documentation/DDT Engine.md`
   - Documentazione del comportamento atteso (sezione "Match su Altro Sub")

---

## Tentativi di Fix Falliti

1. ✅ Aggiunto `hasMatch` in `extractOrdered` - implementato
2. ✅ Aggiunto `matchOccurred` in `handleCollecting` - implementato
3. ✅ Spostato `extracted` fuori dal blocco `if/else` - implementato
4. ❌ Il problema persiste: `matchOccurred` è ancora `false`

---

## Prossimi Passi Suggeriti

1. **Verificare `detectDateSpan("dicembre")`**:
   - Aggiungere log per vedere se matcha correttamente
   - Verificare se `hit` è truthy quando l'input è solo "dicembre"

2. **Verificare `setMemory`**:
   - Controllare se aggiorna la memory anche con valori identici
   - Se non aggiorna, potrebbe essere il problema

3. **Aggiungere log dettagliati**:
   - Log in `extractOrdered` quando `hasMatch` viene impostato
   - Log in `handleCollecting` quando `matchOccurred` viene calcolato
   - Log quando `setMemory` viene chiamato per date

4. **Verificare il flusso completo**:
   - Step-by-step: input "dicembre" → extractOrdered → hasMatch? → memoryChanged? → matchOccurred? → noMatch?

---

## Note Aggiuntive

- Il codice usa log temporanei (`console.log`) per debug
- I test passano per "boh" (noMatch corretto) e "dicembre 12" (match corretto)
- Solo il caso "dicembre" da solo (match su altro sub) fallisce

---

## ✅ RISOLUZIONE COMPLETATA

**Data risoluzione**: 2024-12-XX

### Correzioni Implementate

1. **Separazione `matchOccurred` da `memoryChanged`**
   - `matchOccurred` indica se la grammatica ha riconosciuto qualcosa (indipendentemente da `memoryChanged`)
   - Usato per determinare se andare in noMatch: `if (!matchOccurred)` invece di `if (!memoryChanged && !matchOccurred)`

2. **Rilevatori granulari per sub-date isolati**
   - Aggiunte funzioni `detectMonthSpan`, `detectDaySpan`, `detectYearSpan`
   - Permettono di matchare "dicembre" da solo anche se non forma una data completa
   - Attivi solo in ToComplete mode con `mainNode` fornito

3. **Priorità di rilevazione in ToComplete**
   - Prima: rilevatore completo (`detectDateSpan`) - può matchare più subs contemporaneamente (es. "dicembre 12")
   - Poi: rilevatori granulari - per sub isolati (es. "dicembre" solo)

4. **Gestione `extractedVariables`**
   - Sempre crea oggetto `extracted` valido con `hasMatch=true`
   - Perché le variabili estratte derivano già da un match

5. **Pattern aggiuntivo per "day month"**
   - Aggiunto pattern `re2b` per "12 dicembre" (day month senza anno)
   - Risolve il test "extractOrdered should extract all subs"

6. **Logging mirato**
   - Sostituiti `console.log` temporanei con `logMI` strutturato
   - Log dettagliati in `extractOrdered`, `handleCollecting`, e per match/noMatch

### Risultati Test

✅ **Tutti i 6 test ToComplete passano**:
- ✅ partial date -> ToComplete -> asks for missing sub
- ✅ "dicembre" → matcha month, rimane su day (NON va in noMatch)
- ✅ "dicembre 12" → matcha month e day, va a Confirmation
- ✅ "boh" → noMatch sul sub, escalation corretta
- ✅ multiple noMatch → counter incrementa progressivamente
- ✅ "12 dicembre" → extractOrdered estrae tutti i subs

### Stato Finale

**Tutti i problemi identificati sono stati risolti. Il codice funziona correttamente secondo le specifiche della documentazione.**



