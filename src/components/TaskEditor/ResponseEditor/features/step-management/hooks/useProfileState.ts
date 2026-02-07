import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NLPProfile } from '@responseEditor/DataExtractionEditor';
import { getIsTesting } from '@responseEditor/testingState';
import { getNodeIdStrict, getNodeLabelStrict, getSubNodesStrict } from '@responseEditor/core/domain/nodeStrict';

// Helper functions
function toCommaList(list?: string[] | null): string {
  return Array.isArray(list) ? list.join(', ') : '';
}

function fromCommaList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);
}

function tryParseJSON<T = any>(text: string): { value?: T; error?: string } {
  const t = (text || '').trim();
  if (!t) return { value: undefined as any };
  try {
    return { value: JSON.parse(t) };
  } catch (e: any) {
    return { error: e?.message || 'JSON parse error' };
  }
}

function inferKindFromNode(n: any): string {
  const typeStr = String(n?.type || '').toLowerCase();
  const labelStr = String(n?.label || '').toLowerCase();
  if (/date|dob|birth/.test(typeStr) || /date|dob|birth/.test(labelStr)) return 'date';
  if (/email/.test(typeStr) || /email/.test(labelStr)) return 'email';
  if (/phone|tel/.test(typeStr) || /phone|tel/.test(labelStr)) return 'phone';
  if (/address/.test(typeStr) || /address/.test(labelStr)) return 'address';
  if (/name/.test(typeStr) || /name/.test(labelStr)) return 'name';
  if (/number|amount|qty|quantity/.test(typeStr) || /number|amount|qty|quantity/.test(labelStr)) return 'number';
  return 'generic';
}

/**
 * Hook for managing NLP profile state in DataExtractionEditor.
 * Handles kind, synonyms, regex, formatHints, examples, confidence, postProcess, waiting messages.
 */
export function useProfileState(
  node: any,
  locale: string,
  onChange?: (profile: NLPProfile) => void
) {
  // Compute initial profile from node
  const initial: NLPProfile = useMemo(() => {
    const p = (node && (node as any).nlpProfile) || {};

    // ✅ DEBUG: Log node.nlpProfile.examples quando viene calcolato initial
    const nodeExamples = Array.isArray(p.examples) ? p.examples : undefined;
    if (nodeExamples || p.examples !== undefined) {
      console.log('[useProfileState] Computing initial profile from node', {
        nodeId: node?.id,
        hasNlpProfile: !!(node as any)?.nlpProfile,
        nlpProfileKeys: (node as any)?.nlpProfile ? Object.keys((node as any).nlpProfile) : [],
        hasExamples: !!nodeExamples,
        examplesCount: nodeExamples?.length || 0,
        examples: nodeExamples?.slice(0, 3),
        hasTestNotes: !!(node as any)?.testNotes,
        testNotesCount: (node as any)?.testNotes ? Object.keys((node as any).testNotes).length : 0
      });
      }

      const result = {
      slotId: node ? (getNodeIdStrict(node) || getNodeLabelStrict(node) || 'slot') : 'slot',
      locale,
      kind: ((node?.kind && node.kind !== 'generic') ? node.kind : (p.kind && p.kind !== 'generic') ? p.kind : inferKindFromNode(node)) as string,
      synonyms: Array.isArray(p.synonyms)
        ? p.synonyms
        : Array.isArray((node as any)?.synonyms)
          ? (node as any).synonyms
          : [(node?.label || '').toString(), (node?.label || '').toString().toLowerCase()].filter(Boolean),
      regex: p.regex,
      testCases: Array.isArray(p.testCases) ? p.testCases : undefined,
      formatHints: Array.isArray(p.formatHints) ? p.formatHints : undefined,
      examples: Array.isArray(p.examples) ? p.examples : undefined,
      minConfidence: typeof p.minConfidence === 'number' ? p.minConfidence : 0.6,
      postProcess: p.postProcess,
      subSlots: p.subSlots,
      waitingEsc1: typeof p.waitingEsc1 === 'string' && p.waitingEsc1.trim() ? p.waitingEsc1 : 'Un istante…',
      waitingEsc2: typeof p.waitingEsc2 === 'string' && p.waitingEsc2.trim() ? p.waitingEsc2 : (node?.kind === 'intent' ? 'Un momento per favore, sto analizzando la sua richiesta' : 'Ancora un istante…'),
    };


    return result;
  }, [node, locale, (node as any)?.nlpProfile?.regex, (node as any)?.nlpProfile?.examples]); // ✅ Aggiunto nlpProfile.examples per reagire alle modifiche delle frasi

  const inferredKind = useMemo(() => inferKindFromNode(node), [node]);

  // State
  const [lockKind, setLockKind] = useState<boolean>(false);
  const [kind, setKindInternal] = useState<string>(initial.kind);
  const [synonymsText, setSynonymsText] = useState<string>(toCommaList(initial.synonyms));
  const [regex, setRegex] = useState<string>(initial.regex || '');
  const [formatText, setFormatText] = useState<string>(toCommaList(initial.formatHints));
  const [examplesList, setExamplesList] = useState<string[]>(Array.isArray(initial.examples) ? initial.examples : []);
  const [minConf, setMinConf] = useState<number>(initial.minConfidence || 0.6);
  const [postProcessText, setPostProcessText] = useState<string>(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
  const [waitingEsc1, setWaitingEsc1] = useState<string>(initial.waitingEsc1 || '');
  const [waitingEsc2, setWaitingEsc2] = useState<string>(initial.waitingEsc2 || '');
  const [jsonError, setJsonError] = useState<string | undefined>(undefined);
  // ✅ AGGIUNTO: stato locale per testCases per evitare race condition
  const [testCases, setTestCases] = useState<string[]>(initial.testCases || []);
  // Test case generation is now on-demand only, not automatic
  const lastNodeLabelRef = useRef<string>('');

  // Reset generation flag when node changes
  useEffect(() => {
    const currentLabel = node?.label || '';
    if (currentLabel !== lastNodeLabelRef.current) {
      lastNodeLabelRef.current = currentLabel;
    }
  }, [node?.label]);

  // ✅ CRITICAL: Sync local regex state when initial.regex changes (from contract sync)
  // This ensures that when node.nlpProfile.regex is updated by handleContractChange,
  // the local state is updated and useExtractionTesting receives the correct regex
  useEffect(() => {
    const newRegex = initial.regex || '';
    // Only update if different to avoid unnecessary re-renders
    if (regex !== newRegex) {
      console.log('[useProfileState] Syncing regex state', {
        oldRegex: regex || '(empty)',
        newRegex: newRegex || '(empty)',
        initialRegex: initial.regex || '(empty)',
        nodeNlpProfileRegex: (node as any)?.nlpProfile?.regex || '(empty)'
      });
      setRegex(newRegex);
    }
  }, [initial.regex]); // ✅ Only depend on initial.regex, not node (to avoid excessive re-renders)

  // Recommended defaults per kind
  const recommendedForKind = useCallback((k: string) => {
    const s = (k || '').toLowerCase();
    if (s === 'phone') {
      return {
        synonyms: 'phone, telefono, cellulare, mobile, numero di telefono',
        formats: 'E.164, +39 333 1234567',
        examples: ['+39 333 1234567', '3331234567', '0039 333 1234567'],
        min: 0.9,
      };
    }
    if (s === 'email') {
      return {
        synonyms: 'email, e-mail, indirizzo email',
        formats: 'local@domain.tld',
        examples: ['mario.rossi@example.com'],
        min: 0.9,
      };
    }
    if (s === 'date') {
      return {
        synonyms: 'date of birth, data di nascita, dob, birth date',
        formats: 'dd/MM/yyyy, d/M/yyyy, d MMMM yyyy, d MMM yyyy',
        examples: ['16/12/1961', '16 dicembre 1961'],
        min: 0.85,
      };
    }
    if (s === 'name') {
      return {
        synonyms: 'full name, nome completo, name',
        formats: '',
        examples: ['Mario Rossi'],
        min: 0.8,
      };
    }
    if (s === 'address') {
      return {
        synonyms: 'address, indirizzo, via, civico, cap, città',
        formats: 'street, house number, city, postal code, country',
        examples: ['via Chiabrera 25, 15011 Acqui Terme, Italia'],
        min: 0.8,
      };
    }
    if (s === 'number') {
      return {
        synonyms: 'number, quantity, amount, numero',
        formats: 'integer, decimal',
        examples: ['42', '3.14'],
        min: 0.8,
      };
    }
    return { synonyms: '', formats: '', examples: [], min: 0.6 };
  }, []);

  // Track if kind change is user-initiated (not from sync)
  const isUserKindChangeRef = useRef<boolean>(false);

  // When Kind changes (user-initiated), re-seed editor fields with recommended defaults
  const prevKindRef = useRef<string>(initial.kind);
  useEffect(() => {
    // Skip if this is a sync (not user change)
    if (!isUserKindChangeRef.current) {
      prevKindRef.current = kind;
      isUserKindChangeRef.current = false; // Reset flag
      return;
    }

    if (kind && kind !== prevKindRef.current) {
      const r = recommendedForKind(kind);
      setSynonymsText(r.synonyms);
      setFormatText(r.formats);
      setExamplesList(r.examples); // Load recommended examples for the new Kind
      setMinConf(r.min);
      // Only reset regex/postProcess on user-initiated kind change
      setRegex('');
      setPostProcessText('');
    }
    prevKindRef.current = kind;
    isUserKindChangeRef.current = false; // Reset flag after processing
  }, [kind, recommendedForKind, node]);

  // Sync form when node changes (use stable dependency to avoid loops)
  const prevSlotIdRef = useRef<string>('');
  // ✅ RIMOSSO: prevExamplesRef - non serve più sincronizzare examples quando cambia initial.examples
  // examplesList è ora uno stato diretto, non derivato (come testCases)

  useEffect(() => {
    const currentSlotId = initial.slotId;

    // ✅ SEMPLIFICATO: Sincronizza SOLO quando cambia il nodo (slotId)
    // NON quando cambia initial.examples per lo stesso nodo (evita race condition)
    const shouldSync = currentSlotId !== prevSlotIdRef.current;

    if (!shouldSync) return;

    prevSlotIdRef.current = currentSlotId;

    // Mark that this is NOT a user-initiated kind change
    isUserKindChangeRef.current = false;

    setLockKind(false);
    setKindInternal(initial.kind); // Use internal setter to avoid marking as user change
    try {
      // Sync from node
    } catch { }

    // ✅ PULITO: Una sola volta, senza duplicati
    setSynonymsText(toCommaList(initial.synonyms));
    setRegex(initial.regex || ''); // IMPORTANT: Load regex from initial profile (don't reset!)
    setTestCases(initial.testCases || []);
    setFormatText(toCommaList(initial.formatHints));
    setExamplesList(Array.isArray(initial.examples) ? initial.examples : []);
    setMinConf(initial.minConfidence || 0.6);
    setPostProcessText(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
    setWaitingEsc1(initial.waitingEsc1 || '');
    setWaitingEsc2(initial.waitingEsc2 || '');
  }, [initial.slotId]); // ✅ RIMOSSO initial.examples - sincronizza solo quando cambia nodo

  // ✅ CRITICAL FIX: Sincronizza regex quando node.nlpProfile.regex cambia (da contract sync)
  // Questo assicura che quando il contract viene sincronizzato con node.nlpProfile.regex,
  // lo stato locale regex viene aggiornato immediatamente
  const prevNlpProfileRegexRef = useRef<string | undefined>(initial.regex);
  useEffect(() => {
    const currentRegex = initial.regex;
    // ✅ Solo se è cambiato E non è vuoto (per evitare di resettare quando l'utente cancella)
    if (currentRegex !== prevNlpProfileRegexRef.current && currentRegex) {
      console.log('[useProfileState] Syncing regex from node.nlpProfile', {
        oldRegex: prevNlpProfileRegexRef.current || '(empty)',
        newRegex: currentRegex || '(empty)',
        'will update state': true
      });
      prevNlpProfileRegexRef.current = currentRegex;
      setRegex(currentRegex);
    } else if (currentRegex !== prevNlpProfileRegexRef.current) {
      // ✅ Aggiorna il ref anche se non aggiorniamo lo stato (per tracciare cambiamenti)
      prevNlpProfileRegexRef.current = currentRegex;
    }
  }, [initial.regex]);

  // ✅ Sync testCases quando riapri l'editor (initial.testCases cambia) MA solo se lo stato locale è vuoto
  // Questo gestisce il caso in cui il componente non viene smontato quando chiudi l'editor
  const isFirstMountTestCasesRef = useRef(true);
  useEffect(() => {
    if (isFirstMountTestCasesRef.current) {
      isFirstMountTestCasesRef.current = false;
      return; // Prima volta: già inizializzato con useState
    }

    // Se lo stato locale è vuoto, sincronizza con initial (riaprimento editor)
    if (testCases.length === 0 && (initial.testCases || []).length > 0) {
      setTestCases(initial.testCases || []);
    }
  }, [initial.testCases]);

  // ✅ CRITICAL: Sync examplesList quando initial.examples cambia (riaprimento editor o reload)
  // Questo gestisce il caso in cui il componente non viene smontato quando chiudi l'editor
  const prevInitialExamplesRef = useRef<string[] | undefined>(initial.examples);
  useEffect(() => {
    const currentExamples = initial.examples || [];
    const prevExamples = prevInitialExamplesRef.current || [];

    // ✅ Sincronizza se initial.examples è cambiato (riaprimento editor o reload)
    // Confronta array per vedere se sono diversi
    const hasChanged =
      currentExamples.length !== prevExamples.length ||
      currentExamples.some((ex, idx) => ex !== prevExamples[idx]);

    if (hasChanged) {
      console.log('[useProfileState] Syncing examplesList from node', {
        prevCount: prevExamples.length,
        newCount: currentExamples.length,
        prevExamples: prevExamples.slice(0, 3),
        newExamples: currentExamples.slice(0, 3)
      });
      prevInitialExamplesRef.current = currentExamples;
      setExamplesList(currentExamples);
    } else {
      // Aggiorna il ref anche se non cambia (per tracciare)
      prevInitialExamplesRef.current = currentExamples;
    }
  }, [initial.examples]);

  // Keep kind synced with inferred when lockKind is enabled
  useEffect(() => {
    if (lockKind) {
      isUserKindChangeRef.current = false; // LockKind is not a "change kind" action (don't reset regex)
      setKindInternal('auto');
    }
  }, [lockKind, inferredKind, node]);

  // Test case generation is now on-demand only (via button/action in UI)
  // No automatic generation on mount

  // Build profile object
  const profile: NLPProfile = useMemo(() => {
    const syns = fromCommaList(synonymsText);
    const formats = fromCommaList(formatText);
    const ex = examplesList;
    const post = tryParseJSON(postProcessText);
    setJsonError(post.error);
    const subNodes = getSubNodesStrict(node);
    const autoSubSlots = subNodes.length > 0
      ? subNodes.map((s: any) => ({
        slotId: getNodeIdStrict(s) || String(getNodeLabelStrict(s) || '').toLowerCase().replace(/\s+/g, '_'),
        label: getNodeLabelStrict(s)
      }))
      : undefined;

    const out = {
      slotId: initial.slotId,
      locale: initial.locale,
      kind: (kind === 'generic' && (node?.kind && node.kind !== 'generic')) ? node.kind : kind,
      synonyms: syns,
      regex: regex || undefined,
      testCases: testCases.length > 0 ? testCases : undefined, // ✅ Usa stato locale invece di node
      formatHints: formats.length ? formats : undefined,
      examples: ex.length ? ex : undefined,
      minConfidence: minConf,
      postProcess: post.error ? undefined : post.value,
      subSlots: autoSubSlots,
      waitingEsc1: waitingEsc1 || undefined,
      waitingEsc2: waitingEsc2 || undefined,
    };


    return out;
  }, [initial.slotId, initial.locale, kind, synonymsText, regex, testCases, formatText, examplesList, minConf, postProcessText, waitingEsc1, waitingEsc2, node]);

  // Ensure latest profile is flushed on unmount
  const profileRef = useRef<NLPProfile | null>(null);
  const onChangeRef = useRef(onChange);
  const nodeRef = useRef(node);

  // Keep refs updated
  useEffect(() => {
    profileRef.current = profile;
    onChangeRef.current = onChange;
    nodeRef.current = node;
  }, [profile, onChange, node]);

  useEffect(() => {
    return () => {
      try { if (profileRef.current) onChangeRef.current?.(profileRef.current); } catch { }
    };
  }, []);

  // Emit onChange when profile changes
  // ✅ SEMPLIFICATO: onChange viene chiamato direttamente quando cambia il profile
  // ✅ BATCH TESTING: Block onChange during batch testing to prevent feedback loops
  const lastSentJsonRef = useRef<string>('');
  const isTestingRef = useRef<boolean>(false);

  // ✅ Keep testing state ref in sync
  useEffect(() => {
    isTestingRef.current = getIsTesting();
  });

  useEffect(() => {
    // ✅ CRITICAL: Block onChange during batch testing - CHECK FIRST
    if (getIsTesting() || isTestingRef.current) {
      return;
    }

    // ✅ CRITICAL: Exclude examples and autoSubSlots from profile comparison
    // These are only for testing/UI and should not trigger onChange
    const { examples, subSlots, testCases, ...profileCore } = profile;
    const json = JSON.stringify(profileCore);

    // ✅ DOUBLE CHECK: Se siamo entrati in testing mode durante la serializzazione
    if (getIsTesting() || isTestingRef.current) {
      return;
    }

    if (json !== lastSentJsonRef.current) {
      lastSentJsonRef.current = json;

      // ✅ TRIPLE CHECK: Prima di emettere onChange, verifica ancora
      if (getIsTesting() || isTestingRef.current) {
        return;
      }

      // ✅ Emit onChange with FULL profile (for saving), but only when CORE fields change
      // This prevents onChange from being triggered when only examples/subSlots/testCases change
      onChangeRef.current?.(profile);
    }
  }, [profile]);

  // Wrapper for setKind that marks user-initiated changes
  const setKindUser = useCallback((newKind: string) => {
    isUserKindChangeRef.current = true;
    setKindInternal(newKind);
  }, []);

  return {
    // State
    lockKind,
    setLockKind,
    kind,
    setKind: setKindUser, // Use wrapper to track user changes
    inferredKind,
    synonymsText,
    setSynonymsText,
    regex,
    setRegex,
    formatText,
    setFormatText,
    examplesList,
    setExamplesList,
    minConf,
    setMinConf,
    postProcessText,
    setPostProcessText,
    waitingEsc1,
    setWaitingEsc1,
    waitingEsc2,
    setWaitingEsc2,
    jsonError,
    // Test Cases
    testCases,
    setTestCases,
    // Computed
    profile,
    initial,
  };
}

