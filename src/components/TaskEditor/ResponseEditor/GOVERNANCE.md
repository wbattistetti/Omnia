# 🏛️ ResponseEditor - Architecture Governance

**Version**: 1.0
**Last Updated**: 2024
**Purpose**: Definire il processo di governance per mantenere l'architettura pulita e sostenibile nel tempo.

---

## 👤 Architecture Owner

### Role Definition

L'**Architecture Owner** è una persona (o un piccolo team) responsabile di:

1. **Approvare modifiche al domain layer** (`core/domain/`)
   - Verificare che le funzioni rimangano pure (no side effects)
   - Verificare che non vengano introdotte dipendenze da React, Zustand, hooks, UI
   - Approvare nuove funzioni domain prima del merge

2. **Controllare nuovi hook**
   - Verificare che non ci sia duplicazione con hook esistenti
   - Verificare che seguano i pattern consolidati
   - Approvare consolidamenti quando necessario

3. **Verificare che le dependency rules siano rispettate**
   - Review PR che toccano architettura
   - Verificare che ESLint rules siano rispettate
   - Intervenire quando le regole vengono violate

### Current Owner

**TBD** - Da designare dal team lead

### Process

**Non serve un processo pesante.** Serve una persona che "custodisce la forma" del codice.

**Workflow tipico:**
1. Developer crea/modifica codice
2. ESLint verifica automaticamente le regole base
3. Se il codice tocca `core/domain/` o crea nuovi hook → Architecture Owner review
4. Architecture Owner approva o richiede modifiche
5. Merge solo dopo approvazione

**Quando richiedere review:**
- ✅ Modifiche a `core/domain/*`
- ✅ Nuovi hook in `hooks/`
- ✅ Nuove feature in `features/`
- ✅ Modifiche a `ARCHITECTURE.md` o `GOVERNANCE.md`
- ❌ Modifiche a componenti UI (non richiedono review)
- ❌ Bug fixes minori (non richiedono review)

---

## 🧪 Test Statici di Regressione

### Obiettivo

I test statici verificano che le regole architetturali siano rispettate **automaticamente** in CI/CD.

### Script Disponibili

#### 1. Verifica Domain Layer Purity

**File**: `scripts/verify-domain-purity.js`

Verifica che `core/domain/` non importi:
- React
- Zustand
- Hooks
- UI components

**Uso:**
```bash
npm run verify:domain-purity
```

#### 2. Verifica Import Relativi

**File**: `scripts/verify-imports.js`

Verifica che:
- Nessun import relativo superi `../..` (2 livelli)
- Tutti gli import usino alias quando possibile

**Uso:**
```bash
npm run verify:imports
```

#### 3. Verifica Cross-Feature Imports

**File**: `scripts/verify-features.js`

Verifica che:
- Le feature non si importino tra loro
- Le feature importino solo da `core/domain/`, `core/state/`, `core/utils/`

**Uso:**
```bash
npm run verify:features
```

### Integrazione CI/CD

Aggiungere questi script al pipeline CI:

```yaml
# .github/workflows/architecture-checks.yml
name: Architecture Checks

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run verify:domain-purity
      - run: npm run verify:imports
      - run: npm run verify:features
```

---

## 📋 Checklist per PR

Prima di aprire una PR che tocca l'architettura, verificare:

### Domain Layer (`core/domain/`)
- [ ] Nessun import da React, Zustand, hooks, UI
- [ ] Funzioni pure (no side effects)
- [ ] Test di purezza aggiornati se necessario
- [ ] JSDoc completo per nuove funzioni

### State Layer (`core/state/`)
- [ ] Nessun import da UI o features
- [ ] Può importare solo da `core/domain/`
- [ ] Store ben strutturato e tipizzato

### Features (`features/`)
- [ ] Non importa da altre features
- [ ] Importa solo da `core/domain/`, `core/state/`, `core/utils/`
- [ ] Feature ben isolata e testabile

### Hooks (`hooks/`)
- [ ] Non duplica logica esistente
- [ ] Segue pattern consolidati
- [ ] Documentato se complesso

### Imports
- [ ] Usa alias invece di percorsi relativi profondi
- [ ] Nessun import relativo supera `../..`

---

## 🚨 Violazioni Comuni

### ❌ Domain Layer importa React

```typescript
// ❌ ERRORE
import { useState } from 'react';
export function getMainNodes() { ... }
```

**Fix:**
```typescript
// ✅ CORRETTO
export function getMainNodes(taskTree: TaskTree) { ... }
```

### ❌ Feature importa da altra feature

```typescript
// ❌ ERRORE
import { useNodeFinder } from '../node-editing/hooks';
```

**Fix:**
```typescript
// ✅ CORRETTO
// Usa core/domain o core/state invece
import { findNodeByIndices } from '@responseEditor/core/domain';
```

### ❌ Import relativo troppo profondo

```typescript
// ❌ ERRORE
import { something } from '../../../../utils/helpers';
```

**Fix:**
```typescript
// ✅ CORRETTO
import { something } from '@utils/helpers';
```

---

## 📊 Metriche

### Health Metrics

Monitorare periodicamente:

1. **Domain Layer Purity**: % di funzioni pure nel domain
2. **Import Depth**: Media della profondità degli import relativi
3. **Cross-Feature Dependencies**: Numero di dipendenze tra feature
4. **Hook Count**: Numero totale di hook (obiettivo: stabile o in calo)

### Reporting

Generare report mensile con:
- Violazioni risolte
- Nuove violazioni introdotte
- Trend delle metriche
- Azioni correttive necessarie

---

## 🔄 Processo di Evoluzione

### Quando Modificare le Regole

Le regole in `ARCHITECTURE.md` possono essere modificate, ma:

1. **Richiede approvazione dell'Architecture Owner**
2. **Richiede documentazione del motivo**
3. **Richiede aggiornamento di ESLint rules se necessario**
4. **Richiede comunicazione al team**

### Proposta di Modifica

Per proporre una modifica:

1. Aprire issue con tag `architecture`
2. Descrivere il problema attuale
3. Proporre la modifica
4. Attendere review dell'Architecture Owner
5. Se approvato, aggiornare `ARCHITECTURE.md` e ESLint

---

## 📚 Risorse

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Regole di dipendenza
- [FASE1_COMPLETATA.md](./FASE1_COMPLETATA.md) - Stabilizzazione completata
- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Piano di refactoring originale

---

**Nota**: Questo documento è vivo e deve evolvere con il progetto. Aggiornare quando necessario, sempre con approvazione dell'Architecture Owner.
