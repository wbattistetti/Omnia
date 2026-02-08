# Soluzione Implementata - Test Cases che Scompaiono

## Problema Risolto

Il problema dei test cases che scompaiono dopo l'aggiunta era causato da un'architettura basata su "derived state" dove `selectedNode` era una derivazione complessa attraverso multipli `useMemo`, invece di uno stato diretto.

## Approccio Adottato

Abbiamo implementato la **Soluzione Pulita SENZA storage** suggerita dall'esperto, che elimina completamente il "derived state hell" e rende `selectedNode` uno stato diretto gestito da React.

### Cambiamenti Principali

#### 1. ResponseEditor/index.tsx - Stato Diretto

**Prima (sbagliato):**
```typescript
const selectedNode = useMemo(() => {
  // Complessa derivazione da mainList, localDDT, etc...
  const main = mainList[selectedMainIndex];
  return main;
}, [mainListStableKey, selectedMainIndex, ...molte dipendenze]);
```

**Dopo (corretto):**
```typescript
// ✅ selectedNode è uno stato diretto, non una derivazione
const [selectedNode, setSelectedNode] = useState<any>(null);
const [selectedNodePath, setSelectedNodePath] = useState<{
  mainIndex: number;
  subIndex?: number;
} | null>(null);

// Inizializza selectedNode quando mainList è pronto
useEffect(() => {
  if (!selectedNode && mainList.length > 0) {
    const node = selectedSubIndex == null
      ? mainList[selectedMainIndex]
      : getSubDataList(mainList[selectedMainIndex])?.[selectedSubIndex];

    if (node) {
      setSelectedNode(node);
      setSelectedNodePath({
        mainIndex: selectedMainIndex,
        subIndex: selectedSubIndex
      });
    }
  }
}, [mainList, selectedNode, selectedMainIndex, selectedSubIndex]);

// Aggiorna selectedNode quando cambiano gli indici di selezione
useEffect(() => {
  if (mainList.length > 0) {
    if (selectedRoot) {
      // Root selected
      const introStep = introduction
        ? { type: 'introduction', escalations: introduction.escalations }
        : { type: 'introduction', escalations: [] };
      setSelectedNode({ ...localDDT, steps: [introStep] });
      setSelectedNodePath(null);
    } else {
      // Main or sub selected
      const node = selectedSubIndex == null
        ? mainList[selectedMainIndex]
        : getSubDataList(mainList[selectedMainIndex])?.[selectedSubIndex];

      if (node) {
        setSelectedNode(node);
        setSelectedNodePath({
          mainIndex: selectedMainIndex,
          subIndex: selectedSubIndex
        });
      }
    }
  }
}, [selectedMainIndex, selectedSubIndex, selectedRoot, mainList, localDDT, introduction]);
```

#### 2. handleProfileUpdate - Aggiornamento Corretto

**Prima (sbagliato):**
```typescript
updateSelectedNode((node) => {
  const next: any = { ...(node || {}) };
  next.nlpProfile = { ...(next.nlpProfile || {}), ...profile };
  return next;
}, true);
```

**Dopo (corretto):**
```typescript
// ✅ handleProfileUpdate: aggiorna sia selectedNode che localDDT
const handleProfileUpdate = useCallback((partialProfile: any) => {
  // Aggiorna selectedNode immediatamente
  setSelectedNode((prev: any) => {
    if (!prev) return prev;
    return {
      ...prev,
      nlpProfile: {
        ...(prev.nlpProfile || {}),
        ...partialProfile
      }
    };
  });

  // Aggiorna localDDT per persistenza
  setLocalDDT((prev: any) => {
    if (!prev || !selectedNodePath) return prev;

    const mains = getMainDataList(prev);
    const { mainIndex, subIndex } = selectedNodePath;

    if (mainIndex >= mains.length) return prev;

    const main = mains[mainIndex];

    // Caso MAIN node
    if (subIndex === undefined) {
      const updatedMain = {
        ...main,
        nlpProfile: {
          ...(main.nlpProfile || {}),
          ...partialProfile
        }
      };

      const newMainData = [...mains];
      newMainData[mainIndex] = updatedMain;

      return { ...prev, mainData: newMainData };
    }

    // Caso SUB node
    const subList = main.subData || [];
    if (subIndex >= subList.length) return prev;

    const updatedSub = {
      ...subList[subIndex],
      nlpProfile: {
        ...(subList[subIndex].nlpProfile || {}),
        ...partialProfile
      }
    };

    const newSubData = [...subList];
    newSubData[subIndex] = updatedSub;

    const updatedMain = { ...main, subData: newSubData };

    const newMainData = [...mains];
    newMainData[mainIndex] = updatedMain;

    return { ...prev, mainData: newMainData };
  });
}, [selectedNodePath]);
```

#### 3. useProfileState - Semplificato

**Prima (complesso):**
```typescript
useEffect(() => {
  // Logica complessa per evitare di perdere testCases
  const profileWithoutTestCases = { ...profile };
  delete profileWithoutTestCases.testCases;
  // ... 30+ righe di logica
}, [profile.synonyms, profile.regex, ...10+ dipendenze]);
```

**Dopo (semplice):**
```typescript
useEffect(() => {
  const json = JSON.stringify(profile);

  if (json !== lastSentJsonRef.current) {
    lastSentJsonRef.current = json;
    onChangeRef.current?.(profile);
  }
}, [profile]);
```

### Vantaggi della Soluzione

1. ✅ **Elimina "Derived State Hell"**: `selectedNode` non è più una derivazione complessa, è uno stato diretto
2. ✅ **Gestisce Main e Subnodes**: `handleProfileUpdate` correttamente aggiorna sia main che sub nodes
3. ✅ **Nessuna Race Condition**: Usa `selectedNodePath` invece di closure su `selectedNode`
4. ✅ **Sincronizzazione Garantita**: `selectedNode` e `localDDT` vengono aggiornati atomicamente
5. ✅ **Test Cases Persistono**: I test cases ora rimangono visibili perché `selectedNode` ha sempre i dati aggiornati
6. ✅ **Codice Semplice**: Rimosso `mainListStableKey` e tutta la complessità delle dipendenze

### Codice Rimosso

- `mainListStableKey` useMemo (non più necessario)
- Logica complessa di `onChange` in `useProfileState`
- Dipendenze fragili nel `selectedNode` useMemo (ora è uno stato)
- `localStorage`/`sessionStorage` (non necessari, tutto vive nello stato React)

## Flusso Dati Finale (Semplificato)

```
User: digita "test1" e preme Enter
  ↓
TestValuesColumn.handleAddTestCase()
  ↓
onTestCasesChange([...testCases, "test1"])
  ↓
RegexInlineEditor.setTestCases(["test1"])
  ↓
handleProfileUpdate({ ...profile, testCases: ["test1"] })
  ↓
setSelectedNode(prev => ({ ...prev, nlpProfile: { ...prev.nlpProfile, testCases: ["test1"] } }))
  ↓
setLocalDDT(prev => ({ ...prev, mainData: [updatedMain] }))
  ↓
React re-render
  ↓
profile = selectedNode.nlpProfile // ← Diretto, non più derivato
  ↓
TestValuesColumn riceve testCases: ["test1"]
  ↓
✅ Griglia mostra "test1" stabilmente
```

## Risultato

✅ **Problema risolto**: I test cases non scompaiono più dopo l'aggiunta
✅ **Architettura pulita**: Nessun "derived state", tutto è diretto
✅ **Codice manutenibile**: Più semplice, meno bug
✅ **Performance ottimali**: Meno ricalcoli, meno re-render

