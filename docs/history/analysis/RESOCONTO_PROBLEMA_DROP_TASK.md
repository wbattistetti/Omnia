# Resoconto: Problema Drop Task - Task Scompaiono dopo Cambio Step

## Problema
Quando si droppa un task da un catalogo in uno step, il task appare momentaneamente ma poi scompare. Se si cambia step e si torna indietro, i task droppati non sono più visibili.

## Architettura Attuale

### Componenti Coinvolti
1. **BehaviourEditor.tsx**: Gestisce lo stato locale delle escalations e la sincronizzazione con il node
2. **StepEditor.tsx**: Gestisce il rendering e il drop dei task
3. **index.tsx (ResponseEditorInner)**: Gestisce `selectedNode` e `updateSelectedNode`

### Flusso Attuale

#### 1. Drop di un Task
```
TaskRowDnDWrapper (drop)
  → StepEditor.handleDropFromViewer
    → BehaviourEditor.handleEscalationsChange
      → setEscalations(newEscalations) [stato locale]
      → saveEscalationsToNode(selectedStepKey, newEscalations) [salva nel node]
```

#### 2. Cambio Step
```
handleStepChange(newStepKey)
  → Salva escalations correnti nel node (usando escalationsRef.current)
  → Carica escalations del nuovo step dal node
  → setSelectedStepKey(newStepKey)
```

#### 3. Sincronizzazione
```
useEffect([node?.id, node?.label, selectedStepKey])
  → Se justSavedRef indica salvataggio recente (< 100ms), ignora
  → Altrimenti carica escalations dal node usando updateSelectedNode
```

## Problema Identificato

### Sintomo
Dai log:
- Quando droppi: `tasksCount: 2` (corretto)
- Quando salvi in handleStepChange: `savingTasksCount: 2` (corretto)
- Quando torni indietro: `tasksCount: 1` (SBAGLIATO - dovrebbe essere 2)

### Cause Possibili

1. **Timing Issue**: Il `useEffect` viene triggerato prima che `updateSelectedNode` completi l'aggiornamento del node. Quando legge dal node, il salvataggio potrebbe non essere ancora persistito.

2. **Prop Node Non Aggiornato**: Il prop `node` in `BehaviourEditor` viene da `selectedNode` in `ResponseEditorInner`. Quando `updateSelectedNode` aggiorna `selectedNode`, React potrebbe non aver ancora aggiornato il prop `node` quando il `useEffect` viene triggerato.

3. **Race Condition**: Il `useEffect` che dipende da `selectedStepKey` viene triggerato quando cambi step, ma potrebbe leggere dal node prima che il salvataggio dello step precedente sia completato.

4. **Salvataggio Non Persistito**: Il salvataggio in `saveEscalationsToNode` potrebbe non funzionare correttamente. I log mostrano che salva, ma quando si legge di nuovo, i dati non ci sono.

## Soluzioni Tentate

### 1. Ref per Tracciare Escalations Correnti
```typescript
const escalationsRef = React.useRef<any[]>(escalations);
```
**Risultato**: Non risolve il problema - il ref è aggiornato ma il salvataggio non viene letto correttamente.

### 2. Operazione Atomica in handleStepChange
```typescript
updateSelectedNode((currentNode) => {
  // Salva escalations correnti
  // Carica escalations nuovo step
  return next;
});
```
**Risultato**: Non risolve - il salvataggio avviene ma quando torni indietro non vengono caricate.

### 3. Flag justSavedRef per Evitare Sovrascrittura
```typescript
const justSavedRef = React.useRef<{ stepKey: string; timestamp: number } | null>(null);
```
**Risultato**: Riduce i log ma non risolve il problema principale.

### 4. useEffect che Usa updateSelectedNode per Leggere
```typescript
useEffect(() => {
  updateSelectedNode((currentNode) => {
    // Leggi escalations
    return currentNode;
  });
}, [node?.id, node?.label, selectedStepKey]);
```
**Risultato**: Causa troppi log e non risolve il problema.

## Analisi del Codice

### saveEscalationsToNode
```typescript
const saveEscalationsToNode = (stepKey: string, escalationsToSave: any[]) => {
  updateSelectedNode((node) => {
    // Aggiorna node.steps[stepKey].escalations
    return next;
  });
};
```
**Problema**: `updateSelectedNode` aggiorna `selectedNode` ma il prop `node` potrebbe non essere ancora aggiornato quando il `useEffect` viene triggerato.

### handleStepChange
```typescript
const handleStepChange = (newStepKey: string) => {
  updateSelectedNode((currentNode) => {
    // Salva escalations correnti
    // Carica escalations nuovo step
    return next;
  });
  setSelectedStepKey(newStepKey);
};
```
**Problema**: `setSelectedStepKey` viene chiamato DOPO `updateSelectedNode`, ma il `useEffect` che dipende da `selectedStepKey` potrebbe essere triggerato prima che `updateSelectedNode` completi.

### useEffect di Sincronizzazione
```typescript
useEffect(() => {
  updateSelectedNode((currentNode) => {
    const freshEscalations = getEscalationsFromNode(currentNode, selectedStepKey);
    setEscalations(freshEscalations);
    return currentNode;
  });
}, [node?.id, node?.label, selectedStepKey]);
```
**Problema**:
- Viene triggerato quando cambia `selectedStepKey`, ma potrebbe leggere dal node prima che il salvataggio dello step precedente sia completato
- Viene triggerato anche quando cambia `node?.id` o `node?.label`, ma questi potrebbero non cambiare quando salvi le escalations

## Soluzione Proposta

### Approccio Semplificato
1. **Rimuovere completamente il `useEffect` di sincronizzazione** - è troppo complesso e causa problemi
2. **Caricare solo in `handleStepChange`** - quando cambi step, carica direttamente dal node
3. **Salvare sempre immediatamente** - quando droppi o modifichi, salva subito nel node
4. **Usare un ref per tracciare il node aggiornato** - invece di dipendere dal prop `node`

### Codice Proposto

```typescript
// Rimuovere useEffect di sincronizzazione
// Caricare solo in handleStepChange usando updateSelectedNode per leggere il node più recente
// Salvare sempre immediatamente quando cambiano le escalations
```

## Analisi Dettagliata del Problema

### Flusso Corretto Atteso
1. Drop task → `handleEscalationsChange` → salva nel node → stato locale aggiornato
2. Cambio step → `handleStepChange` → salva escalations correnti → carica nuovo step
3. Torno indietro → `handleStepChange` → carica escalations salvate → dovrebbero essere visibili

### Problema Reale
Quando torni indietro, le escalations caricate hanno `tasksCount: 1` invece di `tasksCount: 2`, anche se il salvataggio mostrava `savingTasksCount: 2`.

### Possibili Cause

#### 1. Race Condition in updateSelectedNode
`updateSelectedNode` aggiorna `selectedNode` e poi sincronizza `localDDT`. Il prop `node` in `BehaviourEditor` viene da `selectedNode`, ma quando il `useEffect` viene triggerato, potrebbe leggere ancora il valore vecchio.

#### 2. useEffect Triggerato Troppo Presto
Il `useEffect` che dipende da `selectedStepKey` viene triggerato quando cambi step, ma potrebbe leggere dal node prima che il salvataggio dello step precedente sia completato in `handleStepChange`.

#### 3. Salvataggio Non Persistito
Il salvataggio in `saveEscalationsToNode` potrebbe non funzionare correttamente. I log mostrano che salva, ma quando si legge di nuovo, i dati non ci sono. Potrebbe essere un problema di immutabilità o di riferimento.

#### 4. Formato Steps Non Gestito Correttamente
Il codice gestisce sia `node.steps` come array che come oggetto, ma potrebbe esserci un problema nella logica di salvataggio/caricamento per uno dei due formati.

## Domande per l'Esperto

1. **Perché il salvataggio non viene letto correttamente?** I log mostrano che salva con `tasksCount: 2`, ma quando si legge di nuovo si ottiene `tasksCount: 1`. Il salvataggio avviene in `updateSelectedNode`, ma quando si legge, il node non ha i dati salvati.

2. **Come gestire correttamente la sincronizzazione tra stato locale e node?** Lo stato locale è necessario per l'UI reattiva, ma deve essere sincronizzato con il node per la persistenza. Il problema è che abbiamo due fonti di verità che si sovrascrivono.

3. **È corretto usare `updateSelectedNode` per leggere il node?** Attualmente usiamo `updateSelectedNode((node) => { ... return node; })` per leggere, ma questo potrebbe causare problemi. Dovremmo avere un modo separato per leggere?

4. **Come evitare race conditions tra salvataggio e caricamento?** Il problema sembra essere che quando salvi in `handleStepChange` e poi il `useEffect` viene triggerato, legge valori vecchi. Come sincronizzare correttamente?

5. **Dovremmo usare un approccio completamente diverso?** Forse invece di stato locale + sincronizzazione, dovremmo:
   - Usare solo il node come fonte di verità (ma questo potrebbe causare problemi di performance)
   - Usare un sistema di cache/ref per tracciare le modifiche non salvate
   - Usare un sistema di transazioni per garantire atomicità

6. **Il problema è nel formato dei dati?** Il node usa `steps` come oggetto `{ start: { escalations: [...] } }`, ma quando salviamo, potremmo non salvare correttamente in questo formato.

## Codice Rilevante

### saveEscalationsToNode (righe 127-167)
Salva le escalations nel node. Gestisce sia array che oggetto. I log mostrano che salva correttamente.

### handleStepChange (righe 170-227)
Salva le escalations correnti e carica quelle del nuovo step in un'unica operazione atomica. I log mostrano che salva correttamente, ma quando torni indietro, le escalations caricate sono sbagliate.

### useEffect (righe 95-124)
Sincronizza le escalations quando cambia il node o lo step. Viene triggerato troppo spesso e potrebbe sovrascrivere le modifiche locali.

## Prossimi Passi Suggeriti

1. **Rimuovere completamente il `useEffect` di sincronizzazione** - è troppo complesso e causa problemi
2. **Caricare solo in `handleStepChange`** - quando cambi step, carica direttamente dal node usando `updateSelectedNode`
3. **Verificare che il salvataggio funzioni correttamente** - aggiungere log più dettagliati per vedere se il node viene effettivamente aggiornato
4. **Usare un ref per tracciare il node aggiornato** - invece di dipendere dal prop `node`, usare un ref che viene aggiornato quando `updateSelectedNode` completa

## File Coinvolti

- `src/components/ActEditor/ResponseEditor/BehaviourEditor.tsx` - Logica principale
- `src/components/ActEditor/ResponseEditor/StepEditor.tsx` - Gestione drop
- `src/components/ActEditor/ResponseEditor/index.tsx` - Gestione selectedNode e updateSelectedNode

## Log Rilevanti

```
[BehaviourEditor] handleEscalationsChange {stepKey: 'notConfirmed', escalationsCount: 1, tasksCount: 2}
[BehaviourEditor] handleStepChange {from: 'notConfirmed', to: 'noInput', savingEscalationsCount: 1, savingTasksCount: 2}
[BehaviourEditor] Loading escalations for new step {stepKey: 'noInput', escalationsCount: 1, tasksCount: 1}
[BehaviourEditor] handleStepChange {from: 'noInput', to: 'notConfirmed', savingEscalationsCount: 1, savingTasksCount: 1}
[BehaviourEditor] Loading escalations for new step {stepKey: 'notConfirmed', escalationsCount: 1, tasksCount: 1} // SBAGLIATO - dovrebbe essere 2
```

Il problema è chiaro: quando salvi con `savingTasksCount: 2`, ma quando torni indietro e carichi, ottieni `tasksCount: 1`. Il salvataggio non viene persistito correttamente o viene sovrascritto.

