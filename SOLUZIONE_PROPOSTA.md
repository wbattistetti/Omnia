# Soluzione Proposta - Fix per Test Cases

## Analisi dell'Esperto

L'esperto ha identificato che:
- La logica funzionale è semplice (aggiungere una stringa a un array)
- L'architettura attuale è troppo complessa con troppe derive e memo
- Il problema è che `selectedNode` non si ricalcola quando cambiano i `testCases` perché le dipendenze del `useMemo` non includono `testCases`

## Soluzione Proposta (Fix Immediato)

### Problema attuale

`selectedNode` dipende da `mainListStableKey` che non include `testCases`:

```typescript
const mainListStableKey = useMemo(() => {
  if (!mainList || mainList.length === 0) return 'empty';
  return mainList.map((m: any, idx: number) => {
    const label = m?.label || '';
    const subCount = getSubDataList(m)?.length || 0;
    return `${idx}:${label}:${subCount}`; // ← Non include testCases!
  }).join('|');
}, [mainList]);

const selectedNode = useMemo(() => {
  const main = mainList[selectedMainIndex];
  return main;
}, [mainListStableKey, ...]); // ← mainListStableKey non cambia quando cambiano testCases
```

### Soluzione 1: Aggiungere dipendenza esplicita su testCases

**Modifica a `index.tsx`:**

```typescript
// Estrai i testCases del nodo selezionato come dipendenza esplicita
const selectedNodeTestCases = useMemo(() => {
  if (selectedRoot) return undefined;
  const main = mainList[selectedMainIndex];
  if (!main) return undefined;
  if (selectedSubIndex == null) {
    // Main node
    return (main as any)?.nlpProfile?.testCases;
  } else {
    // Sub node
    const subList = getSubDataList(main);
    const sub = subList[selectedSubIndex];
    return (sub as any)?.nlpProfile?.testCases;
  }
}, [mainList, selectedMainIndex, selectedSubIndex, selectedRoot]);

// Nodo selezionato: root se selectedRoot, altrimenti main/sub in base agli indici
const selectedNode = useMemo(() => {
  // If root is selected, return the root DDT structure with introduction step
  if (selectedRoot) {
    if (!localDDT) return null;
    const introStep = introduction
      ? { type: 'introduction', escalations: introduction.escalations }
      : { type: 'introduction', escalations: [] };
    return { ...localDDT, steps: [introStep] };
  }
  const main = mainList[selectedMainIndex];
  if (!main) {
    return null;
  }
  if (selectedSubIndex == null) {
    // Main selected
    return main;
  }
  const subList = getSubDataList(main);
  const sub = subList[selectedSubIndex] || main;
  return sub;
}, [
  mainListStableKey,
  selectedMainIndex,
  selectedSubIndex,
  selectedRoot,
  introduction,
  mainList,
  localDDT,
  selectedNodeTestCases // ← Dipendenza esplicita su testCases
]);
```

**Vantaggi:**
- Fix minimale e immediato
- Non cambia l'architettura esistente
- `selectedNode` si ricalcola quando cambiano i `testCases`

**Svantaggi:**
- Non risolve il problema architetturale di fondo
- Aggiunge un altro `useMemo` (ma necessario per la dipendenza)

## Soluzione 2: Semplificare mainListStableKey (Alternativa)

Invece di aggiungere una nuova dipendenza, potremmo includere i `testCases` nella `mainListStableKey`:

```typescript
const mainListStableKey = useMemo(() => {
  if (!mainList || mainList.length === 0) return 'empty';
  return mainList.map((m: any, idx: number) => {
    const label = m?.label || '';
    const subCount = getSubDataList(m)?.length || 0;
    // Aggiungi hash dei testCases per rilevare cambiamenti
    const testCasesHash = JSON.stringify((m as any)?.nlpProfile?.testCases || []);
    return `${idx}:${label}:${subCount}:${testCasesHash}`;
  }).join('|');
}, [mainList]);
```

**Vantaggi:**
- Usa la dipendenza esistente
- Meno codice

**Svantaggi:**
- `mainListStableKey` diventa più complesso
- Include dati nested nella chiave (potrebbe essere inefficiente)

## Soluzione 3: Rimuovere mainListStableKey (Più radicale)

Come suggerito dall'esperto, potremmo rimuovere `mainListStableKey` e usare direttamente `mainList`:

```typescript
// Rimuovi mainListStableKey completamente
// const mainListStableKey = useMemo(...); // ← RIMOSSO

const selectedNode = useMemo(() => {
  // ... stesso codice ...
}, [
  // mainListStableKey, // ← RIMOSSO
  selectedMainIndex,
  selectedSubIndex,
  selectedRoot,
  introduction,
  mainList, // ← mainList cambia quando cambia localDDT
  localDDT
]);
```

**Vantaggi:**
- Semplifica il codice
- Rimuove un livello di derivazione

**Svantaggi:**
- `selectedNode` si ricalcola più spesso (potrebbe essere meno performante)
- Ma probabilmente non è un problema reale

## Soluzione 4: Usare Immer (Come suggerito dall'esperto)

L'esperto ha suggerito di usare Immer per gestire gli aggiornamenti nested. Questo richiederebbe:

1. Installare Immer: `npm install immer`
2. Modificare `useNodeUpdate.ts`:

```typescript
import { produce } from 'immer';

const updateSelectedNode = useCallback((updater, notifyProvider = true) => {
  setLocalDDT((prev) => {
    return produce(prev, (draft) => {
      const mains = getMainDataList(draft);
      const main = mains[selectedMainIndex];
      if (!main) return;

      if (selectedSubIndex == null) {
        // Main node update
        const updated = updater(main) || main;
        mains[selectedMainIndex] = updated;
      } else {
        // Sub node update
        const subList = getSubDataList(main);
        const sub = subList[selectedSubIndex];
        if (!sub) return;
        const updated = updater(sub) || sub;
        const subIdx = (main.subData || []).findIndex((s: any) => s.label === sub.label);
        main.subData[subIdx] = updated;
      }
    });
  });
}, [localDDT, selectedRoot, selectedMainIndex, selectedSubIndex, replaceSelectedDDT]);
```

**Vantaggi:**
- Gestione più sicura degli aggiornamenti nested
- Codice più leggibile
- Evita errori di shallow copy

**Svantaggi:**
- Richiede nuova dipendenza
- Cambia il pattern esistente

## Raccomandazione

**Per un fix immediato:** Soluzione 1 (aggiungere dipendenza esplicita su `testCases`)

**Per una soluzione più robusta a lungo termine:** Combinare Soluzione 1 + Soluzione 4 (Immer)

**Per una semplificazione architetturale:** Soluzione 3 (rimuovere `mainListStableKey`) + eventualmente Soluzione 4

## Domande per l'Esperto

1. Quale soluzione preferisci tra le 4 proposte?
2. La Soluzione 1 è sufficiente come fix immediato o preferisci una delle altre?
3. Dovremmo procedere con Immer (Soluzione 4) anche se richiede una nuova dipendenza?
4. Rimuovere `mainListStableKey` (Soluzione 3) è una buona idea o potrebbe causare problemi di performance?

