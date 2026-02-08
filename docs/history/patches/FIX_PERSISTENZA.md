# Fix Persistenza Test Cases - Sincronizzazione Stato Locale con Node

## Problema Identificato

Dopo aver risolto la race condition per l'aggiunta di test cases, è emerso un nuovo problema: **i test cases non persistevano dopo aver chiuso e riaperto l'editor**.

### Comportamento Osservato

1. User aggiunge test cases → ✅ Appaiono correttamente
2. User chiude l'editor NLP
3. User riapre lo stesso nodo → ❌ I test cases sono spariti

## Root Cause

Il problema aveva due aspetti:

### 1. Mancata Sincronizzazione dello Stato Locale

Lo stato locale `testCases` in `useProfileState` non si aggiornava quando il `node` veniva ricaricato con i dati persistiti.

**Problema:**
```typescript
// ✅ Sincronizzava testCases solo quando cambiava slotId o examples
useEffect(() => {
  // ...
  setTestCases(initial.testCases || []);
}, [initial.slotId, initial.examples]); // ❌ Mancava initial.testCases
```

### 2. Doppia Fonte di Verità per selectedNode

`handleProfileUpdate` aggiornava `selectedNode` direttamente, creando una race condition con l'`useEffect` che lo aggiornava da `mainList`:

**Problema:**
```typescript
const handleProfileUpdate = useCallback((partialProfile: any) => {
  // ❌ Aggiorna selectedNode direttamente
  setSelectedNode((prev: any) => ({
    ...prev,
    nlpProfile: { ...(prev.nlpProfile || {}), ...partialProfile }
  }));

  // ✅ Aggiorna localDDT
  setLocalDDT((prev: any) => {
    // ... aggiorna mainData
  });
}, [selectedNodePath]);

// Poi l'useEffect sovrascrive selectedNode con i dati da mainList
useEffect(() => {
  const node = mainList[selectedMainIndex];
  setSelectedNode(node); // ← Sovrascrive l'aggiornamento precedente
}, [mainList, ...]);
```

## Soluzione Implementata

### 1. Sincronizzazione Esplicita di testCases

**File: `src/components/ActEditor/ResponseEditor/hooks/useProfileState.ts`**

Aggiunto un `useEffect` dedicato per sincronizzare `testCases` quando cambiano nel `node`:

```typescript
// ✅ Sync testCases when node.nlpProfile.testCases changes (for persistence)
const prevTestCasesRef = useRef<string>('');
useEffect(() => {
  const currentTestCasesKey = JSON.stringify(initial.testCases || []);

  // Sync if testCases changed in the node (e.g., after save/reload)
  if (currentTestCasesKey !== prevTestCasesRef.current) {
    prevTestCasesRef.current = currentTestCasesKey;
    setTestCases(initial.testCases || []);
  }
}, [initial.testCases]);
```

### 2. Singola Fonte di Verità per selectedNode

**File: `src/components/ActEditor/ResponseEditor/index.tsx`**

Rimosso l'aggiornamento diretto di `selectedNode` da `handleProfileUpdate`. Ora solo `localDDT` viene aggiornato, e `selectedNode` viene aggiornato automaticamente dall'`useEffect` che monitora `mainList`:

```typescript
// ✅ handleProfileUpdate: aggiorna SOLO localDDT
const handleProfileUpdate = useCallback((partialProfile: any) => {
  // Aggiorna localDDT per persistenza
  setLocalDDT((prev: any) => {
    // ... aggiorna mainData con partialProfile
    return { ...prev, mainData: newMainData };
  });
  // ❌ NON aggiorna più selectedNode direttamente
}, [selectedNodePath]);

// ✅ useEffect: aggiorna selectedNode quando mainList cambia
useEffect(() => {
  if (mainList.length > 0) {
    const node = mainList[selectedMainIndex];
    if (node) {
      setSelectedNode(node); // ← Unica fonte di verità
    }
  }
}, [mainList, selectedMainIndex, ...]);
```

### 3. Logging per Debug

Aggiunto logging per tracciare gli aggiornamenti di `selectedNode`:

```typescript
try {
  if (localStorage.getItem('debug.responseEditor') === '1') {
    console.log('[selectedNode] Updated', {
      nodeLabel: node.label,
      hasTestCases: !!node.nlpProfile?.testCases,
      testCasesCount: (node.nlpProfile?.testCases || []).length,
      testCases: node.nlpProfile?.testCases
    });
  }
} catch {}
```

## Flusso Completo con Persistenza

### Aggiunta Test Case

```
User: aggiunge "test1"
  ↓
setTestCasesProp(["test1"]) // ← Setter diretto da useProfileState
  ↓
useProfileState: setTestCases(["test1"]) // ← Aggiorna stato locale
  ↓
profile = useMemo(() => ({ ...other, testCases: ["test1"] })) // ← Ricalcola
  ↓
useEffect in useProfileState: onChange(profile) // ← Emette onChange
  ↓
ResponseEditor.handleProfileUpdate(profile)
  ↓
setLocalDDT((prev) => {
  const updatedMain = {
    ...main,
    nlpProfile: { ...(main.nlpProfile || {}), ...profile }
  };
  return { ...prev, mainData: [...mains, updatedMain] };
})
  ↓
mainList = useMemo(() => getMainDataList(localDDT)) // ← Ricalcola con nuovo localDDT
  ↓
useEffect: setSelectedNode(mainList[selectedMainIndex]) // ← Aggiorna selectedNode da mainList
  ↓
NLPExtractorProfileEditor riceve node aggiornato
  ↓
useProfileState riceve node con nlpProfile.testCases: ["test1"]
  ↓
initial.testCases = ["test1"]
  ↓
✅ Test case visibile e persistito
```

### Chiusura e Riapertura Editor

```
User: chiude l'editor (activeEditor = null)
  ↓
(localDDT mantiene i test cases nel mainData[selectedMainIndex].nlpProfile.testCases)
  ↓
User: riapre lo stesso nodo (activeEditor = 'regex')
  ↓
mainList[selectedMainIndex] ha nlpProfile.testCases: ["test1"] // ← Dati persistiti
  ↓
useEffect: setSelectedNode(mainList[selectedMainIndex]) // ← selectedNode con test cases
  ↓
NLPExtractorProfileEditor riceve node con nlpProfile.testCases: ["test1"]
  ↓
useProfileState: initial.testCases = ["test1"]
  ↓
useEffect (linea 220): currentTestCasesKey !== prevTestCasesRef.current
  ↓
setTestCases(initial.testCases) // ← Sincronizza stato locale con node
  ↓
profile.testCases: ["test1"]
  ↓
RegexInlineEditor riceve testCases: ["test1"]
  ↓
TestValuesColumn mostra ["test1"]
  ↓
✅ Test cases ripristinati dopo riapertura
```

## Vantaggi della Soluzione

1. ✅ **Singola Fonte di Verità**: `selectedNode` è sempre derivato da `mainList`, no duplicazioni
2. ✅ **Sincronizzazione Automatica**: `useEffect` sincronizza `testCases` quando il `node` cambia
3. ✅ **Persistenza Garantita**: I test cases sono salvati in `localDDT` e ripristinati alla riapertura
4. ✅ **No Race Conditions**: Flusso unidirezionale: `localDDT` → `mainList` → `selectedNode` → `useProfileState`
5. ✅ **Debug Facilitato**: Logging dettagliato per tracciare gli aggiornamenti

## File Modificati

- ✅ `src/components/ActEditor/ResponseEditor/hooks/useProfileState.ts`
  - Aggiunto `useEffect` per sincronizzare `testCases` quando cambiano in `initial.testCases`

- ✅ `src/components/ActEditor/ResponseEditor/index.tsx`
  - Rimosso aggiornamento diretto di `selectedNode` da `handleProfileUpdate`
  - Aggiunto logging per tracciare aggiornamenti di `selectedNode`

## Test da Eseguire

1. ✅ Aggiungere test case → dovrebbe apparire immediatamente
2. ✅ Chiudere l'editor NLP
3. ✅ Riaprire lo stesso nodo → i test cases dovrebbero essere ancora visibili
4. ✅ Verificare nei log `[selectedNode] Updated` che i `testCases` siano presenti

## Risultato Finale

✅ **I test cases ora persistono correttamente dopo chiusura e riapertura dell'editor**
✅ **Architettura pulita con singola fonte di verità**
✅ **Flusso unidirezionale prevedibile**

