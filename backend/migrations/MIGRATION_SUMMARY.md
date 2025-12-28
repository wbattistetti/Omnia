# Migrazione: Task_Templates → Tasks (Modello Unificato)

## Data: 2025-01-27

## Obiettivo
Unificare il modello dati eliminando la distinzione tra "template" e "task":
- Tutti i documenti sono ora **Tasks**
- `templateId: null` = Task standalone (era un "template")
- `templateId: GUID` = Task che referenzia un altro Task

## Modifiche Implementate

### 1. Collection Rinominata
- **Prima**: `Task_Templates`
- **Dopo**: `Tasks`
- La collection originale `Task_Templates` è mantenuta per backup

### 2. Struttura Unificata
Ogni Task ha ora:
- `id`: GUID univoco
- `type`: Enum numerico (0-19) - TaskType
- `templateId`: `null` (standalone) o `GUID` (referenza)
- `label`: Nome visualizzato
- Campi polimorfici specifici per tipo

### 3. TaskType Enum Esteso
```typescript
UNDEFINED = -1
SayMessage = 0
CloseSession = 1
Transfer = 2
DataRequest = 3      // Rinominato da GetData
BackendCall = 4
ClassifyProblem = 5
SendSMS = 6          // ✅ NUOVO
SendEmail = 7        // ✅ NUOVO
EscalateToHuman = 8  // ✅ NUOVO
EscalateToGuardVR = 9 // ✅ NUOVO
ReadFromBackend = 10 // ✅ NUOVO
WriteToBackend = 11  // ✅ NUOVO
LogData = 12         // ✅ NUOVO
LogLabel = 13        // ✅ NUOVO
PlayJingle = 14      // ✅ NUOVO
Jump = 15            // ✅ NUOVO
HangUp = 16          // ✅ NUOVO
Assign = 17          // ✅ NUOVO
Clear = 18           // ✅ NUOVO
WaitForAgent = 19    // ✅ NUOVO
```

### 4. Campi Legacy Rimossi
- ❌ `taskType` (legacy) - rimosso, usa solo `type`
- ✅ `type` ora è sempre enum numerico (0-19)

## Script di Migrazione Eseguiti

### 1. `migrate_tasks_unified_model.js`
- Migra `Task_Templates` → `Tasks` nella factory
- Aggiunge `templateId: null` a tutti i documenti
- Rimuove `taskType` legacy
- **Risultato**: 75 task migrati nella factory

### 2. `migrate_projects_tasks.js`
- Migra `Task_Templates` → `Tasks` in tutti i progetti
- **Risultato**: 63 task migrati in 3 progetti

### 3. `fix_action_types_from_original.js`
- Corregge le action che avevano `type: 3` (DataRequest) invece dei nuovi enum (6-19)
- **Risultato**: 16 action corrette

## Statistiche Finali

### Factory
- Task migrati: **75**
- Action corrette: **16**
- Distribuzione type:
  - `type: 0` (SayMessage): 2
  - `type: 3` (DataRequest): 53
  - `type: 6` (SendSMS): 1
  - `type: 7` (SendEmail): 1
  - `type: 8` (EscalateToHuman): 1
  - `type: 9` (EscalateToGuardVR): 1
  - `type: 10` (ReadFromBackend): 1
  - `type: 11` (WriteToBackend): 1
  - `type: 12` (LogData): 1
  - `type: 13` (LogLabel): 1
  - `type: 14` (PlayJingle): 1
  - `type: 15` (Jump): 1
  - `type: 16` (HangUp): 1
  - `type: 17` (Assign): 1
  - `type: 18` (Clear): 1
  - `type: 19` (WaitForAgent): 1

### Progetti
- Progetti processati: **3**
- Task migrati totali: **63**

## Prossimi Passi

1. ✅ **Completato**: Migrazione database
2. ⏳ **Da fare**: Aggiornare backend endpoints per usare `Tasks` invece di `Task_Templates`
3. ⏳ **Da fare**: Aggiornare frontend per usare i nuovi enum (6-19)
4. ⏳ **Da fare**: Aggiornare VB.NET backend per supportare i nuovi enum
5. ⏳ **Da fare**: Rimuovere collection `Task_Templates` originale (dopo verifica)

## Note Importanti

- La collection `Task_Templates` originale è ancora presente per backup
- Tutti i task hanno `templateId: null` (standalone)
- Il campo `taskType` è stato rimosso
- I nuovi enum (6-19) sono ora utilizzati per le action

## File di Migrazione

- `migrate_tasks_unified_model.js` - Migrazione factory
- `migrate_projects_tasks.js` - Migrazione progetti
- `fix_action_types_from_original.js` - Correzione action types
- `verify_action_mapping.js` - Verifica mapping

