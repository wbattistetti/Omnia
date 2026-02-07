# Guida Rapida Integrazione per Cursor

## 🆕 Novità v1.3.0

**Correzioni UI e miglioramenti:**
- ✅ Icone più grandi nelle card delle fasi (24px invece di 20px)
- ✅ Payoff descrittivi: "Schema gerarchico e campi", "Comprensione linguaggio naturale", etc.
- ✅ Pulsanti Sì/No semplificati e più affidabili

---

## Cosa è TaskBuilderAIWizard

Un componente React completo che simula la creazione guidata di task conversazionali tramite AI. Include:
- ✅ 3 pannelli: Sidebar albero task + Centro wizard + Destra esempi dialogo
- ✅ Pipeline animata con 3 fasi (Vincoli, Parser, Messaggi)
- ✅ Libreria con 20 task predefiniti
- ✅ Preview dialoghi in tempo reale durante selezione
- ✅ Tutti i dati sono mock, pronti per essere sostituiti 1:1 con API reali

---

## Step 1: Copia la Cartella

```bash
# Copia l'intera cartella nel tuo progetto Cursor
cp -r TaskBuilderAIWizard /path/to/your/cursor/project/src/
```

---

## Step 2: Verifica Dipendenze

Nel tuo `package.json`:

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.344.0"
  }
}
```

Se non hai `lucide-react`:
```bash
npm install lucide-react
```

---

## Step 3: Usa il Componente

Nel tuo `App.tsx`:

```typescript
import { WizardApp } from './TaskBuilderAIWizard/WizardApp';

function App() {
  return <WizardApp />;
}

export default App;
```

O come route:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WizardApp } from './TaskBuilderAIWizard/WizardApp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/wizard" element={<WizardApp />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Step 4: Verifica Tailwind

Il componente usa Tailwind CSS. Assicurati che `tailwind.config.js` includa la cartella:

```javascript
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",  // ← Deve includere TaskBuilderAIWizard
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Se non funziona, verifica esplicitamente:

```javascript
content: [
  "./src/**/*.{js,jsx,ts,tsx}",
  "./src/TaskBuilderAIWizard/**/*.{js,jsx,ts,tsx}",
],
```

---

## Step 5: Build e Test

```bash
npm run build
npm run dev
```

Vai su `http://localhost:5173` (o la tua porta) e verifica che:
- ✅ Il wizard si carichi
- ✅ Puoi inserire input
- ✅ La pipeline si anima
- ✅ L'accordion si apre/chiude
- ✅ Selezionando una card, il pannello destro mostra dialoghi

---

## Personalizzazioni Rapide

### 1. Cambia i Task Disponibili

Modifica `utils/mockData.ts`:

```typescript
export const MOCK_MODULES: FakeModuleTemplate[] = [
  {
    id: 'mio-task',
    name: 'my_task',
    label: 'Il Mio Task',
    type: 'composite',
    icon: 'info',
    examples: ['Voglio fare qualcosa'],
    subTasks: [
      { templateId: 'date', label: 'Data', type: 'date' }
    ]
  },
  // ... altri task
];
```

### 2. Cambia Velocità Animazioni

Modifica `utils/delays.ts`:

```typescript
export const TIMINGS = {
  PHASE_CONSTRAINT: 2000,  // Millisecondi per fase Vincoli
  PHASE_PARSER: 2500,      // Millisecondi per fase Parser
  PHASE_MESSAGES: 2000,    // Millisecondi per fase Messaggi
  // ... altri timing
};
```

### 3. Aggiungi Dialoghi Personalizzati

Modifica `components/RightPanel.tsx` nella funzione `getModuleDialogs()`:

```typescript
case 'mio-task':
  return scenario === 'happy' ? [
    { role: 'bot' as const, text: 'Ciao! Come posso aiutarti?' },
    { role: 'user' as const, text: 'Vorrei fare questo' },
    { role: 'bot' as const, text: 'Perfetto! Fatto!' }
  ] : // ... altri scenari
```

### 4. Cambia Colori

Cerca e sostituisci nei componenti:
- `bg-blue-500` → Tuo colore primario
- `bg-green-500` → Tuo colore successo
- `bg-orange-500` → Tuo colore warning
- `bg-gray-50` → Tuo background

---

## Sostituire Mock con API Reali

### Dove Sono i Mock

Tutti i mock sono in `fakeApi/simulateEndpoints.ts`:

```typescript
export async function searchModuleHeuristic(input: string) {
  // Mock: cerca nei MOCK_MODULES
  // ↓ Sostituisci con:
  const response = await fetch('/api/search-module', {
    method: 'POST',
    body: JSON.stringify({ input })
  });
  return response.json();
}

export async function generateDataSchema(input: string) {
  // Mock: genera schema fake
  // ↓ Sostituisci con:
  const response = await fetch('/api/generate-schema', {
    method: 'POST',
    body: JSON.stringify({ input })
  });
  return response.json();
}

// Stessa cosa per:
// - generateConstraints()
// - generateContract()
// - generateMessages()
```

### Cosa Sostituire

1. **searchModuleHeuristic**: Endpoint che cerca task in libreria
2. **generateDataSchema**: Endpoint che genera albero task
3. **generateConstraints**: Endpoint che genera vincoli
4. **generateContract**: Endpoint che genera parser NLP
5. **generateMessages**: Endpoint che genera messaggi bot

### Tipi da Usare

I tipi sono in `types/`:
- `FakeTaskTreeNode` → Struttura albero task
- `FakeConstraint` → Vincolo validazione
- `FakeNLPContract` → Contratto parser
- `FakeStepMessages` → Messaggi dialogo
- `FakeModuleTemplate` → Template task libreria

**Importante:** Rinomina i tipi rimuovendo "Fake" quando usi quelli reali:
```typescript
// Fake
import { FakeTaskTreeNode } from './types/FakeTaskTreeNode';

// Reale
import { TaskTreeNode } from '@your-api/types';
```

---

## Struttura Cartelle

```
TaskBuilderAIWizard/
├── WizardApp.tsx              # Entry point - usa questo
├── components/                # Componenti UI (non toccare)
│   ├── CenterPanel.tsx
│   ├── RightPanel.tsx
│   ├── Sidebar.tsx
│   ├── Pipeline.tsx
│   ├── PhaseCard.tsx
│   └── Toast.tsx
├── hooks/                     # Logica state (non toccare)
│   ├── useWizardState.ts
│   ├── useSimulation.ts
│   └── useSidebarSync.ts
├── fakeApi/                   # ← SOSTITUISCI CON API REALI
│   └── simulateEndpoints.ts
├── types/                     # TypeScript types
│   └── ...
├── utils/                     # ← PERSONALIZZA QUI
│   ├── mockData.ts            # Task libreria
│   └── delays.ts              # Timing animazioni
├── README.md                  # Documentazione completa
└── INTEGRATION_GUIDE.md       # Questo file
```

---

## Troubleshooting

### Problema: Tailwind non funziona
**Soluzione:** Verifica che `tailwind.config.js` includa `./src/**/*.{tsx,ts}` e che tu abbia `@tailwind` import in `index.css`.

### Problema: Icone non appaiono
**Soluzione:** Installa `lucide-react`:
```bash
npm install lucide-react
```

### Problema: Errore TypeScript sui tipi
**Soluzione:** Verifica che TypeScript compili correttamente:
```bash
npm run typecheck
```

### Problema: Pannello destro vuoto durante selezione
**Soluzione:** Verifica che WizardApp passi `onPreviewModule`, `previewModuleId` e `availableModules` ai rispettivi componenti. Questa è una feature della v1.2.0.

### Problema: Animazioni troppo veloci/lente
**Soluzione:** Modifica i valori in `utils/delays.ts`.

---

## Domande Frequenti

### Posso usare il wizard in un modal?
Sì, basta wrappare `<WizardApp />` in un div con dimensioni fisse:
```jsx
<div className="fixed inset-0 z-50 bg-white">
  <WizardApp />
</div>
```

### Posso disabilitare l'accordion?
Sì, in `CenterPanel.tsx` rimuovi la sezione accordion o imposta una condizione:
```typescript
{showAccordion && (
  <div className="border border-gray-300 rounded-xl">
    {/* accordion content */}
  </div>
)}
```

### Posso cambiare i 3 scenari nel pannello destro?
Sì, in `RightPanel.tsx` cerca `type DialogScenario` e aggiungi/rimuovi scenari. Poi aggiorna la logica in `getModuleDialogs()`.

### Posso usare il wizard con altro framework (Vue, Svelte)?
No, è specifico per React. Dovresti riscrivere i componenti nel tuo framework.

### Posso esportare il task generato come JSON?
Sì, nel step "completato" puoi aggiungere un bottone che chiama:
```typescript
const exportJSON = () => {
  const data = {
    taskTree: dataSchema,
    constraints: constraintsData,
    contract: contractData,
    messages: messagesData
  };
  console.log(JSON.stringify(data, null, 2));
};
```

---

## Prossimi Passi

1. ✅ Integra il wizard nel tuo progetto
2. ✅ Testa tutte le funzionalità
3. ✅ Personalizza task e dialoghi
4. ✅ Sostituisci mock con API reali
5. ✅ Deploy!

---

## Supporto

Consulta `README.md` per documentazione tecnica completa.

**Versione:** 1.3.0
**Data:** 2026-02-06
