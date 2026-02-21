# Wizard Refactoring Plan

## ✅ Completed

### 1. New Store (Zustand)
- **File**: `TaskBuilderAIWizard/store/wizardStore.ts`
- **Single source of truth** per tutto lo stato del wizard
- Elimina race conditions, multiple sources of truth, closure stale
- Selectors per valori computati

### 2. Pure Action Functions
- **File**: `TaskBuilderAIWizard/actions/wizardActions.ts`
- Funzioni pure che aggiornano lo store direttamente
- No hooks, no closures, no race conditions
- `runStructureGeneration`: Genera struttura dati
- `runParallelGeneration`: Genera constraints/parser/messages in parallelo
- `checkCompletion`: Verifica se tutto è completato

### 3. Simplified Hook
- **File**: `TaskBuilderAIWizard/hooks/useWizardNew.ts`
- Hook semplice che usa store + azioni pure
- Max 2 livelli di astrazione (vs 5+ nel vecchio sistema)
- Gestione errori consistente

## 🔄 Next Steps

### 4. Refactor Components
I componenti devono essere refactorati per usare il nuovo store:

**CenterPanel.tsx**
```typescript
// OLD
const { pipelineSteps, dataSchema } = wizardContext;

// NEW
const pipelineSteps = useWizardStore(state => state.pipelineSteps);
const dataSchema = useWizardStore(state => state.dataSchema);
```

**Sidebar.tsx**
```typescript
// OLD
const { taskTree, activeNodeId } = props;

// NEW
const taskTree = useWizardStore(state => state.dataSchema);
const activeNodeId = useWizardStore(state => state.activeNodeId);
const setActiveNodeId = useWizardStore(state => state.setActiveNodeId);
```

**PhaseCard.tsx**
- Legge direttamente da `pipelineSteps` nello store
- Nessun prop drilling

### 5. Migrate Response Editor Integration
**File**: `src/components/TaskEditor/ResponseEditor/hooks/useWizardIntegration.ts`

Sostituire:
- `useWizardState` → `useWizardStore`
- `useWizardGeneration` → `useWizardNew` + `wizardActions`
- `useWizardCompletion` → logica integrata in `useWizardNew`
- `useWizardFlow` → transizioni gestite nello store

### 6. Remove Old Code
Dopo migrazione completa, rimuovere:
- `TaskBuilderAIWizard/hooks/useWizardState.ts` (sostituito da store)
- `TaskBuilderAIWizard/hooks/useWizardGeneration.ts` (sostituito da actions)
- `TaskBuilderAIWizard/hooks/useWizardCompletion.ts` (logica integrata)
- `TaskBuilderAIWizard/hooks/useWizardFlow.ts` (transizioni nello store)
- `TaskBuilderAIWizard/hooks/useWizardSync.ts` (può essere integrato)

## 📊 Architecture Comparison

### OLD (Complex)
```
useWizardIntegration (orchestratore)
  ├─> useWizardState (stato)
  ├─> useWizardFlow (transizioni)
  ├─> useWizardCompletion (completamento)
  ├─> useWizardGeneration (generazione)
  │     └─> continueAfterStructureConfirmation
  │           └─> updatePhaseProgress (closure)
  │                 └─> checkAndCompleteRef.current() (ref)
  │                       └─> checkAndComplete (useCallback)
  └─> useWizardSync (sincronizzazione)
```

**Problemi:**
- 5+ livelli di astrazione
- Race conditions (React state asincrono)
- Closure stale (props vecchie)
- Doppia fonte di verità (pipelineSteps + contatori + dataSchema)
- Gestione errori inconsistente

### NEW (Simple)
```
useWizardNew (hook semplice)
  ├─> useWizardStore (Zustand store)
  └─> wizardActions (funzioni pure)
        ├─> runStructureGeneration
        ├─> runParallelGeneration
        └─> checkCompletion
```

**Vantaggi:**
- 2 livelli di astrazione
- Single source of truth (store)
- No race conditions (store sincrono)
- No closure stale (store sempre aggiornato)
- Gestione errori consistente

## 🧪 Testing Checklist

Prima di completare la migrazione, testare tutte le 40+ funzionalità:

### Generazione
- [ ] Generazione struttura dati gerarchica
- [ ] Generazione constraints parallela
- [ ] Generazione parser parallela (con plan engines)
- [ ] Generazione messages parallela (8 step types)
- [ ] Progress bar real-time (0-100% per fase)

### UI/UX
- [ ] Sidebar con albero espandibile
- [ ] Icone dinamiche per tipo dato
- [ ] Conferma/rifiuto struttura
- [ ] Modalità correzione struttura
- [ ] Euristica moduli esistenti
- [ ] Preview moduli
- [ ] Anteprima dialoghi (3 scenari)

### Integrazioni
- [ ] Creazione template + istanza (2 volte)
- [ ] `buildTaskTree` + `onTaskBuilderComplete` (2 volte)
- [ ] Generazione contracts
- [ ] Generazione engines/parsers
- [ ] Sincronizzazione variabili
- [ ] Chiusura automatica wizard quando `COMPLETED`

### Validazioni
- [ ] `id === templateId` per ogni nodo
- [ ] ID univoci
- [ ] Tutti i nodi hanno messages
- [ ] Tutti i nodi hanno constraints
- [ ] Tutti i nodi hanno parser
- [ ] Tutti i task hanno completato tutte le fasi

## 🚀 Migration Strategy

### Option A: Parallel Implementation (Recommended)
1. Mantenere vecchio sistema funzionante
2. Implementare nuovo sistema in parallelo
3. Testare nuovo sistema con feature flag
4. Migrare gradualmente componenti
5. Rimuovere vecchio sistema quando tutto funziona

### Option B: Direct Replacement
1. Refactorare tutti i componenti in una volta
2. Testare tutto insieme
3. Rischi: regressioni, debugging difficile

## 📝 Notes

- Il nuovo store è già creato e funzionante
- Le azioni pure sono già implementate
- Il hook semplificato è già pronto
- **NEXT**: Refactorare componenti per usare il nuovo store
- **THEN**: Migrare integrazione Response Editor
- **FINALLY**: Rimuovere vecchio codice

## 🔍 Key Improvements

1. **No Race Conditions**: Store è sincrono, no React state asincrono
2. **No Closure Stale**: Store sempre aggiornato, no props vecchie
3. **Single Source of Truth**: Solo store, no multiple sources
4. **Simpler Architecture**: 2 livelli vs 5+ livelli
5. **Consistent Error Handling**: Contatori solo su success, no increment su error
6. **Deterministic Completion**: Check completion solo quando contatori completi
