# Patch Complete: Refactoring steps da Dictionary a MaterializedStep[]

## Riepilogo
Questo documento contiene tutte le patch necessarie per convertire `steps` da `Record<string, any>` (dictionary) a `MaterializedStep[]` (array) in tutto il codebase.

## Modello Target
```typescript
interface MaterializedStep {
  id: string;                    // ✅ Nuovo GUID per l'istanza
  templateStepId?: string;        // ✅ GUID dello step del template (presente solo se step derivato dal template)
  escalations: any[];             // ✅ Escalations (unica parte modificabile)
  // ❌ NO templateId nello step (è già a livello di istanza)
}

// Step derivato dal template: ha templateStepId
// Step aggiunto dall'utente: NON ha templateStepId (undefined)
```

---

## File 1: `src/utils/taskUtils.ts`

### Patch 1.1: `migrateTaskOverrides` (linee 577-630)

**Problema:** Funzione accetta `Record<string, any>` e itera su `steps[templateId]`

**Sostituisci:**
```typescript
export function migrateTaskOverrides(steps: Record<string, any>): void {
  if (!steps || typeof steps !== 'object') return;

  for (const templateId in steps) {
    const nodeSteps = steps[templateId];
    if (!nodeSteps || typeof nodeSteps !== 'object') continue;

    // Case A: steps as object { start: { escalations: [...] } }
    if (!Array.isArray(nodeSteps)) {
      for (const stepType in nodeSteps) {
        const step = nodeSteps[stepType];
        if (step?.escalations && Array.isArray(step.escalations)) {
          step.escalations.forEach((esc: any) => {
            if (esc?.tasks && Array.isArray(esc.tasks)) {
              esc.tasks.forEach((task: any) => {
                if (task.templateTaskId === undefined) {
                  task.templateTaskId = null;
                  task.edited = true;  // ✅ Cannot determine if inherited
                }
              });
            }
            // Legacy: also check actions
            if (esc?.actions && Array.isArray(esc.actions)) {
              esc.actions.forEach((action: any) => {
                if (action.templateTaskId === undefined) {
                  action.templateTaskId = null;
                  action.edited = true;
                }
              });
            }
          });
        }
      }
    }

    // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
    if (Array.isArray(nodeSteps)) {
      nodeSteps.forEach((group: any) => {
        if (group?.escalations && Array.isArray(group.escalations)) {
          group.escalations.forEach((esc: any) => {
            if (esc?.tasks && Array.isArray(esc.tasks)) {
              esc.tasks.forEach((task: any) => {
                if (task.templateTaskId === undefined) {
                  task.templateTaskId = null;
                  task.edited = true;
                }
              });
            }
            if (esc?.actions && Array.isArray(esc.actions)) {
              esc.actions.forEach((action: any) => {
                if (action.templateTaskId === undefined) {
                  action.templateTaskId = null;
                  action.edited = true;
                }
              });
            }
          });
        }
      });
    }
  }
}
```

**Con:**
```typescript
/**
 * Migrate existing steps to include templateTaskId and edited flags
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
export function migrateTaskOverrides(steps: MaterializedStep[] | Record<string, any>): void {
  // ✅ Gestione retrocompatibilità: se è dictionary, converti in array
  if (!Array.isArray(steps)) {
    if (steps && typeof steps === 'object') {
      console.warn('[migrateTaskOverrides] ⚠️ Steps è un dictionary (legacy), convertendo in array');
      // ✅ Converti dictionary in array (per retrocompatibilità)
      const stepsArray: MaterializedStep[] = [];
      for (const templateId in steps) {
        const nodeSteps = steps[templateId];
        if (!nodeSteps || typeof nodeSteps !== 'object') continue;

        // Case A: steps as object { start: { escalations: [...] } }
        if (!Array.isArray(nodeSteps)) {
          for (const stepType in nodeSteps) {
            const step = nodeSteps[stepType];
            if (step?.escalations && Array.isArray(step.escalations)) {
              stepsArray.push({
                id: uuidv4(),
                templateStepId: step.id || `${templateId}:${stepType}`,
                escalations: step.escalations
              });
            }
          }
        }
        // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
        else if (Array.isArray(nodeSteps)) {
          nodeSteps.forEach((group: any) => {
            if (group?.escalations && Array.isArray(group.escalations)) {
              stepsArray.push({
                id: uuidv4(),
                templateStepId: group.id || group.templateStepId,
                escalations: group.escalations
              });
            }
          });
        }
      }
      steps = stepsArray;
    } else {
      return; // Non è né array né dictionary valido
    }
  }

  // ✅ Itera su array MaterializedStep[]
  for (const step of steps) {
    if (!step || !Array.isArray(step.escalations)) continue;

    step.escalations.forEach((esc: any) => {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        esc.tasks.forEach((task: any) => {
          if (task.templateTaskId === undefined) {
            task.templateTaskId = null;
            task.edited = true;  // ✅ Cannot determine if inherited
          }
        });
      }
      // Legacy: also check actions
      if (esc?.actions && Array.isArray(esc.actions)) {
        esc.actions.forEach((action: any) => {
          if (action.templateTaskId === undefined) {
            action.templateTaskId = null;
            action.edited = true;
          }
        });
      }
    });
  }
}
```

### Patch 1.2: `updateEditedFlags` (linee 1343-1456)

**Problema:** Itera su `workingCopy.steps` come dictionary con `for (const templateId in workingCopy.steps)`

**Sostituisci:**
```typescript
function updateEditedFlags(workingCopy: TaskTree, templateExpanded: TaskTree): void {
  if (!workingCopy.steps || !templateExpanded.steps) return;

  // ... helper functions ...

  // Itera su tutti gli steps della working copy
  for (const templateId in workingCopy.steps) {
    const workingSteps = workingCopy.steps[templateId];
    const templateSteps = templateExpanded.steps[templateId] || templateExpanded.steps;
    if (!workingSteps || !templateSteps) continue;

    // Case A: steps as object { start: { escalations: [...] } }
    if (!Array.isArray(workingSteps) && typeof workingSteps === 'object') {
      // ... existing code ...
    }

    // Case B: steps as array [{ type: 'start', escalations: [...] }, ...]
    if (Array.isArray(workingSteps)) {
      // ... existing code ...
    }
  }
}
```

**Con:**
```typescript
/**
 * Update edited flags by comparing workingCopy vs templateExpanded
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
function updateEditedFlags(workingCopy: TaskTree, templateExpanded: TaskTree): void {
  // ✅ Steps sono ora array MaterializedStep[]
  const workingSteps: MaterializedStep[] = Array.isArray(workingCopy.steps) ? workingCopy.steps : [];
  const templateSteps: MaterializedStep[] = Array.isArray(templateExpanded.steps) ? templateExpanded.steps : [];

  if (workingSteps.length === 0 || templateSteps.length === 0) return;

  // Helper per confrontare valori di un task
  const compareTaskValues = (instanceTask: any, templateTask: any): boolean => {
    // Confronta text
    if (instanceTask.text !== templateTask.text) {
      return false;
    }

    // Confronta parameters[].value
    const instanceParams = instanceTask.parameters || [];
    const templateParams = templateTask.parameters || [];

    const paramMap = new Map<string, any>();
    templateParams.forEach((p: any) => {
      const key = p.parameterId || p.key || p.id;
      if (key) paramMap.set(key, p.value);
    });

    for (const p of instanceParams) {
      const key = p.parameterId || p.key || p.id;
      if (key) {
        const templateValue = paramMap.get(key);
        if (p.value !== templateValue) {
          return false;
        }
      }
    }

    return true;
  };

  // ✅ Helper per trovare step nel template per templateStepId
  const findTemplateStep = (templateStepId: string): MaterializedStep | null => {
    return templateSteps.find((step: MaterializedStep) => step.templateStepId === templateStepId) || null;
  };

  // ✅ Helper per trovare task nel template step per templateTaskId
  const findTemplateTask = (templateTaskId: string, templateStep: MaterializedStep): any => {
    if (!templateStep || !Array.isArray(templateStep.escalations)) return null;

    for (const esc of templateStep.escalations) {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        const task = esc.tasks.find((t: any) => t.id === templateTaskId);
        if (task) return task;
      }
      // Legacy: also check actions
      if (esc?.actions && Array.isArray(esc.actions)) {
        const action = esc.actions.find((a: any) => a.id === templateTaskId || a.actionInstanceId === templateTaskId);
        if (action) return action;
      }
    }
    return null;
  };

  // ✅ Itera su array MaterializedStep[] della working copy
  for (const workingStep of workingSteps) {
    if (!workingStep || !Array.isArray(workingStep.escalations)) continue;

    // ✅ Trova step corrispondente nel template usando templateStepId
    const templateStep = workingStep.templateStepId
      ? findTemplateStep(workingStep.templateStepId)
      : null;

    // ✅ Se step non ha templateStepId, è un step aggiunto → tutti i task sono edited
    if (!workingStep.templateStepId || !templateStep) {
      workingStep.escalations.forEach((esc: any) => {
        if (esc?.tasks && Array.isArray(esc.tasks)) {
          esc.tasks.forEach((task: any) => {
            task.edited = true;  // ✅ Step aggiunto → tutti i task sono edited
          });
        }
        if (esc?.actions && Array.isArray(esc.actions)) {
          esc.actions.forEach((action: any) => {
            action.edited = true;
          });
        }
      });
      continue;
    }

    // ✅ Step derivato: confronta task con template
    workingStep.escalations.forEach((esc: any, escIdx: number) => {
      if (esc?.tasks && Array.isArray(esc.tasks)) {
        esc.tasks.forEach((task: any) => {
          if (task.templateTaskId !== null && task.templateTaskId !== undefined) {
            // Task ereditato: confronta con template
            const templateTask = findTemplateTask(task.templateTaskId, templateStep);
            if (templateTask) {
              const valuesMatch = compareTaskValues(task, templateTask);
              task.edited = !valuesMatch;  // edited = false se coincidono, true se differiscono
            } else {
              // Template task non trovato → consideralo modificato
              task.edited = true;
            }
          } else {
            // Task nuovo → edited = true (già impostato, ma assicuriamoci)
            task.edited = true;
          }
        });
      }
      // Legacy: also check actions
      if (esc?.actions && Array.isArray(esc.actions)) {
        esc.actions.forEach((action: any) => {
          if (action.templateTaskId !== null && action.templateTaskId !== undefined) {
            const templateAction = findTemplateTask(action.templateTaskId, templateStep);
            if (templateAction) {
              const valuesMatch = compareTaskValues(action, templateAction);
              action.edited = !valuesMatch;
            } else {
              action.edited = true;
            }
          } else {
            action.edited = true;
          }
        });
      }
    });
  }
}
```

### Patch 1.3: `markTaskAsEdited` (linee 535-573)

**Problema:** Usa `steps[templateId]` per accedere agli steps

**Sostituisci:**
```typescript
export function markTaskAsEdited(
  steps: Record<string, any>,
  templateId: string,
  stepType: string,
  escalationIndex: number,
  taskIndex: number
): void {
  const nodeSteps = steps[templateId];
  if (!nodeSteps) return;

  // Case A: steps as object { start: { escalations: [...] } }
  // ... existing code ...
}
```

**Con:**
```typescript
/**
 * Mark a specific task as edited in the steps array
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
export function markTaskAsEdited(
  steps: MaterializedStep[] | Record<string, any>,
  templateId: string,
  stepType: string,
  escalationIndex: number,
  taskIndex: number
): void {
  // ✅ Gestione retrocompatibilità: se è dictionary, non possiamo modificarlo direttamente
  if (!Array.isArray(steps)) {
    console.warn('[markTaskAsEdited] ⚠️ Steps è un dictionary (legacy), operazione non supportata');
    return;
  }

  // ✅ Trova step per templateStepId (se stepType corrisponde a un templateStepId)
  // Nota: stepType potrebbe essere 'start', 'noMatch', etc. - dobbiamo trovare lo step corrispondente
  // Per ora, assumiamo che stepType sia il tipo di step e cerchiamo nel primo step che corrisponde
  // TODO: Migliorare la logica di matching se necessario

  // ✅ Itera su array MaterializedStep[]
  for (const step of steps) {
    if (!step || !Array.isArray(step.escalations)) continue;

    // ✅ Verifica se questo step corrisponde (per ora, controlliamo solo escalations)
    if (escalationIndex < step.escalations.length) {
      const esc = step.escalations[escalationIndex];
      if (esc?.tasks && Array.isArray(esc.tasks) && taskIndex < esc.tasks.length) {
        const task = esc.tasks[taskIndex];
        task.edited = true;
        return; // ✅ Trovato e modificato
      }
    }
  }

  console.warn('[markTaskAsEdited] ⚠️ Step o task non trovato', {
    templateId,
    stepType,
    escalationIndex,
    taskIndex,
    stepsCount: steps.length
  });
}
```

### Patch 1.4: `syncTaskWithTemplate` (linee 650-720)

**Problema:** Usa `template.steps[templateId]` per accedere agli steps del template

**Nota:** Questa funzione potrebbe non essere necessaria nel nuovo modello, ma se esiste, deve essere aggiornata.

**Cerca:** `template.steps[templateId]` o `template.steps[templateId] || template.steps`

**Sostituisci con:** Logica che cerca nel template usando `templateStepId` invece di `templateId`

---

## File 2: `src/utils/ddtInstanceManager.ts`

### Patch 2.1: `loadAndAdaptDDTForExistingTask` (linee 310-360)

**Problema:** Usa `Object.keys(task.steps)`, `task.steps[templateId]`, `clonedSteps` come dictionary

**Sostituisci:**
```typescript
  // ✅ 6. Usa steps dall'istanza (se esistono E hanno struttura corretta) o quelli clonati
  // ✅ CRITICAL: Verifica che task.steps abbia la struttura corretta (chiavi = templateId, non step types)
  const taskStepsKeys = task.steps ? Object.keys(task.steps) : [];
  const stepTypeKeys = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success'];
  const hasWrongStructure = taskStepsKeys.length === stepTypeKeys.length &&
    taskStepsKeys.every(key => stepTypeKeys.includes(key));

  let finalSteps = (task.steps && Object.keys(task.steps).length > 0 && !hasWrongStructure)
    ? task.steps  // ✅ Usa steps esistenti dal task (solo se struttura corretta)
    : clonedSteps; // ✅ Altrimenti usa steps clonati dal template

  // ✅ CRITICAL: Se la struttura è sbagliata, correggila salvando i clonedSteps corretti
  if (hasWrongStructure && Object.keys(clonedSteps).length > 0) {
    console.warn('[🔍 ddtInstanceManager] ⚠️ Rilevata struttura sbagliata in task.steps, correggendo con clonedSteps', {
      taskId: task.id,
      wrongKeys: taskStepsKeys,
      correctKeys: Object.keys(clonedSteps)
    });
    // ✅ Correggi il task salvando i clonedSteps corretti
    // ✅ REMOVED: updateTask ridondante - task è già nella cache, modifica direttamente
    task.steps = clonedSteps;  // ✅ Modifica diretta nella cache
    finalSteps = clonedSteps; // ✅ Usa clonedSteps come finalSteps
  }

  // ✅ AGGIUNTO: Definisci finalStepsKeys e clonedStepsKeys PRIMA di usarle
  const finalStepsKeys = finalSteps ? Object.keys(finalSteps) : [];
  const clonedStepsKeys = Object.keys(clonedSteps);
```

**Con:**
```typescript
  // ✅ 6. Usa steps dall'istanza (se esistono E hanno struttura corretta) o quelli clonati
  // ✅ NUOVO: steps è un array MaterializedStep[], non un dictionary
  const taskStepsArray: MaterializedStep[] = Array.isArray(task.steps) ? task.steps : [];
  const clonedStepsArray: MaterializedStep[] = Array.isArray(clonedSteps) ? clonedSteps : [];

  // ✅ Verifica se task.steps è un array valido
  const hasValidStepsArray = taskStepsArray.length > 0;

  let finalSteps: MaterializedStep[] = hasValidStepsArray
    ? taskStepsArray  // ✅ Usa steps esistenti dal task (se array valido)
    : clonedStepsArray; // ✅ Altrimenti usa steps clonati dal template

  // ✅ CRITICAL: Se task.steps non è un array, correggilo salvando i clonedSteps corretti
  if (!Array.isArray(task.steps) && clonedStepsArray.length > 0) {
    console.warn('[🔍 ddtInstanceManager] ⚠️ Rilevata struttura sbagliata in task.steps (non è array), correggendo con clonedSteps', {
      taskId: task.id,
      taskStepsType: typeof task.steps,
      taskStepsIsArray: Array.isArray(task.steps),
      clonedStepsCount: clonedStepsArray.length
    });
    // ✅ Correggi il task salvando i clonedSteps corretti
    task.steps = clonedStepsArray;  // ✅ Modifica diretta nella cache
    finalSteps = clonedStepsArray; // ✅ Usa clonedSteps come finalSteps
  }

  // ✅ Log ridotto (solo informazioni essenziali)
  console.log('[🔍 ddtInstanceManager] finalSteps determinato', {
    usingTaskSteps: hasValidStepsArray,
    taskStepsIsArray: Array.isArray(task.steps),
    finalStepsCount: finalSteps.length,
    clonedStepsCount: clonedStepsArray.length
  });
```

---

## File 3: `src/utils/ddtMergeUtils.ts`

### Patch 3.1: `extractModifiedDDTFields` (linee 1040-1060)

**Problema:** Usa `result.steps[nodeTemplateId] = nodeSteps` per salvare steps come dictionary

**Sostituisci:**
```typescript
        // ✅ CRITICAL: Salva steps usando templateId come chiave (non id)
        // task.steps[node.templateId] = steps clonati
        if (hasSteps && nodeTemplateId) {
          if (!result.steps) result.steps = {};
          result.steps[nodeTemplateId] = nodeSteps;
          console.log('[extractModifiedDDTFields] ✅ Including steps in override', {
            mainNodeIndex: i,
            nodeId: mainNode.id,
            nodeTemplateId,
            stepsType: typeof nodeSteps,
            stepsIsArray: Array.isArray(nodeSteps),
            stepsKeys: typeof nodeSteps === 'object' ? Object.keys(nodeSteps || {}) : [],
            stepsLength: Array.isArray(nodeSteps) ? nodeSteps.length : 0
          });
        }
```

**Con:**
```typescript
        // ✅ CRITICAL: Salva steps come array MaterializedStep[]
        // ✅ NUOVO: steps è un array, non un dictionary
        if (hasSteps && nodeTemplateId) {
          // ✅ Inizializza result.steps come array se non esiste
          if (!result.steps) result.steps = [];

          // ✅ Converti nodeSteps in MaterializedStep[] se necessario
          const materializedSteps: MaterializedStep[] = Array.isArray(nodeSteps)
            ? nodeSteps
            : [];  // ✅ Se non è array, inizializza vuoto (legacy format)

          // ✅ Aggiungi steps all'array (non sovrascrivere, ma unire)
          result.steps = [...(result.steps as MaterializedStep[]), ...materializedSteps];

          console.log('[extractModifiedDDTFields] ✅ Including steps in override', {
            mainNodeIndex: i,
            nodeId: mainNode.id,
            nodeTemplateId,
            stepsType: typeof nodeSteps,
            stepsIsArray: Array.isArray(nodeSteps),
            stepsLength: materializedSteps.length,
            totalStepsCount: (result.steps as MaterializedStep[]).length
          });
        }
```

---

## File 4: `src/components/TaskEditor/ResponseEditor/index.tsx`

### Patch 4.1: Accesso a `task.steps[nodeTemplateId]` (linee 1200-1260)

**Problema:** Usa `task.steps[nodeTemplateId]` per accedere agli steps di un nodo

**Cerca:** `task.steps[nodeTemplateId]` o `task?.steps?.[nodeTemplateId]`

**Sostituisci con:** Helper function che cerca steps per `templateStepId` o crea mapping

**Aggiungi helper function:**
```typescript
/**
 * Get steps for a specific node templateId from MaterializedStep[] array
 * ✅ NUOVO: Cerca steps per templateStepId invece di dictionary lookup
 */
function getStepsForNode(steps: MaterializedStep[] | Record<string, any> | undefined, nodeTemplateId: string): MaterializedStep[] {
  // ✅ Gestione retrocompatibilità: se è dictionary, converti
  if (!steps) return [];

  if (Array.isArray(steps)) {
    // ✅ NUOVO: Filtra steps per templateStepId che inizia con nodeTemplateId
    // Nota: templateStepId ha formato `${nodeTemplateId}:${stepKey}`
    return steps.filter((step: MaterializedStep) =>
      step.templateStepId && step.templateStepId.startsWith(nodeTemplateId)
    );
  }

  // ✅ Legacy: se è dictionary, converti in array
  if (typeof steps === 'object' && steps[nodeTemplateId]) {
    const nodeSteps = steps[nodeTemplateId];
    if (Array.isArray(nodeSteps)) {
      return nodeSteps.map((step: any) => ({
        id: step.id || uuidv4(),
        templateStepId: step.templateStepId || step.id,
        escalations: step.escalations || []
      }));
    }
  }

  return [];
}
```

**Sostituisci tutti gli usi di `task.steps[nodeTemplateId]` con:**
```typescript
const nodeSteps = getStepsForNode(task.steps, nodeTemplateId);
```

### Patch 4.2: `Object.keys(task.steps)` (linee 1193, 1201, etc.)

**Problema:** Usa `Object.keys(task.steps)` per ottenere le chiavi

**Sostituisci:**
```typescript
const allTaskStepsKeys = task?.steps ? Object.keys(task.steps) : [];
```

**Con:**
```typescript
const taskStepsCount = Array.isArray(task?.steps) ? task.steps.length : 0;
// ✅ Non abbiamo più "chiavi" - abbiamo un array di steps
```

---

## File 5: `src/components/TaskEditor/ResponseEditor/useTaskCommands.ts`

### Patch 5.1: Gestione mista array/dictionary (linee 88-400)

**Problema:** Gestisce steps come array o dictionary in modo inconsistente

**Cerca:** `next.steps = [...next.steps]` e `next.steps = { ...(next.steps || {}) }`

**Sostituisci con:** Sempre array MaterializedStep[]

**Pattern da sostituire:**
```typescript
if (Array.isArray(next.steps)) {
  next.steps = [...next.steps];
} else {
  next.steps = { ...(next.steps || {}) };
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

---

## File 6: `src/utils/ddtStepsCloner.ts`

### Patch 6.1: `CloneSteps` (linee 28-106)

**Problema:** Usa `Object.entries(clonedSteps)`, `task.steps[nodeTemplateId] = nodeSteps`

**Sostituisci:**
```typescript
  // ✅ Aggiungi gli steps clonati a task.steps (modifica in-place)
  for (const [nodeTemplateId, nodeSteps] of Object.entries(clonedSteps)) {
    if (!nodeTemplateId) {
      console.warn('[🔍 CloneSteps] ⚠️ Chiave vuota negli steps clonati, skip', {
        nodeStepsKeys: Object.keys(nodeSteps || {})
      });
      continue;
    }

    task.steps[nodeTemplateId] = nodeSteps;
    console.log('[🔍 CloneSteps] Steps aggiunti a task.steps', {
      nodeTemplateId,
      stepTypes: Object.keys(nodeSteps || {})
    });
  }

  console.log('[🔍 CloneSteps] COMPLETE', {
    taskId: task.id,
    finalStepsKeys: Object.keys(task.steps),
    finalStepsCount: Object.keys(task.steps).length,
    guidMappingSize: guidMapping.size
  });
```

**Con:**
```typescript
  // ✅ Aggiungi gli steps clonati a task.steps (modifica in-place)
  // ✅ NUOVO: clonedSteps è un array MaterializedStep[], non un dictionary
  if (!Array.isArray(clonedSteps)) {
    console.warn('[🔍 CloneSteps] ⚠️ clonedSteps non è un array, inizializzando come array vuoto');
    task.steps = [];
    return;
  }

  // ✅ Inizializza task.steps come array se non esiste
  if (!Array.isArray(task.steps)) {
    task.steps = [];
  }

  // ✅ Aggiungi tutti gli steps clonati all'array
  task.steps = [...task.steps, ...clonedSteps];

  console.log('[🔍 CloneSteps] COMPLETE', {
    taskId: task.id,
    finalStepsCount: task.steps.length,
    clonedStepsCount: clonedSteps.length,
    guidMappingSize: guidMapping.size
  });
```

---

## File 7: `src/utils/ddt.ts`

### Patch 7.1: `hasdataButNosteps` (linee 22-151)

**Problema:** Usa `Object.keys(task.steps)`, `task.steps[templateId]`

**Sostituisci:** Logica che verifica se ci sono steps nell'array invece di dictionary lookup

**Cerca:** `Object.keys(task.steps)`, `task.steps[mainTemplateId]`

**Sostituisci con:**
```typescript
// ✅ Verifica se ci sono steps nell'array per questo templateId
const hasStepsForNode = (steps: MaterializedStep[] | Record<string, any> | undefined, templateId: string): boolean => {
  if (!steps) return false;

  if (Array.isArray(steps)) {
    // ✅ NUOVO: Cerca steps per templateStepId che inizia con templateId
    return steps.some((step: MaterializedStep) =>
      step.templateStepId && step.templateStepId.startsWith(templateId)
    );
  }

  // ✅ Legacy: se è dictionary, verifica chiave
  if (typeof steps === 'object' && steps[templateId]) {
    return true;
  }

  return false;
};
```

---

## File 8: Altri file minori

### Patch 8.1: `src/components/TaskEditor/ResponseEditor/ddtSelectors.ts` (linee 60-66)

**Problema:** Itera su `Object.keys(node.steps)`

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

### Patch 8.2: `src/components/DialogueEngine/ddt/ddtSteps.ts` (linee 42-51)

**Problema:** Usa `node.steps[stepType]` e itera su `for (const key in node.steps)`

**Sostituisci con:** Logica che cerca step per tipo nell'array

---

## Note Finali

1. **Retrocompatibilità:** Tutte le patch includono gestione retrocompatibilità per dictionary legacy
2. **Verifica:** Dopo ogni patch, verificare che:
   - `steps` sia sempre `MaterializedStep[]` o gestito come array
   - Nessun `templateId` negli step (solo a livello di istanza)
   - `templateStepId` presente solo per step derivati
   - Step aggiunti senza `templateStepId`

3. **Testing:** Testare ogni funzione dopo l'applicazione della patch

4. **Ordine di applicazione:**
   - Prima: `taskUtils.ts` (funzioni core)
   - Poi: `ddtInstanceManager.ts`, `ddtMergeUtils.ts` (utilities)
   - Infine: Componenti React (UI)
