# Migration Plan: Remove InstanceRepository

## Obiettivo
Rimuovere completamente `InstanceRepository` e usare solo `TaskRepository` come unico repository per i dati delle istanze.

## Stato Attuale
- **Dual Mode**: Sia `InstanceRepository` che `TaskRepository` sono attivi
- **Sincronizzazione**: `InstanceRepository` sincronizza automaticamente con `TaskRepository`
- **TaskRepository**: Wrapper attorno a `InstanceRepository` (dipende da esso)

## File che usano InstanceRepository (23 file)

### Categoria 1: Core Services (2 file)
- `src/services/TaskRepository.ts` - **DIPENDE DA InstanceRepository**
- `src/services/InstanceRepository.ts` - **DA RIMUOVERE**

### Categoria 2: App Core (2 file)
- `src/components/AppContent.tsx` - Load/Save istanze
- `src/components/App.tsx` - Probabilmente usi minori

### Categoria 3: Editor Components (6 file)
- `src/components/ActEditor/EditorHost/editors/TextMessageEditor.tsx`
- `src/components/ActEditor/ResponseEditor/index.tsx`
- `src/components/ActEditor/ResponseEditor/DDTHostAdapter.tsx`
- `src/components/ActEditor/ResponseEditor/NonInteractiveResponseEditor.tsx`
- `src/components/ActEditor/ResponseEditor/ResizableNonInteractiveEditor.tsx`
- `src/components/ActEditor/ResponseEditor/NLPExtractorProfileEditor.tsx`

### Categoria 4: Flowchart Components (3 file)
- `src/components/Flowchart/rows/NodeRow/NodeRow.tsx`
- `src/utils/taskHelpers.ts`
- `src/components/Flowchart/utils/actVisuals.ts`

### Categoria 5: Chat Simulator (3 file)
- `src/components/ChatSimulator/hooks/useFlowOrchestrator.ts`
- `src/components/ChatSimulator/hooks/rowHelpers.ts`
- `src/components/ChatSimulator/hooks/flowRowPlayer.ts`

### Categoria 6: Intent Editor (3 file)
- `src/features/intent-editor/HostAdapter.tsx`
- `src/components/ActEditor/ResponseEditor/components/IntentListEditor.tsx`
- `src/components/ActEditor/ResponseEditor/components/IntentListEditorWrapper.tsx`

### Categoria 7: Altri (4 file)
- `src/components/ActEditor/ResponseEditor/InlineEditors/IntentEditorInlineEditor.tsx`
- `src/services/IntellisenseService.ts`
- `src/components/Flowchart/hooks/useIntellisenseHandlers.ts`
- `src/services/__tests__/InstanceRepository.test.ts`

## Piano di Migrazione (8 Fasi)

### Fase 1: Rendere TaskRepository Indipendente ⚠️ CRITICO
**Obiettivo**: `TaskRepository` deve gestire lo storage direttamente, senza dipendere da `InstanceRepository`

**Modifiche**:
1. Spostare la logica di storage da `InstanceRepository` a `TaskRepository`
   - `TaskRepository` deve avere la sua `Map<string, Task>` interna
   - Metodi `saveAllTasksToDatabase` e `loadAllTasksFromDatabase` devono gestire direttamente il database

2. Mantenere compatibilità con database esistente
   - Leggere da `/api/projects/:pid/instances` (formato ActInstance)
   - Convertire ActInstance → Task durante il load
   - Scrivere in formato ActInstance durante il save (per compatibilità)

**File da modificare**:
- `src/services/TaskRepository.ts` - Aggiungere storage interno e metodi database

**Test**:
- Verificare che `TaskRepository` funzioni senza `InstanceRepository`
- Verificare load/save dal database

---

### Fase 2: Migrare AppContent per Load/Save
**Obiettivo**: `AppContent.tsx` deve usare solo `TaskRepository` per load/save

**Modifiche**:
1. Rimuovere `instanceRepository.loadInstancesFromDatabase()`
2. Usare solo `taskRepository.loadAllTasksFromDatabase()`
3. Rimuovere `instanceRepository.saveAllInstancesToDatabase()`
4. Usare solo `taskRepository.saveAllTasksToDatabase()`

**File da modificare**:
- `src/components/AppContent.tsx`

**Test**:
- Aprire progetto esistente → verificare che i dati siano caricati
- Modificare dati → salvare → riaprire → verificare che i dati siano salvati

---

### Fase 3: Migrare Editor Components
**Obiettivo**: Tutti gli editor devono usare `TaskRepository` invece di `InstanceRepository`

**Modifiche per ogni editor**:

#### TextMessageEditor.tsx
- `instanceRepository.getInstance()` → `taskRepository.getTask()`
- `instanceRepository.createInstanceWithId()` → `taskRepository.createTask()`
- `instanceRepository.updateMessage()` → `taskRepository.updateTaskValue()`

#### ResponseEditor/index.tsx
- `instanceRepository.updateDDT()` → `taskRepository.updateTaskValue()`

#### DDTHostAdapter.tsx
- `instanceRepository.getInstance()` → `taskRepository.getTask()`
- `instanceRepository.createInstanceWithId()` → `taskRepository.createTask()`
- `instanceRepository.updateDDT()` → `taskRepository.updateTaskValue()`

**File da modificare**:
- `src/components/ActEditor/EditorHost/editors/TextMessageEditor.tsx`
- `src/components/ActEditor/ResponseEditor/index.tsx`
- `src/components/ActEditor/ResponseEditor/DDTHostAdapter.tsx`
- `src/components/ActEditor/ResponseEditor/NonInteractiveResponseEditor.tsx`
- `src/components/ActEditor/ResponseEditor/ResizableNonInteractiveEditor.tsx`
- `src/components/ActEditor/ResponseEditor/NLPExtractorProfileEditor.tsx`

**Test**:
- Aprire ogni tipo di editor → modificare dati → verificare che funzioni
- Salvare → riaprire → verificare che i dati siano salvati

---

### Fase 4: Migrare NodeRow e taskHelpers
**Obiettivo**: `NodeRow.tsx` e `taskHelpers.ts` devono usare solo `TaskRepository`

**Modifiche**:

#### taskHelpers.ts
- Rimuovere tutti gli usi di `instanceRepository`
- `createRowWithTask()` deve usare solo `taskRepository.createTask()`
- `updateRowTaskAction()` deve usare solo `taskRepository.updateTask()`

#### NodeRow.tsx
- `instanceRepository.getInstance()` → `taskRepository.getTask()`
- Rimuovere tutti gli usi di `instanceRepository`

**File da modificare**:
- `src/utils/taskHelpers.ts`
- `src/components/Flowchart/rows/NodeRow/NodeRow.tsx`

**Test**:
- Creare nuova riga → verificare che funzioni
- Modificare riga → verificare che funzioni
- Salvare → riaprire → verificare che funzioni

---

### Fase 5: Migrare Chat Simulator
**Obiettivo**: Chat Simulator deve usare `TaskRepository` per eseguire il flow

**Modifiche**:
- `rowHelpers.ts`: `getDDTForRow()` deve usare `taskRepository.getTask()` invece di `instanceRepository.getInstance()`
- `useFlowOrchestrator.ts`: Rimuovere usi di `instanceRepository`

**File da modificare**:
- `src/components/ChatSimulator/hooks/rowHelpers.ts`
- `src/components/ChatSimulator/hooks/useFlowOrchestrator.ts`
- `src/components/ChatSimulator/hooks/flowRowPlayer.ts`

**Test**:
- Eseguire flow nel Chat Simulator → verificare che funzioni
- Verificare che i DDT vengano caricati correttamente

---

### Fase 6: Migrare Componenti Rimanenti
**Obiettivo**: Migrare tutti gli altri componenti che usano `InstanceRepository`

**File da modificare**:
- `src/components/Flowchart/utils/actVisuals.ts`
- `src/services/IntellisenseService.ts`
- `src/components/Flowchart/hooks/useIntellisenseHandlers.ts`
- `src/features/intent-editor/HostAdapter.tsx`
- `src/components/ActEditor/ResponseEditor/components/IntentListEditor.tsx`
- `src/components/ActEditor/ResponseEditor/components/IntentListEditorWrapper.tsx`
- `src/components/ActEditor/ResponseEditor/InlineEditors/IntentEditorInlineEditor.tsx`
- `src/components/App.tsx`

**Test**:
- Testare ogni componente modificato
- Verificare che non ci siano regressioni

---

### Fase 7: Rimuovere Sincronizzazione
**Obiettivo**: Rimuovere la sincronizzazione da `InstanceRepository` (non serve più)

**Modifiche**:
- Rimuovere il codice di sincronizzazione da:
  - `InstanceRepository.updateMessage()`
  - `InstanceRepository.updateDDT()`
  - `InstanceRepository.updateIntents()`

**File da modificare**:
- `src/services/InstanceRepository.ts`

**Test**:
- Verificare che tutto funzioni ancora (non dovrebbe esserci più codice che usa InstanceRepository)

---

### Fase 8: Rimuovere InstanceRepository
**Obiettivo**: Rimuovere completamente `InstanceRepository` e il tipo `ActInstance`

**Modifiche**:
1. Eliminare `src/services/InstanceRepository.ts`
2. Rimuovere import di `InstanceRepository` da tutti i file
3. Rimuovere il tipo `ActInstance` (se non usato altrove)
4. Aggiornare `TaskRepository` per non importare più `InstanceRepository`

**File da modificare**:
- Eliminare: `src/services/InstanceRepository.ts`
- `src/services/TaskRepository.ts` - Rimuovere import
- Verificare che non ci siano altri import

**Test Finale**:
- ✅ Aprire progetto esistente
- ✅ Creare nuove righe
- ✅ Modificare dati negli editor
- ✅ Salvare progetto
- ✅ Riaprire progetto
- ✅ Eseguire flow nel Chat Simulator
- ✅ Verificare che tutto funzioni come prima

---

## Note Importanti

### Compatibilità Database
- Il database usa ancora il formato `ActInstance`
- `TaskRepository` deve continuare a leggere/scrivere in formato `ActInstance` per compatibilità
- La conversione `ActInstance ↔ Task` avviene in `TaskRepository`

### Backward Compatibility
- Durante la migrazione, mantenere la sincronizzazione fino alla Fase 7
- Dopo la Fase 7, tutto deve usare solo `TaskRepository`

### Testing
- Testare ogni fase prima di procedere alla successiva
- Verificare che i dati esistenti continuino a funzionare
- Verificare che il salvataggio/caricamento funzioni correttamente

---

## Ordine di Esecuzione

1. ✅ **Fase 1** (CRITICO) - Rendere TaskRepository indipendente
2. ✅ **Fase 2** - Migrare AppContent
3. ✅ **Fase 3** - Migrare Editor Components
4. ✅ **Fase 4** - Migrare NodeRow e taskHelpers
5. ✅ **Fase 5** - Migrare Chat Simulator
6. ✅ **Fase 6** - Migrare Componenti Rimanenti
7. ✅ **Fase 7** - Rimuovere Sincronizzazione
8. ✅ **Fase 8** - Rimuovere InstanceRepository

**IMPORTANTE**: Non procedere alla fase successiva finché la fase corrente non è completamente testata e funzionante.

