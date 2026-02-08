# Patch Complete per Refactoring Template/Instance Model

## Stato Attuale
- ✅ Fase 1: Migrazione Factory completata (version e versionNote aggiunti)
- ✅ Fase 2: Rimozione copia template dal bootstrap completata
- ⏳ Fase 3: Refactoring cloneTemplateSteps - PARZIALE (tipo di ritorno aggiornato, ma corpo funzione ha ancora errori)
- ⏳ Fase 4-8: Da completare

## Patch da Applicare

### 1. Correggere `cloneTemplateSteps` - CASE 1 (linee 834-842)

**Sostituisci:**
```typescript
    // ✅ CASE 1: Template composito - steps organizzati per nodeId: template.steps[nodeId] = { start: {...}, ... }
    if (sourceSteps[nodeTemplateId] && typeof sourceSteps[nodeTemplateId] === 'object') {
      const templateSteps = sourceSteps[nodeTemplateId];
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateSteps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(newGuid, oldGuid));
      clonedSteps[nodeId] = cloned;
      // Log rimosso per ridurre rumore - solo log critici
      return;
    }
```

**Con:**
```typescript
    // ✅ CASE 1: Template composito - steps organizzati per nodeId: template.steps[nodeId] = { start: {...}, ... }
    if (sourceSteps[nodeTemplateId] && typeof sourceSteps[nodeTemplateId] === 'object') {
      const templateSteps = sourceSteps[nodeTemplateId];
      const stepKeys = Object.keys(templateSteps);

      for (const stepKey of stepKeys) {
        const templateStep = templateSteps[stepKey];
        if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
          // ✅ Generate new GUID for instance step
          const instanceStepId = uuidv4();
          // ✅ Use stepKey as templateStepId (or generate if needed)
          const templateStepId = templateStep.id || `${nodeTemplateId}:${stepKey}`;

          // ✅ Clone escalations with new task IDs
          const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));

          // ✅ Create MaterializedStep (DERIVATO dal template - ha sempre templateStepId)
          // ✅ NO templateId nello step (è già a livello di istanza)
          materializedSteps.push({
            id: instanceStepId,
            templateStepId: templateStepId,  // ✅ SEMPRE presente per step derivati
            escalations: clonedEscalations
            // ✅ NO templateId qui - è già a livello di istanza
          });
        }
      }
      return;
    }
```

### 2. Correggere `cloneTemplateSteps` - CASE 2 (linee 844-872)

**Sostituisci:**
```typescript
    // ✅ CASE 2: Template atomico - steps direttamente in template.steps: template.steps = { start: {...}, ... }
    // Verifica se le chiavi sono nomi di step (non GUID)
    const stepNames = ['start', 'noMatch', 'noInput', 'confirmation', 'notConfirmed', 'success', 'introduction'];
    const hasStepNameKeys = sourceStepsKeys.some(key => stepNames.includes(key));

    // ✅ Per template atomici con struttura flat, usa sempre gli steps direttamente
    // Non serve verificare nodeId === templateDataFirstId perché per template atomici
    // gli steps sono sempre per l'unico nodo del template
    if (hasStepNameKeys) {
      // ✅ Template atomico: gli steps sono direttamente in template.steps
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(sourceTemplate.steps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(newGuid, oldGuid));
      clonedSteps[nodeId] = cloned;
      // Log rimosso per ridurre rumore - solo log critici
      return;
    }

    // ❌ Steps non trovati
    console.warn('⚠️ [cloneStepsForNodeId] Steps non trovati', {
      nodeId,
      templateId: sourceTemplate.id || sourceTemplate._id,
      templateHasSteps: true,
      templateStepsKeys: sourceStepsKeys,
      templateStepsKeysExpanded: JSON.stringify(sourceStepsKeys),
      lookingFor: nodeId,
      templateDataFirstId: templateDataFirstId,
      nodeIdMatchesDataFirstId: nodeId === templateDataFirstId,
      hasStepNameKeys: hasStepNameKeys
    });
```

**Con:**
```typescript
    // ✅ CASE 2: Template atomico - steps direttamente in template.steps: template.steps = { start: {...}, ... }
    const sourceStepsKeys = Object.keys(sourceSteps);
    const hasStepNameKeys = sourceStepsKeys.some(key => stepNames.includes(key));

    if (hasStepNameKeys) {
      // ✅ Template atomico: gli steps sono direttamente in template.steps
      for (const stepKey of sourceStepsKeys) {
        if (stepNames.includes(stepKey)) {
          const templateStep = sourceSteps[stepKey];
          if (templateStep && typeof templateStep === 'object' && Array.isArray(templateStep.escalations)) {
            // ✅ Generate new GUID for instance step
            const instanceStepId = uuidv4();
            // ✅ Use stepKey as templateStepId (or generate if needed)
            const templateStepId = templateStep.id || `${nodeTemplateId}:${stepKey}`;

            // ✅ Clone escalations with new task IDs
            const clonedEscalations = templateStep.escalations.map((esc: any) => cloneEscalationWithNewTaskIds(esc, allGuidMappings));

            // ✅ Create MaterializedStep (DERIVATO dal template - ha sempre templateStepId)
            // ✅ NO templateId nello step (è già a livello di istanza)
            materializedSteps.push({
              id: instanceStepId,
              templateStepId: templateStepId,  // ✅ SEMPRE presente per step derivati
              escalations: clonedEscalations
              // ✅ NO templateId qui - è già a livello di istanza
            });
          }
        }
      }
      return;
    }

    // ❌ Steps non trovati
    console.warn('⚠️ [materializeStepsFromTemplate] Steps non trovati', {
      nodeTemplateId,
      templateId: sourceTemplate.id || sourceTemplate._id,
      templateHasSteps: true,
      templateStepsKeys: sourceStepsKeys
    });
```

### 3. Aggiornare `migrateTaskOverrides` per gestire array (linee 577-607+)

**ATTENZIONE:** Questa funzione attualmente gestisce `Record<string, any>`. Deve essere aggiornata per gestire `MaterializedStep[]`.

**Nuova implementazione:**
```typescript
/**
 * Migrate existing steps to include templateTaskId and edited flags
 * ✅ NUOVO: Gestisce array MaterializedStep[] invece di dictionary
 */
export function migrateTaskOverrides(steps: MaterializedStep[] | Record<string, any>): void {
  // ✅ Gestione retrocompatibilità: se è dictionary, converti in array
  if (!Array.isArray(steps)) {
    console.warn('[migrateTaskOverrides] ⚠️ Steps è un dictionary (legacy), convertendo in array');
    // TODO: Convertire dictionary in array se necessario
    return;
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

### 4. Aggiornare `updateEditedFlags` per gestire array (linee 1336-1456)

**ATTENZIONE:** Questa funzione attualmente itera su `workingCopy.steps` come dictionary. Deve essere aggiornata per gestire array.

**Nuova implementazione:**
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

## File da Aggiornare

1. ✅ `src/utils/taskUtils.ts` - cloneTemplateSteps, buildTemplateExpanded, buildTaskTree, extractTaskOverrides, migrateTaskOverrides, updateEditedFlags
2. ✅ `src/types/taskTypes.ts` - TaskTree interface (già aggiornato)
3. ⏳ `src/utils/ddtInstanceManager.ts` - loadAndAdaptDDTForExistingTask
4. ⏳ `src/utils/ddtMergeUtils.ts` - extractModifiedDDTFields
5. ⏳ Altri file che usano steps come dictionary

## ⚠️ CRITICO: Patch mancante per materializeStepsFromTemplate

La funzione helper `materializeStepsFromTemplate` in `cloneTemplateSteps` ha ancora codice legacy con variabili non definite (`clonedSteps`, `nodeId`, `sourceStepsKeys`, `templateDataFirstId`).

**Vedi:** `PATCH_ALL_STEPS_DICTIONARY_REFACTORING.md` per la patch completa di `cloneTemplateSteps`.

## Note Importanti

- **labelKey**: Usato invece di `label` per translation keys
- **templateId rimosso dagli step**: Solo `id`, `templateStepId`, `escalations` in MaterializedStep
- **Semantica step derivato vs aggiunto**:
  - Step derivato: ha `templateStepId` (sempre presente quando clonato)
  - Step aggiunto: NON ha `templateStepId` (undefined - quando utente aggiunge manualmente)
- **steps come array**: `MaterializedStep[]` invece di `Record<string, any>`
