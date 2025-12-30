# Analisi Collections MongoDB

## 📋 Riepilogo Collections

### ✅ Collections ATTIVE (mantieni)

1. **`Tasks`** (uppercase)
   - **Stato**: ✅ Attiva - Collection principale per task templates
   - **Documenti**: 75
   - **Uso**: Template catalog principale (migrata da Task_Templates)
   - **Campi**: id, type, templateId, label, dataContracts, patterns, stepPrompts, contexts, name, steps

2. **`Heuristics`** (uppercase)
   - **Stato**: ✅ Attiva - Pattern euristiche per task type detection
   - **Documenti**: 23
   - **Uso**: Pattern matching per identificare tipo task da testo
   - **Campi**: _id, patterns (per lingua), taskType

3. **`factory_types`** (lowercase)
   - **Stato**: ✅ Attiva - NLP extractors
   - **Documenti**: 10
   - **Uso**: Definisce tipi di estrazione (email, phone, date, number, ecc.)
   - **Campi**: id, name, extractorCode, regexPatterns, llmPrompt, nerRules, validators, examples
   - **Endpoint**: Usato da `newBackend/services/database_service.py`

4. **`ddt_library`** (lowercase)
   - **Stato**: ✅ Attiva - DDT Library V2
   - **Documenti**: 6
   - **Uso**: Template DDT riutilizzabili con scope filtering
   - **Campi**: id, label, scope, ddt, _migrationSource, _originalActId
   - **Endpoint**: `/api/factory/ddt-library-v2`, `/api/factory/resolve-ddt`

### ⚠️ Collections DA VERIFICARE

1. **`task_templates`** (lowercase)
   - **Stato**: ⚠️ Attiva ma da migrare
   - **Documenti**: 108
   - **Uso**: Endpoint `/api/factory/task-templates-v2` (linea 2165)
   - **Campi**: id, label, description, scope, type, isBuiltIn, contexts, valueSchema, icon, color
   - **Problema**: Duplicata con `Tasks` - ha scope filtering e contexts
   - **Azione**: Migrare endpoint a `Tasks` o unificare le collection

### ❌ Collections OBSOLETE (eliminate)

1. **`Task_Templates`** (uppercase)
   - **Stato**: ❌ Eliminata
   - **Documenti**: 0
   - **Uso**: Migrata a `Tasks`
   - **Azione**: ✅ Già eliminata

---

## 🔍 Analisi Dettagliata

### `task_templates` vs `Tasks`

**Differenze:**
- `task_templates` (lowercase): 108 documenti, ha `scope`, `contexts`, `isBuiltIn`
- `Tasks` (uppercase): 75 documenti, ha `dataContracts`, `patterns`, `stepPrompts`, `steps`

**Possibili cause:**
1. `task_templates` contiene template con scope filtering (client-specific, industry-specific)
2. `Tasks` contiene template globali/factory
3. Potrebbero essere complementari o duplicati

**Raccomandazione:**
- Verificare se `task_templates` contiene dati diversi da `Tasks`
- Se duplicati: migrare a `Tasks` e eliminare `task_templates`
- Se complementari: unificare in `Tasks` con scope filtering

---

## 📊 Proposta Migrazione

### Step 1: Analizza duplicati
```javascript
// Confronta task_templates vs Tasks
// Verifica se hanno gli stessi ID
```

### Step 2: Migra endpoint
```javascript
// Migra /api/factory/task-templates-v2 da task_templates a Tasks
// Aggiungi scope filtering a Tasks se mancante
```

### Step 3: Unifica collection
```javascript
// Copia documenti unici da task_templates a Tasks
// Elimina task_templates
```

---

## ✅ Conclusioni

1. **`Tasks`** - ✅ Mantieni (collection principale)
2. **`Heuristics`** - ✅ Mantieni (pattern matching)
3. **`factory_types`** - ✅ Mantieni (NLP extractors)
4. **`ddt_library`** - ✅ Mantieni (DDT Library V2)
5. **`task_templates`** - ⚠️ Da migrare a `Tasks` o unificare
6. **`Task_Templates`** - ❌ Già eliminata

