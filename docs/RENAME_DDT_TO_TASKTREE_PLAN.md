# Piano di Ridenominazione: DDT → TaskTree

## Obiettivo
Ridenominare completamente il concetto "DDT" (DataDialogueTemplate) in "TaskTree" per allineare la terminologia con l'architettura attuale.

## Terminologia Corretta

| Vecchio (DDT) | Nuovo (TaskTree) | Note |
|---------------|------------------|------|
| `DDT` | `TaskTree` | Vista runtime costruita da Template + Instance |
| `DialogueDataTemplate` | `TaskTemplate` | Template persistito |
| `DataDialogueTemplate` | `TaskTemplate` | Template persistito |
| `ddt` (variabile) | `taskTree` | Variabile locale |
| `DDT` (tipo/interfaccia) | `TaskTree` | Tipo TypeScript |

## File da Ridenominare

### 1. File e Cartelle
- `src/components/DialogueDataTemplateBuilder/` → `src/components/TaskTreeBuilder/`
- `src/components/DialogueDataTemplateBuilder/DDTWizard/` → `src/components/TaskTreeBuilder/TaskTreeWizard/`
- `src/components/TaskEditor/ResponseEditor/DDTHostAdapter.tsx` → `src/components/TaskEditor/ResponseEditor/TaskTreeHostAdapter.tsx`
- `src/utils/ddtInstanceManager.ts` → `src/utils/taskTreeManager.ts`
- `src/utils/ddtMergeUtils.ts` → `src/utils/taskTreeMergeUtils.ts`
- `src/utils/ddtPromptAdapter.ts` → `src/utils/taskTreePromptAdapter.ts`
- `src/utils/ddtStepGenerator.ts` → `src/utils/taskTreeStepGenerator.ts`

### 2. Funzioni da Ridenominare

#### `src/utils/ddtInstanceManager.ts` → `taskTreeManager.ts`
- `loadAndAdaptDDTForExistingTask` → `loadAndAdaptTaskTreeForExistingTask`
- `buildDDTFromTemplate` → `buildTaskTreeFromTemplate`
- `mergeDDTWithInstance` → `mergeTaskTreeWithInstance`

#### `src/utils/ddtMergeUtils.ts` → `taskTreeMergeUtils.ts`
- `loadDDTFromTemplate` → `loadTaskTreeFromTemplate`
- `buildMainDataFromTemplate` → `buildMainNodesFromTemplate`
- `mergeDDTStructure` → `mergeTaskTreeStructure`

#### `src/utils/ddtPromptAdapter.ts` → `taskTreePromptAdapter.ts`
- `adaptDDTPrompts` → `adaptTaskTreePrompts`
- `extractDDTPromptsToAdapt` → `extractTaskTreePromptsToAdapt`

#### `src/utils/ddtStepGenerator.ts` → `taskTreeStepGenerator.ts`
- `generateDDTSteps` → `generateTaskTreeSteps`
- `buildDDTStepStructure` → `buildTaskTreeStepStructure`

#### `src/components/TaskEditor/ResponseEditor/DDTHostAdapter.tsx` → `TaskTreeHostAdapter.tsx`
- Componente: `DDTHostAdapter` → `TaskTreeHostAdapter`
- Props: `ddt` → `taskTree`

#### `src/components/DialogueDataTemplateBuilder/DDTWizard/DDTWizard.tsx` → `TaskTreeWizard.tsx`
- Componente: `DDTWizard` → `TaskTreeWizard`
- Props: `onDDTGenerated` → `onTaskTreeGenerated`
- State: `ddt` → `taskTree`

### 3. Variabili e Props

#### `src/components/Flowchart/rows/NodeRow/NodeRow.tsx`
- `onOpenDDT` → `onOpenTaskTree`
- `hasTaskDDT` → `hasTaskTree`
- `ddt` (variabile locale) → `taskTree`
- Commenti: "DDT" → "TaskTree"

#### `src/components/TaskEditor/ResponseEditor/index.tsx`
- `ddt` prop → `taskTree` prop
- `initialDDT` → `initialTaskTree`
- `hasDDT` → `hasTaskTree`

#### `src/components/AppContent.tsx`
- `ddt` in event detail → `taskTree`
- `onDDTOpen` → `onTaskTreeOpen`

### 4. Context e Hooks

#### `src/context/DDTManagerContext.tsx` → `TaskTreeManagerContext.tsx`
- `DDTManagerContext` → `TaskTreeManagerContext`
- `useDDTManager` → `useTaskTreeManager`
- `openDDT` → `openTaskTree`
- `closeDDT` → `closeTaskTree`

#### `src/context/DDTContext.tsx` → `TaskTreeContext.tsx`
- `DDTContext` → `TaskTreeContext`
- `useDDTContext` → `useTaskTreeContext`
- `getTranslationsForDDT` → `getTranslationsForTaskTree`

### 5. Utility Functions

#### `src/utils/taskVisuals.ts`
- `hasTaskDDT` → `hasTaskTree`

#### `src/utils/taskUtils.ts`
- Commenti: "DDT" → "TaskTree"
- `buildTaskTree` (già corretto, ma verificare commenti)

### 6. Types

#### `src/types/taskTypes.ts`
- Commenti: "DDT" → "TaskTree"
- `TaskTree` interface (già corretto)

### 7. Services

#### `src/services/DialogueTaskService.ts`
- Commenti: "DDT tasks" → "TaskTree tasks"

## Ordine di Esecuzione

### Fase 1: Fix Errore Assignment (PRIORITÀ ALTA)
1. ✅ Rimuovere `(row as any).taskId = row.id;` da NodeRow.tsx (5 occorrenze)

### Fase 2: Ridenominazione Funzioni e Variabili (SENZA RINOMINARE FILE)
1. Ridenominare funzioni in `ddtInstanceManager.ts`
2. Ridenominare funzioni in `ddtMergeUtils.ts`
3. Ridenominare funzioni in `ddtPromptAdapter.ts`
4. Ridenominare funzioni in `ddtStepGenerator.ts`
5. Ridenominare variabili e props in `NodeRow.tsx`
6. Ridenominare variabili e props in `ResponseEditor/index.tsx`
7. Ridenominare variabili in `AppContent.tsx`
8. Ridenominare utility functions in `taskVisuals.ts`

### Fase 3: Ridenominazione Context e Hooks
1. Ridenominare `DDTManagerContext` → `TaskTreeManagerContext`
2. Ridenominare `DDTContext` → `TaskTreeContext`
3. Aggiornare tutti gli import

### Fase 4: Ridenominazione File e Cartelle
1. Ridenominare cartella `DialogueDataTemplateBuilder` → `TaskTreeBuilder`
2. Ridenominare cartella `DDTWizard` → `TaskTreeWizard`
3. Ridenominare file `ddtInstanceManager.ts` → `taskTreeManager.ts`
4. Ridenominare file `ddtMergeUtils.ts` → `taskTreeMergeUtils.ts`
5. Ridenominare file `ddtPromptAdapter.ts` → `taskTreePromptAdapter.ts`
6. Ridenominare file `ddtStepGenerator.ts` → `taskTreeStepGenerator.ts`
7. Ridenominare file `DDTHostAdapter.tsx` → `TaskTreeHostAdapter.tsx`
8. Aggiornare tutti gli import

### Fase 5: Commenti e Documentazione
1. Aggiornare commenti in tutti i file
2. Aggiornare documentazione in `docs/`
3. Aggiornare commenti in `documentation/`

## Regole di Sicurezza

1. **Mantieni backward compatibility**: Se ci sono API pubbliche, aggiungi deprecation warnings
2. **Test dopo ogni fase**: Verifica che tutto compili e funzioni
3. **Commit incrementali**: Un commit per fase
4. **Non modificare logica**: Solo ridenominazione, nessun cambio di comportamento

## Checklist Pre-Commit

- [ ] Tutti i test passano
- [ ] Nessun errore TypeScript
- [ ] Nessun errore ESLint
- [ ] Tutti gli import aggiornati
- [ ] Tutte le variabili rinominate
- [ ] Tutti i commenti aggiornati
- [ ] Documentazione aggiornata
