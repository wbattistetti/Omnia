# Resoconto Tecnico: Dialog Contract Update non funzionante

## 📋 Contesto e Requisiti

### Obiettivo
Quando un utente modifica un `dataContract` (es. regex) in `RecognitionEditor`, il sistema deve:
1. **Tracciare** le modifiche in memoria (NON salvare subito)
2. Alla **chiusura** del `ResponseEditor`, verificare se ci sono modifiche non salvate
3. Se ci sono modifiche, **mostrare un dialog** che chiede all'utente:
   - Aggiornare il template esistente
   - Creare un nuovo template versionato
   - Annullare (blocca la chiusura del ResponseEditor)

### Requisiti specifici
- Dialog deve apparire **solo alla chiusura**, non durante la modifica
- Dialog deve essere **dentro ResponseEditor** (non fullscreen overlay esterno)
- Se l'utente preme "Annulla", il ResponseEditor **NON deve chiudersi**
- Il testo del dialog deve essere semplificato: "Hai modificato i contracts per questo dato. Vuoi aggiornare il template o crearne uno nuovo?"

---

## 🏗️ Architettura Implementata

### 1. Componenti Coinvolti

#### `ResponseEditor/index.tsx` (Componente principale)
- **Stato dialog**: `showContractDialog`, `pendingContractChange`
- **Ref per comunicazione**: `contractChangeRef` (React.useRef)
- **Handler chiusura**: `handleEditorClose` - verifica modifiche prima di chiudere

#### `RecognitionEditor.tsx` (Componente che gestisce i contracts)
- **Stato modifiche**: `hasUnsavedContractChanges`, `modifiedContract`
- **Handler modifiche**: `handleContractChange` - traccia modifiche senza mostrare dialog
- **Comunicazione**: Usa `useImperativeHandle` + aggiornamento diretto del ref

#### `ContractUpdateDialog.tsx` (Dialog modale)
- Dialog semplice con 3 opzioni: Aggiorna template, Crea nuovo, Annulla
- Posizionato dentro ResponseEditor con `position: absolute`

### 2. Flusso di Dati

```
[Utente modifica regex]
    ↓
RecognitionEditor.handleContractChange()
    ↓
- Confronta con template.dataContract
- Se diverso:
  - setHasUnsavedContractChanges(true)
  - setModifiedContract(updatedContract)
  - contractChangeRef.current = { hasUnsavedChanges: true, ... }
    ↓
[Utente chiude ResponseEditor]
    ↓
ResponseEditor.handleEditorClose()
    ↓
- Legge contractChangeRef.current
- Se hasUnsavedChanges === true:
  - setShowContractDialog(true)
  - return (blocca chiusura)
    ↓
[Dialog appare]
    ↓
[Utente sceglie azione]
    ↓
- Aggiorna template O crea nuovo template
- Chiude dialog
- Procede con chiusura ResponseEditor
```

---

## 🔍 Implementazione Dettagliata

### File: `ResponseEditor/index.tsx`

#### Dichiarazione stato e ref (linee ~110-124)
```typescript
const [showContractDialog, setShowContractDialog] = React.useState(false);
const [pendingContractChange, setPendingContractChange] = React.useState<{
  templateId: string;
  templateLabel: string;
  modifiedContract: any;
} | null>(null);

const contractChangeRef = React.useRef<{
  hasUnsavedChanges: boolean;
  modifiedContract: any;
  nodeTemplateId: string | undefined;
  nodeLabel: string | undefined;
}>({ hasUnsavedChanges: false, modifiedContract: null, nodeTemplateId: undefined, nodeLabel: undefined });
```

#### Verifica modifiche in handleEditorClose (linee ~573-598)
```typescript
const handleEditorClose = React.useCallback(async () => {
  // ... log iniziale ...

  // ✅ Verifica se ci sono modifiche ai contracts non salvate
  const contractChange = contractChangeRef.current;
  console.log('[ResponseEditor][CLOSE] 🔍 Checking contract changes', {
    hasUnsavedChanges: contractChange?.hasUnsavedChanges,
    hasModifiedContract: !!contractChange?.modifiedContract,
    nodeTemplateId: contractChange?.nodeTemplateId,
    nodeLabel: contractChange?.nodeLabel,
    refKeys: contractChange ? Object.keys(contractChange) : [],
    refValue: contractChange
  });

  if (contractChange?.hasUnsavedChanges && contractChange.modifiedContract && contractChange.nodeTemplateId) {
    // ✅ Mostra dialog e blocca chiusura
    const template = DialogueTaskService.getTemplate(contractChange.nodeTemplateId);
    setPendingContractChange({
      templateId: contractChange.nodeTemplateId,
      templateLabel: template?.label || contractChange.nodeLabel || 'Template',
      modifiedContract: contractChange.modifiedContract
    });
    setShowContractDialog(true);
    return; // ✅ Blocca chiusura
  }

  // ... resto della logica di chiusura ...
}, [/* dipendenze */]);
```

#### Passaggio ref a NLPExtractorProfileEditor (linea ~1952)
```typescript
<NLPExtractorProfileEditor
  // ... altri props ...
  contractChangeRef={contractChangeRef}
/>
```

### File: `RecognitionEditor.tsx`

#### Tracciamento modifiche (linee ~224-280)
```typescript
const handleContractChange = useCallback((updatedContract: DataContract | null) => {
  const node = editorProps?.node;
  if (!node || !node.templateId) return;

  const nodeTemplateId = node.templateId;
  const changed = hasContractChanged(nodeTemplateId, updatedContract);

  if (changed) {
    // ✅ Contract modificato: traccia ma NON mostra dialog
    setHasUnsavedContractChanges(true);
    setModifiedContract(updatedContract);
    setLocalContract(updatedContract);

    // ✅ Aggiorna immediatamente il ref (non aspetta useImperativeHandle)
    if (contractChangeRef) {
      contractChangeRef.current = {
        hasUnsavedChanges: true,
        modifiedContract: updatedContract,
        nodeTemplateId: node.templateId,
        nodeLabel: node.label
      };
      console.log('[CONTRACT] CHANGE - Ref updated immediately', {
        hasUnsavedChanges: contractChangeRef.current.hasUnsavedChanges,
        nodeTemplateId: contractChangeRef.current.nodeTemplateId
      });
    }
  } else {
    // Reset se non ci sono modifiche
    setHasUnsavedContractChanges(false);
    setModifiedContract(null);
    if (contractChangeRef) {
      contractChangeRef.current = {
        hasUnsavedChanges: false,
        modifiedContract: null,
        nodeTemplateId: node.templateId,
        nodeLabel: node.label
      };
    }
  }
}, [editorProps?.node, hasContractChanged, contractChangeRef]);

// ✅ Esponi anche tramite useImperativeHandle (backup)
React.useImperativeHandle(contractChangeRef, () => ({
  hasUnsavedChanges: hasUnsavedContractChanges,
  modifiedContract,
  nodeTemplateId: editorProps?.node?.templateId,
  nodeLabel: editorProps?.node?.label
}), [hasUnsavedContractChanges, modifiedContract, editorProps?.node]);
```

### File: `NLPExtractorProfileEditor.tsx`

#### Passaggio ref a RecognitionEditor (linea ~436)
```typescript
<RecognitionEditor
  // ... altri props ...
  contractChangeRef={contractChangeRef}
/>
```

---

## ❌ Problema Attuale

### Sintomi
- L'utente modifica il regex (es. `\bgiorno\b` → `\bgiorno\bddd`)
- I log mostrano che le modifiche vengono tracciate correttamente:
  ```
  [CONTRACT] CHANGE - Contract modified, tracking for later
  [CONTRACT] CHANGE - Ref updated immediately
  ```
- L'utente chiude il ResponseEditor
- **Il dialog NON appare**
- Il ResponseEditor si chiude normalmente senza mostrare il dialog

### Log Mancanti
Nei log forniti dall'utente **NON compare**:
- `[ResponseEditor][CLOSE] 🚪 Editor close initiated`
- `[ResponseEditor][CLOSE] 🔍 Checking contract changes`

Questo suggerisce che:
1. `handleEditorClose` **non viene chiamato**, OPPURE
2. Il ref `contractChangeRef.current` è vuoto/resettato quando viene letto

---

## 🔬 Punti Critici da Verificare

### 1. Verificare se `handleEditorClose` viene chiamato
**File**: `ResponseEditor/index.tsx` linea ~1447
```typescript
<EditorHeader
  onClose={handleEditorClose}  // ← Verificare che questo sia effettivamente chiamato
/>
```

**Possibili problemi**:
- `EditorHeader` potrebbe chiamare direttamente `onClose` prop invece di `handleEditorClose`
- Potrebbe esserci un altro punto di chiusura che bypassa `handleEditorClose`

### 2. Verificare sincronizzazione del ref
**Problema potenziale**: Il ref viene aggiornato in `RecognitionEditor`, ma quando `handleEditorClose` legge `contractChangeRef.current`, potrebbe essere:
- Non ancora aggiornato (race condition)
- Resettato da qualche altro codice
- Il ref non è lo stesso oggetto (problema di riferimento)

### 3. Verificare lifecycle del componente
**Possibile problema**: Quando il ResponseEditor si chiude, `RecognitionEditor` potrebbe essere smontato prima che `handleEditorClose` legga il ref, causando la perdita dello stato.

### 4. Verificare se il ref viene passato correttamente
**Chain di passaggio**:
```
ResponseEditor (crea ref)
  → NLPExtractorProfileEditor (riceve ref)
    → RecognitionEditor (riceve ref)
```

Verificare che il ref sia lo stesso oggetto in tutta la catena.

---

## 🛠️ Debug Suggeriti

### 1. Aggiungere log nel punto di chiusura
```typescript
// In EditorHeader o dove viene chiamato onClose
console.log('[EditorHeader] onClose called', {
  hasHandleEditorClose: !!handleEditorClose,
  handleEditorCloseType: typeof handleEditorClose
});
```

### 2. Verificare valore del ref prima della chiusura
```typescript
// In handleEditorClose, PRIMA di leggere contractChangeRef
console.log('[ResponseEditor][CLOSE] Ref state BEFORE check', {
  refExists: !!contractChangeRef,
  refCurrent: contractChangeRef?.current,
  refCurrentKeys: contractChangeRef?.current ? Object.keys(contractChangeRef.current) : []
});
```

### 3. Verificare se RecognitionEditor è ancora montato
```typescript
// In RecognitionEditor, quando viene smontato
useEffect(() => {
  return () => {
    console.log('[RecognitionEditor] UNMOUNTING', {
      hasUnsavedChanges,
      contractChangeRefCurrent: contractChangeRef?.current
    });
  };
}, []);
```

### 4. Verificare se il ref viene resettato da qualche parte
Cercare nel codice tutte le occorrenze di:
```typescript
contractChangeRef.current = { hasUnsavedChanges: false, ... }
```

---

## 📝 Note Aggiuntive

### Doppio meccanismo di aggiornamento ref
Attualmente il ref viene aggiornato in due modi:
1. **Direttamente** in `handleContractChange` (linea ~254-265)
2. **Tramite useImperativeHandle** (linea ~282-290)

Questo potrebbe causare conflitti o race conditions.

### Timing del ref update
Il ref viene aggiornato **sincronamente** quando cambia il contract, ma `useImperativeHandle` potrebbe sovrascriverlo in un momento successivo con valori diversi.

### Possibile soluzione alternativa
Invece di usare un ref, considerare:
- **Context API** per condividere lo stato delle modifiche
- **Callback prop** che viene chiamato quando cambia lo stato
- **Event emitter** per comunicare tra componenti

---

## ✅ Soluzione Implementata

### Problema Identificato
`handleEditorClose` non viene mai chiamato perché:
1. `hideHeader={true}` → `EditorHeader` non viene renderizzato → nessun pulsante che chiami `handleEditorClose`
2. `tab.onClose` non è definito quando viene creato il tab
3. Quando l'utente clicca la X del tab, `DockManager` chiama `tab.onClose(t)` (che non esiste) e poi chiude direttamente il tab

### Soluzione Implementata

#### 1. AppContent crea un ref per la funzione di chiusura
```typescript
// In AppContent.tsx, dentro UnifiedTabContent quando tab.type === 'responseEditor'
const editorCloseRef = React.useRef<null | (() => Promise<void>)>(null);
```

#### 2. Passa un setter a ResponseEditor
```typescript
<ResponseEditor
  // ... altri props ...
  registerOnClose={(fn) => { editorCloseRef.current = fn; }}
/>
```

#### 3. ResponseEditor registra handleEditorClose
```typescript
// In ResponseEditor/index.tsx
React.useEffect(() => {
  if (registerOnClose) {
    registerOnClose(handleEditorClose);
    console.log('[ResponseEditor] ✅ Registered handleEditorClose in ref');
  }
}, [registerOnClose, handleEditorClose]);
```

#### 4. Quando il tab viene creato/aggiornato, imposta tab.onClose
```typescript
// In AppContent.tsx
React.useEffect(() => {
  if (tab.type === 'responseEditor' && tab.id && setDockTree) {
    setDockTree(prev =>
      mapNode(prev, n => {
        if (n.kind === 'tabset') {
          const idx = n.tabs.findIndex(t => t.id === tab.id);
          if (idx !== -1 && n.tabs[idx].type === 'responseEditor') {
            const updatedTab = {
              ...n.tabs[idx],
              onClose: async (tab: DockTabResponseEditor) => {
                // ✅ Chiama handleEditorClose tramite ref
                if (editorCloseRef.current) {
                  await editorCloseRef.current();
                }
              }
            } as DockTabResponseEditor;
            return {
              ...n,
              tabs: [
                ...n.tabs.slice(0, idx),
                updatedTab,
                ...n.tabs.slice(idx + 1)
              ]
            };
          }
        }
        return n;
      })
    );
  }
}, [tab.id, tab.type, setDockTree]);
```

### Vantaggi della Soluzione
- ✅ Non modifica `DockManager`
- ✅ Non cambia la struttura del tab
- ✅ `ResponseEditor` non dipende da `DockManager`
- ✅ `handleEditorClose` rimane incapsulato dentro `ResponseEditor`
- ✅ Il tab diventa finalmente capace di eseguire la logica di chiusura corretta

### Flusso Completo
1. Utente modifica contract → `RecognitionEditor` traccia modifiche in `contractChangeRef`
2. Utente clicca X del tab → `DockManager` chiama `tab.onClose(t)`
3. `tab.onClose` chiama `editorCloseRef.current()` → `handleEditorClose()`
4. `handleEditorClose` verifica `contractChangeRef.current.hasUnsavedChanges`
5. Se `true` → mostra dialog e blocca chiusura
6. Se `false` → procede con chiusura normale chiamando `onClose()`

## 🎯 Prossimi Passi

1. ✅ **Implementata** la soluzione corretta con ref pattern
2. **Testare** il flusso completo:
   - Modificare un contract
   - Chiudere il ResponseEditor
   - Verificare che il dialog appaia
   - Testare tutte e tre le opzioni (Aggiorna, Crea nuovo, Annulla)

---

## 📁 File Modificati

- `src/components/TaskEditor/ResponseEditor/index.tsx`
- `src/components/TaskEditor/ResponseEditor/RecognitionEditor.tsx`
- `src/components/TaskEditor/ResponseEditor/NLPExtractorProfileEditor.tsx`
- `src/components/TaskEditor/ResponseEditor/ContractUpdateDialog.tsx`
