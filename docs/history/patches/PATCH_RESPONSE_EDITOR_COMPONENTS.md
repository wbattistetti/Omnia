# Patch per Componenti React - ResponseEditor

## File: `src/components/TaskEditor/ResponseEditor/index.tsx`

### Patch 1: Helper function `getStepsForNode` (già aggiunta)
✅ Completata - Helper function aggiunta alle linee 1112-1135

### Patch 2: Sostituire `task.steps[nodeTemplateId]` nella selezione nodo (linee 1205-1220)

**Sostituisci:**
```typescript
        }); nodeTemplateId && task?.steps?.[nodeTemplateId] ? (() => {
            const nodeSteps = task.steps[nodeTemplateId];
            const isArray = Array.isArray(nodeSteps);
            const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
            let escalationsCount = 0;
            let tasksCount = 0;

            if (isArray) {
              escalationsCount = nodeSteps.length;
              tasksCount = nodeSteps.reduce((acc: number, step: any) =>
                acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0);
            } else if (isObject) {
              escalationsCount = nodeSteps?.start?.escalations?.length || nodeSteps?.introduction?.escalations?.length || 0;
              const startEscs = nodeSteps?.start?.escalations || [];
              const introEscs = nodeSteps?.introduction?.escalations || [];
```

**Con:**
```typescript
        });

        // ✅ NUOVO: Usa helper function per ottenere steps per questo nodo
        const nodeStepsArray = getStepsForNode(task?.steps, nodeTemplateId);
        if (nodeStepsArray.length > 0) {
          const nodeSteps = nodeStepsArray;
          const isArray = true; // ✅ Sempre array nel nuovo modello
          const isObject = false;
          let escalationsCount = 0;
          let tasksCount = 0;

          escalationsCount = nodeSteps.length;
          tasksCount = nodeSteps.reduce((acc: number, step: MaterializedStep) =>
            acc + (step?.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0), 0);
```

### Patch 3: Sostituire `Object.keys(task.steps)` nel log di chiusura (linee 864-875)

**Sostituisci:**
```typescript
          taskStepsKeys: task?.steps ? Object.keys(task.steps) : [],
          taskStepsCount: task?.steps ? Object.keys(task.steps).length : 0,
          taskStepsDetails: task?.steps ? Object.keys(task.steps).map(nodeId => {
            const nodeSteps = task.steps[nodeId];
            const isArray = Array.isArray(nodeSteps);
            const isObject = typeof nodeSteps === 'object' && !Array.isArray(nodeSteps);
            let escalationsCount = 0;
            let tasksCount = 0;

            if (isArray) {
              escalationsCount = nodeSteps.length;
```

**Con:**
```typescript
          taskStepsCount: Array.isArray(task?.steps) ? task.steps.length : 0,
          taskStepsIsArray: Array.isArray(task?.steps),
          taskStepsDetails: Array.isArray(task?.steps) ? task.steps.map((step: MaterializedStep) => {
            const nodeSteps = [step]; // ✅ Ogni step è un MaterializedStep
            const isArray = true; // ✅ Sempre array nel nuovo modello
            const isObject = false;
            let escalationsCount = 0;
            let tasksCount = 0;

            escalationsCount = step.escalations?.length || 0;
            tasksCount = step.escalations?.reduce((a: number, esc: any) => a + (esc?.tasks?.length || 0), 0) || 0;
```

### Patch 4: Sostituire `task.steps[nodeTemplateId]` nel salvataggio sub-node (linee 1423-1430)

**Sostituisci:**
```typescript
          // ✅ CRITICAL: Salva updated.steps usando templateId come chiave (non id)
          // task.steps[node.templateId] = steps clonati
          const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
          if (nodeTemplateId && updated.steps && task) {
            // Aggiorna task.steps immediatamente (unica fonte di verità)
            if (!task.steps) task.steps = {};
            task.steps[nodeTemplateId] = updated.steps;
          }
```

**Con:**
```typescript
          // ✅ CRITICAL: Salva updated.steps come array MaterializedStep[]
          // ✅ NUOVO: steps è un array, non un dictionary
          const nodeTemplateId = updated.templateId || updated.id; // ✅ Fallback a id se templateId non presente
          if (nodeTemplateId && updated.steps && task) {
            // ✅ Inizializza task.steps come array se non esiste
            if (!Array.isArray(task.steps)) {
              task.steps = [];
            }

            // ✅ Converti updated.steps in MaterializedStep[] se necessario
            const materializedSteps: MaterializedStep[] = Array.isArray(updated.steps)
              ? updated.steps
              : [];

            // ✅ Rimuovi steps esistenti per questo nodo e aggiungi i nuovi
            const otherSteps = (task.steps as MaterializedStep[]).filter((step: MaterializedStep) =>
              !step.templateStepId || !step.templateStepId.startsWith(nodeTemplateId)
            );

            task.steps = [...otherSteps, ...materializedSteps];
          }
```

---

## File: `src/components/TaskEditor/ResponseEditor/useTaskCommands.ts`

### Patch 5: Gestione mista array/dictionary (linee 85-95, 120-127, 163-170, 212-219, 299-309, 389-399)

**Pattern da sostituire:**
```typescript
        if (Array.isArray(next.steps)) {
          next.steps = [...next.steps];
          // ...
        } else {
          next.steps = { ...(next.steps || {}) };
          // ...
        }
```

**Con:**
```typescript
        // ✅ Sempre array MaterializedStep[]
        if (!Array.isArray(next.steps)) {
          next.steps = [];  // ✅ Inizializza come array vuoto se non è array
        }
        next.steps = [...next.steps];  // ✅ Sempre array
```

**Applica questo pattern a tutte le occorrenze nelle funzioni:**
- `editTask` (linee 85-95)
- `addTask` (linee 120-127)
- `deleteTask` (linee 163-170)
- `moveTask` (linee 212-219)
- `addEscalation` (linee 299-309)
- `deleteEscalation` (linee 389-399)

---

## File: `src/components/TaskEditor/ResponseEditor/ddtSelectors.ts`

### Patch 6: `getNodeSteps` - gestione array (linee 60-66)

**Sostituisci:**
```typescript
  // Variante B: steps come oggetto: { start: {...}, success: {...} }
  if (node.steps && typeof node.steps === 'object' && !Array.isArray(node.steps)) {
    for (const key of Object.keys(node.steps)) {
      const val = node.steps[key];
      if (val != null) present.add(key);
    }
  }
```

**Con:**
```typescript
  // ✅ Variante B: steps come array MaterializedStep[]
  if (node.steps && Array.isArray(node.steps)) {
    for (const step of node.steps) {
      if (step && step.escalations && step.escalations.length > 0) {
        // ✅ Aggiungi tipo step se presente (da templateStepId o altro)
        if (step.templateStepId) {
          const stepType = step.templateStepId.split(':').pop() || 'unknown';
          present.add(stepType);
        }
      }
    }
  }
```

---

## File: `src/components/TaskEditor/ResponseEditor/useSelectedNode.ts`

### Patch 7: `Object.keys(node.steps)` (linee 29-35, 46-53)

**Sostituisci:**
```typescript
    // Set the first step as selected, if available
    if (node && node.steps) {
      const stepKeys = Object.keys(node.steps);
      if (stepKeys.length > 0) {
        dispatch({ type: 'SET_STEP', step: stepKeys[0] });
      } else {
        dispatch({ type: 'SET_STEP', step: '' });
      }
    } else {
      dispatch({ type: 'SET_STEP', step: '' });
    }
```

**Con:**
```typescript
    // Set the first step as selected, if available
    if (node && node.steps && Array.isArray(node.steps) && node.steps.length > 0) {
      // ✅ Estrai tipo step da templateStepId (formato: `${nodeTemplateId}:${stepKey}`)
      const firstStep = node.steps[0];
      const stepType = firstStep.templateStepId?.split(':').pop() || 'start';
      dispatch({ type: 'SET_STEP', step: stepType });
    } else {
      dispatch({ type: 'SET_STEP', step: '' });
    }
```

**E anche:**
```typescript
  useEffect(() => {
    const node = getNodeByIndex(ddt, selectedNodeIndex, null);
    if (node && node.steps && Array.isArray(node.steps)) {
      node.steps.forEach((step: MaterializedStep) => {
        if (step?.escalations) {
          // ✅ Processa escalations
        }
      });
    }
  }, [selectedNodeIndex, ddt]);
```

---

## File: `src/components/TaskEditor/ResponseEditor/hooks/useWizardInference.ts`

### Patch 8: `task.steps[firstMainTemplateId]` (linee 113-125)

**Sostituisci:**
```typescript
      // ✅ CRITICAL: Leggi da task.steps usando templateId come chiave (non id)
      // task.steps[node.templateId] = steps clonati
      if (!empty && currentTaskTree?.nodes && currentTaskTree.nodes.length > 0) {
        const firstMain = currentTaskTree.nodes[0];
        const firstMainId = firstMain?.id;
        const firstMainTemplateId = firstMain?.templateId || firstMain?.id; // ✅ Fallback a id se templateId non presente
        const hasSteps = !!(firstMainTemplateId && task?.steps && task.steps[firstMainTemplateId]);

        const allTaskStepsKeys = task?.steps ? Object.keys(task.steps) : [];
        // ✅ CRITICAL: Stampa chiavi come stringhe per debug
        console.log('[🔍 useWizardInference] 🔑 CHIAVI IN task.steps:', allTaskStepsKeys);
        console.log('[🔍 useWizardInference] 🔍 CERCHIAMO CHIAVE:', firstMainTemplateId);
```

**Con:**
```typescript
      // ✅ CRITICAL: Leggi da task.steps usando helper function (array MaterializedStep[])
      if (!empty && currentTaskTree?.nodes && currentTaskTree.nodes.length > 0) {
        const firstMain = currentTaskTree.nodes[0];
        const firstMainId = firstMain?.id;
        const firstMainTemplateId = firstMain?.templateId || firstMain?.id; // ✅ Fallback a id se templateId non presente

        // ✅ Helper function per ottenere steps per questo nodo
        const getStepsForNode = (steps: MaterializedStep[] | Record<string, any> | undefined, nodeTemplateId: string): MaterializedStep[] => {
          if (!steps) return [];
          if (Array.isArray(steps)) {
            return steps.filter((step: MaterializedStep) =>
              step.templateStepId && step.templateStepId.startsWith(nodeTemplateId)
            );
          }
          if (typeof steps === 'object' && steps[nodeTemplateId]) {
            const nodeSteps = steps[nodeTemplateId];
            return Array.isArray(nodeSteps) ? nodeSteps : [];
          }
          return [];
        };

        const nodeStepsArray = getStepsForNode(task?.steps, firstMainTemplateId);
        const hasSteps = nodeStepsArray.length > 0;

        const taskStepsCount = Array.isArray(task?.steps) ? task.steps.length : 0;
        console.log('[🔍 useWizardInference] 🔍 Steps for node', {
          firstMainTemplateId,
          hasSteps,
          taskStepsCount,
          nodeStepsCount: nodeStepsArray.length
        });
```

---

## Note Finali

1. **Import necessario:** Aggiungi `import type { MaterializedStep } from '../../../types/taskTypes';` e `import { v4 as uuidv4 } from 'uuid';` dove necessario
2. **Helper function:** La funzione `getStepsForNode` è già stata aggiunta in `index.tsx` - può essere esportata e riutilizzata in altri file
3. **Retrocompatibilità:** Tutte le patch includono gestione retrocompatibilità per dictionary legacy
4. **Verifica:** Dopo ogni patch, verificare che:
   - `steps` sia sempre `MaterializedStep[]` o gestito come array
   - Nessun `templateId` negli step (solo a livello di istanza)
   - `templateStepId` presente solo per step derivati
   - Step aggiunti senza `templateStepId`
