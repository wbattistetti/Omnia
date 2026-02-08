# Analisi Profonda: Problemi con Riconoscimento Pattern per Righe di Nodo

## Contesto
Il sistema di riconoscimento dei pattern per le righe di nodo dei blocchi di flusso è stato ristrutturato per utilizzare pattern caricati dal database invece di pattern hardcoded. Il sistema dovrebbe inferire automaticamente la categoria semantica (es. "problem-classification", "choice", "confirmation") dalle label delle righe.

## Architettura Attuale

### Flusso di Caricamento Pattern
1. **Backend** (`backend/server.js`):
   - Carica pattern da MongoDB collection `Heuristics` con `_id: 'CategoryExtraction'`
   - Struttura: `{ patterns: { IT: [...], EN: [...], PT: [...] } }`
   - Ogni array contiene oggetti `{ pattern: string, category: string }`
   - Endpoint: `/api/factory/task-heuristics` restituisce `rulesByLang[lang].CATEGORY_PATTERNS`

2. **Frontend** (`src/nlp/taskType/patternLoader.ts`):
   - Carica pattern via fetch da `/api/factory/task-heuristics`
   - Memorizza in `patternCache` come `Map<Lang, RuleSet>`
   - **IMPORTANTE**: `CATEGORY_PATTERNS` viene memorizzato come array di oggetti (NON come RegExp, a differenza degli altri pattern)

3. **Utilizzo** (`src/services/RowHeuristicsService.ts`):
   - `inferCategory()` viene chiamato solo per `TaskType.DataRequest`
   - Normalizza label: `label.toLowerCase().trim()`
   - Crea nuovo `RegExp` da `catPattern.pattern` ad ogni chiamata
   - Testa pattern nell'ordine di priorità delle lingue

## Problemi Identificati

### 🔴 PROBLEMA 1: Pattern con Anchors Rigidi (`^` e `$`)
**Descrizione**: I pattern nel database usano `^` (inizio) e `$` (fine) che richiedono match completo della stringa.

**Esempio pattern**:
```javascript
pattern: '^(?:chiedi|richiedi|domanda|acquisisci|raccogli)\\s+(?:il|la|lo|gli|le|l\'|un|una|uno)\\s+motivo\\s+(?:della|del|di)\\s+chiamata$'
```

**Problema**: Se la label contiene spazi extra, punteggiatura, o testo aggiuntivo, il pattern non matcha.

**Esempio fallimento**:
- Label: `"Chiedi il motivo della chiamata."` (con punto finale)
- Normalizzato: `"chiedi il motivo della chiamata."`
- Pattern non matcha perché c'è un punto dopo `chiamata`

**Soluzione Proposta**:
1. Rimuovere `^` e `$` dai pattern (match parziale)
2. Oppure normalizzare meglio il testo (rimuovere punteggiatura finale)
3. Oppure aggiungere pattern più flessibili

### 🟡 PROBLEMA 2: Normalizzazione Testo Insufficiente
**Descrizione**: La normalizzazione attuale è solo `toLowerCase().trim()`, ma non gestisce:
- Punteggiatura finale (`.`, `!`, `?`)
- Spazi multipli
- Caratteri speciali
- Apostrofi normalizzati vs tipografici (`'` vs `'`)

**Codice attuale**:
```typescript
const normalizedLabel = label.toLowerCase().trim();
```

**Soluzione Proposta**:
```typescript
const normalizedLabel = label
  .toLowerCase()
  .trim()
  .replace(/[.,!?;:]+$/g, '') // Rimuovi punteggiatura finale
  .replace(/\s+/g, ' ') // Normalizza spazi multipli
  .replace(/[''""]/g, "'"); // Normalizza apostrofi
```

### 🟡 PROBLEMA 3: Pattern Non Compilati in Cache
**Descrizione**: A differenza degli altri pattern (es. `REQUEST_DATA`, `MESSAGE`) che vengono compilati in `RegExp` durante il caricamento, `CATEGORY_PATTERNS` viene memorizzato come array di oggetti. Questo significa:
- Ogni chiamata a `inferCategory()` crea nuovi `RegExp` (overhead)
- Se un pattern è invalido, l'errore viene catturato solo a runtime

**Codice attuale** (`patternLoader.ts:62`):
```typescript
CATEGORY_PATTERNS: rules.CATEGORY_PATTERNS || [],
```

**Confronto con altri pattern** (`patternLoader.ts:44-46`):
```typescript
MESSAGE: rules.MESSAGE?.map((s: string) => new RegExp(s, 'i')) || [],
REQUEST_DATA: rules.REQUEST_DATA?.map((s: string) => {
  try {
    return new RegExp(s, 'i');
  } catch (err) {
    console.error(`[PATTERN_LOADER] ❌ Errore compilazione pattern: ${s}`, err);
    return null;
  }
}).filter((r: RegExp | null) => r !== null) || [],
```

**Soluzione Proposta**:
Compilare i pattern durante il caricamento, con validazione:
```typescript
CATEGORY_PATTERNS: rules.CATEGORY_PATTERNS?.map((cp: CategoryPattern) => {
  try {
    return {
      pattern: new RegExp(cp.pattern, 'i'),
      category: cp.category
    };
  } catch (err) {
    console.error(`[PATTERN_LOADER] ❌ Errore compilazione CATEGORY_PATTERN: ${cp.pattern}`, err);
    return null;
  }
}).filter((cp: any) => cp !== null) || [],
```

E aggiornare `inferCategory()` per usare pattern già compilati:
```typescript
if (catPattern.pattern.test(normalizedLabel)) {
  // ...
}
```

### 🟡 PROBLEMA 4: Mancanza di Logging Dettagliato
**Descrizione**: Il logging attuale mostra solo match riusciti, ma non:
- Quanti pattern sono stati testati
- Quali pattern non hanno matchato (per debug)
- Se i pattern sono stati caricati correttamente

**Soluzione Proposta**:
Aggiungere logging dettagliato:
```typescript
console.log('🔍 [RowHeuristics][inferCategory] Inizio analisi', {
  label,
  normalizedLabel,
  taskType,
  lang,
  availableLangs,
  totalPatterns: ruleSet.CATEGORY_PATTERNS.length
});

// ... nel loop di test pattern ...
if (!regex.test(normalizedLabel)) {
  console.debug(`  ❌ Pattern non matchato: ${catPattern.pattern}`);
}
```

### 🔴 PROBLEMA 5: Race Condition nel Caricamento Cache
**Descrizione**: `waitForCache()` potrebbe non gestire correttamente errori o race conditions se:
- La cache fallisce durante il caricamento
- Multiple chiamate simultanee a `inferCategory()` prima che la cache sia pronta

**Codice attuale** (`patternLoader.ts:112-204`):
Il codice gestisce già race conditions, ma potrebbe migliorare la gestione degli errori.

**Soluzione Proposta**:
Aggiungere retry logic e timeout:
```typescript
static async inferCategory(...) {
  // ...
  let retries = 3;
  while (retries > 0) {
    try {
      await waitForCache();
      break;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('[RowHeuristics][inferCategory] Cache non disponibile dopo retry');
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  // ...
}
```

### 🟡 PROBLEMA 6: Pattern Potrebbero Non Essere Presenti nel Database
**Descrizione**: Se il documento `CategoryExtraction` non esiste o è vuoto, `CATEGORY_PATTERNS` sarà un array vuoto e `inferCategory()` restituirà sempre `null` senza avvisare.

**Soluzione Proposta**:
Aggiungere validazione e warning:
```typescript
if (!ruleSet || !ruleSet.CATEGORY_PATTERNS || ruleSet.CATEGORY_PATTERNS.length === 0) {
  console.warn(`[RowHeuristics][inferCategory] Nessun pattern disponibile per lingua ${currentLang}`);
  continue;
}
```

E log iniziale:
```typescript
const totalPatterns = availableLangs.reduce((sum, lang) => {
  const rs = getRuleSet(lang);
  return sum + (rs?.CATEGORY_PATTERNS?.length || 0);
}, 0);

if (totalPatterns === 0) {
  console.warn('[RowHeuristics][inferCategory] ⚠️ Nessun pattern CATEGORY_PATTERNS disponibile in nessuna lingua!');
}
```

## Raccomandazioni Prioritarie

### Priorità ALTA
1. **Migliorare normalizzazione testo** (Problema 2)
2. **Compilare pattern in cache** (Problema 3)
3. **Rendere pattern più flessibili** (rimuovere `^` e `$` o normalizzare meglio) (Problema 1)

### Priorità MEDIA
4. **Aggiungere logging dettagliato** (Problema 4)
5. **Validare presenza pattern nel database** (Problema 6)

### Priorità BASSA
6. **Migliorare gestione race conditions** (Problema 5)

## Test Suggeriti

1. Test con label che hanno punteggiatura finale
2. Test con spazi multipli
3. Test con pattern non presenti nel database
4. Test con pattern invalidi nel database
5. Test con chiamate simultanee a `inferCategory()`
6. Test con cache non ancora caricata

## Soluzioni Implementate

### ✅ IMPLEMENTATO: Compilazione Pattern in Cache
**File**: `src/nlp/taskType/patternLoader.ts`
- I pattern `CATEGORY_PATTERNS` vengono ora compilati in `RegExp` durante il caricamento
- Validazione durante il caricamento: pattern invalidi vengono filtrati
- Nuovo tipo `CompiledCategoryPattern` con pattern compilato e originale (per logging)

### ✅ IMPLEMENTATO: Normalizzazione Testo Migliorata
**File**: `src/services/RowHeuristicsService.ts`
- Rimozione punteggiatura finale (`.`, `!`, `?`, `;`, `:`)
- Normalizzazione spazi multipli
- Normalizzazione apostrofi tipografici (`'` e `'` → `'`)

### ✅ IMPLEMENTATO: Logging Dettagliato
**File**: `src/services/RowHeuristicsService.ts`
- Log iniziale con conteggio pattern totali
- Warning se nessun pattern disponibile
- Log per ogni lingua testata
- Log dettagliato quando un pattern matcha
- Log quando nessun pattern matcha

### ✅ IMPLEMENTATO: Validazione Pattern
**File**: `src/nlp/taskType/patternLoader.ts`
- Pattern invalidi vengono filtrati durante il caricamento
- Errori di compilazione vengono loggati ma non bloccano il caricamento

## Note Implementative

- I pattern nel database sono in `backend/scripts/add_category_patterns.js`
- Lo script deve essere eseguito per popolare il database
- Verificare che il documento `CategoryExtraction` esista in MongoDB collection `Heuristics` del database `factory`

## Prossimi Passi (Non Implementati)

### Pattern con Anchors Rigidi
**Problema**: I pattern usano `^` e `$` che richiedono match completo. Se la label ha punteggiatura o spazi extra, non matcha.

**Soluzione Temporanea**: La normalizzazione migliorata rimuove la punteggiatura finale, ma potrebbe non essere sufficiente per tutti i casi.

**Soluzione Definitiva**: Considerare di:
1. Rimuovere `^` e `$` dai pattern nel database (match parziale)
2. Oppure aggiungere varianti dei pattern senza anchors
3. Oppure usare pattern più flessibili con `.*` all'inizio/fine

### Race Condition nel Caricamento Cache
**Problema**: Potrebbero esserci race conditions se multiple chiamate simultanee avvengono prima che la cache sia pronta.

**Soluzione**: Aggiungere retry logic con timeout (non implementato per ora, ma il codice attuale gestisce già le race conditions base).
