# Piano Migrazione: Struttura Ibrida DDT (Steps Piatti)

## Obiettivo
Migrare da struttura annidata (`mainData[].steps`) a struttura ibrida:
- **mainData/subData**: Rimangono annidati (compatibilità VB.NET)
- **dialogueSteps**: Lista piatta con `dataId` reference
- **constraints**: Lista piatta con `dataId` reference (opzionale, futuro)

---

## FASE 1: Analisi e Preparazione ✅

### 1.1 Definire Schema Ibrido
- [ ] Creare `DialogueStep` interface con `dataId`, `type`, `escalations`
- [ ] Aggiornare `Task` interface: aggiungere `dialogueSteps?: DialogueStep[]`
- [ ] Aggiornare `MainDataNode`: rimuovere `steps` (sarà piatta)
- [ ] Creare helper functions per migrazione

### 1.2 Helper Functions
- [ ] `extractStepsFromNested(mainData)`: Estrae steps annidati → lista piatta
- [ ] `buildNestedStepsFromFlat(dialogueSteps, dataId)`: Ricostruisce steps annidati (per compatibilità temporanea)
- [ ] `migrateTaskToHybrid(task)`: Trasforma task da annidato a ibrido

---

## FASE 2: Migrazione Database 🗄️

### 2.1 Script Migrazione MongoDB
- [ ] Creare `backend/migrations/flatten_dialogue_steps.js`
- [ ] Iterare su `factory.Tasks` collection
- [ ] Iterare su tutte le `project_*.tasks` collections
- [ ] Per ogni task con `mainData`:
  - Estrai `steps` da `mainData[].steps` e `mainData[].subData[].steps`
  - Crea `dialogueSteps[]` con `dataId` reference
  - Rimuovi `steps` da `mainData` e `subData`
  - Salva task aggiornato
- [ ] Dry-run mode per test
- [ ] Backup automatico prima di migrazione

### 2.2 Validazione
- [ ] Verificare che tutti i task siano migrati
- [ ] Verificare che `dialogueSteps` contenga tutti gli steps
- [ ] Verificare che `mainData` non contenga più `steps`

---

## FASE 3: Refactoring TypeScript Types 📝

### 3.1 Aggiornare Types
- [ ] `src/types/taskTypes.ts`: Aggiungere `dialogueSteps?: DialogueStep[]`
- [ ] `src/components/DialogueDataTemplateBuilder/DDTAssembler/currentDDT.types.ts`:
  - Rimuovere `steps: StepGroup[]` da `MainDataNode`
  - Aggiungere `dialogueSteps?: DialogueStep[]` a `AssembledDDT`
- [ ] Creare `src/types/dialogueStep.ts` con `DialogueStep` interface

### 3.2 Compatibilità Temporanea
- [ ] Creare adapter functions per backward compatibility
- [ ] `getStepsForData(dialogueSteps, dataId)`: Query steps per dataId
- [ ] `getStepForData(dialogueSteps, dataId, stepType)`: Query step specifico

---

## FASE 4: Refactoring ddtMergeUtils 🔧

### 4.1 `loadDDTFromTemplate`
- [ ] Rimuovere clonazione ricorsiva di `mainData[].steps`
- [ ] Clonare solo `dialogueSteps` array (lineare)
- [ ] Mantenere `mainData` come riferimento (senza steps)

### 4.2 `extractModifiedDDTFields`
- [ ] Rimuovere confronto di `mainData[].steps` annidati
- [ ] Confrontare solo `dialogueSteps` array (lineare)
- [ ] Semplificare logica da ~150 linee a ~20 linee

### 4.3 `cloneStepsWithNewTaskIds`
- [ ] Semplificare: clonare solo `dialogueSteps` array
- [ ] Rimuovere ricorsione su `mainData/subData`
- [ ] Ridurre da ~50 linee a ~10 linee

### 4.4 `buildMainDataFromTemplate`
- [ ] Rimuovere clonazione di steps da `mainData`
- [ ] Mantenere solo struttura `mainData` (senza steps)
- [ ] `dialogueSteps` viene clonato separatamente

---

## FASE 5: Refactoring ResponseEditor 🎨

### 5.1 Aggiornare Accesso Steps
- [ ] Sostituire `mainData[0].steps` con `dialogueSteps.filter(s => s.dataId === mainData[0].id)`
- [ ] Sostituire `mainData[0].subData[0].steps` con `dialogueSteps.filter(s => s.dataId === subData[0].id)`
- [ ] Creare helper `useDialogueSteps(dataId)` hook

### 5.2 Aggiornare `updateSelectedNode`
- [ ] Modificare logica per aggiornare `dialogueSteps` invece di `mainData[].steps`
- [ ] Mantenere `mainData` immutabile (solo riferimento)

### 5.3 Aggiornare `EscalationEditor`
- [ ] Aggiornare per lavorare con `dialogueSteps` piatti
- [ ] Mantenere stessa UX (trasparente all'utente)

---

## FASE 6: Refactoring Selectors 🔍

### 6.1 `ddtSelectors.ts`
- [ ] `getNodeSteps(node)`: Query `dialogueSteps` invece di `node.steps`
- [ ] `getMessagesFor(node, stepKey)`: Query `dialogueSteps` invece di `node.steps[stepKey]`
- [ ] Mantenere stessa API (backward compatible)

---

## FASE 7: Refactoring DDT Assembler 🏗️

### 7.1 `MainDataBuilder.ts`
- [ ] `buildMainDataNode`: Non creare `steps` in `mainData`
- [ ] Creare `dialogueSteps` separatamente con `dataId` reference
- [ ] Aggiornare `DDTBuilder.ts` per generare `dialogueSteps`

### 7.2 `assembleFinal.ts`
- [ ] Aggiornare per generare `dialogueSteps` invece di `mainData[].steps`
- [ ] Mantenere stessa struttura finale

---

## FASE 8: Testing e Validazione ✅

### 8.1 Unit Tests
- [ ] Test migrazione database (dry-run)
- [ ] Test clonazione `dialogueSteps`
- [ ] Test estrazione override
- [ ] Test query `dialogueSteps` per `dataId`

### 8.2 Integration Tests
- [ ] Test caricamento DDT da template
- [ ] Test salvataggio DDT con override
- [ ] Test clonazione task da template
- [ ] Test ResponseEditor con nuova struttura

### 8.3 Compatibilità VB.NET
- [ ] Verificare che `mainData.subData` rimanga annidato
- [ ] Verificare che runtime VB.NET funzioni (usa `mainData.subData`, non `dialogueSteps`)

---

## FASE 9: Cleanup 🧹

### 9.1 Rimuovere Codice Legacy
- [ ] Rimuovere helper functions per backward compatibility (se non più necessarie)
- [ ] Rimuovere commenti obsoleti
- [ ] Aggiornare documentazione

### 9.2 Performance
- [ ] Verificare che query `dialogueSteps.filter` sia performante
- [ ] Considerare index su `dataId` se necessario (MongoDB)

---

## Struttura Target (Ibrida)

```typescript
// ✅ TEMPLATE
{
  id: "guid-template",
  label: "Data di nascita",
  mainData: [
    {
      id: "guid-main",
      templateId: "guid-main-template",
      label: "Data di nascita",
      type: "DateOfBirth",
      // ⚠️ NO steps qui
      subData: [
        { id: "guid-day", templateId: "guid-day-template" }
      ]
    }
  ],
  dialogueSteps: [
    { id: "guid-step-1", type: "start", dataId: "guid-main", escalations: [...] },
    { id: "guid-step-2", type: "noMatch", dataId: "guid-main", escalations: [...] },
    { id: "guid-step-3", type: "start", dataId: "guid-day", escalations: [...] }
  ]
}

// ✅ ISTANZA (stessa struttura, solo override)
{
  id: "guid-instance",
  templateId: "guid-template",
  label: "Chiedi la data",
  mainData: [
    {
      templateId: "guid-main-template",
      // ⚠️ NO steps qui (riferimento al template)
    }
  ],
  dialogueSteps: [
    { id: "guid-step-1", type: "start", dataId: "guid-main", escalations: [...] }  // ✅ Solo override
  ]
}
```

---

## Note Importanti

1. **VB.NET Compatibility**: `mainData.subData` rimane annidato (nessun cambiamento)
2. **Backward Compatibility**: Creare adapter functions temporanee se necessario
3. **Performance**: Query `dialogueSteps.filter` è O(n) ma n è piccolo (~8-30 steps)
4. **Testing**: Testare ogni fase prima di procedere alla successiva

---

## Timeline Stimata

- FASE 1: 1-2 ore
- FASE 2: 2-3 ore
- FASE 3: 1-2 ore
- FASE 4: 3-4 ore
- FASE 5: 2-3 ore
- FASE 6: 1-2 ore
- FASE 7: 2-3 ore
- FASE 8: 3-4 ore
- FASE 9: 1-2 ore

**Totale**: ~16-25 ore

