import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NLPProfile } from '../NLPExtractorProfileEditor';

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
 * Hook for managing NLP profile state in NLPExtractorProfileEditor.
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
    try { console.log('[KindPersist][ProfileEditor][initial]', { nodeLabel: node?.label, nodeKind: node?.kind, manual: (node as any)?._kindManual, profileKind: p?.kind }); } catch {}
    return {
      slotId: (node?.id || node?._id || node?.label || 'slot') as string,
      locale,
      kind: ((node?.kind && node.kind !== 'generic') ? node.kind : (p.kind && p.kind !== 'generic') ? p.kind : inferKindFromNode(node)) as string,
      synonyms: Array.isArray(p.synonyms)
        ? p.synonyms
        : Array.isArray((node as any)?.synonyms)
          ? (node as any).synonyms
          : [(node?.label || '').toString(), (node?.label || '').toString().toLowerCase()].filter(Boolean),
      regex: p.regex,
      formatHints: Array.isArray(p.formatHints) ? p.formatHints : undefined,
      examples: Array.isArray(p.examples) ? p.examples : undefined,
      minConfidence: typeof p.minConfidence === 'number' ? p.minConfidence : 0.6,
      postProcess: p.postProcess,
      subSlots: p.subSlots,
      waitingEsc1: typeof p.waitingEsc1 === 'string' && p.waitingEsc1.trim() ? p.waitingEsc1 : 'Un istante…',
      waitingEsc2: typeof p.waitingEsc2 === 'string' && p.waitingEsc2.trim() ? p.waitingEsc2 : 'Ancora un istante…',
    };
  }, [node, locale]);

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
      try { console.log('[KindPersist][ProfileEditor][kind change]', { from: prevKindRef.current, to: kind, nodeLabel: node?.label }); } catch {}
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
  const prevExamplesRef = useRef<string>(''); // Track examples changes
  useEffect(() => {
    const currentSlotId = initial.slotId;
    const currentExamplesKey = JSON.stringify(initial.examples || []); // Stringify to detect changes

    // Sync if slotId changed OR examples changed for same node
    const shouldSync = currentSlotId !== prevSlotIdRef.current ||
                      currentExamplesKey !== prevExamplesRef.current;

    if (!shouldSync) return;

    prevSlotIdRef.current = currentSlotId;
    prevExamplesRef.current = currentExamplesKey;

    // Mark that this is NOT a user-initiated kind change
    isUserKindChangeRef.current = false;

    setLockKind(false);
    setKindInternal(initial.kind); // Use internal setter to avoid marking as user change
    try {
      console.log('[KindPersist][ProfileEditor][sync from node]', {
        nodeLabel: node?.label,
        nodeKind: node?.kind,
        initialKind: initial.kind,
        examplesCount: Array.isArray(initial.examples) ? initial.examples.length : 0,
        examples: initial.examples
      });
    } catch {}
    setSynonymsText(toCommaList(initial.synonyms));
    setRegex(initial.regex || ''); // IMPORTANT: Load regex from initial profile (don't reset!)
    setFormatText(toCommaList(initial.formatHints));
    setExamplesList(Array.isArray(initial.examples) ? initial.examples : []); // FIX: Always sync examples from node
    setMinConf(initial.minConfidence || 0.6);
    setPostProcessText(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
    setWaitingEsc1(initial.waitingEsc1 || '');
    setWaitingEsc2(initial.waitingEsc2 || '');
  }, [initial.slotId, initial.examples]); // FIX: Added initial.examples to detect changes

  // Keep kind synced with inferred when lockKind is enabled
  useEffect(() => {
    if (lockKind) {
      isUserKindChangeRef.current = false; // LockKind is not a "change kind" action (don't reset regex)
      setKindInternal('auto');
      try { console.log('[KindPersist][ProfileEditor][lockKind → auto]', { inferredKind, nodeLabel: node?.label }); } catch {}
    }
  }, [lockKind, inferredKind, node]);

  // Build profile object
  const profile: NLPProfile = useMemo(() => {
    const syns = fromCommaList(synonymsText);
    const formats = fromCommaList(formatText);
    const ex = examplesList;
    const post = tryParseJSON(postProcessText);
    setJsonError(post.error);
    const autoSubSlots = Array.isArray((node as any)?.subData)
      ? (node as any).subData.map((s: any) => ({
          slotId: s?.id || String(s?.label || s?.name || '').toLowerCase().replace(/\s+/g, '_'),
          label: s?.label || s?.name || ''
        }))
      : undefined;
    const out = {
      slotId: initial.slotId,
      locale: initial.locale,
      kind: (kind === 'generic' && (node?.kind && node.kind !== 'generic')) ? node.kind : kind,
      synonyms: syns,
      regex: regex || undefined,
      formatHints: formats.length ? formats : undefined,
      examples: ex.length ? ex : undefined,
      minConfidence: minConf,
      postProcess: post.error ? undefined : post.value,
      subSlots: autoSubSlots,
      waitingEsc1: waitingEsc1 || undefined,
      waitingEsc2: waitingEsc2 || undefined,
    };
    try { console.log('[KindPersist][ProfileEditor][profile memo]', { nodeLabel: node?.label, outKind: out.kind }); } catch {}
    return out;
  }, [node, initial.slotId, initial.locale, kind, synonymsText, regex, formatText, examplesList, minConf, postProcessText, waitingEsc1, waitingEsc2]);

  // Ensure latest profile is flushed on unmount
  const profileRef = useRef<NLPProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    return () => {
      try { if (profileRef.current) onChange?.(profileRef.current); } catch {}
    };
  }, [onChange]);

  // Emit onChange when profile changes (debounced)
  const lastSentJsonRef = useRef<string>('');
  useEffect(() => {
    const json = JSON.stringify(profile);
    if (json !== lastSentJsonRef.current) {
      lastSentJsonRef.current = json;
      const safeProfile = { ...profile } as NLPProfile;
      if (safeProfile.kind === 'generic' && (node?.kind && node.kind !== 'generic')) {
        safeProfile.kind = node.kind;
      }
      try { console.log('[KindPersist][ProfileEditor][emit onChange]', { nodeLabel: node?.label, kind: safeProfile.kind }); } catch {}
      onChange?.(safeProfile);
    }
  }, [profile.synonyms, profile.regex, profile.kind, profile.formatHints, profile.examples, profile.minConfidence, profile.postProcess, profile.subSlots, profile, node, onChange]);

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
    // Computed
    profile,
    initial,
  };
}

