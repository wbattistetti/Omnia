# Fix per materializeStepsFromTemplate

## Problema
La funzione `materializeStepsFromTemplate` in `src/utils/taskUtils.ts` ha ancora codice legacy che usa:
- `cloneStepsWithNewTaskIds()` che restituisce un dictionary
- `clonedSteps[nodeId]` che non esiste più
- Variabili non definite (`nodeId`, `templateDataFirstId`)

## Soluzione
Sostituire le linee 857-863 e 874-880 con la logica corretta che usa `materializedSteps.push()`.

## Patch da applicare manualmente

### Linee 857-863 (CASE 1):
Sostituisci:
```typescript
      const templateSteps = sourceSteps[nodeTemplateId];
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(templateSteps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(newGuid, oldGuid));
      // ✅ REPLACED: Ora usa materializedSteps.push() invece di clonedSteps dictionary
      // Vedi implementazione completa nel blocco CASE 1 sopra
      // Log rimosso per ridurre rumore - solo log critici
      return;
```

Con:
```typescript
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
```

### Linee 874-880 (CASE 2):
Sostituisci:
```typescript
      // ✅ Template atomico: gli steps sono direttamente in template.steps
      const { cloned, guidMapping } = cloneStepsWithNewTaskIds(sourceTemplate.steps);
      guidMapping.forEach((newGuid, oldGuid) => allGuidMappings.set(newGuid, oldGuid));
      // ✅ REPLACED: Ora usa materializedSteps.push() invece di clonedSteps dictionary
      // Vedi implementazione completa nel blocco CASE 1 sopra
      // Log rimosso per ridurre rumore - solo log critici
      return;
```

Con:
```typescript
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
```
