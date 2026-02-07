# ResponseEditor Architecture Rules

**Version**: 1.0
**Last Updated**: 2024
**Purpose**: Definire le regole di dipendenza minime ma efficaci per mantenere l'architettura pulita e sostenibile.

---

## 🎯 Dependency Rules (6 Regole)

Queste sono le **uniche** regole di dipendenza. Semplici, chiare, efficaci.

### 1. Domain → non importa da React, store, hooks, UI

Il domain layer contiene solo funzioni pure. Non può dipendere da:
- ❌ React (hooks, componenti)
- ❌ Store (Zustand, Redux, etc.)
- ❌ Hooks (qualsiasi hook)
- ❌ UI (componenti, styling)

**Può importare da:**
- ✅ Types (`@types/*`)
- ✅ Utils esterni (solo se pure functions)
- ✅ Altri moduli domain

**Esempio corretto:**
```typescript
// core/domain/taskTree.ts
import type { TaskTree } from '@types/taskTypes';
import { getNodesWithFallback } from '@utils/taskTreeMigrationHelpers'; // ✅ OK: pure function
```

**Esempio errato:**
```typescript
// core/domain/taskTree.ts
import React from 'react'; // ❌ ERRORE
import { useTaskTreeStore } from '../state'; // ❌ ERRORE
```

---

### 2. State → non importa da UI o features

Il state layer gestisce solo lo stato. Non può dipendere da:
- ❌ UI (componenti, styling)
- ❌ Features (qualsiasi feature)

**Può importare da:**
- ✅ Domain (`core/domain/*`)
- ✅ Types (`@types/*`)
- ✅ Zustand (per creare store)

**Esempio corretto:**
```typescript
// core/state/taskTreeStore.ts
import { create } from 'zustand';
import type { TaskTree } from '@types/taskTypes';
import { getMainNodes } from '../domain'; // ✅ OK: domain layer
```

**Esempio errato:**
```typescript
// core/state/taskTreeStore.ts
import SomeComponent from '../components/SomeComponent'; // ❌ ERRORE
import { useNodeFinder } from '../features/node-editing/hooks'; // ❌ ERRORE
```

---

### 3. Features → non importano tra loro

Le feature sono autonome e indipendenti. Non possono importare da altre feature.

**Può importare da:**
- ✅ Core (`core/domain/*`, `core/state/*`)
- ✅ Types (`@types/*`)
- ✅ Utils esterni (`@utils/*`, `@services/*`)

**Esempio corretto:**
```typescript
// features/node-editing/hooks/useNodeFinder.ts
import { getMainNodes, getSubNodes } from '@responseEditor/core/domain'; // ✅ OK: core
import type { TaskTree } from '@types/taskTypes'; // ✅ OK: types
```

**Esempio errato:**
```typescript
// features/node-editing/hooks/useNodeFinder.ts
import { useProfileUpdate } from '../step-management/hooks'; // ❌ ERRORE: altre feature
```

---

### 4. Hooks → importano solo da core e features (mai da UI)

Gli hook orchestrano la logica. Non possono importare da UI.

**Può importare da:**
- ✅ Core (`core/domain/*`, `core/state/*`)
- ✅ Features (`features/*/hooks/*`, `features/*/core/*`)
- ✅ Types (`@types/*`)
- ✅ Utils esterni (`@utils/*`, `@services/*`)

**Non può importare da:**
- ❌ Components (`components/*`, `*.tsx` che sono componenti)

**Esempio corretto:**
```typescript
// hooks/useResponseEditorCore.ts
import { useTaskTreeFromStore } from '@responseEditor/core/state'; // ✅ OK: core
import { useNodeFinder } from '@responseEditor/features/node-editing/hooks'; // ✅ OK: features
```

**Esempio errato:**
```typescript
// hooks/useResponseEditorCore.ts
import ResponseEditorLayout from '../components/ResponseEditorLayout'; // ❌ ERRORE: UI
```

---

### 5. Components → importano solo da hooks e core

I componenti gestiscono solo il rendering. Non possono importare direttamente da features.

**Può importare da:**
- ✅ Hooks (`hooks/*`)
- ✅ Core (`core/domain/*`, `core/state/*`)
- ✅ Types (`@types/*`)
- ✅ Altri componenti (solo per composizione)

**Esempio corretto:**
```typescript
// components/ResponseEditorLayout.tsx
import { useResponseEditor } from '../hooks/useResponseEditor'; // ✅ OK: hooks
import { useTaskTreeFromStore } from '@responseEditor/core/state'; // ✅ OK: core
```

**Esempio errato:**
```typescript
// components/ResponseEditorLayout.tsx
import { useNodeFinder } from '../features/node-editing/hooks'; // ❌ ERRORE: features direttamente
```

---

### 6. Persistence → importa solo da domain e state

Il persistence layer gestisce solo il salvataggio. Non può importare da UI.

**Può importare da:**
- ✅ Domain (`core/domain/*`)
- ✅ State (`core/state/*`)
- ✅ Types (`@types/*`)
- ✅ Services (`@services/*`)

**Esempio corretto:**
```typescript
// features/persistence/saveTask.ts
import { getMainNodes } from '@responseEditor/core/domain'; // ✅ OK: domain
import { useTaskTreeStore } from '@responseEditor/core/state'; // ✅ OK: state
```

**Esempio errato:**
```typescript
// features/persistence/saveTask.ts
import SomeComponent from '../components/SomeComponent'; // ❌ ERRORE: UI
```

---

## 📋 Regole di Import

### Import con Aliases

Usa sempre gli alias invece di percorsi relativi:

```typescript
// ✅ CORRETTO
import { getMainNodes } from '@responseEditor/core/domain';
import { useTaskTreeFromStore } from '@responseEditor/core/state';

// ❌ ERRATO
import { getMainNodes } from '../../core/domain';
import { useTaskTreeFromStore } from '../../../core/state';
```

### Limite Profondità Import

Nessun import relativo deve superare `../..` (2 livelli).

```typescript
// ✅ CORRETTO
import { something } from '../utils';
import { something } from '../../hooks';

// ❌ ERRATO
import { something } from '../../../utils';
import { something } from '../../../../hooks';
```

---

## 🎯 Obiettivo

Queste regole hanno un obiettivo semplice: **mantenere l'architettura pulita e sostenibile**.

- ✅ Domain layer rimane puro (testabile, riutilizzabile)
- ✅ Features rimangono autonome (sviluppo parallelo)
- ✅ Hooks orchestrano senza dipendere da UI
- ✅ Components gestiscono solo rendering
- ✅ Persistence gestisce solo salvataggio

---

## ⚠️ Note Importanti

1. **Queste sono le uniche regole**: Non aggiungere altre regole. Se serve una nuova regola, probabilmente l'architettura va rivista.

2. **ESLint le verifica automaticamente**: Le regole sono verificate da ESLint in CI. Non puoi committare codice che viola queste regole.

3. **Architecture Owner approva eccezioni**: Se serve violare una regola, l'Architecture Owner deve approvare l'eccezione.

4. **Semplicità prima di tutto**: Regole semplici = team felice + architettura stabile.

---

## 📚 Riferimenti

- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Feature-Based Architecture](https://khalilstemmler.com/articles/domain-driven-design-intro/)
