# Task Pipeline Verification Report

## Obiettivo
Garantire che ogni task nella pipeline abbia sempre:
- `type` (TaskType enum, obbligatorio)
- `templateId` (string | null, obbligatorio, può essere null per standalone)
- `templateTaskId` (string | null, per tracking template overrides)
- `edited` (boolean, per tracking user modifications)

**Nessun fallback, nessuna derivazione, nessun default nascosto.**

---

## 1. CREAZIONE TASK

### ✅ TaskRepository.createTask
**File**: `src/services/TaskRepository.ts:56`
- ✅ Valida che `type` sia presente
- ✅ `templateId` può essere null (standalone)
- ✅ Nessun fallback

### ✅ normalize.ts - createTask
**File**: `src/components/TaskEditor/ResponseEditor/utils/normalize.ts:14`
- ✅ Valida che `type` sia presente
- ✅ `templateId` può essere null (standalone)
- ✅ Nessun fallback

### ✅ taskHelpers.ts - createRowWithTask
**File**: `src/utils/taskHelpers.ts:154`
- ✅ Usa `taskRepository.createTask` (già validato)
- ✅ Nessun fallback

### ❌ BUG: StepBuilder.ts - buildTask
**File**: `src/components/DialogueDataTemplateBuilder/DDTAssembler/StepBuilder.ts:32`
- ❌ **FALLBACK TROVATO**: `templateIdToTaskType(templateId) || TaskType.SayMessage`
- ❌ **PROBLEMA**: Se `templateIdToTaskType` restituisce `UNDEFINED`, usa `SayMessage` come default
- ✅ **FIX RICHIESTO**: Lanciare errore se `templateIdToTaskType` restituisce `UNDEFINED`

### ✅ assembleFinal.ts
**File**: `src/components/DialogueDataTemplateBuilder/DDTWizard/assembleFinal.ts:705`
- ✅ Valida che `templateIdToTaskType` non restituisca `UNDEFINED`
- ✅ Aggiunge `type` e `templateId` alle actions legacy
- ✅ Nessun fallback

### ✅ saveIntentMessages.ts
**File**: `src/components/TaskEditor/ResponseEditor/utils/saveIntentMessages.ts:49`
- ✅ Valida che `templateIdToTaskType` non restituisca `UNDEFINED`
- ✅ Aggiunge `type` e `templateId` alle actions legacy
- ✅ Nessun fallback

---

## 2. CLONAZIONE TASK

### ✅ cloneEscalationWithNewTaskIds
**File**: `src/utils/taskUtils.ts:435`
- ✅ Valida che `type` sia presente
- ✅ Valida che `templateId` sia presente (può essere null)
- ✅ Aggiunge `templateTaskId` e `edited: false`
- ✅ Nessun fallback

### ✅ cloneStepsWithNewTaskIds
**File**: `src/utils/taskUtils.ts:387`
- ✅ Usa `cloneEscalationWithNewTaskIds` (già validato)
- ✅ Nessun fallback

---

## 3. MODIFICA TASK

### ✅ useTaskCommands.ts - appendTask
**File**: `src/components/TaskEditor/ResponseEditor/useTaskCommands.ts:324`
- ✅ Valida che `type` sia presente
- ✅ Aggiunge `templateTaskId: null` e `edited: true` per nuovi task
- ✅ Nessun fallback

### ✅ useTaskCommands.ts - editTask
**File**: `src/components/TaskEditor/ResponseEditor/useTaskCommands.ts`
- ✅ Marca task come `edited: true` quando modificato
- ✅ Preserva `type` e `templateId` esistenti

### ✅ updateActionTextInDDT
**File**: `src/components/TaskEditor/ResponseEditor/ChatSimulator/utils/updateActionText.ts:54`
- ✅ Marca task come `edited: true` quando testo modificato
- ⚠️ **POTENZIALE BUG**: Non verifica che `type` e `templateId` siano presenti prima di modificare
- ✅ **FIX RICHIESTO**: Aggiungere validazione prima di modificare

### ❌ BUG: normalizeTaskForEscalation
**File**: `src/components/TaskEditor/ResponseEditor/utils/escalationHelpers.ts:94`
- ❌ **FALLBACK TROVATO**: `templateId = taskTemplateId || (isTaskIdGuid ? null : taskId) || 'sayMessage'`
- ❌ **PROBLEMA**: Se `taskTemplateId` è undefined, usa `taskId` o `'sayMessage'` come default
- ❌ **PROBLEMA**: Non verifica che `type` sia presente
- ✅ **FIX RICHIESTO**: Validare che `type` e `templateId` siano presenti, lanciare errore se mancanti

### ❌ BUG: buildEscalationModel
**File**: `src/components/TaskEditor/ResponseEditor/utils/buildEscalationModel.ts:138`
- ❌ **FALLBACK TROVATO**: `const finalTemplateId = task.templateId || 'sayMessage'`
- ❌ **PROBLEMA**: Se `task.templateId` è undefined, usa `'sayMessage'` come default
- ❌ **PROBLEMA**: Non verifica che `type` sia presente
- ✅ **FIX RICHIESTO**: Validare che `type` e `templateId` siano presenti, lanciare errore se mancanti

---

## 4. SERIALIZZAZIONE TASK

### ✅ buildTaskTree
**File**: `src/utils/taskUtils.ts:1042`
- ✅ Usa `cloneTemplateSteps` (già validato)
- ✅ Nessun fallback

### ✅ extractTaskOverrides
**File**: `src/utils/taskUtils.ts`
- ✅ Preserva `steps` dalla working copy
- ✅ Nessun fallback

---

## 5. PASSAGGIO AL BACKEND

### ✅ Chat Simulator - DDEBubbleChat
**File**: `src/components/TaskEditor/ResponseEditor/ChatSimulator/DDEBubbleChat.tsx:80`
- ✅ Richiede `taskTree` obbligatorio
- ✅ Non invia solo `taskId`
- ✅ Passa istanza completa

### ✅ Backend API - HandleTaskSessionStart
**File**: `VBNET/ApiServer/Program.vb`
- ✅ Usa `TaskTree` se presente
- ✅ Fallback a database solo se `TaskTree` non presente (legacy)
- ✅ Converte `TaskTree` in `TaskTreeRuntime`

---

## 6. COMPILATORE VB.NET

### ✅ TaskAssembler.CompileTask
**File**: `VBNET/Compiler/TaskAssembler.vb:422`
- ✅ Valida che `type` sia presente
- ✅ Restituisce `Nothing` se `type` manca o è invalido
- ✅ Nessun fallback

### ✅ UtteranceInterpretationTaskCompiler
**File**: `VBNET/Compiler/TaskCompiler/UtteranceInterpretationTaskCompiler.vb`
- ✅ Usa `TaskAssembler` (già validato)
- ✅ Nessun fallback

---

## BUG TROVATI E CORRETTI

### ✅ BUG #1: StepBuilder.ts - buildTask - CORRETTO
**File**: `src/components/DialogueDataTemplateBuilder/DDTAssembler/StepBuilder.ts:32`
**Problema**: Fallback `|| TaskType.SayMessage`
**Fix**: ✅ Lancia errore se `templateIdToTaskType` restituisce `UNDEFINED`

### ✅ BUG #2: normalizeTaskForEscalation - CORRETTO
**File**: `src/components/TaskEditor/ResponseEditor/utils/escalationHelpers.ts:94`
**Problema**: Fallback per `templateId` e mancanza di validazione `type`
**Fix**: ✅ Valida che `type` e `templateId` siano presenti, lancia errore se mancanti

### ✅ BUG #3: buildEscalationModel - CORRETTO
**File**: `src/components/TaskEditor/ResponseEditor/utils/buildEscalationModel.ts:138`
**Problema**: Fallback per `templateId` e mancanza di validazione `type`
**Fix**: ✅ Valida che `type` e `templateId` siano presenti, lancia errore se mancanti

### ✅ WARNING #1: updateActionTextInDDT - CORRETTO
**File**: `src/components/TaskEditor/ResponseEditor/ChatSimulator/utils/updateActionText.ts:54`
**Problema**: Non verifica che `type` e `templateId` siano presenti prima di modificare
**Fix**: ✅ Aggiunta validazione prima di modificare in tutti i punti (Case A, Case B, introduction)

---

## CONCLUSIONI

### ✅ Punti già corretti:
1. TaskRepository.createTask
2. normalize.ts - createTask
3. cloneEscalationWithNewTaskIds
4. useTaskCommands.appendTask
5. assembleFinal.ts
6. saveIntentMessages.ts
7. Chat Simulator
8. Compilatore VB.NET

### ❌ Bug da correggere:
1. StepBuilder.ts - buildTask (fallback)
2. normalizeTaskForEscalation (fallback + mancanza validazione)
3. buildEscalationModel (fallback + mancanza validazione)

### ⚠️ Warning:
1. updateActionTextInDDT (mancanza validazione opzionale)
