# TODO NUOVO - Future Features & Design Specs

## 📋 Category System (Preset + Custom Categories)

**Status**: Design completo, non implementato
**Priorità**: Media
**Data**: 2026-01-14

### 🎯 Concetto

Sistema di categorie semantiche per task che permette:
- **Preset**: Categorie standard predefinite con icone/colori fissi
- **Custom**: Categorie personalizzate create dal designer con icone/colori custom
- **AI Integration**: AI suggerisce categorie dal preset (preferito) o propone custom quando necessario

### 🧩 Architettura

#### Struttura Dati

```typescript
// ✅ Preset di categorie standard (costante centralizzata)
const PRESET_CATEGORIES = {
  // SayMessage categories
  'greeting': {
    label: 'Saluto',
    icon: 'Sun',
    color: '#fbbf24',
    description: 'Messaggi di benvenuto'
  },
  'farewell': {
    label: 'Congedo',
    icon: 'Wave',
    color: '#3b82f6',
    description: 'Messaggi di commiato'
  },
  'info-short': {
    label: 'Informazione Breve',
    icon: 'MessageSquare',
    color: '#10b981',
    description: 'Messaggi informativi concisi'
  },
  'info-long': {
    label: 'Informazione Dettagliata',
    icon: 'FileText',
    color: '#06b6d4',
    description: 'Messaggi informativi estesi'
  },

  // DataRequest categories
  'problem-classification': {
    label: 'Classificazione Problema',
    icon: 'GitBranch',
    color: '#f59e0b',
    description: 'Classificazione di intenti/problemi'
  },
  'personal-data': {
    label: 'Dato Personale',
    icon: 'User',
    color: '#8b5cf6',
    description: 'Raccolta dati personali'
  },
  'contact-info': {
    label: 'Informazioni di Contatto',
    icon: 'Phone',
    color: '#3b82f6',
    description: 'Email, telefono, indirizzo'
  },
  // ... altre categorie preset
};

// ✅ Categorie personalizzate (salvate nel progetto)
interface CustomCategory {
  id: string;
  label: string;
  icon: string; // Nome icona Lucide o custom
  color: string;
  description?: string;
  scope: 'project' | 'global'; // Progetto specifico o globale
}

// ✅ Task con category
interface Task {
  type: TaskType,
  category?: string, // ✅ ID categoria (preset o custom)
  categoryCustom?: CustomCategory, // ✅ Se custom, dettagli completi
  // ...
}
```

#### Logica Euristica

```typescript
// ✅ getTaskVisuals(type, category?, customCategory?, hasDDT?)
export function getTaskVisuals(
  type: TaskType,
  category?: string,
  customCategory?: CustomCategory,
  hasDDT?: boolean
) {
  // ✅ Base: usa type per default
  const baseVisuals = getTaskVisualsByType(type, hasDDT);

  // ✅ Priorità 1: Custom category (ha la precedenza)
  if (customCategory) {
    return {
      ...baseVisuals,
      Icon: getIconComponent(customCategory.icon),
      labelColor: customCategory.color,
      iconColor: customCategory.color,
    };
  }

  // ✅ Priorità 2: Preset category
  if (category && PRESET_CATEGORIES[category]) {
    const preset = PRESET_CATEGORIES[category];
    return {
      ...baseVisuals,
      Icon: getIconComponent(preset.icon),
      labelColor: preset.color,
      iconColor: preset.color,
    };
  }

  // ✅ Priorità 3: Base da type
  return baseVisuals;
}
```

### 🤖 AI Integration

#### Prompt AI Aggiornato

Aggiungere al prompt in `backend/services/TemplateIntelligenceService.js`:

```javascript
"CATEGORY SUGGESTION:
Based on the user request, suggest a semantic category:

PRESET CATEGORIES (prefer these):
- 'greeting' for welcome messages
- 'farewell' for goodbye messages
- 'problem-classification' for classifying user intents/problems
- 'personal-data' for personal information collection
- 'info-long' for detailed informational messages
- 'info-short' for brief informational messages
- etc.

CUSTOM CATEGORY (only if preset doesn't fit):
If the request doesn't match any preset category, you can suggest a new custom category:
{
  'category': 'custom',
  'customCategory': {
    'label': 'Nome categoria',
    'icon': 'IconName', // Lucide icon name
    'color': '#hexcolor',
    'description': 'Descrizione'
  }
}

Return in response JSON:
{
  "action": "...",
  "type": "DataRequest",
  "category": "problem-classification", // ✅ Preset
  // OR
  "category": "custom", // ✅ Custom
  "customCategory": { ... }, // ✅ Dettagli custom
  // ...
}
"
```

### 🎨 UI Requirements

1. **Category Selector** (in Task Editor):
   - Dropdown con preset categories
   - Opzione "Crea nuova categoria"
   - Se custom, mostra icon picker e color picker

2. **Custom Categories Management**:
   - Lista categorie custom del progetto
   - Modifica/elimina custom categories
   - Condivisione tra progetti (opzionale)

### 📁 File da Modificare

#### Frontend

1. **`src/types/taskTypes.ts`**
   - Aggiungere `category?: string` al tipo `Task`
   - Creare `CustomCategory` interface

2. **`src/components/Flowchart/utils/taskVisuals.ts`**
   - Creare `PRESET_CATEGORIES` constant
   - Estendere `getTaskVisualsByType()` → `getTaskVisuals(type, category?, customCategory?, hasDDT?)`
   - Creare `getVisualStyleByCategory(category)` helper

3. **Tutti i file che usano `getTaskVisualsByType()`**:
   - `src/components/Flowchart/rows/NodeRow/NodeRow.tsx` (linea 1590, 1636)
   - `src/components/TaskEditor/ResponseEditor/index.tsx` (linea 482)
   - `src/components/TaskEditor/EditorHost/editors/TextMessageEditor.tsx` (linea 122)
   - `src/components/TaskEditor/EditorHost/editors/BackendCallEditor.tsx` (linea 544)
   - `src/features/intent-editor/HostAdapter.tsx` (linea 194)
   - Aggiornare per passare `task.category` e `task.categoryCustom`

#### Backend

4. **`backend/services/TemplateIntelligenceService.js`**
   - Aggiungere sezione "CATEGORY SUGGESTION" al prompt AI
   - Gestire `category` e `customCategory` nella risposta JSON

#### Database/Storage

5. **Custom Categories Storage**:
   - Salvare custom categories nel progetto (MongoDB collection `CustomCategories`)
   - O in `projectData.customCategories[]`

### 🔄 Priorità di Risoluzione

1. **Custom category** (se presente) → ha la precedenza
2. **Preset category** (se presente) → override del base
3. **Base da type** → fallback se nessuna category

### ✅ Vantaggi

- **Standardizzazione**: Preset garantisce coerenza visiva
- **Flessibilità**: Custom permette adattamento a casi specifici
- **AI Intelligente**: Usa preset quando possibile, propone custom quando serve
- **Scalabile**: Preset può crescere, custom per casi edge
- **Manutenibile**: Preset centralizzato, custom salvate nel progetto
- **Nessun impatto tecnico**: Category è metadato semantico, non comportamento

### 📝 Note Implementative

- La category NON tocca la logica di esecuzione
- È puramente editoriale/visiva
- Può essere aggiunta/rimossa senza breaking changes
- AI può suggerire preset o custom in base al contesto

---

## Altri TODO Futuri

(Altri TODO verranno aggiunti qui)
