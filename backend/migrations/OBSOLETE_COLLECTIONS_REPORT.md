# 📊 Report: Collezioni MongoDB Obsolete

**Data analisi**: 2025-01-29
**Script**: `backend/migrations/identify_obsolete_collections.js`

---

## ❌ COLLEZIONI OBSOLETE (possono essere eliminate SUBITO)

### Factory Database

1. **`Flows`** (0 documenti)
   - **Stato**: ❌ VUOTA e non usata nel codice
   - **Azione**: ✅ **ELIMINA** - non referenziata in nessun endpoint

2. **`Variables`** (0 documenti)
   - **Stato**: ❌ VUOTA e non usata nel codice
   - **Azione**: ✅ **ELIMINA** - non referenziata in nessun endpoint

---

## ⚠️ COLLEZIONI DA MIGRARE (dopo migrazione, possono essere eliminate)

### Factory Database

1. **`ddt_library`** (6 documenti, tutti VUOTI)
   - **Stato**: ⚠️ Tutti i DDT sono placeholder vuoti da migrazione incompleta
   - **Uso**: Endpoint `/api/factory/ddt-library-v2`, `/api/factory/resolve-ddt`
   - **Problema**: Tutti i 6 documenti sono vuoti (no mainData, no steps)
   - **Azione**:
     - ✅ Verifica se gli endpoint sono ancora usati dal frontend
     - ✅ Se non usati → **ELIMINA** subito
     - ✅ Se usati → migra a `Tasks` e poi **ELIMINA**

2. **`task_templates`** (108 documenti)
   - **Stato**: ⚠️ Duplicata con `Tasks` (75 documenti)
   - **Uso**: Endpoint `/api/factory/task-templates-v2` (linea 2165)
   - **Problema**: Ha scope filtering e contexts che `Tasks` potrebbe non avere
   - **Azione**:
     - ✅ Migra endpoint `/api/factory/task-templates-v2` da `task_templates` a `Tasks`
     - ✅ Aggiungi supporto scope filtering a `Tasks` se mancante
     - ✅ Dopo migrazione → **ELIMINA** `task_templates`

3. **`AgentActs`** (0 documenti)
   - **Stato**: ⚠️ DEPRECATA ma ancora referenziata nel codice
   - **Uso**: Endpoint linea 644, 2735, 2756 (deprecati ma ancora presenti)
   - **Problema**: Collection vuota ma endpoint ancora presenti
   - **Azione**:
     - ✅ Rimuovi endpoint deprecati (linea 644, 2735, 2756)
     - ✅ Dopo rimozione endpoint → **ELIMINA** `AgentActs`

4. **`IDETranslations`** (32 documenti)
   - **Stato**: ⚠️ Legacy, unificata in `Translations` (3633 documenti)
   - **Uso**: Endpoint `/api/factory/ide-translations` (linea 2849)
   - **Problema**: Endpoint legacy, traduzioni unificate in `Translations`
   - **Azione**:
     - ✅ Verifica se endpoint è ancora usato dal frontend
     - ✅ Se non usato → migra 32 documenti in `Translations` e **ELIMINA**
     - ✅ Se usato → migra endpoint a `Translations` e poi **ELIMINA**

5. **`DataDialogueTranslations`** (0 documenti)
   - **Stato**: ⚠️ VUOTA ma ancora referenziata
   - **Uso**: Endpoint `/api/factory/data-dialogue-translations` (linea 2872, 2975)
   - **Problema**: Collection vuota ma endpoint ancora presenti
   - **Azione**:
     - ✅ Verifica se endpoint è ancora usato dal frontend
     - ✅ Se non usato → rimuovi endpoint e **ELIMINA** collection
     - ✅ Se usato → migra endpoint a `Translations` e poi **ELIMINA**

### Projects Database

6. **`projects`** (4 documenti)
   - **Stato**: ⚠️ Potrebbe essere duplicata con `projects_catalog` (1 documento)
   - **Uso**: Endpoint `/api/projects`, `/projects` (linea 3862, 3908, 3938, 3962)
   - **Problema**: Potrebbe essere legacy, `projects_catalog` è la fonte di verità
   - **Azione**:
     - ✅ Verifica se `projects` e `projects_catalog` contengono gli stessi dati
     - ✅ Se duplicate → migra endpoint a `projects_catalog` e **ELIMINA** `projects`
     - ✅ Se complementari → mantieni entrambe

---

## ✅ COLLEZIONI ATTIVE (mantieni)

### Factory Database

- ✅ **`Tasks`** (75 documenti) - Collection principale per task templates
- ✅ **`Heuristics`** (23 documenti) - Pattern euristiche per task type detection
- ✅ **`factory_types`** (10 documenti) - NLP extractors
- ✅ **`BackendCalls`** (0 documenti) - Backend call templates
- ✅ **`Conditions`** (3 documenti) - Condition templates
- ✅ **`Constants`** (7 documenti) - Constants (mesi, ecc.)
- ✅ **`Industries`** (10 documenti) - Industry definitions
- ✅ **`Translations`** (3633 documenti) - Translations unificate
- ✅ **`Extractors`** (7 documenti) - NLP extractors
- ✅ **`ExtractorBindings`** (7 documenti) - NLP extractor bindings
- ✅ **`DataDialogueTemplates`** - Data dialogue templates (usata linea 3845)

### Projects Database

- ✅ **`projects_catalog`** (1 documento) - Catalogo progetti (fonte di verità)

---

## 📋 PRIORITÀ DI ELIMINAZIONE

### 🔴 PRIORITÀ ALTA (elimina subito)

1. **`Flows`** - VUOTA, non usata
2. **`Variables`** - VUOTA, non usata
3. **`ddt_library`** - Tutti i 6 documenti sono VUOTI (placeholder)

### 🟡 PRIORITÀ MEDIA (dopo verifica/migrazione)

4. **`AgentActs`** - VUOTA, endpoint deprecati (rimuovi endpoint prima)
5. **`DataDialogueTranslations`** - VUOTA, endpoint legacy (verifica se usato)
6. **`IDETranslations`** - 32 documenti, endpoint legacy (migra in Translations)

### 🟢 PRIORITÀ BASSA (dopo migrazione endpoint)

7. **`task_templates`** - 108 documenti, migrare endpoint a `Tasks`
8. **`projects`** - 4 documenti, verificare se duplicata con `projects_catalog`

---

## 🛠️ SCRIPT DI ELIMINAZIONE

Dopo aver verificato/migrato, usa questo script per eliminare le collezioni obsolete:

```javascript
// backend/migrations/remove_obsolete_collections.js
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb+srv://...';
const dbFactory = 'factory';
const dbProjects = 'Projects';

const OBSOLETE_COLLECTIONS = {
  factory: [
    'Flows',                    // ✅ VUOTA, non usata
    'Variables',                // ✅ VUOTA, non usata
    'ddt_library',             // ⚠️ Tutti i DDT sono vuoti
    'AgentActs',                // ⚠️ VUOTA, endpoint deprecati
    'DataDialogueTranslations', // ⚠️ VUOTA, endpoint legacy
    'IDETranslations',          // ⚠️ Da migrare in Translations
    'task_templates'            // ⚠️ Da migrare a Tasks
  ],
  Projects: [
    'projects'                  // ⚠️ Da verificare se duplicata
  ]
};

async function removeObsolete() {
  const client = new MongoClient(uri);
  try {
    await client.connect();

    // Elimina da factory
    const factoryDb = client.db(dbFactory);
    for (const collName of OBSOLETE_COLLECTIONS.factory) {
      const count = await factoryDb.collection(collName).countDocuments();
      if (count === 0) {
        await factoryDb.collection(collName).drop();
        console.log(`✅ Eliminata ${collName} (vuota)`);
      } else {
        console.log(`⚠️  ${collName} ha ${count} documenti - verifica prima di eliminare`);
      }
    }

    // Elimina da Projects
    const projectsDb = client.db(dbProjects);
    for (const collName of OBSOLETE_COLLECTIONS.Projects) {
      const count = await projectsDb.collection(collName).countDocuments();
      if (count === 0) {
        await projectsDb.collection(collName).drop();
        console.log(`✅ Eliminata ${collName} (vuota)`);
      } else {
        console.log(`⚠️  ${collName} ha ${count} documenti - verifica prima di eliminare`);
      }
    }
  } finally {
    await client.close();
  }
}
```

---

## ✅ CONCLUSIONI

**Collezioni da eliminare SUBITO:**
- `Flows` (vuota)
- `Variables` (vuota)
- `ddt_library` (tutti i DDT sono vuoti)

**Collezioni da eliminare DOPO migrazione:**
- `task_templates` → migrare endpoint a `Tasks`
- `AgentActs` → rimuovere endpoint deprecati
- `IDETranslations` → migrare in `Translations`
- `DataDialogueTranslations` → migrare in `Translations`
- `projects` → verificare se duplicata con `projects_catalog`

