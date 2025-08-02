# 🎨 Sistema di Theming - Documentazione Completa

## 📋 INDICE
1. [Panoramica](#panoramica)
2. [Architettura Corretta](#architettura-corretta)
3. [Funzionalità da Implementare](#funzionalità-da-implementare)
4. [Errori da Evitare](#errori-da-evitare)
5. [Roadmap di Implementazione](#roadmap-di-implementazione)
6. [Struttura dei File](#struttura-dei-file)
7. [API e Hook](#api-e-hook)
8. [Esempi di Utilizzo](#esempi-di-utilizzo)
9. [Testing e Debug](#testing-e-debug)

---

## 🎯 PANORAMICA

### Obiettivo
Sistema di theming modulare e scalabile che permette di modificare colori, font e stili di tutti gli elementi dell'IDE tramite click diretto, senza interferire con le funzionalità esistenti.

### Principi Fondamentali
- ✅ **Modularità**: Ogni componente gestisce il proprio editing
- ✅ **Non-interferenza**: Nessun listener globale che rompe funzionalità esistenti
- ✅ **Precisione**: Click su parti specifiche (background, text, border) per editing mirato
- ✅ **Performance**: Nessun re-render inutile, stato centralizzato
- ✅ **Manutenibilità**: Codice pulito, separazione delle responsabilità

---

## 🏗️ ARCHITETTURA CORRETTA

### 1. Pattern "Propagazione Controllata + Handler Modulari"

```typescript
// ❌ SBAGLIATO: Listener globale su document
document.addEventListener('click', handleClick, true); // ROMPE TUTTO!

// ✅ GIUSTO: Ogni componente gestisce il proprio click
const MyComponent = () => {
  const { isEditMode, createClickHandler } = useThemeEditor();
  
  const handleBackgroundClick = createClickHandler('my-element', 'background');
  const handleTextClick = createClickHandler('my-element', 'text');
  
  const handleNormalClick = (e) => {
    if (!isEditMode) {
      // Comportamento normale del componente
      doNormalStuff();
    }
  };
  
  return (
    <div onClick={handleNormalClick}>
      <div onClick={handleBackgroundClick}>Background</div>
      <span onClick={handleTextClick}>Text</span>
    </div>
  );
};
```

### 2. Flusso di Dati
```
Componente → useThemeEditor → useThemeActions → ThemeReducer → Stato Globale
     ↓
MiniColorPicker → Applicazione Cambiamenti → CSS Variables
```

### 3. Separazione delle Responsabilità
- **Componenti**: Gestiscono il proprio comportamento e rendering
- **Hook**: Forniscono API pulite per l'editing
- **Reducer**: Gestisce lo stato globale in modo prevedibile
- **Registry**: Centralizza la definizione degli elementi editabili
- **CSS Generator**: Applica i cambiamenti al DOM

---

## 🚀 FUNZIONALITÀ DA IMPLEMENTARE

### 1. Toggle Tema (PRIORITÀ ALTA)
- [x] Pulsante "Tema ATTIVO/DISATTIVO" funzionante
- [x] Nessuna interferenza con altri elementi quando disattivato
- [x] Cursor personalizzato quando attivo (pennello)

### 2. Editing Preciso (PRIORITÀ ALTA)
- [x] Click su parti specifiche (background, text, border)
- [x] MiniColorPicker che si apre nella posizione corretta
- [x] Preview in tempo reale dei cambiamenti
- [x] Applicazione/Annullamento dei cambiamenti

### 3. Elementi Editabili (PRIORITÀ MEDIA)
- [x] Sidebar Header (background, text)
- [x] Accordion Header (background, text, border)
- [x] Flowchart Nodes (background, text, border)
- [x] Canvas (background, border)
- [x] Pulsanti (background, text)

### 4. Funzionalità Avanzate (PRIORITÀ BASSA)
- [ ] Editor font (tipo, dimensione, peso)
- [ ] Persistenza del tema
- [ ] Reset/Undo/Redo
- [ ] Import/Export temi
- [ ] Temi predefiniti

---

## ❌ ERRORI DA EVITARE

### 1. Listener Globali (CRITICO)
```typescript
// ❌ MAI FARE QUESTO
document.addEventListener('click', handleClick, true);
```
**Problemi**: Interferisce con accordion, pulsanti, select, input, ecc.
**Soluzione**: Handler specifici per ogni componente

### 2. Stato Complesso e Inconsistente
```typescript
// ❌ SBAGLIATO
const [isOpen, setIsOpen] = useState(false);
const [editingElement, setEditingElement] = useState(null);
const [editingProperty, setEditingProperty] = useState(null);
const [previewValue, setPreviewValue] = useState('');
// ... 10 altri stati

// ✅ GIUSTO
const [state, dispatch] = useReducer(themeReducer, initialState);
```

### 3. Logica Imperativa
```typescript
// ❌ SBAGLIATO
useEffect(() => {
  if (isEditMode) {
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }
}, [isEditMode]);

// ✅ GIUSTO
const handleClick = createClickHandler('element', 'part');
```

### 4. CSS Inline o Manipolazione Diretta del DOM
```typescript
// ❌ SBAGLIATO
element.style.backgroundColor = newColor;

// ✅ GIUSTO
document.documentElement.style.setProperty('--sidebar-header-bg', newColor);
```

### 5. Re-render Inutili
```typescript
// ❌ SBAGLIATO
const [colors, setColors] = useState({});
const updateColor = (color) => setColors({...colors, [key]: color});

// ✅ GIUSTO
const { applyPropertyChange } = useThemeActions();
```

---

## 🗺️ ROADMAP DI IMPLEMENTAZIONE

### FASE 1: Fondamenta (1-2 ore)
1. **ThemeReducer** - Stato centralizzato e prevedibile
2. **useThemeState** - Hook per accesso allo stato
3. **useThemeActions** - Hook per le azioni
4. **elementRegistry** - Registro degli elementi editabili

### FASE 2: Componenti Base (1-2 ore)
1. **ThemeProvider** - Provider principale
2. **ThemeToggle** - Pulsante toggle funzionante
3. **MiniColorPicker** - Editor colori funzionante
4. **CustomCursor** - Cursor personalizzato

### FASE 3: Editing Modulare (2-3 ore)
1. **useThemeEditor** - Hook per componenti editabili
2. **SidebarHeader** - Implementazione completa
3. **SidebarEntityAccordion** - Implementazione completa
4. **Test funzionalità base**

### FASE 4: Elementi Aggiuntivi (1-2 ore)
1. **FlowchartNode** - Editing nodi
2. **Canvas** - Editing canvas
3. **Pulsanti** - Editing pulsanti
4. **Test completo**

### FASE 5: Ottimizzazioni (1 ora)
1. **Performance** - Memoizzazione
2. **UX** - Feedback visivo
3. **Debug** - Logging pulito
4. **Documentazione** - Commenti e esempi

---

## 📁 STRUTTURA DEI FILE

```
src/theme/
├── state/
│   └── ThemeReducer.ts          # Stato centralizzato
├── hooks/
│   ├── useThemeState.ts         # Accesso allo stato
│   ├── useThemeActions.ts       # Azioni del tema
│   └── useThemeEditor.ts        # Hook per componenti
├── components/
│   ├── ThemeProvider.tsx        # Provider principale
│   ├── ThemeToggle.tsx          # Pulsante toggle
│   └── MiniColorPicker.tsx      # Editor colori
├── utils/
│   ├── elementRegistry.ts       # Registro elementi
│   └── cssGenerator.ts          # Generazione CSS
├── types.ts                     # Tipi TypeScript
└── ThemeManager.tsx             # Componente principale
```

---

## 🔧 API E HOOK

### useThemeState()
```typescript
const { state, dispatch } = useThemeState();
const { isEditMode, isMiniPickerOpen, editingElement } = state;
```

### useThemeActions()
```typescript
const { 
  toggleEditMode, 
  openEditorAt, 
  applyPropertyChange,
  closeMiniPicker 
} = useThemeActions();
```

### useThemeEditor()
```typescript
const { isEditMode, createClickHandler } = useThemeEditor();

const handleBackgroundClick = createClickHandler('element-name', 'background');
const handleTextClick = createClickHandler('element-name', 'text');
```

### elementRegistry
```typescript
// Registrazione elemento
elementRegistry.register({
  id: 'sidebar-header',
  name: 'Header Sidebar',
  properties: { background: '#3b82f6', color: '#ffffff' },
  selector: '[data-theme-element="sidebar-header"]',
  editableProperties: ['background', 'color']
});

// Ricerca elemento
const element = elementRegistry.get('sidebar-header');
```

---

## 💡 ESEMPI DI UTILIZZO

### Componente Editabile Completo
```typescript
import { useThemeEditor } from '../../theme/hooks/useThemeEditor';

const MyComponent = () => {
  const { isEditMode, createClickHandler } = useThemeEditor();
  
  // Handler per editing
  const handleBackgroundClick = createClickHandler('my-element', 'background');
  const handleTextClick = createClickHandler('my-element', 'text');
  
  // Handler per comportamento normale
  const handleNormalClick = (e: React.MouseEvent) => {
    if (!isEditMode) {
      // Comportamento normale
      console.log('Clicked normally');
    }
  };
  
  return (
    <div 
      className="my-component"
      onClick={handleNormalClick}
      data-theme-element="my-element"
    >
      <div 
        className="background"
        onClick={handleBackgroundClick}
        style={{ cursor: isEditMode ? 'pointer' : 'default' }}
        data-theme-part="background"
      >
        <span 
          className="text"
          onClick={handleTextClick}
          style={{ cursor: isEditMode ? 'pointer' : 'default' }}
          data-theme-part="text"
        >
          Testo editabile
        </span>
      </div>
    </div>
  );
};
```

### Registrazione Elemento
```typescript
// In elementRegistry.ts
const defaultElements: ThemeElement[] = [
  {
    id: 'my-element',
    type: 'component',
    name: 'My Component',
    properties: { 
      background: '#ffffff', 
      color: '#000000' 
    },
    selector: '[data-theme-element="my-element"]',
    editableProperties: ['background', 'color']
  }
];
```

---

## 🧪 TESTING E DEBUG

### Test Funzionali
1. **Toggle Tema**: Verifica che il pulsante funzioni senza interferenze
2. **Accordion**: Verifica che si aprano/chiudano normalmente quando tema disattivato
3. **Editing**: Verifica che si apra il color picker quando tema attivo
4. **Applicazione**: Verifica che i colori vengano applicati correttamente
5. **Annullamento**: Verifica che "Annulla" ripristini il valore originale

### Debug Logging
```typescript
// Log strutturati per debug
console.log('🎨 openEditorAt chiamato:', { elementName, part, coordinates });
console.log('🎨 Componente cliccato:', { elementName, part, coordinates });
console.log('🎨 Applying property change:', { elementId, property, value });
```

### Checklist Testing
- [ ] Tema DISATTIVATO = Comportamento normale (accordion, pulsanti funzionano)
- [ ] Tema ATTIVO = Cursor pennello, editing funziona
- [ ] Click su background = Apre color picker per background
- [ ] Click su text = Apre color picker per text
- [ ] Conferma = Applica il colore
- [ ] Annulla = Ripristina valore originale
- [ ] Chiudi = Chiude il picker

---

## 🚨 PROBLEMI INCONTRATI E DA NON RIPETERE

### 1. Listener Globali (CRITICO - ROMPE TUTTO)
```typescript
// ❌ QUESTO HA ROTTO TUTTO
document.addEventListener('click', handleClick, true);
```
**Problemi causati:**
- Accordion non si aprivano più
- Pulsanti non funzionavano
- Select e input bloccati
- Interferenza con TUTTI gli elementi interattivi

**Soluzione corretta:**
- Handler specifici per ogni componente
- Nessun listener globale
- Ogni componente gestisce il proprio comportamento

### 2. Stato Complesso e Inconsistente
```typescript
// ❌ QUESTO HA CAUSATO CONFUSIONE TOTALE
const [isOpen, setIsOpen] = useState(false);
const [editingElement, setEditingElement] = useState(null);
const [editingProperty, setEditingProperty] = useState(null);
const [previewValue, setPreviewValue] = useState('');
const [originalValue, setOriginalValue] = useState('');
// ... 10 altri stati che si sovrapponevano
```
**Problemi causati:**
- Stati che si contraddicevano
- Re-render infiniti
- Difficile debugging
- Comportamenti imprevedibili

**Soluzione corretta:**
- Un solo reducer centralizzato
- Stato prevedibile e immutabile
- Azioni chiare e atomiche

### 3. MiniColorPicker Non Si Chiudeva
```typescript
// ❌ QUESTO HA FRUSTRATO L'UTENTE
// Il picker rimaneva aperto, non si chiudeva mai
// "non si chiude un cazzo" - feedback utente
```
**Problemi causati:**
- UX disastrosa
- Picker che rimaneva aperto
- Click fuori non funzionava
- Escape key ignorata

**Soluzione corretta:**
- Handler specifici per chiudere
- Click outside listener
- Escape key handler
- Stato centralizzato per visibilità

### 4. "Annulla" Non Ripristinava il Valore
```typescript
// ❌ QUESTO HA CONFUSO L'UTENTE
// "ero annulla non risptirsina forse no nsalvi il colore prima?"
```
**Problemi causati:**
- Valore originale perso
- Annulla non funzionava
- UX confusa

**Soluzione corretta:**
- Salvare valore originale all'apertura
- Funzione restoreOriginalValue
- Stato separato per preview vs applicato

### 5. Theme Toggle Non Togglava
```typescript
// ❌ QUESTO HA FRUSTRATO L'UTENTE
// "se riciclicco sul pulsante tema deve togglare tema/non tema"
// "no toggla. Se per risovere pb cosi banali impeghimao tutto questo tempo vuol dire che il codice fa schifi schifo"
```
**Problemi causati:**
- Pulsante non funzionava
- Listener globale interferiva
- Comportamento imprevedibile

**Soluzione corretta:**
- Handler specifico per il toggle
- data-theme-ignore per escludere
- Stato centralizzato per isEditMode

### 6. Accordion Non Si Aprivano Quando Tema Disattivato
```typescript
// ❌ QUESTO HA ROTTO LA FUNZIONALITÀ BASE
// "gli acocridon non si aprono opiu quando il theeme è disattivto deve eesere come prima il comportmanwto"
```
**Problemi causati:**
- Funzionalità base rotta
- UX disastrosa
- Utente frustrato

**Soluzione corretta:**
- Controllo `if (!isEditMode) return;` all'inizio
- Comportamento normale quando tema disattivato
- Separazione chiara tra editing e funzionalità

### 7. Errori di Build e Import
```typescript
// ❌ QUESTO HA BLOCCATO LO SVILUPPO
// "useThemeState.ts:23:27: ERROR: Expected ">" but found "value""
// "React is not defined"
// "Cannot find name 'useThemeManager'"
```
**Problemi causati:**
- Build che non partiva
- Import sbagliati
- File mancanti
- Tempo perso per fix

**Soluzione corretta:**
- Tipi TypeScript corretti
- Import espliciti
- File esistenti prima di referenziarli
- Test build dopo ogni modifica

### 8. Cursor Personalizzato Non Funzionava
```typescript
// ❌ QUESTO HA CONFUSO L'UX
// "non diventa neanche piu pennlo in nessun momento"
// "non è dentica ma facciamo un'altra cosa"
```
**Problemi causati:**
- Cursor non appariva
- Browser override
- SVG non corretto

**Soluzione corretta:**
- CSS con `!important`
- SVG data URL corretto
- Iniezione globale nel DOM

### 9. Elementi Non Registrati nel Registry
```typescript
// ❌ QUESTO HA IMPEDITO L'EDITING
// "non si apre nessun colorpicker"
// Elementi non trovati nel registry
```
**Problemi causati:**
- Editing non funzionava
- Elementi non trovati
- Funzionalità inutile

**Soluzione corretta:**
- Registrazione automatica elementi predefiniti
- Chiamata `registerDefaultElements()`
- Registry popolato all'avvio

### 10. Architettura Fragile e Imprevedibile
```typescript
// ❌ QUESTO È STATO IL PROBLEMA FONDAMENTALE
// "ma che archiettura di mera è se adgn i modifica si spacca ttuto!!!"
// "aspetta stronzo cerca di capirte porco dio!!!"
```
**Problemi causati:**
- Ogni modifica rompeva qualcos'altro
- Sistema instabile
- Tempo perso per fix
- Frustrazione estrema

**Soluzione corretta:**
- Architettura modulare
- Separazione delle responsabilità
- Test dopo ogni modifica
- Documentazione chiara

---

## 🎯 CONCLUSIONI

### Cosa Funziona
- Architettura modulare senza listener globali
- Separazione chiara delle responsabilità
- Stato centralizzato e prevedibile
- API pulite e facili da usare

### Cosa Evitare
- Listener globali su document
- Stato complesso e inconsistente
- Logica imperativa
- Manipolazione diretta del DOM

### Prossimi Passi
1. Implementare FASE 1 (Fondamenta)
2. Testare ogni fase prima di procedere
3. Mantenere codice pulito e documentato
4. Focus su funzionalità core prima di features avanzate

---

**NOTA**: Questo documento è la guida definitiva per implementare un sistema di theming robusto e manutenibile. Seguire rigorosamente questa architettura eviterà i problemi del passato. 


Criticità da monitorare (non errori, ma attenzione)
⚠️ 1. MiniPicker = UX doppia se non centralizzi focus
Se clicchi due volte in zone vicine e si aprono 2 pickers o si sovrappongono → disastro. Soluzione:

Garantire che ce ne sia uno solo aperto alla volta.

Quando si clicca su un'altra parte, il precedente si chiude.

⚠️ 2. CSS Variables vs inline
Nel doc dici:

document.documentElement.style.setProperty('--sidebar-header-bg', newColor);

Perfetto! Ma serve:

un mapping elementId + property → CSS var name

fallback per elementi dinamici (es. nodi flowchart creati runtime)

Ti suggerisco di introdurre una funzione:

ts
Copia
Modifica
getCssVarName(elementId: string, property: keyof ThemeProperties): string
🧠 Suggerimenti per migliorare ancora
💡 1. ThemeChangeTracker
Nel doc manca la parte che volevi implementare:

“una vista sinottica delle modifiche attive con preview/annulla/applica/reset”

Può essere una FASE 6. Ma consiglio di documentarla già, almeno nel file ThemeReducer.ts con:

ts
Copia
Modifica
interface ThemeChange {
  elementId: string;
  property: keyof ThemeProperties;
  oldValue: string;
  newValue: string;
}
💡 2. Test automatici
Nel blocco Testing e Debug, puoi aggiungere:

snapshot dei CSS variables prima/dopo

test su ThemeReducer per verifica pure function

simulate click per testare createClickHandler

🏁 Verdetto finale
🔒 Solido a livello architetturale
🧠 Intelligente per evitare errori futuri
📈 Scalabile per team o progetti crescenti

✅ Può diventare la base definitiva per il sistema di theming in OMNIA.