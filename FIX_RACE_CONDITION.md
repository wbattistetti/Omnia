# Fix Finale - Test Cases che Scompaiono (Race Condition Risolta)

## Problema Identificato

Dopo l'implementazione della riscrittura pulita con `selectedNode` come stato diretto, i test cases continuavano a scomparire. Il problema era una **race condition** nel flusso di aggiornamento:

### Sequenza Problematica

1. User aggiunge "test1" in `TestValuesColumn`
2. `setTestCases(["test1"])` viene chiamato in `RegexInlineEditor`
3. `RegexInlineEditor` chiama `onProfileUpdate({ ...profile, testCases: ["test1"] })`
4. **MA** `profile` era costruito da `useProfileState` che leggeva `testCases` dal `node.nlpProfile.testCases`
5. Il `node` prop **non era ancora aggiornato** perché React non aveva fatto re-render
6. Quindi `profile.testCases` era ancora `[]` (vuoto)
7. `handleProfileUpdate` aggiornava `selectedNode` con `testCases: []`
8. I test cases scomparivano immediatamente

### Root Cause

```typescript
// ❌ PROBLEMA: profile legge testCases dal node che non è ancora aggiornato
const profile: NLPProfile = useMemo(() => {
  const nodeProfile = (node && (node as any).nlpProfile) || {};
  const currentTestCases = Array.isArray(nodeProfile.testCases)
    ? nodeProfile.testCases
    : undefined;

  return {
    // ...
    testCases: currentTestCases, // ← Legge dal node vecchio!
  };
}, [node, (node as any)?.nlpProfile?.testCases, ...]);
```

## Soluzione Implementata

### 1. Stato Locale per testCases in useProfileState

**File: `src/components/ActEditor/ResponseEditor/hooks/useProfileState.ts`**

```typescript
// ✅ AGGIUNTO: stato locale per testCases per evitare race condition
const [testCases, setTestCases] = useState<string[]>(initial.testCases || []);

// Build profile object
const profile: NLPProfile = useMemo(() => {
  // ...
  return {
    // ...
    testCases: testCases.length > 0 ? testCases : undefined, // ✅ Usa stato locale
  };
}, [initial.slotId, initial.locale, kind, synonymsText, regex, testCases, ...]);

// Export testCases e setTestCases
return {
  // ...
  testCases,
  setTestCases,
  profile,
};
```

### 2. Passaggio Diretto di testCases agli Inline Editors

**File: `src/components/ActEditor/ResponseEditor/NLPExtractorProfileEditor.tsx`**

```typescript
// Estrae testCases e setTestCases da useProfileState
const {
  // ...
  testCases,
  setTestCases,
  profile,
} = useProfileState(node, locale, onChange);

// Passa direttamente agli inline editors
<RegexInlineEditor
  regex={regex}
  setRegex={setRegex}
  node={node}
  profile={profile}
  testCases={testCases}        // ✅ Passato direttamente
  setTestCases={setTestCases}  // ✅ Passato direttamente
  onProfileUpdate={(updatedProfile) => {
    onChange?.(updatedProfile);
  }}
/>
```

### 3. Uso Diretto del Setter negli Inline Editors

**File: `src/components/ActEditor/ResponseEditor/InlineEditors/RegexInlineEditor.tsx`**

```typescript
interface RegexInlineEditorProps {
  // ...
  testCases?: string[]; // ✅ Test cases passed directly
  setTestCases?: (cases: string[]) => void; // ✅ Setter passed directly
}

export default function RegexInlineEditor({
  regex,
  setRegex,
  profile,
  testCases: testCasesProp,
  setTestCases: setTestCasesProp,
  onProfileUpdate,
}: RegexInlineEditorProps) {
  // ✅ Usa testCases da props (stato locale) invece di profile (node vecchio)
  const testCases = testCasesProp || profile?.testCases || [];

  const setTestCases = React.useCallback((cases: string[]) => {
    // ✅ Usa setter diretto se disponibile (evita race condition)
    if (setTestCasesProp) {
      setTestCasesProp(cases);
    } else if (onProfileUpdate && profile) {
      // Fallback: aggiorna tramite onProfileUpdate
      onProfileUpdate({ ...profile, testCases: cases });
    }
  }, [setTestCasesProp, profile, onProfileUpdate]);

  // ...
}
```

### 4. Stesso Pattern per Tutti gli Inline Editors

Applicato lo stesso pattern a:
- ✅ `RegexInlineEditor.tsx`
- ✅ `ExtractorInlineEditor.tsx`
- ✅ `NERInlineEditor.tsx`
- ✅ `LLMInlineEditor.tsx`

## Flusso Corretto Finale

```
User: digita "test1" e preme Enter
  ↓
TestValuesColumn.handleAddTestCase()
  ↓
onTestCasesChange([...testCases, "test1"])
  ↓
RegexInlineEditor.setTestCases(["test1"])
  ↓
setTestCasesProp(["test1"]) // ← Chiama il setter da useProfileState
  ↓
useProfileState: setTestCases(["test1"]) // ← Aggiorna stato locale
  ↓
profile = useMemo(() => ({ ...other, testCases: ["test1"] })) // ← Ricalcola con nuovo stato
  ↓
useEffect in useProfileState: onChange(profile) // ← Emette onChange
  ↓
ResponseEditor.handleProfileUpdate(profile) // ← Aggiorna selectedNode e localDDT
  ↓
React re-render
  ↓
useProfileState riceve node aggiornato
  ↓
profile.testCases: ["test1"] // ← Sempre corretto perché usa stato locale
  ↓
TestValuesColumn riceve testCases: ["test1"]
  ↓
✅ Griglia mostra "test1" stabilmente (nessuna race condition)
```

## Vantaggi della Soluzione

1. ✅ **Elimina Race Condition**: `testCases` vive nello stato locale, non dipende dal `node` prop
2. ✅ **Aggiornamenti Immediati**: Il setter aggiorna lo stato locale direttamente
3. ✅ **Sincronizzazione Garantita**: `useEffect` in `useProfileState` sincronizza con il nodo
4. ✅ **Backward Compatible**: Fallback a `onProfileUpdate` se `setTestCasesProp` non disponibile
5. ✅ **Consistente**: Stesso pattern per tutti gli inline editors

## File Modificati

- ✅ `src/components/ActEditor/ResponseEditor/hooks/useProfileState.ts` - Stato locale per testCases
- ✅ `src/components/ActEditor/ResponseEditor/NLPExtractorProfileEditor.tsx` - Passaggio props
- ✅ `src/components/ActEditor/ResponseEditor/InlineEditors/RegexInlineEditor.tsx` - Uso diretto setter
- ✅ `src/components/ActEditor/ResponseEditor/InlineEditors/ExtractorInlineEditor.tsx` - Uso diretto setter
- ✅ `src/components/ActEditor/ResponseEditor/InlineEditors/NERInlineEditor.tsx` - Uso diretto setter
- ✅ `src/components/ActEditor/ResponseEditor/InlineEditors/LLMInlineEditor.tsx` - Uso diretto setter

## Risultato

✅ **Race condition risolta**: I test cases ora vengono aggiunti e rimangono visibili stabilmente
✅ **Architettura robusta**: Stato locale + sync con node = nessuna perdita di dati
✅ **Codice pulito**: Pattern consistente e manutenibile

