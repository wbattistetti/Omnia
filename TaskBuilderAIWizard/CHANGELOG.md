# Changelog - TaskBuilderAIWizard

## [1.3.0] - 2026-02-06

### Correzioni UI e Miglioramenti UX

**Problema Risolto:**
Icone troppo piccole nelle card delle fasi, payoff poco espressivi, e pulsanti Sì/No con tooltip complessi che causavano problemi di rendering.

**Modifiche Implementate:**

1. **Icone Ingrandite (PhaseCard.tsx:47)**
   - PRIMA: `w-5 h-5` (20px)
   - DOPO: `w-6 h-6` (24px)
   - Le icone nelle card sono ora più visibili e proporzionate

2. **Payoff Più Espressivi (CenterPanel.tsx:99-131)**
   - Struttura dati: "Definizione" → "Schema gerarchico e campi"
   - Vincoli: "Regole" → "Regole di validazione"
   - Parser: "Interpretazione" → "Comprensione linguaggio naturale"
   - Messaggi: "Generazione" → "Dialogo conversazionale"
   - I payoff ora descrivono chiaramente cosa fa ogni fase

3. **Pulsanti Sì/No Semplificati (Sidebar.tsx:232-246)**
   - PRIMA: Pulsante Sì con tooltip hover complesso, animazione light-sweep
   - DOPO: Pulsanti semplici e puliti senza tooltip
   - Risolto problema del pulsante Sì che spariva
   - Migliorata affidabilità del rendering

### File Modificati
- `components/PhaseCard.tsx` - Icone da w-5 h-5 a w-6 h-6
- `components/CenterPanel.tsx` - Payoff più descrittivi per tutte le fasi
- `components/Sidebar.tsx` - Pulsanti conferma semplificati

---

## [1.2.0] - 2026-02-06

### Novità Principali
Preview immediata dei dialoghi quando selezioni una card dall'accordion "Cerca in libreria".

### Feature Aggiunta: Preview Dialoghi durante Selezione

**Problema Risolto:**
Prima, quando l'utente selezionava una card nell'accordion "Cerca in libreria", il pannello destro rimaneva vuoto. Gli esempi di dialogo apparivano solo dopo aver completato l'intero wizard.

**Soluzione:**
Ora quando selezioni una card, il pannello destro mostra immediatamente esempi di conversazione con 3 scenari interattivi (Happy Path, Frasi Parziali, Errori).

---

## File Modificati

### 1. `hooks/useWizardState.ts`

#### State Aggiunto
```typescript
const [previewModuleId, setPreviewModuleId] = useState<string | null>(null);
```

**Scopo:** Traccia quale modulo è attualmente in preview quando l'utente seleziona una card.

#### Metodo Aggiunto
```typescript
setPreviewModuleId: (id: string | null) => void
```

**Return Object Aggiornato:**
```typescript
return {
  // ... existing props
  previewModuleId,
  setPreviewModuleId,
};
```

---

### 2. `WizardApp.tsx`

#### Handler Aggiunto
```typescript
const handlePreviewModule = (moduleId: string) => {
  setPreviewModuleId(moduleId);
};
```

**Scopo:** Callback chiamato quando l'utente clicca su una card nell'accordion.

#### Props Aggiornati

**CenterPanel:**
```typescript
<CenterPanel
  // ... existing props
  onPreviewModule={handlePreviewModule}  // ← NUOVO
/>
```

**RightPanel:**
```typescript
<RightPanel
  // ... existing props
  previewModuleId={previewModuleId}      // ← NUOVO
  availableModules={availableModules}    // ← NUOVO
/>
```

---

### 3. `components/CenterPanel.tsx`

#### Props Interface Aggiornata
```typescript
type CenterPanelProps = {
  // ... existing props
  onPreviewModule?: (moduleId: string) => void;  // ← NUOVO
};
```

#### Logica Click Card Aggiornata

**PRIMA:**
```typescript
<div
  onClick={() => setSelectedModule(module)}
  className={/* ... */}
>
```

**DOPO:**
```typescript
<div
  onClick={() => {
    setSelectedModule(module);
    onPreviewModule?.(module.id);  // ← NUOVO: notifica parent
  }}
  className={/* ... */}
>
```

**Location:** Sia nell'accordion "Cerca in libreria" (step `euristica_non_trovata`) che nella lista card (step `euristica_trovata`).

---

### 4. `components/RightPanel.tsx`

#### Props Interface Aggiornata
```typescript
type RightPanelProps = {
  // ... existing props
  previewModuleId?: string | null;           // ← NUOVO
  availableModules?: FakeModuleTemplate[];   // ← NUOVO
};
```

#### Logica Preview Aggiunta

**Trova modulo in preview:**
```typescript
const previewModule = previewModuleId
  ? availableModules.find(m => m.id === previewModuleId)
  : null;
```

#### Funzione Nuova: getModuleDialogs()

Genera dialoghi specifici per ogni task:

```typescript
const getModuleDialogs = (
  module: FakeModuleTemplate,
  scenario: DialogScenario
): Array<{ role: 'user' | 'bot'; text: string }> => {
  // Dialoghi specifici per:
  // - booking-restaurant (3 scenari)
  // - haircut-appointment (3 scenari)
  // - order-delivery (3 scenari)
  // - default (3 scenari generici)
}
```

**Dialoghi Implementati:**

| Task                  | Scenari |
|-----------------------|---------|
| booking-restaurant    | ✅ 3    |
| haircut-appointment   | ✅ 3    |
| order-delivery        | ✅ 3    |
| Altri task            | ✅ 3 (generici) |

#### Logica Rendering Aggiornata

**PRIMA:**
```typescript
const renderDialog = () => {
  if (messages) {
    return generateDialogFromMessages(messages, activeScenario);
  }
  return defaultEmptyDialog;
};
```

**DOPO:**
```typescript
const renderDialog = () => {
  // Priorità 1: Preview modulo selezionato
  if (previewModule) {
    const dialogs = getModuleDialogs(previewModule, activeScenario);
    return renderDialogs(dialogs);
  }
  // Priorità 2: Dialoghi generati dalla pipeline
  if (messages) {
    return generateDialogFromMessages(messages, activeScenario);
  }
  // Priorità 3: Placeholder vuoto
  return defaultEmptyDialog;
};
```

---

## Dettagli Dialoghi Predefiniti

### booking-restaurant (Prenota Ristorante)

**Happy Path:**
```
Bot: Per favore, dimmi per quante persone vuoi prenotare e quando.
User: Vorrei prenotare per 4 persone domani sera alle 20:00
Bot: Perfetto! Confermi la prenotazione per 4 persone domani sera alle 20:00?
User: Sì, confermo
Bot: Prenotazione confermata! A domani sera!
```

**Frasi Parziali:**
```
Bot: Per favore, dimmi per quante persone vuoi prenotare e quando.
User: Per 4 persone
Bot: Per quale giorno e che orario?
User: Domani sera alle 20
Bot: Perfetto! Prenotazione completata.
```

**Errori:**
```
Bot: Per favore, dimmi per quante persone vuoi prenotare.
User: Per 50 persone
Bot: Mi dispiace, possiamo accogliere fino a 20 persone. Prova con un numero inferiore.
User: Va bene, per 15 persone
Bot: Perfetto! Procediamo con 15 persone.
```

### haircut-appointment (Appuntamento Parrucchiere)

**Happy Path:**
```
Bot: Quando vorresti venire per il taglio?
User: Giovedì prossimo alle 15
Bot: Che tipo di servizio desideri?
User: Solo taglio
Bot: Perfetto! Appuntamento fissato per giovedì alle 15.
```

**Frasi Parziali:**
```
Bot: Quando vorresti venire?
User: Giovedì
Bot: A che ora preferisci?
User: Nel pomeriggio
Bot: Abbiamo disponibilità alle 15 o alle 17. Quale preferisci?
User: Alle 15 va bene
```

**Errori:**
```
Bot: Quando vorresti venire?
User: Ieri
Bot: Non posso prenotare una data passata. Scegli una data futura.
User: Ok, domani alle 10
Bot: Perfetto! A domani!
```

### order-delivery (Ordine Consegna)

**Happy Path:**
```
Bot: Cosa vorresti ordinare?
User: Una pizza margherita e una coca cola
Bot: Qual è il tuo indirizzo di consegna?
User: Via Roma 15, Milano
Bot: Ordine confermato! Consegna in 30 minuti.
```

**Frasi Parziali:**
```
Bot: Cosa vorresti ordinare?
User: Una pizza
Bot: Che tipo di pizza?
User: Margherita
Bot: Qual è il tuo indirizzo?
User: Via Roma 15
```

**Errori:**
```
Bot: Qual è il tuo indirizzo di consegna?
User: Via Roma
Bot: Mi serve anche il numero civico per la consegna.
User: Numero 15
Bot: Perfetto! Ordine in arrivo.
```

### Altri Task (Generici)

Per task senza dialoghi specifici, vengono generati dialoghi generici basati su `module.examples`:

```
Bot: Ciao! Come posso aiutarti?
User: [esempio del task]
Bot: Perfetto! Procediamo.
User: Va bene
Bot: Tutto fatto!
```

---

## Flusso Utente Aggiornato

### Step 1: Euristica NON Trovata
```
User inserisce: "xyz random"
  ↓
Nessun match automatico
  ↓
CenterPanel mostra step "euristica_non_trovata"
  ↓
Header: "Nessun task selezionato"
Bottone: "Genera nuovo task" (in alto a destra)
Accordion: "Cerca in libreria" (chiuso)
RightPanel: Vuoto o placeholder
```

### Step 2: User Apre Accordion
```
User clicca accordion
  ↓
Accordion si espande
  ↓
Mostra 20 card task disponibili
RightPanel: Ancora vuoto
```

### Step 3: User Seleziona Card ← NOVITÀ!
```
User clicca card "Appuntamento Parrucchiere"
  ↓
CenterPanel:
  ├─ Card highlight blu + checkmark
  ├─ Header → "Task selezionato"
  └─ Appare bottone verde "Usa Appuntamento Parrucchiere"
  ↓
WizardApp:
  ├─ setSelectedModule(module)
  └─ handlePreviewModule('haircut-appointment')
  ↓
RightPanel: ← NOVITÀ!
  ├─ Riceve previewModuleId = 'haircut-appointment'
  ├─ Trova modulo in availableModules
  ├─ Chiama getModuleDialogs(module, 'happy')
  └─ MOSTRA SUBITO dialoghi esempio scenario Happy Path
```

### Step 4: User Cambia Scenario ← NOVITÀ!
```
User clicca tab "Errori"
  ↓
setActiveScenario('error')
  ↓
RightPanel:
  ├─ Re-chiama getModuleDialogs(module, 'error')
  └─ Aggiorna dialoghi con scenario errori
```

### Step 5: User Seleziona Altro Task ← NOVITÀ!
```
User clicca card "Prenota Ristorante"
  ↓
CenterPanel:
  ├─ Deseleziona card precedente
  ├─ Highlight nuova card
  └─ handlePreviewModule('booking-restaurant')
  ↓
RightPanel:
  ├─ previewModuleId = 'booking-restaurant'
  ├─ getModuleDialogs(new_module, activeScenario)
  └─ AGGIORNA dialoghi con nuovo task
```

### Step 6: User Procede
```
Opzione A: Click "Usa Appuntamento Parrucchiere"
  ↓
  handleSelectModule('haircut-appointment')
  ↓
  Wizard usa quel modulo
  ↓
  Pipeline parte con task selezionato

Opzione B: Click "Genera nuovo task"
  ↓
  handleProceedFromEuristica()
  ↓
  Wizard genera task custom dall'input
  ↓
  Pipeline parte con task generato
```

---

## Vantaggi Implementazione

### UX Migliorata
- ✅ Feedback immediato durante selezione
- ✅ Nessun pannello vuoto
- ✅ User può confrontare task prima di decidere
- ✅ Preview interattiva con 3 scenari

### Architettura
- ✅ State lift-up corretto (WizardApp coordina)
- ✅ Props drilling minimale
- ✅ Componenti restano autonomi
- ✅ Facile aggiungere nuovi dialoghi

### Performance
- ✅ Nessuna chiamata API durante preview
- ✅ Dialoghi statici (nessun re-render pesante)
- ✅ Switch scenario istantaneo

### Manutenibilità
- ✅ Dialoghi centralizzati in getModuleDialogs()
- ✅ Facile aggiungere nuovi task
- ✅ Fallback generici per task senza dialoghi specifici
- ✅ TypeScript garantisce type safety

---

## Testing Eseguito

### Test 1: Selezione Card
✅ Card si evidenzia con bordo blu
✅ Checkmark appare
✅ Bottone verde appare
✅ RightPanel mostra dialoghi

### Test 2: Switch Scenario
✅ Click tab "Frasi Parziali" → Dialoghi cambiano
✅ Click tab "Errori" → Dialoghi cambiano
✅ Click tab "Happy Path" → Dialoghi tornano originali

### Test 3: Switch Task
✅ Seleziona "Appuntamento Parrucchiere" → Dialoghi specifici
✅ Seleziona "Prenota Ristorante" → Dialoghi cambiano
✅ Seleziona task generico → Dialoghi fallback

### Test 4: Usa Task
✅ Click "Usa <Task>" → Wizard procede
✅ Pipeline parte correttamente
✅ Task selezionato viene usato

### Test 5: Genera Nuovo
✅ Click "Genera nuovo task" → Wizard genera custom
✅ Input originale viene usato
✅ Pipeline genera schema corretto

### Test 6: Build Production
✅ `npm run build` completa senza errori
✅ Bundle ottimizzato
✅ TypeScript compila correttamente

---

## File Creati/Aggiornati

### Creati
- `INTEGRATION_GUIDE.md` - Guida rapida integrazione per Cursor
- `CHANGELOG.md` - Questo file

### Modificati
- `hooks/useWizardState.ts` - Aggiunto previewModuleId state
- `WizardApp.tsx` - Aggiunto handlePreviewModule + props aggiornati
- `components/CenterPanel.tsx` - Aggiunto onPreviewModule callback
- `components/RightPanel.tsx` - Aggiunta logica preview + getModuleDialogs()
- `README.md` - Aggiunta sezione "NOVITÀ v1.2.0"

### Non Modificati (per questa feature)
- `components/Sidebar.tsx`
- `components/Pipeline.tsx`
- `components/PhaseCard.tsx`
- `components/Toast.tsx`
- `hooks/useSimulation.ts`
- `hooks/useSidebarSync.ts`
- `fakeApi/simulateEndpoints.ts`
- `utils/mockData.ts`
- `utils/delays.ts`
- Tutti i file `types/`

---

## Retrocompatibilità

✅ Questa feature è **completamente retrocompatibile**:

1. Props opzionali: `onPreviewModule?`, `previewModuleId?`, `availableModules?`
2. Se non passi questi props, comportamento come prima
3. Se `previewModuleId` è null, mostra dialoghi generati o placeholder
4. Nessuna breaking change su API esistenti

---

## Prossimi Possibili Sviluppi

### Feature Suggerite
- [ ] Aggiungere più dialoghi specifici per gli altri 17 task
- [ ] Permettere editing dialoghi inline
- [ ] Export dialoghi come JSON
- [ ] Search/filter nell'accordion task
- [ ] Preview anche quando euristica trovata automaticamente
- [ ] Animazioni transizione tra dialoghi diversi

### Miglioramenti Tecnici
- [ ] Memoization di getModuleDialogs() per performance
- [ ] Lazy loading dialoghi (se diventano troppi)
- [ ] Test unitari per logica preview
- [ ] Storybook per componenti

---

## Migrazione da v1.0.0 a v1.2.0

### Se Hai Customizzato CenterPanel

**Attenzione:** Se hai modificato `CenterPanel.tsx`, devi aggiungere:

```typescript
// Nella props interface
onPreviewModule?: (moduleId: string) => void;

// Nel click handler della card
onClick={() => {
  setSelectedModule(module);
  onPreviewModule?.(module.id);  // ← Aggiungi questa riga
}}
```

### Se Hai Customizzato RightPanel

**Attenzione:** Se hai modificato `RightPanel.tsx`, devi:

1. Aggiungere props:
```typescript
previewModuleId?: string | null;
availableModules?: FakeModuleTemplate[];
```

2. Implementare logica preview:
```typescript
const previewModule = previewModuleId
  ? availableModules.find(m => m.id === previewModuleId)
  : null;

if (previewModule) {
  // Mostra dialoghi preview
}
```

### Se Hai Customizzato WizardApp

**Attenzione:** Passa i nuovi props:

```typescript
<CenterPanel
  onPreviewModule={handlePreviewModule}
/>

<RightPanel
  previewModuleId={previewModuleId}
  availableModules={availableModules}
/>
```

---

**Versione Corrente:** 1.3.0
**Data Release:** 2026-02-06
**Breaking Changes:** Nessuno
**Deprecations:** Nessuno
