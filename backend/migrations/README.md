# Migration Scripts - AgentAct to TaskTemplate

## Obiettivo
Migrare da `AgentActs` a `task_templates` + `ddt_library` senza perdere dati o rompere funzionalità esistenti.

## Principio: DUAL MODE
- Vecchio e nuovo sistema coesistono
- Nessuna perdita di dati
- Rollback sempre possibile

---

## STEP 1: Setup Collections

**File:** `step1_setup_collections.js`

**Cosa fa:**
- Crea collezioni `task_templates` e `ddt_library`
- Crea indici necessari
- Verifica che `AgentActs` sia ancora presente

**Sicurezza:** ✅ 100% sicuro - Non modifica dati esistenti

**Esegui:**
```bash
cd backend
node migrations/step1_setup_collections.js
```

**Verifica:**
```javascript
// MongoDB shell
use DbFactory
db.getCollectionNames()  // Deve includere task_templates e ddt_library
db.AgentActs.count()     // Deve essere uguale a prima
```

---

## STEP 2: Copy Data

**File:** `step2_copy_data.js`

**Cosa fa:**
- Copia AgentActs → task_templates
- Estrae DDT → ddt_library (se presente)
- Preserva AgentActs originali
- Traccia origine con metadata `_originalActId`

**Sicurezza:** ✅ 99% sicuro - Copia senza cancellare

**Esegui:**
```bash
node migrations/step2_copy_data.js
```

**Verifica:**
```javascript
// MongoDB shell
use DbFactory

// Conta originali
db.AgentActs.count()

// Conta copie
db.task_templates.count({ _migrationSource: "AgentActs" })

// Conta DDT
db.ddt_library.count({ _migrationSource: "AgentActs" })

// Verifica mapping
db.AgentActs.findOne()
db.task_templates.findOne({ _originalActId: "..." })
```

**Rollback (se necessario):**
```javascript
db.task_templates.deleteMany({ _migrationSource: "AgentActs" })
db.ddt_library.deleteMany({ _migrationSource: "AgentActs" })
```

---

## STEP 3: Seed Built-in Templates

**File:** `step3_seed_builtins.js`

**Cosa fa:**
- Crea 4 TaskTemplate built-in: GetData, SayMessage, ClassifyProblem, callBackend
- Questi corrispondono ai 4 CASE nel `TaskExecutor.vb`

**Sicurezza:** ✅ 100% sicuro - Solo inserimenti

**Esegui:**
```bash
node migrations/step3_seed_builtins.js
```

**Verifica:**
```javascript
// MongoDB shell
use DbFactory

// Conta built-in
db.task_templates.count({ isBuiltIn: true })  // Deve essere 4

// Lista built-in
db.task_templates.find({ isBuiltIn: true }, { id: 1, label: 1, type: 1 })
```

---

## Ordine di esecuzione

```bash
# 1. Setup (SEMPRE per primo)
node migrations/step1_setup_collections.js

# 2. Copia dati (DOPO step 1)
node migrations/step2_copy_data.js

# 3. Seed built-in (DOPO step 2)
node migrations/step3_seed_builtins.js

# 4. Verifica tutto
node migrations/verify_migration.js  # (TODO: da creare)
```

---

## Prossimi passi (dopo STEP 1-3)

### STEP 4: Backend Dual Mode
- Creare endpoint `/api/factory/task-templates-v2`
- Mantenere `/api/factory/agent-acts` (fallback)

### STEP 5: Frontend Dual Mode
- Creare `TaskTemplateServiceV2`
- Feature flag per switch graduale

### STEP 6: Test Integration
- Test automatici
- Test manuale in produzione

### STEP 7: Switch graduale
- Attiva nuovo sistema per pochi utenti
- Monitora errori
- Rollback se necessario

### STEP 8: Cleanup (ULTIMO)
- Rinomina `AgentActs` → `AgentActs_backup`
- Rimuovi codice vecchio

---

## Rollback completo

Se qualcosa va storto:

```javascript
// MongoDB shell
use DbFactory

// Elimina nuove collezioni
db.task_templates.drop()
db.ddt_library.drop()

// AgentActs è ancora intatto!
db.AgentActs.count()  // Verifica
```

---

## Note

- **Backup DB prima di ogni step:** `mongodump --uri="mongodb://localhost:27017" --out=backup_$(date +%Y%m%d)`
- **Test su copia del DB prima:** Clone DB production → test su clone
- **Monitora log:** Ogni script stampa dettagli su cosa fa
- **Metadata tracciamento:** `_originalActId`, `_migrationDate`, `_migrationSource`

---

## Domande frequenti

**Q: Posso eseguire gli step più volte?**
A: Sì, sono idempotenti. STEP 2 usa `upsert`, STEP 3 aggiorna se esiste.

**Q: Cosa succede se fallisce a metà?**
A: Gli script sono transazionali per collezione. Rimuovi con rollback e riesegui.

**Q: Perdo DDT durante migrazione?**
A: No. Ogni DDT viene copiato in `ddt_library` con reference tracking.

**Q: Quando posso cancellare AgentActs?**
A: Solo dopo STEP 8, dopo 1-2 settimane di test in produzione.





