import React from 'react';
import { Play, Wand2, MessageCircle } from 'lucide-react';
import { extractField } from '../../../nlp/pipeline';
import { nerExtract } from '../../../nlp/services/nerClient';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';
import { Calendar, Mail, Phone, Hash, Globe, MapPin, User, FileText, CreditCard, CarFront as Car, Badge, Landmark, Type as TypeIcon, ChevronDown, Plus, ChevronsRight, Wrench, BarChart2 } from 'lucide-react';
import nlpTypesConfig from '../../../../config/nlp-types.json';

// 🎨 Colori centralizzati per extractors
const EXTRACTOR_COLORS = {
  regex: '#d1fae5',        // Verde chiaro
  deterministic: '#e5e7eb', // Grigio
  ner: '#fef3c7',          // Giallo pallido
  llm: '#fed7aa',          // Arancione pallido
  waitingBg: '#f0fdf4'     // Verde chiarissimo
};

// 📊 Etichette colonne con tooltip
const COLUMN_LABELS = {
  regex: { 
    main: "Espressione", 
    tech: "Regex",
    tooltip: "Cerca pattern di testo con espressioni regolari"
  },
  deterministic: { 
    main: "Logica", 
    tech: "Extractor",
    tooltip: "Parsing semantico con regole programmate specifiche per tipo"
  },
  ner: { 
    main: "AI Rapida", 
    tech: "NER",
    tooltip: "Riconoscimento entità con intelligenza artificiale veloce"
  },
  llm: { 
    main: "AI Completa", 
    tech: "LLM",
    tooltip: "Comprensione linguistica profonda con modello AI avanzato"
  }
};

export interface NLPProfile {
  slotId: string;
  locale: string;
  kind: string;
  synonyms: string[];
  regex?: string;
  formatHints?: string[];
  examples?: string[];
  minConfidence?: number;
  postProcess?: any;
  subSlots?: any;
  waitingEsc1?: string;
  waitingEsc2?: string;
}

function toCommaList(list?: string[] | null): string {
  return Array.isArray(list) ? list.join(', ') : '';
}

function fromCommaList(text: string): string[] {
  return (text || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 && arr.indexOf(s) === i);
}

// removed unused multiline helper

function tryParseJSON<T = any>(text: string): { value?: T; error?: string } {
  const t = (text || '').trim();
  if (!t) return { value: undefined as any };
  try {
    return { value: JSON.parse(t) };
  } catch (e: any) {
    return { error: e?.message || 'JSON parse error' };
  }
}

// 🎨 Aggiungi CSS per animazione spinner
if (typeof document !== 'undefined' && !document.getElementById('nlp-spinner-animation')) {
  const style = document.createElement('style');
  style.id = 'nlp-spinner-animation';
  style.textContent = `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-10px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
}

export default function NLPExtractorProfileEditor({
  node,
  locale = 'it-IT',
  onChange,
}: {
  node: any;
  locale?: string;
  onChange?: (profile: NLPProfile) => void;
}) {
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

  const initial: NLPProfile = React.useMemo(() => {
    const p = (node && (node as any).nlpProfile) || {};
    try { console.log('[KindPersist][ProfileEditor][initial]', { nodeLabel: node?.label, nodeKind: node?.kind, manual: (node as any)?._kindManual, profileKind: p?.kind }); } catch {}
    return {
      slotId: (node?.id || node?._id || node?.label || 'slot') as string,
      locale,
      // Pre-seed kind strictly from node.kind or inferred value; never force 'generic' here
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

  const inferredKind = React.useMemo(() => inferKindFromNode(node), [node]);
  // Default: Auto unchecked to avoid flipping kind -> 'auto' on mount
  const [lockKind, setLockKind] = React.useState<boolean>(false);
  const [kind, setKind] = React.useState<string>(initial.kind);
  const KIND_OPTIONS = React.useMemo(() => {
    const iconColor = '#9ca3af';
    const mk = (value: string, label: string, IconCmp: any) => ({ value, label, Icon: () => <IconCmp size={14} color={iconColor} /> });
    const opts = [
      mk('address', 'address', MapPin),
      mk('city', 'city', MapPin),
      mk('country', 'country', Globe),
      mk('credit_card', 'credit card', CreditCard),
      mk('date', 'date', Calendar),
      mk('email', 'email', Mail),
      mk('gender', 'gender', User),
      mk('iban', 'iban', Landmark),
      mk('license_plate', 'license plate', Car),
      mk('name', 'name', TypeIcon),
      mk('number', 'number', Hash),
      mk('phone', 'phone', Phone),
      mk('province', 'province', MapPin),
      mk('street', 'street', MapPin),
      mk('vat', 'vat', Badge),
      mk('zip', 'zip', Hash),
      mk('generic', 'generic', FileText),
    ];
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, []);
  const selectedKindOpt = React.useMemo(() => KIND_OPTIONS.find(o => o.value === kind) || KIND_OPTIONS[0], [KIND_OPTIONS, kind]);
  const [kindOpen, setKindOpen] = React.useState(false);
  const kindRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (kindRef.current && !kindRef.current.contains(e.target as Node)) setKindOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const [synonymsText, setSynonymsText] = React.useState<string>(toCommaList(initial.synonyms));
  const [regex, setRegex] = React.useState<string>(initial.regex || '');
  const [regexAiMode, setRegexAiMode] = React.useState<boolean>(false);
  const [regexAiPrompt, setRegexAiPrompt] = React.useState<string>('');
  const [regexBackup, setRegexBackup] = React.useState<string>('');
  const [generatingRegex, setGeneratingRegex] = React.useState<boolean>(false);
  const regexInputRef = React.useRef<HTMLInputElement>(null);
  const [formatText, setFormatText] = React.useState<string>(toCommaList(initial.formatHints));
  const [examplesList, setExamplesList] = React.useState<string[]>(Array.isArray(initial.examples) ? initial.examples : []);
  const [minConf, setMinConf] = React.useState<number>(initial.minConfidence || 0.6);
  const [postProcessText, setPostProcessText] = React.useState<string>(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
  const [waitingEsc1, setWaitingEsc1] = React.useState<string>(initial.waitingEsc1 || '');
  const [waitingEsc2, setWaitingEsc2] = React.useState<string>(initial.waitingEsc2 || '');
  const [newExample, setNewExample] = React.useState<string>('');
  const [selectedRow, setSelectedRow] = React.useState<number | null>(null);
  const [rowResults, setRowResults] = React.useState<Array<{
    regex?: string;
    deterministic?: string;
    ner?: string;
    llm?: string;
    regexMs?: number;
    detMs?: number;
    nerMs?: number;
    llmMs?: number;
    running?: boolean; // overall
    detRunning?: boolean;
    nerRunning?: boolean;
    llmRunning?: boolean;
    spans?: Array<{start:number;end:number}>;
    value?: string;
    confidence?: number;
    variables?: Record<string, any>;
  }>>([]);
  // Inline editing state for Tester stacked values
  const [editingCell, setEditingCell] = React.useState<{
    row: number;
    col: 'det' | 'ner' | 'llm';
    key: string;
  } | null>(null);
  const [editingText, setEditingText] = React.useState<string>('');
  const [cellOverrides, setCellOverrides] = React.useState<Record<string, string>>({});
  // Removed per-row bottom details panel state
  const [testing, setTesting] = React.useState<boolean>(false);
  const [baselineStats, setBaselineStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [lastStats, setLastStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [reportOpen, setReportOpen] = React.useState<boolean>(false);
  const [jsonError, setJsonError] = React.useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = React.useState<'regex' | 'extractor' | 'post' | null>(null);
  const [activeEditor, setActiveEditor] = React.useState<'regex' | 'extractor' | 'ner' | 'llm' | null>(null);
  
  // Note system: cellNotes[rowIndex][column] = note text
  const [cellNotes, setCellNotes] = React.useState<Record<string, string>>({});
  const [editingNote, setEditingNote] = React.useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = React.useState<string | null>(null);
  
  const [endpointBase] = React.useState<string>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('nlpEndpointBase') : null;
      return saved || ((import.meta as any)?.env?.VITE_PROMIS_URL || '/api');
    } catch {
      return ((import.meta as any)?.env?.VITE_PROMIS_URL || '/api');
    }
  });
  React.useEffect(() => {
    try { localStorage.setItem('nlpEndpointBase', endpointBase || ''); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recommended defaults per kind
  const recommendedForKind = React.useCallback((k: string) => {
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

  // When Kind changes (by user), re-seed editor fields with recommended defaults for that kind
  const prevKindRef = React.useRef<string>(initial.kind);
  React.useEffect(() => {
    if (kind && kind !== prevKindRef.current) {
      const r = recommendedForKind(kind);
      try { console.log('[KindPersist][ProfileEditor][kind change]', { from: prevKindRef.current, to: kind, nodeLabel: node?.label }); } catch {}
      setSynonymsText(r.synonyms);
      setFormatText(r.formats);
      setExamplesList(r.examples);
      setMinConf(r.min);
      // reset regex and post process when kind switches category
      setRegex('');
      setPostProcessText('');
    }
    prevKindRef.current = kind;
  }, [kind, recommendedForKind]);

  // Ensure latest profile is flushed on unmount (e.g., when closing the panel quickly)
  const profileRef = React.useRef<NLPProfile | null>(null);
  React.useEffect(() => { profileRef.current = {
    slotId: initial.slotId,
    locale: initial.locale,
    kind,
    synonyms: fromCommaList(synonymsText),
    regex: regex || undefined,
    formatHints: fromCommaList(formatText) || undefined,
    examples: examplesList.length ? examplesList : undefined,
    minConfidence: minConf,
    postProcess: tryParseJSON(postProcessText).value,
    subSlots: Array.isArray((node as any)?.subData)
      ? (node as any).subData.map((s: any) => ({ slotId: s?.id || String(s?.label || s?.name || '').toLowerCase().replace(/\s+/g, '_'), label: s?.label || s?.name || '' }))
      : undefined,
    waitingEsc1: waitingEsc1 || undefined,
    waitingEsc2: waitingEsc2 || undefined,
  }; }, [initial.slotId, initial.locale, kind, synonymsText, regex, formatText, examplesList, minConf, postProcessText, node, waitingEsc1, waitingEsc2]);
  React.useEffect(() => {
    return () => {
      try { if (profileRef.current) onChange?.(profileRef.current); } catch {}
    };
  }, [onChange]);

  // Auto-run parsing when a new phrase is appended
  const prevExamplesCountRef = React.useRef<number>(examplesList.length);
  React.useEffect(() => {
    if (examplesList.length > prevExamplesCountRef.current) {
      const newIdx = examplesList.length - 1;
      setSelectedRow(newIdx);
      setTimeout(() => { void runRowTest(newIdx); }, 0);
    }
    prevExamplesCountRef.current = examplesList.length;
  }, [examplesList.length]);

  // Sync form when node changes (avoid depending on lockKind to prevent loops)
  React.useEffect(() => {
    // Default: Auto unchecked, use normalized node.kind directly
    setLockKind(false);
    setKind(initial.kind);
    try { console.log('[KindPersist][ProfileEditor][sync from node]', { nodeLabel: node?.label, nodeKind: node?.kind, initialKind: initial.kind }); } catch {}
    setSynonymsText(toCommaList(initial.synonyms));
    setRegex(initial.regex || '');
    setFormatText(toCommaList(initial.formatHints));
    setExamplesList(Array.isArray(initial.examples) ? initial.examples : []);
    setMinConf(initial.minConfidence || 0.6);
    setPostProcessText(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
    setNewExample('');
    setSelectedRow(null);
    setRowResults([]);
    setWaitingEsc1(initial.waitingEsc1 || '');
    setWaitingEsc2(initial.waitingEsc2 || '');
  }, [initial.slotId]);

  // Keep kind synced with inferred only when locked is enabled explicitly by user
  React.useEffect(() => {
    if (lockKind) {
      setKind('auto');
      try { console.log('[KindPersist][ProfileEditor][lockKind → auto]', { inferredKind, nodeLabel: node?.label }); } catch {}
    }
  }, [lockKind, inferredKind]);

  const profile: NLPProfile = React.useMemo(() => {
    const syns = fromCommaList(synonymsText);
    const formats = fromCommaList(formatText);
    const ex = examplesList;
    const post = tryParseJSON(postProcessText);
    setJsonError(post.error);
    // Auto-derive subSlots from subData (hidden, read-only)
    const autoSubSlots = Array.isArray((node as any)?.subData)
      ? (node as any).subData.map((s: any) => ({
          slotId: s?.id || String(s?.label || s?.name || '').toLowerCase().replace(/\s+/g, '_'),
          label: s?.label || s?.name || ''
        }))
      : undefined;
    const out = {
      slotId: initial.slotId,
      locale: initial.locale,
      // Guard against writing back 'generic' over a known node.kind; keep 'auto' or the inferred kind
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

  const lastSentJsonRef = React.useRef<string>('');
  React.useEffect(() => {
    const json = JSON.stringify(profile);
    if (json !== lastSentJsonRef.current) {
      lastSentJsonRef.current = json;
      // Prevent emitting a downgrade to generic; keep previous node.kind in that case
      const safeProfile = { ...profile } as NLPProfile;
      if (safeProfile.kind === 'generic' && (node?.kind && node.kind !== 'generic')) {
        safeProfile.kind = node.kind;
      }
      try { console.log('[KindPersist][ProfileEditor][emit onChange]', { nodeLabel: node?.label, kind: safeProfile.kind }); } catch {}
      onChange?.(safeProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.synonyms, profile.regex, profile.kind, profile.formatHints, profile.examples, profile.minConfidence, profile.postProcess, profile.subSlots]);

  function summarizeVars(vars?: Record<string, any>, fallbackValue?: string): string {
    if (!vars || typeof vars !== 'object') return fallbackValue ? `value=${fallbackValue}` : '—';
    const entries = Object.entries(vars).filter(([, v]) => v != null && v !== '');
    if (!entries.length && fallbackValue) return `value=${fallbackValue}`;
    return entries.map(([k, v]) => `${k}=${v}`).join(', ');
  }

  // Build spans positions for highlighting within phrase
  const findAllOccurrences = (text: string, sub: string): Array<{ start: number; end: number }> => {
    const spans: Array<{ start: number; end: number }> = [];
    if (!sub) return spans;
    const needle = sub.toLowerCase();
    const hay = text.toLowerCase();
    let idx = 0;
    while ((idx = hay.indexOf(needle, idx)) !== -1) {
      spans.push({ start: idx, end: idx + needle.length });
      idx += Math.max(1, needle.length);
    }
    return spans;
  };
  const mergeSpans = (a: Array<{ start: number; end: number }>, b: Array<{ start: number; end: number }>) => {
    const all = [...(a || []), ...(b || [])].sort((x, y) => x.start - y.start);
    if (!all.length) return [] as Array<{ start: number; end: number }>;
    const merged: Array<{ start: number; end: number }> = [all[0]];
    for (let i = 1; i < all.length; i += 1) {
      const last = merged[merged.length - 1];
      const cur = all[i];
      if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
      else merged.push({ ...cur });
    }
    return merged;
  };
  const italianMonths = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  const spansFromDate = (phrase: string, v?: { day?: any; month?: any; year?: any }) => {
    const spans: Array<{ start: number; end: number }> = [];
    if (!v) return spans;
    const addNum = (num?: any) => {
      const s = String(num || '').trim();
      if (!s) return;
      // match with or without leading zero
      const variants = new Set([s, s.padStart(2, '0')]);
      variants.forEach((vv) => { spans.push(...findAllOccurrences(phrase, vv)); });
    };
    addNum(v.day);
    addNum(v.year);
    if (typeof v.month !== 'undefined') {
      const mStr = String(v.month).toLowerCase();
      // numeric month
      const mNum = parseInt(mStr, 10);
      if (!Number.isNaN(mNum)) {
        const variants = new Set([String(mNum), String(mNum).padStart(2, '0')]);
        variants.forEach((vv) => { spans.push(...findAllOccurrences(phrase, vv)); });
      }
      // textual month
      italianMonths.forEach((nm) => {
        if (findAllOccurrences(phrase, nm).length) spans.push(...findAllOccurrences(phrase, nm));
      });
    }
    return spans;
  };
  const spansFromScalar = (phrase: string, value?: any) => {
    const v = (value == null ? '' : String(value)).trim();
    if (!v) return [] as Array<{ start: number; end: number }>;
    return findAllOccurrences(phrase, v);
  };

  const extractRegexOnly = (text: string) => {
    const spans: Array<{ start: number; end: number }> = [];
    let value = '';
    if (profile.regex) {
      try {
        const re = new RegExp(profile.regex, 'g');
        let m: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((m = re.exec(text)) !== null) {
          spans.push({ start: m.index, end: m.index + m[0].length });
          if (!value) value = m[0];
        }
      } catch {}
    }
    return { value, spans, summary: value ? `value=${value}` : '—' };
  };

  // removed unused helper

  const mapKindToField = (k: string): string => {
    const s = (k || '').toLowerCase();
    
    // ✅ Use extractorMapping from config
    const extractorMapping = nlpTypesConfig.extractorMapping as Record<string, string>;
    
    // Direct mapping from config
    if (extractorMapping[s]) {
      return extractorMapping[s];
    }
    
    // Auto/Generic → heuristic mapping to date when hints/examples suggest a date
    if (s === 'generic' || s === 'auto') {
      const months = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre','gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
      const examplesText = (examplesList || []).join(' ').toLowerCase();
      const synonyms = toCommaList(fromCommaList(synonymsText)).toLowerCase();
      const formats = (formatText || '').toLowerCase();
      const hasMonth = months.some((m) => examplesText.includes(m));
      const hasNumericDate = /\b\d{1,2}[\/\-.]\d{1,2}(?:[\/\-.]\d{2,4})?\b/.test(examplesText);
      const hasYear = /\b(19\d{2}|20\d{2})\b/.test(examplesText);
      const hasDateWords = /(data|nascit|birth|dob)/.test(synonyms);
      const hasDateFormatHint = /(dd|yyyy|mmm)/.test(formats);
      if (hasMonth || hasNumericDate || (hasYear && hasDateWords) || hasDateFormatHint) {
        // eslint-disable-next-line no-console
        console.log('[Tester][LOCAL] auto-map generic → dateOfBirth');
        return 'dateOfBirth';
      }
    }
    return 'generic';
  };

  const runRowTest = async (idx: number) => {
    const phrase = examplesList[idx] || '';
    if (!phrase) return;
    setTesting(true);
    // helper to update partial row state
    const update = (partial: any) => setRowResults(prev => { const next = [...prev]; next[idx] = { ...(next[idx] || {}), ...partial }; return next; });

    // set initial running state
    update({ running: true, detRunning: true, nerRunning: true, llmRunning: true, regex: '—', deterministic: '—', ner: '—', llm: '—' });

    // Regex (sync)
    const t0Regex = performance.now();
    const regexRes = extractRegexOnly(phrase);
    update({ regex: regexRes.summary, regexMs: Math.round(performance.now() - t0Regex), spans: regexRes.spans });

    const field = mapKindToField(profile.kind);

    // Deterministic async task
    const detTask = (async () => {
      const t0 = performance.now();
    try {
      const det = await extractField<any>(field, phrase);
        let detSummary = '—';
      let detSpans: Array<{ start: number; end: number }> = [];
      if (det.status === 'accepted') {
        if (field === 'dateOfBirth') {
          const v: any = det.value || {};
          detSummary = summarizeVars({ day: v.day, month: v.month, year: v.year }, v.day && v.month && v.year ? `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}` : undefined);
          detSpans = spansFromDate(phrase, v);
        } else if (field === 'phone') {
          const v: any = det.value || {};
          detSummary = v.e164 ? `value=${v.e164}` : '—';
          detSpans = spansFromScalar(phrase, v.e164 || v.value);
        } else if (field === 'email') {
          detSummary = det.value ? `value=${String(det.value)}` : '—';
          detSpans = spansFromScalar(phrase, det.value);
        } else if (det.value) {
          detSpans = spansFromScalar(phrase, det.value);
        }
      } else if (det.status === 'ask-more' && det.value) {
        if (field === 'dateOfBirth') {
          const v: any = det.value || {};
          detSummary = summarizeVars({ day: v.day, month: v.month, year: v.year });
          detSpans = spansFromDate(phrase, v);
        }
      }
        setRowResults(prev => {
          const next = [...prev];
          const base = ((next[idx] || {}) as any).spans || [];
          next[idx] = { ...(next[idx] || {}), deterministic: detSummary, detMs: Math.round(performance.now() - t0), detRunning: false, spans: mergeSpans(base, detSpans) } as any;
          return next;
        });
      } catch {
        update({ deterministic: '—', detMs: Math.round(performance.now() - t0), detRunning: false });
      }
    })();

    // NER async task
    const nerTask = (async () => {
      const t0 = performance.now();
    try {
      const ner = await nerExtract<any>(field, phrase);
        let nerSummary = '—';
      let nerSpans: Array<{ start: number; end: number }> = [];
      if (Array.isArray(ner?.candidates) && ner.candidates.length > 0) {
        const c = ner.candidates[0];
        if (field === 'dateOfBirth') {
          nerSummary = summarizeVars({ day: c?.value?.day, month: c?.value?.month, year: c?.value?.year });
          nerSpans = spansFromDate(phrase, c?.value);
        } else if (field === 'phone') {
          nerSummary = c?.value ? `value=${String(c.value)}` : '—';
          nerSpans = spansFromScalar(phrase, c?.value);
        } else if (field === 'email') {
          nerSummary = c?.value ? `value=${String(c.value)}` : '—';
          nerSpans = spansFromScalar(phrase, c?.value);
        } else if (c?.value) {
          nerSpans = spansFromScalar(phrase, c?.value);
        }
      }
        setRowResults(prev => {
          const next = [...prev];
          const base = ((next[idx] || {}) as any).spans || [];
          next[idx] = { ...(next[idx] || {}), ner: nerSummary, nerMs: Math.round(performance.now() - t0), nerRunning: false, spans: mergeSpans(base, nerSpans) } as any;
          return next;
        });
      } catch {
        update({ ner: '—', nerMs: Math.round(performance.now() - t0), nerRunning: false });
      }
    })();

    // LLM async task
    const llmTask = (async () => {
      const t0 = performance.now();
      try {
        const res = await fetch('/api/nlp/llm-extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field, text: phrase, lang: 'it' }) });
        let llmSummary = '—';
        let llmSpans: Array<{ start: number; end: number }> = [];
        if (res.ok) {
          const obj = await res.json();
          if (Array.isArray(obj?.candidates) && obj.candidates.length > 0) {
            const c = obj.candidates[0];
            if (field === 'dateOfBirth' && c?.value) {
              llmSummary = summarizeVars({ day: c.value.day, month: c.value.month, year: c.value.year });
              llmSpans = spansFromDate(phrase, c.value);
            } else if (field === 'phone') {
              llmSummary = c?.value ? `value=${String(c.value)}` : '—';
              llmSpans = spansFromScalar(phrase, c?.value);
            } else if (field === 'email') {
              llmSummary = c?.value ? `value=${String(c.value)}` : '—';
              llmSpans = spansFromScalar(phrase, c?.value);
            } else if (c?.value) {
              llmSpans = spansFromScalar(phrase, c?.value);
            }
          }
        }
        setRowResults(prev => {
      const next = [...prev];
          const base = ((next[idx] || {}) as any).spans || [];
          next[idx] = { ...(next[idx] || {}), llm: llmSummary, llmMs: Math.round(performance.now() - t0), llmRunning: false, spans: mergeSpans(base, llmSpans) } as any;
      return next;
    });
      } catch {
        update({ llm: '—', llmMs: Math.round(performance.now() - t0), llmRunning: false });
      }
    })();

    // When all three are done, stop overall running
    await Promise.allSettled([detTask, nerTask, llmTask]);
    update({ running: false });
    setSelectedRow(idx);
    setTesting(false);
  };

  const runAllRows = async () => {
    setTesting(true);
    for (let i = 0; i < examplesList.length; i += 1) {
      await runRowTest(i);
    }
    // compute stats after run
    try {
      const stats = computeStatsFromResults();
      setLastStats(stats);
      if (!baselineStats) setBaselineStats(stats);
    } catch {}
    setTesting(false);
  };

  // Highlight now rendered inline in the Phrase cell

  // Expected keys per kind
  const expectedKeysForKind = (k: string): string[] => {
    const s = (k || '').toLowerCase();
    if (s === 'date') return ['day', 'month', 'year'];
    if (s === 'email' || s === 'phone' || s === 'number' || s === 'name' || s === 'address') return ['value'];
    return ['value'];
  };

  // Helpers to format summary into stacked key: value lines showing expected keys; missing keys grey, present black
  const renderStackedSummary = (summary: string | undefined, rowIdx?: number, col?: 'det' | 'ner' | 'llm') => {
    const text = (summary || '—').toString();
    const kv: Record<string, string | undefined> = {};
    if (text !== '—') {
      text.split(',').forEach(part => {
        const sp = part.split('=');
        const k = sp[0] && sp[0].trim();
        const v = typeof sp[1] !== 'undefined' ? String(sp[1]).trim() : undefined;
        if (k) kv[k] = v;
      });
    }
    const keys = expectedKeysForKind(kind);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        {keys.map((k) => {
          const overrideKey = typeof rowIdx === 'number' && col ? `${rowIdx}:${col}:${k}` : '';
          const overridden = overrideKey ? cellOverrides[overrideKey] : undefined;
          const baseVal = kv[k];
          const value = typeof overridden !== 'undefined' ? overridden : baseVal;
          const present = typeof value !== 'undefined' && value !== '';
          const isEditing = !!editingCell && editingCell.row === rowIdx && editingCell.col === col && editingCell.key === k;
          return (
            <span key={k} style={{ color: present ? '#0b0f17' : '#9ca3af', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', alignItems: 'start', gap: 6 }}>
              <span>{k}:</span>
              {!isEditing ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof rowIdx !== 'number' || !col) return;
                    setEditingCell({ row: rowIdx, col, key: k });
                    setEditingText(value || '');
                  }}
                  title="Clicca per modificare"
                  style={{ cursor: 'text', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', minWidth: 0, maxWidth: '100%' }}
                >
                  {present ? value : '—'}
                </span>
              ) : (
                <span style={{ display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
                <textarea
                  defaultValue={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (typeof rowIdx === 'number' && col) {
                        const k2 = `${rowIdx}:${col}:${k}`;
                        setCellOverrides((prev) => ({ ...prev, [k2]: editingText }));
                      }
                      setEditingCell(null);
                    } else if (e.key === 'Escape') {
                      setEditingCell(null);
                    }
                  }}
                  onBlur={() => {
                    if (typeof rowIdx === 'number' && col) {
                      const k2 = `${rowIdx}:${col}:${k}`;
                      setCellOverrides((prev) => ({ ...prev, [k2]: editingText }));
                    }
                    setEditingCell(null);
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const resize = () => {
                      // fixed, compact height (don't change row height)
                      const cs = getComputedStyle(el);
                      const lhStr = cs.lineHeight || '16px';
                      const lh = parseFloat(lhStr) || 16;
                      const baseH = Math.max(16, Math.ceil(lh));
                      el.style.height = `${baseH}px`;
                      // width autosize to content up to cell width (no column growth)
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      let w = 40; // min
                      if (ctx) {
                        const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                        ctx.font = font;
                        w = Math.ceil(ctx.measureText(el.value || '—').width) + 10; // padding
                      }
                      const parent = el.parentElement as HTMLElement | null;
                      const max = parent ? parent.clientWidth : w;
                      // enforce max and hide overflow
                      el.style.maxWidth = `${max}px`;
                      el.style.width = `${Math.min(w, max)}px`;
                    };
                    resize();
                    el.focus();
                    try { el.selectionStart = el.value.length; } catch {}
                    el.addEventListener('input', resize);
                    // Cleanup on detach
                    setTimeout(() => { if (el) el.removeEventListener('input', resize); }, 0);
                  }}
                  style={{
                    display: 'inline-block',
                    width: 'auto',
                    maxWidth: '100%',
                    minWidth: 40,
                    minHeight: 16,
                    padding: '0 2px',
                    borderRadius: 2,
                    border: '1px solid #94a3b8',
                    background: '#fff',
                    color: '#111827',
                    fontSize: 14,
                    lineHeight: 1.1,
                    resize: 'none',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    wordBreak: 'keep-all',
                    outline: 'none',
                    boxShadow: 'none',
                  }}
                />
                </span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Compute metrics based on ground truth (manual overrides in det col) vs predictions
  function computeStatsFromResults() {
    let matched = 0;
    let falseAccept = 0;
    let totalGt = 0;
    (examplesList || []).forEach((_, rowIdx) => {
      const rr: any = rowResults[rowIdx] || {};
      const keys = expectedKeysForKind(kind);
      const parseSummary = (text?: string) => {
        const out: Record<string, string | undefined> = {};
        const t = (text || '').toString();
        if (!t || t === '—') return out;
        t.split(',').forEach((p) => { const sp = p.split('='); const k = sp[0]?.trim(); const v = sp[1] != null ? String(sp[1]).trim() : undefined; if (k) out[k] = v; });
        return out;
      };
      const det = parseSummary(rr.deterministic);
      const ner = parseSummary(rr.ner);
      const llm = parseSummary(rr.llm);
      keys.forEach((kKey) => {
        const gt = cellOverrides[`${rowIdx}:det:${kKey}`];
        if (typeof gt === 'undefined') return; // only count when GT is given
        totalGt += 1;
        const pred = det[kKey] ?? ner[kKey] ?? llm[kKey];
        if (!pred) return; // unmatched (counted implicitly via totalGt)
        if (pred === gt) matched += 1; else falseAccept += 1;
      });
    });
    return { matched, falseAccept, totalGt };
  }

  // Unified color time bar with thresholds: >200ms yellow, >1000ms red
  const renderTimeBar = (ms?: number, maxMs?: number) => {
    const m = typeof ms === 'number' && ms > 0 ? ms : 0;
    const max = Math.max(1, typeof maxMs === 'number' && maxMs > 0 ? maxMs : 1);
    let remaining = Math.min(m, max);
    const seg1Ms = Math.min(200, remaining); remaining -= seg1Ms;
    const seg2Ms = Math.min(800, Math.max(0, remaining)); remaining -= seg2Ms;
    const seg3Ms = Math.max(0, remaining);
    const seg1Pct = (seg1Ms / max) * 100;
    const seg2Pct = (seg2Ms / max) * 100;
    const seg3Pct = (seg3Ms / max) * 100;
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ height: 4, width: '100%', background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
          {seg1Pct > 0 && <div style={{ height: 4, width: `${seg1Pct}%`, background: '#64748b' }} />}
          {seg2Pct > 0 && <div style={{ height: 4, width: `${seg2Pct}%`, background: '#fbbf24' }} />}
          {seg3Pct > 0 && <div style={{ height: 4, width: `${seg3Pct}%`, background: '#ef4444' }} />}
        </div>
        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{m ? `${m} ms` : ''}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header compatto + tab editor */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 80px 1fr', alignItems: 'end', gap: 12 }}>
          {/* Kind stretto */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Kind</label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.8 }}>
                <input type="checkbox" checked={lockKind} onChange={(e) => { const v = e.target.checked; setLockKind(v); setKind(v ? 'auto' : inferredKind); }} /> Auto
                  </label>
                </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} ref={kindRef}>
              {lockKind ? (
                <select value={'auto'} disabled style={{ flex: 1, padding: 6, border: '1px solid #ddd', borderRadius: 8, background: '#f3f4f6' }}>
                  <option value="auto">auto</option>
                </select>
              ) : (
                <div style={{ position: 'relative', flex: 1 }}>
                  {/* ⚠️ Warning when kind='generic' */}
                  <button 
                    type="button" 
                    onClick={() => setKindOpen(o => !o)} 
                    style={{ 
                      width: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      padding: 6, 
                      border: kind === 'generic' ? '2px solid #ef4444' : '1px solid #ddd', 
                      borderRadius: 8, 
                      background: kind === 'generic' ? '#fef2f2' : '#fff', 
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    title={kind === 'generic' ? '⚠️ L\'AI ha usato il tipo generico. Verifica se serve un tipo più specifico.' : undefined}
                  >
                    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}><selectedKindOpt.Icon /></span>
                    <span style={{ flex: 1, textAlign: 'left', color: kind === 'generic' ? '#dc2626' : 'inherit', fontWeight: kind === 'generic' ? 600 : 400 }}>
                      {selectedKindOpt.label}
                      {kind === 'generic' && ' ⚠️'}
                    </span>
                    <ChevronDown size={14} color={kind === 'generic' ? '#dc2626' : '#9ca3af'} />
                  </button>
                  {kind === 'generic' && (
                    <div style={{ 
                      marginTop: 4, 
                      padding: '6px 8px', 
                      background: '#fef2f2', 
                      border: '1px solid #fecaca', 
                      borderRadius: 6, 
                      fontSize: 11, 
                      color: '#dc2626',
                      display: 'flex',
                      gap: 6,
                      alignItems: 'flex-start'
                    }}>
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <span>L'AI ha usato il tipo <strong>generic</strong>. Verifica se serve un tipo più specifico (number, date, email, etc.).</span>
                    </div>
                  )}
                  {kindOpen && (
                    <div style={{ position: 'absolute', zIndex: 20, marginTop: 4, left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 8, maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                      {KIND_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => { setKind(opt.value); setKindOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: opt.value === kind ? '#f3f4f6' : '#fff', border: 'none', cursor: 'pointer' }}>
                          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}><opt.Icon /></span>
                          <span style={{ textAlign: 'left' }}>{opt.label}</span>
                        </button>
                      ))}
              </div>
                  )}
              </div>
              )}
            </div>
          </div>
          {/* Confidence compatto */}
          <div>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Confidence</label>
            <input type="number" min={0} max={1} step={0.05} value={minConf} onChange={(e) => setMinConf(parseFloat(e.target.value))} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          {/* Waiting Messages Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 8, background: '#f0fdf4', borderRadius: 8 }}>
            <div>
              <label style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MessageCircle size={14} />
                Waiting NER
              </label>
              <input value={waitingEsc1} onChange={(e) => setWaitingEsc1(e.target.value)} title="Testo mostrato all'utente mentre si attende il riconoscimento NER" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <MessageCircle size={14} />
                Waiting LLM
              </label>
              <input value={waitingEsc2} onChange={(e) => setWaitingEsc2(e.target.value)} title="Testo mostrato all'utente mentre si attende l'analisi LLM" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
          </div>
        </div>
        {/* OLD tab editors - now replaced by inline editors */}
        <div style={{ marginTop: 10, display: 'none' }}>
          {activeTab === 'regex' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Regex</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={regexInputRef}
                  value={
                    generatingRegex 
                      ? "⏳ Creating regex..." 
                      : (regexAiMode ? regexAiPrompt : regex)
                  }
                  onChange={(e) => {
                    if (regexAiMode && !generatingRegex) {
                      setRegexAiPrompt(e.target.value);
                    } else if (!generatingRegex) {
                      setRegex(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    // ESC key: exit AI mode and restore original regex
                    if (e.key === 'Escape' && regexAiMode) {
                      setRegexAiMode(false);
                      // Keep regexAiPrompt in memory for future iterations
                      // Restore the original regex (even if it was empty!)
                      setRegex(regexBackup);
                      e.preventDefault();
                      console.log('[AI Regex] Cancelled via ESC - restored:', regexBackup, '- prompt kept in memory');
                    }
                  }}
                  placeholder={
                    regexAiMode && !generatingRegex 
                      ? "Describe here what the regex should match (in English)" 
                      : "es. \\b\\d{5}\\b"
                  }
                  disabled={generatingRegex}
                  style={{ 
                    flex: 1, 
                    padding: 10, 
                    border: regexAiMode ? '2px solid #3b82f6' : '1px solid #ddd',
                    borderRadius: 8, 
                    fontFamily: regexAiMode ? 'inherit' : 'monospace',
                    backgroundColor: generatingRegex ? '#f9fafb' : (regexAiMode ? '#eff6ff' : '#fff'),
                    transition: 'all 0.2s ease'
                  }}
                />
                
                {/* Show WAND ONLY in normal mode (NOT in AI mode) */}
                {!regexAiMode && (
                  <button
                    type="button"
                    onClick={() => {
                      // Save current regex before entering AI mode (even if empty!)
                      setRegexBackup(regex);
                      setRegexAiMode(true);
                      // Keep regexAiPrompt in memory - don't reset it!
                      // Give focus to input after state update
                      setTimeout(() => {
                        regexInputRef.current?.focus();
                      }, 0);
                    }}
                    disabled={generatingRegex}
                    title="Generate regex with AI"
                    style={{
                      padding: 10,
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      background: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 40,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Wand2 size={16} color='#666' />
                  </button>
                )}
                
                {/* Show CREATE BUTTON when: AI mode AND at least 5 characters */}
                {regexAiMode && regexAiPrompt.trim().length >= 5 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!regexAiPrompt.trim()) return;
                      
                      setGeneratingRegex(true);
                      try {
                        console.log('[AI Regex] Generating regex for:', regexAiPrompt);
                        
                        const response = await fetch('/api/nlp/generate-regex', { 
                          method: 'POST', 
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ description: regexAiPrompt })
                        });
                        
                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.detail || 'Failed to generate regex');
                        }
                        
                        const data = await response.json();
                        console.log('[AI Regex] Response:', data);
                        
                        if (data.success && data.regex) {
                          setRegex(data.regex);
                          console.log('[AI Regex] Regex generated successfully:', data.regex);
                          
                          if (data.explanation) {
                            console.log('[AI Regex] Explanation:', data.explanation);
                            console.log('[AI Regex] Examples:', data.examples);
                          }
                          
                          // Exit AI mode and return to normal
                          // Keep regexAiPrompt in memory for future iterations
                          setRegexAiMode(false);
                        } else {
                          throw new Error('No regex returned from API');
                        }
                      } catch (error) {
                        console.error('[AI Regex] Error:', error);
                        alert(`Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      } finally {
                        setGeneratingRegex(false);
                      }
                    }}
                    disabled={generatingRegex}
                    title="Generate regex from description"
                    style={{
                      padding: '10px 16px',
                      border: '2px solid #3b82f6',
                      borderRadius: 8,
                      background: generatingRegex ? '#f3f4f6' : '#3b82f6',
                      color: '#fff',
                      cursor: generatingRegex ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      fontWeight: 500,
                      minWidth: 120,
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      animation: 'fadeIn 0.2s ease-in'
                    }}
                  >
                    {generatingRegex ? (
                      <>
                        <span style={{ 
                          display: 'inline-block', 
                          width: 14, 
                          height: 14, 
                          border: '2px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>Creating...</span>
                      </>
                    ) : (
                      'Create Regex'
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
          {activeTab === 'extractor' && (
            <NLPCompactEditor
              synonymsText={synonymsText}
              setSynonymsText={setSynonymsText}
              formatText={formatText}
              setFormatText={setFormatText}
            />
          )}
          {activeTab === 'post' && (
            <PostProcessEditor value={postProcessText} onChange={setPostProcessText} />
          )}
          {jsonError && (
            <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>JSON non valido: {jsonError}</div>
          )}
        </div>
      </div>

      {/* Tester full width */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Tester</div>
          {/* Controls in one line: input fills, icons right */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const t = (newExample || '').trim();
                  if (!t) return;
                  const existIdx = examplesList.findIndex((p) => p === t);
                  if (existIdx !== -1) {
                    setSelectedRow(existIdx);
                    // avvia il riconoscimento in background anche se già esiste
                    setTimeout(() => { void runRowTest(existIdx); }, 0);
                  } else {
                    const next = Array.from(new Set([...examplesList, t]));
                    setExamplesList(next);
                    const newIdx = next.length - 1;
                    setSelectedRow(newIdx);
                    // avvia dopo che lo state è aggiornato
                    setTimeout(() => { void runRowTest(newIdx); }, 0);
                  }
                  setNewExample('');
                }
              }}
              placeholder="Aggiungi frase…"
              style={{ flex: 1, padding: 10, border: '1px solid #4b5563', background: '#111827', color: '#e5e7eb', borderRadius: 8 }}
            />
            <button title="Aggiungi" onClick={() => {
                const t = (newExample || '').trim();
                if (!t) return;
                const existIdx = examplesList.findIndex((p) => p === t);
                if (existIdx !== -1) {
                  setSelectedRow(existIdx);
                  setTimeout(() => { void runRowTest(existIdx); }, 0);
                } else {
                  const next = Array.from(new Set([...examplesList, t]));
                  setExamplesList(next);
                  const newIdx = next.length - 1;
                  setSelectedRow(newIdx);
                  setTimeout(() => { void runRowTest(newIdx); }, 0);
                }
                setNewExample('');
              }} style={{ border: '1px solid #10b981', background: '#065f46', color: '#ecfdf5', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
              <Plus size={14} />
            </button>
            <button onClick={runAllRows} disabled={testing || examplesList.length === 0} title="Prova tutte" style={{ border: '1px solid #22c55e', background: testing ? '#eab308' : '#14532d', color: '#dcfce7', borderRadius: 8, padding: '8px 10px', cursor: testing ? 'default' : 'pointer' }}>
              <ChevronsRight size={16} />
            </button>
            {/* Tuning */}
            <button
              title="Tuning"
              onClick={async () => {
                const errors: Array<any> = [];
                (examplesList || []).forEach((phrase, rowIdx) => {
                  const rr = rowResults[rowIdx] || {} as any;
                  const cols: Array<{ id: 'det'|'ner'|'llm'; src?: string }> = [
                    { id: 'det', src: rr?.deterministic },
                    { id: 'ner', src: rr?.ner },
                    { id: 'llm', src: rr?.llm },
                  ];
                  const keys = expectedKeysForKind(kind);
                  keys.forEach((kKey) => {
                    const gt = cellOverrides[`${rowIdx}:det:${kKey}`];
                    cols.forEach(({ id, src }) => {
                      const predMap: Record<string,string|undefined> = {};
                      const t = (src || '').toString();
                      if (t && t !== '—') {
                        t.split(',').forEach(part => { const sp = part.split('='); const kk = sp[0]?.trim(); const vv = sp[1] != null ? String(sp[1]).trim() : undefined; if (kk) predMap[kk] = vv; });
                      }
                      const pred = predMap[kKey];
                      if ((gt && !pred) || (gt && pred && pred !== gt)) {
                        errors.push({ phrase, key: kKey, pred: pred ?? null, gt, type: pred ? 'false-accept' : 'unmatched', engine: id });
                      }
                    });
                  });
                });
                try {
                  const res = await fetch('/api/nlp/tune-contract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, locale: initial.locale, profile: { synonyms: fromCommaList(synonymsText), formatHints: fromCommaList(formatText), regex: regex || undefined, postProcess: tryParseJSON(postProcessText).value }, errors }) });
                  if (res.ok) {
                    const obj = await res.json();
                    const s = obj?.suggested || {};
                    if (Array.isArray(s.synonyms)) setSynonymsText(toCommaList(s.synonyms));
                    if (Array.isArray(s.formatHints)) setFormatText(toCommaList(s.formatHints));
                    if (typeof s.regex === 'string') setRegex(String(s.regex));
                    if (typeof s.postProcess !== 'undefined') setPostProcessText(typeof s.postProcess === 'string' ? s.postProcess : JSON.stringify(s.postProcess, null, 2));
                    await runAllRows();
                  }
                } catch {}
              }}
              style={{ border: '1px solid #f59e0b', background: '#7c2d12', color: '#ffedd5', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
              <Wrench size={16} />
            </button>
            {/* Report dropdown moved to the far right */}
            <div style={{ position: 'relative' }}>
              <button title="Report" onClick={() => setReportOpen(o => !o)} style={{ border: '1px solid #60a5fa', background: '#0c4a6e', color: '#dbeafe', borderRadius: 8, padding: '8px 10px', cursor: 'pointer' }}>
                <BarChart2 size={16} />
              </button>
              {reportOpen && (
                <div style={{ position: 'absolute', right: 0, marginTop: 6, background: '#111827', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 8, padding: 10, minWidth: 260, zIndex: 30 }}>
                  {(() => {
                    const base = baselineStats || { matched: 0, falseAccept: 0, totalGt: 0 };
                    const last = lastStats || base;
                    const pct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;
                    const gainedMatched = pct(last.matched, last.totalGt) - pct(base.matched, base.totalGt);
                    const removedFA = pct(base.falseAccept, base.totalGt) - pct(last.falseAccept, last.totalGt);
                    const stillUnmatch = Math.max(0, (last.totalGt - last.matched - last.falseAccept));
                    const stillFA = last.falseAccept;
                    const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);
                    return (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div><strong>Gained Matched:</strong> {sign(gainedMatched)}%</div>
                        <div><strong>Removed False acceptance:</strong> {sign(removedFA)}%</div>
                        <div><strong>Still UnMatching:</strong> {stillUnmatch}</div>
                        <div><strong>Still False acceptance:</strong> {stillFA} ({sign(pct(last.falseAccept, last.totalGt) - pct(base.falseAccept, base.totalGt))}%)</div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          {/* Grid - show only when no editor is active */}
          {!activeEditor && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' as any }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: '#f9fafb' }}>Frase</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.regex }} title={COLUMN_LABELS.regex.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{COLUMN_LABELS.regex.main}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({COLUMN_LABELS.regex.tech})</span>
                      </div>
                      <button
                        onClick={() => setActiveEditor(activeEditor === 'regex' ? null : 'regex')}
                        title="Configure Regex"
                        style={{
                          background: activeEditor === 'regex' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Wand2 size={14} color={activeEditor === 'regex' ? '#fff' : '#666'} />
                      </button>
                    </div>
                  </th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.deterministic }} title={COLUMN_LABELS.deterministic.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{COLUMN_LABELS.deterministic.main}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({COLUMN_LABELS.deterministic.tech})</span>
                      </div>
                      <button
                        onClick={() => setActiveEditor(activeEditor === 'extractor' ? null : 'extractor')}
                        title="Configure Extractor"
                        style={{
                          background: activeEditor === 'extractor' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Wand2 size={14} color={activeEditor === 'extractor' ? '#fff' : '#666'} />
                      </button>
                    </div>
                  </th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.ner }} title={COLUMN_LABELS.ner.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{COLUMN_LABELS.ner.main}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({COLUMN_LABELS.ner.tech})</span>
                      </div>
                      <button
                        onClick={() => setActiveEditor(activeEditor === 'ner' ? null : 'ner')}
                        title="Configure NER"
                        style={{
                          background: activeEditor === 'ner' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Wand2 size={14} color={activeEditor === 'ner' ? '#fff' : '#666'} />
                      </button>
                    </div>
                  </th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.llm }} title={COLUMN_LABELS.llm.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{COLUMN_LABELS.llm.main}</span>
                        <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>({COLUMN_LABELS.llm.tech})</span>
                      </div>
                      <button
                        onClick={() => setActiveEditor(activeEditor === 'llm' ? null : 'llm')}
                        title="Configure LLM"
                        style={{
                          background: activeEditor === 'llm' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Wand2 size={14} color={activeEditor === 'llm' ? '#fff' : '#666'} />
                      </button>
                    </div>
                  </th>
                  <th style={{ width: 46, background: '#f9fafb' }}></th>
                </tr>
              </thead>
              <tbody>
                {examplesList.map((ex, i) => {
                  const rr = rowResults[i] || {};
                  const leading = rr.running ? (
                    <span title="Analisi in corso" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />
                  ) : null;
                  const ms = (v?: number) => (typeof v === 'number' ? ` (${v} ms)` : '');
                  const maxMs = Math.max(rr.detMs || 0, rr.nerMs || 0, rr.llmMs || 0);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer', background: selectedRow===i ? '#fff7ed' : '#fff' }} onClick={() => { setSelectedRow(i); }}>
                      <td style={{ padding: 8, fontSize: 15, wordBreak: 'break-word' }}>
                        {leading}
                        {rr.spans && rr.spans.length ? (
                          <span>
                            {(() => {
                              const spans = [...(rr.spans || [])].sort((a: any, b: any) => a.start - b.start);
                              const parts: Array<{ t: string; hit: boolean }> = [];
                              let j = 0;
                              for (const s of spans) { if (s.start > j) parts.push({ t: ex.slice(j, s.start), hit: false }); parts.push({ t: ex.slice(s.start, s.end), hit: true }); j = s.end; }
                              if (j < ex.length) parts.push({ t: ex.slice(j), hit: false });
                              return parts.map((p, k) => (
                                <span
                                  key={k}
                                  style={p.hit
                                    ? { background: 'rgba(251, 191, 36, 0.25)', border: '1px solid rgba(251, 191, 36, 0.55)', borderRadius: 6, padding: '0 3px', margin: '0 1px', fontWeight: 700 }
                                    : { background: 'transparent' }
                                  }
                                >{p.t}</span>
                              ));
                            })()}
                          </span>
                        ) : ex}
                      </td>
                      <td 
                        style={{ padding: 8, fontSize: 15, color: '#374151', overflow: 'visible', background: EXTRACTOR_COLORS.regex, position: 'relative', verticalAlign: 'top' }}
                        onMouseEnter={() => setHoveredCell(`${i}-regex`)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {(rr.regex || '—') + ms(rr.regexMs)}
                          </div>
                          {(hoveredCell === `${i}-regex` || cellNotes[`${i}-regex`]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(editingNote === `${i}-regex` ? null : `${i}-regex`);
                              }}
                              title={cellNotes[`${i}-regex`] ? "Edit note" : "Add note"}
                              style={{
                                background: cellNotes[`${i}-regex`] ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 4,
                                flexShrink: 0
                              }}
                            >
                              <MessageCircle size={12} color={cellNotes[`${i}-regex`] ? '#fff' : '#666'} />
                            </button>
                          )}
                        </div>
                        {(cellNotes[`${i}-regex`] || editingNote === `${i}-regex`) && (
                          <>
                            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
                            {editingNote === `${i}-regex` ? (
                              <div>
                                <textarea
                                  value={cellNotes[`${i}-regex`] || ''}
                                  onChange={(e) => setCellNotes({...cellNotes, [`${i}-regex`]: e.target.value})}
                                  placeholder="Add note..."
                                  rows={2}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: 4,
                                    fontSize: 11,
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.9)',
                                    resize: 'vertical'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    💾
                                  </button>
                                  {cellNotes[`${i}-regex`] && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCellNotes({...cellNotes, [`${i}-regex`]: ''}); setEditingNote(null); }}
                                      style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666', display: 'flex', gap: 4, alignItems: 'start' }}>
                                <MessageCircle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ wordBreak: 'break-word' }}>{cellNotes[`${i}-regex`]}</span>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td 
                        style={{ padding: 8, fontSize: 15, color: '#374151', overflow: 'visible', background: EXTRACTOR_COLORS.deterministic, position: 'relative', verticalAlign: 'top' }}
                        onMouseEnter={() => setHoveredCell(`${i}-deterministic`)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {rr.detRunning && <span title="Deterministic" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                            {renderStackedSummary(rr.deterministic, i, 'det')}
                            {renderTimeBar(rr.detMs, maxMs)}
                          </div>
                          {(hoveredCell === `${i}-deterministic` || cellNotes[`${i}-deterministic`]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(editingNote === `${i}-deterministic` ? null : `${i}-deterministic`);
                              }}
                              title={cellNotes[`${i}-deterministic`] ? "Edit note" : "Add note"}
                              style={{
                                background: cellNotes[`${i}-deterministic`] ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 4,
                                flexShrink: 0
                              }}
                            >
                              <MessageCircle size={12} color={cellNotes[`${i}-deterministic`] ? '#fff' : '#666'} />
                            </button>
                          )}
                        </div>
                        {(cellNotes[`${i}-deterministic`] || editingNote === `${i}-deterministic`) && (
                          <>
                            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
                            {editingNote === `${i}-deterministic` ? (
                              <div>
                                <textarea
                                  value={cellNotes[`${i}-deterministic`] || ''}
                                  onChange={(e) => setCellNotes({...cellNotes, [`${i}-deterministic`]: e.target.value})}
                                  placeholder="Add note..."
                                  rows={2}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: 4,
                                    fontSize: 11,
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.9)',
                                    resize: 'vertical'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    💾
                                  </button>
                                  {cellNotes[`${i}-deterministic`] && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCellNotes({...cellNotes, [`${i}-deterministic`]: ''}); setEditingNote(null); }}
                                      style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666', display: 'flex', gap: 4, alignItems: 'start' }}>
                                <MessageCircle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ wordBreak: 'break-word' }}>{cellNotes[`${i}-deterministic`]}</span>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td 
                        style={{ padding: 8, fontSize: 15, color: '#374151', overflow: 'visible', background: EXTRACTOR_COLORS.ner, position: 'relative', verticalAlign: 'top' }}
                        onMouseEnter={() => setHoveredCell(`${i}-ner`)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {rr.nerRunning && <span title="NER" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #34d399', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                            {renderStackedSummary(rr.ner, i, 'ner')}
                            {renderTimeBar(rr.nerMs, maxMs)}
                          </div>
                          {(hoveredCell === `${i}-ner` || cellNotes[`${i}-ner`]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(editingNote === `${i}-ner` ? null : `${i}-ner`);
                              }}
                              title={cellNotes[`${i}-ner`] ? "Edit note" : "Add note"}
                              style={{
                                background: cellNotes[`${i}-ner`] ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 4,
                                flexShrink: 0
                              }}
                            >
                              <MessageCircle size={12} color={cellNotes[`${i}-ner`] ? '#fff' : '#666'} />
                            </button>
                          )}
                        </div>
                        {(cellNotes[`${i}-ner`] || editingNote === `${i}-ner`) && (
                          <>
                            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
                            {editingNote === `${i}-ner` ? (
                              <div>
                                <textarea
                                  value={cellNotes[`${i}-ner`] || ''}
                                  onChange={(e) => setCellNotes({...cellNotes, [`${i}-ner`]: e.target.value})}
                                  placeholder="Add note..."
                                  rows={2}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: 4,
                                    fontSize: 11,
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.9)',
                                    resize: 'vertical'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    💾
                                  </button>
                                  {cellNotes[`${i}-ner`] && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCellNotes({...cellNotes, [`${i}-ner`]: ''}); setEditingNote(null); }}
                                      style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666', display: 'flex', gap: 4, alignItems: 'start' }}>
                                <MessageCircle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ wordBreak: 'break-word' }}>{cellNotes[`${i}-ner`]}</span>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td 
                        style={{ padding: 8, fontSize: 15, color: '#374151', overflow: 'visible', background: EXTRACTOR_COLORS.llm, position: 'relative', verticalAlign: 'top' }}
                        onMouseEnter={() => setHoveredCell(`${i}-llm`)}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {rr.llmRunning && <span title="LLM" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                            {renderStackedSummary(rr.llm, i, 'llm')}
                            {renderTimeBar(rr.llmMs, maxMs)}
                          </div>
                          {(hoveredCell === `${i}-llm` || cellNotes[`${i}-llm`]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingNote(editingNote === `${i}-llm` ? null : `${i}-llm`);
                              }}
                              title={cellNotes[`${i}-llm`] ? "Edit note" : "Add note"}
                              style={{
                                background: cellNotes[`${i}-llm`] ? '#3b82f6' : 'rgba(255,255,255,0.5)',
                                border: 'none',
                                borderRadius: 4,
                                padding: 4,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                marginLeft: 4,
                                flexShrink: 0
                              }}
                            >
                              <MessageCircle size={12} color={cellNotes[`${i}-llm`] ? '#fff' : '#666'} />
                            </button>
                          )}
                        </div>
                        {(cellNotes[`${i}-llm`] || editingNote === `${i}-llm`) && (
                          <>
                            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
                            {editingNote === `${i}-llm` ? (
                              <div>
                                <textarea
                                  value={cellNotes[`${i}-llm`] || ''}
                                  onChange={(e) => setCellNotes({...cellNotes, [`${i}-llm`]: e.target.value})}
                                  placeholder="Add note..."
                                  rows={2}
                                  autoFocus
                                  style={{
                                    width: '100%',
                                    padding: 4,
                                    fontSize: 11,
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    background: 'rgba(255,255,255,0.9)',
                                    resize: 'vertical'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    💾
                                  </button>
                                  {cellNotes[`${i}-llm`] && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setCellNotes({...cellNotes, [`${i}-llm`]: ''}); setEditingNote(null); }}
                                      style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                    >
                                      🗑️
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setEditingNote(null); }}
                                    style={{ padding: '2px 6px', fontSize: 11, cursor: 'pointer', borderRadius: 3, border: '1px solid #ddd' }}
                                  >
                                    ❌
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, fontStyle: 'italic', color: '#666', display: 'flex', gap: 4, alignItems: 'start' }}>
                                <MessageCircle size={10} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ wordBreak: 'break-word' }}>{cellNotes[`${i}-llm`]}</span>
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    <td style={{ padding: 4, textAlign: 'center' }}>
                      <button title="Prova riga" onClick={(e) => { e.stopPropagation(); void runRowTest(i); }} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: 6, cursor: 'pointer' }}>
                        <Play size={14} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
                {examplesList.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>— nessuna frase —</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {/* Inline Editors - show when activeEditor is set */}
          {activeEditor && (
            <div style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: 8, 
              padding: 16,
              background: '#f9fafb',
              animation: 'fadeIn 0.2s ease-in'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                  {activeEditor === 'regex' && '🪄 Configure Regex'}
                  {activeEditor === 'extractor' && '🪄 Configure Extractor'}
                  {activeEditor === 'ner' && '🪄 Configure NER'}
                  {activeEditor === 'llm' && '🪄 Configure LLM'}
                </h3>
                <button
                  onClick={() => setActiveEditor(null)}
                  style={{
                    background: '#e5e7eb',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                >
                  ❌ Close
                </button>
              </div>

              {activeEditor === 'regex' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, opacity: 0.8 }}>Regex Pattern</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      ref={regexInputRef}
                      value={
                        generatingRegex 
                          ? "⏳ Creating regex..." 
                          : (regexAiMode ? regexAiPrompt : regex)
                      }
                      onChange={(e) => {
                        if (regexAiMode && !generatingRegex) {
                          setRegexAiPrompt(e.target.value);
                        } else if (!generatingRegex) {
                          setRegex(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        // ESC key: exit AI mode and restore original regex
                        if (e.key === 'Escape' && regexAiMode) {
                          setRegexAiMode(false);
                          // Keep regexAiPrompt in memory for future iterations
                          // Restore the original regex (even if it was empty!)
                          setRegex(regexBackup);
                          e.preventDefault();
                          console.log('[AI Regex] Cancelled via ESC - restored:', regexBackup, '- prompt kept in memory');
                        }
                      }}
                      placeholder={
                        regexAiMode && !generatingRegex 
                          ? "Describe here what the regex should match (in English)" 
                          : "es. \\b\\d{5}\\b"
                      }
                      disabled={generatingRegex}
                      style={{ 
                        flex: 1, 
                        padding: 10, 
                        border: regexAiMode ? '2px solid #3b82f6' : '1px solid #ddd',
                        borderRadius: 8, 
                        fontFamily: regexAiMode ? 'inherit' : 'monospace',
                        backgroundColor: generatingRegex ? '#f9fafb' : (regexAiMode ? '#eff6ff' : '#fff'),
                        transition: 'all 0.2s ease'
                      }}
                    />
                    
                    {/* Show WAND ONLY in normal mode (NOT in AI mode) */}
                    {!regexAiMode && (
                      <button
                        type="button"
                        onClick={() => {
                          // Save current regex before entering AI mode (even if empty!)
                          setRegexBackup(regex);
                          setRegexAiMode(true);
                          // Keep regexAiPrompt in memory - don't reset it!
                          // Give focus to input after state update
                          setTimeout(() => {
                            regexInputRef.current?.focus();
                          }, 0);
                        }}
                        disabled={generatingRegex}
                        title="Generate regex with AI"
                        style={{
                          padding: 10,
                          border: '1px solid #ddd',
                          borderRadius: 8,
                          background: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 40,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Wand2 size={16} color='#666' />
                      </button>
                    )}
                    
                    {/* Show CREATE BUTTON when: AI mode AND at least 5 characters */}
                    {regexAiMode && regexAiPrompt.trim().length >= 5 && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!regexAiPrompt.trim()) return;
                          
                          setGeneratingRegex(true);
                          try {
                            console.log('[AI Regex] Generating regex for:', regexAiPrompt);
                            
                            const response = await fetch('/api/nlp/generate-regex', { 
                              method: 'POST', 
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ description: regexAiPrompt })
                            });
                            
                            if (!response.ok) {
                              const error = await response.json();
                              throw new Error(error.detail || 'Failed to generate regex');
                            }
                            
                            const data = await response.json();
                            console.log('[AI Regex] Response:', data);
                            
                            if (data.success && data.regex) {
                              setRegex(data.regex);
                              console.log('[AI Regex] Regex generated successfully:', data.regex);
                              
                              if (data.explanation) {
                                console.log('[AI Regex] Explanation:', data.explanation);
                                console.log('[AI Regex] Examples:', data.examples);
                              }
                              
                              // Exit AI mode and return to normal
                              // Keep regexAiPrompt in memory for future iterations
                              setRegexAiMode(false);
                            } else {
                              throw new Error('No regex returned from API');
                            }
                          } catch (error) {
                            console.error('[AI Regex] Error:', error);
                            alert(`Error generating regex: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          } finally {
                            setGeneratingRegex(false);
                          }
                        }}
                        disabled={generatingRegex}
                        title="Generate regex from description"
                        style={{
                          padding: '10px 16px',
                          border: '2px solid #3b82f6',
                          borderRadius: 8,
                          background: generatingRegex ? '#f3f4f6' : '#3b82f6',
                          color: '#fff',
                          cursor: generatingRegex ? 'default' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          fontWeight: 500,
                          minWidth: 120,
                          justifyContent: 'center',
                          transition: 'all 0.2s ease',
                          animation: 'fadeIn 0.2s ease-in'
                        }}
                      >
                        {generatingRegex ? (
                          <>
                            <span style={{ 
                              display: 'inline-block', 
                              width: 14, 
                              height: 14, 
                              border: '2px solid #fff',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 0.8s linear infinite'
                            }} />
                            <span>Creating...</span>
                          </>
                        ) : (
                          'Create Regex'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeEditor === 'extractor' && (
                <div>
                  <NLPCompactEditor
                    synonymsText={synonymsText}
                    setSynonymsText={setSynonymsText}
                    formatText={formatText}
                    setFormatText={setFormatText}
                  />
                </div>
              )}

              {activeEditor === 'ner' && (
                <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                  <p>NER configuration coming soon...</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    Enable/disable NER and set confidence threshold
                  </p>
                </div>
              )}

              {activeEditor === 'llm' && (
                <div style={{ padding: 16, textAlign: 'center', color: '#666' }}>
                  <p>LLM prompt editor coming soon...</p>
                  <p style={{ fontSize: 12, marginTop: 8 }}>
                    Configure custom prompts for AI extraction
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Details panel rimosso */}
      </div>
    </div>
  );
}


