# Problema: Test Cases scompaiono dopo l'aggiunta

## Sintomo
Quando l'utente aggiunge un test case nella griglia (digita un valore e preme Enter), la riga appare per un istante e poi scompare immediatamente.

## Architettura attuale

### Flusso dei dati (come dovrebbe funzionare)

```
User: digita "test1" e preme Enter
  ↓
TestValuesColumn.handleAddTestCase()
  ↓
onTestCasesChange([...testCases, "test1"])
  ↓
RegexInlineEditor.setTestCases(["test1"])
  ↓
onProfileUpdate({ ...profile, testCases: ["test1"] })
  ↓
ResponseEditor.updateSelectedNode(node => ({
  ...node,
  nlpProfile: { ...node.nlpProfile, testCases: ["test1"] }
}))
  ↓
setLocalDDT({ ...prev, mainData: [updatedNode] })
  ↓
React re-render
  ↓
mainList = getMainDataList(localDDT) // ricalcolato
  ↓
selectedNode = mainList[selectedMainIndex] // ricalcolato
  ↓
useProfileState(selectedNode) // ricalcolato
  ↓
profile.testCases = selectedNode.nlpProfile.testCases // dovrebbe essere ["test1"]
  ↓
RegexInlineEditor riceve nuovo profile
  ↓
TestValuesColumn riceve testCases aggiornato
  ↓
Griglia mostra "test1" ✓
```

### Codice attuale

#### 1. TestValuesColumn.tsx (componente che gestisce la griglia)
```typescript
// Riceve testCases come prop e callback per aggiornarli
interface TestValuesColumnProps {
  testCases: string[];
  onTestCasesChange: (cases: string[]) => void;
}

const handleAddTestCase = () => {
  const trimmed = newTestCase.trim();
  if (!trimmed) return;

  const newTestCases = [...testCases, trimmed];
  onTestCasesChange(newTestCases); // ← Chiama il callback
  setNewTestCase('');
};
```

#### 2. RegexInlineEditor.tsx (parent che passa i props)
```typescript
// Legge testCases direttamente da profile (nessuno stato locale)
const testCases = profile?.testCases || [];

const setTestCases = useCallback((cases: string[]) => {
  if (onProfileUpdate && profile) {
    onProfileUpdate({ ...profile, testCases: cases }); // ← Aggiorna profile
  }
}, [profile, onProfileUpdate]);

// Passa a TestValuesColumn
<TestValuesColumn
  testCases={testCases}
  onTestCasesChange={setTestCases}
/>
```

#### 3. ResponseEditor/index.tsx (livello superiore)
```typescript
// selectedNode viene ricalcolato da mainList
const selectedNode = useMemo(() => {
  const main = mainList[selectedMainIndex];
  return main; // ← Riferimento al nodo
}, [mainListStableKey, selectedMainIndex, selectedSubIndex, selectedRoot, introduction, mainList, localDDT]);

// useProfileState riceve selectedNode
const profile = useProfileState(selectedNode, locale, (profile) => {
  // onChange: aggiorna il nodo nella struttura nested
  updateSelectedNode((node) => {
    const next: any = { ...(node || {}) };
    next.nlpProfile = { ...(next.nlpProfile || {}), ...profile };
    if (profile.testCases !== undefined && Array.isArray(profile.testCases)) {
      next.nlpProfile.testCases = profile.testCases; // ← Salva testCases
    }
    return next;
  }, true);
});
```

#### 4. useProfileState.ts (hook che calcola profile)
```typescript
const profile: NLPProfile = useMemo(() => {
  // Legge testCases direttamente dal node
  const nodeProfile = (node && (node as any).nlpProfile) || {};
  const currentTestCases = Array.isArray(nodeProfile.testCases)
    ? nodeProfile.testCases
    : (initial.testCases || undefined);

  return {
    // ... altri campi
    testCases: currentTestCases, // ← Legge da node.nlpProfile.testCases
  };
}, [node, (node as any)?.nlpProfile?.testCases, ...otherDeps]);
```

#### 5. useNodeUpdate.ts (aggiorna localDDT)
```typescript
const updateSelectedNode = useCallback((updater, notifyProvider = true) => {
  setLocalDDT((prev) => {
    const mains = getMainDataList(prev);
    const main = mains[selectedMainIndex];

    const updated = updater(main) || main; // ← Applica l'updater

    // Shallow copy: solo il nodo modificato
    const newMainData = [...mains];
    newMainData[selectedMainIndex] = updated;
    const next = { ...prev, mainData: newMainData };

    return next; // ← Aggiorna localDDT
  });
}, [localDDT, selectedRoot, selectedMainIndex, selectedSubIndex, replaceSelectedDDT]);
```

## Il problema

### Cosa succede realmente (dai log)

1. ✅ User digita "12 3 1980" e preme Enter
2. ✅ `handleAddTestCase` viene chiamato
3. ✅ `onTestCasesChange([...testCases, "12 3 1980"])` viene chiamato
4. ✅ `setTestCases` viene chiamato in RegexInlineEditor
5. ✅ `onProfileUpdate({ ...profile, testCases: ["12 3 1980"] })` viene chiamato
6. ✅ `updateSelectedNode` viene chiamato (2 volte - problema minore)
7. ✅ Il nodo viene aggiornato: `next.nlpProfile.testCases = ["12 3 1980"]`
8. ✅ `localDDT` viene aggiornato con il nuovo nodo
9. ✅ `replaceSelectedDDT` viene chiamato per persistere
10. ❌ **MA**: `selectedNode` NON viene ricalcolato immediatamente
11. ❌ **QUINDI**: `useProfileState` continua a leggere il vecchio `node` con `testCases: undefined`
12. ❌ **RISULTATO**: `profile.testCases` rimane `undefined`
13. ❌ **CONSEGUENZA**: `TestValuesColumn` riceve `testCases: []` e la riga scompare

### Perché selectedNode non viene ricalcolato?

`selectedNode` dipende da:
- `mainListStableKey` - calcolato da `label` e `subCount` (non cambia quando cambiano solo testCases)
- `mainList` - array di riferimenti (potrebbe non cambiare se React non rileva il cambio)
- `localDDT` - aggiunto come dipendenza ma potrebbe non essere sufficiente

Il problema è che `mainList` viene ricalcolato da `localDDT`, ma React potrebbe non rilevare il cambio se il riferimento dell'array `mainData` non cambia, anche se il contenuto del nodo è cambiato.

## Tentativi di fix falliti

1. ❌ **Aggiunto stato locale in editor**: Causava race condition e sincronizzazione complessa
2. ❌ **Aggiunto guard con lastSetRef**: Hack fragile che non risolve la causa
3. ❌ **Aggiunto localDDT come dipendenza**: Non risolve perché mainList potrebbe non cambiare riferimento
4. ❌ **Shallow copy mirato**: Corretto ma non sufficiente se selectedNode non si ricalcola

## Domande per l'esperto

1. **Perché `selectedNode` non viene ricalcolato dopo `updateSelectedNode`?**
   - `mainList` viene ricalcolato da `localDDT`?
   - Il riferimento di `mainList` cambia quando cambia solo `node.nlpProfile.testCases`?
   - `mainListStableKey` è sufficiente per rilevare i cambiamenti?

2. **Come garantire che `selectedNode` si ricalcoli quando cambia `node.nlpProfile.testCases`?**
   - Dobbiamo aggiungere una dipendenza esplicita su `node.nlpProfile.testCases`?
   - Dobbiamo usare un `useMemo` più specifico?
   - Dobbiamo forzare il ricalcolo in qualche modo?

3. **L'architettura è corretta o c'è un design problem?**
   - È normale avere `selectedNode` derivato da `mainList` che è derivato da `localDDT`?
   - Dovremmo usare un approccio diverso (es. Context, Redux, Zustand)?
   - Dovremmo invertire il flusso (testCases vive in useProfileState invece che in node)?

4. **Come gestire correttamente l'update di una proprietà nested con React?**
   - Shallow copy a cascata è sufficiente?
   - Dobbiamo usare Immer o simili?
   - C'è un pattern React standard per questo caso?

## Codice rilevante

### selectedNode useMemo
```typescript
const selectedNode = useMemo(() => {
  const main = mainList[selectedMainIndex];
  return main; // ← Riferimento al nodo
}, [mainListStableKey, selectedMainIndex, selectedSubIndex, selectedRoot, introduction, mainList, localDDT]);
```

### mainList useMemo
```typescript
const mainList = useMemo(() => getMainDataList(localDDT), [localDDT]);
```

### mainListStableKey useMemo
```typescript
const mainListStableKey = useMemo(() => {
  if (!mainList || mainList.length === 0) return 'empty';
  return mainList.map((m: any, idx: number) => {
    const label = m?.label || '';
    const subCount = getSubDataList(m)?.length || 0;
    return `${idx}:${label}:${subCount}`; // ← Non include testCases!
  }).join('|');
}, [mainList]);
```

### updateSelectedNode
```typescript
const updateSelectedNode = useCallback((updater, notifyProvider = true) => {
  setLocalDDT((prev) => {
    const mains = getMainDataList(prev);
    const main = mains[selectedMainIndex];
    const updated = updater(main) || main;

    const newMainData = [...mains]; // ← Nuovo array
    newMainData[selectedMainIndex] = updated; // ← Nuovo nodo
    const next = { ...prev, mainData: newMainData }; // ← Nuovo DDT

    return next;
  });
}, [localDDT, selectedRoot, selectedMainIndex, selectedSubIndex, replaceSelectedDDT]);
```

## Conclusione

Il problema è che **`selectedNode` non viene ricalcolato** dopo che `updateSelectedNode` aggiorna `localDDT`, quindi `useProfileState` continua a leggere il vecchio nodo senza i test cases aggiornati.

**Serve una soluzione che garantisca che `selectedNode` si ricalcoli quando cambia `node.nlpProfile.testCases`.**

