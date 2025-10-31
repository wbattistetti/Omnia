import React from 'react';
import { Play, Wand2, MessageCircle } from 'lucide-react';
import { extractField } from '../../../nlp/pipeline';
import { nerExtract } from '../../../nlp/services/nerClient';
import { databaseService } from '../../../nlp/services/databaseService';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';
import { Calendar, Mail, Phone, Hash, Globe, MapPin, User, FileText, CreditCard, CarFront as Car, Badge, Landmark, Type as TypeIcon, ChevronDown, Plus, ChevronsRight, Wrench, BarChart2 } from 'lucide-react';
import nlpTypesConfig from '../../../../config/nlp-types.json';

// 🎯 Custom Hooks
import { useNotes } from './hooks/useNotes';
import { useEditorState } from './hooks/useEditorState';
import { useProfileState } from './hooks/useProfileState';

// 🎨 Config Components
import KindSelector from './Config/KindSelector';
import ConfidenceInput from './Config/ConfidenceInput';
import WaitingMessagesConfig from './Config/WaitingMessagesConfig';

// 📝 Note Components
import NoteButton from './CellNote/NoteButton';
import NoteEditor from './CellNote/NoteEditor';
import NoteDisplay from './CellNote/NoteDisplay';
import NoteSeparator from './CellNote/NoteSeparator';

// ✏️ Inline Editors
import RegexInlineEditor from './InlineEditors/RegexInlineEditor';
import ExtractorInlineEditor from './InlineEditors/ExtractorInlineEditor';
import NERInlineEditor from './InlineEditors/NERInlineEditor';
import LLMInlineEditor from './InlineEditors/LLMInlineEditor';

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

// Helper functions moved to useProfileState hook
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
  // Profile state management (extracted to hook)
  const {
    lockKind,
    setLockKind,
    kind,
    setKind,
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
    profile,
  } = useProfileState(node, locale, onChange);

  // Testing state
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
    running?: boolean;
    detRunning?: boolean;
    nerRunning?: boolean;
    llmRunning?: boolean;
    spans?: Array<{start:number;end:number}>;
    value?: string;
    confidence?: number;
    variables?: Record<string, any>;
  }>>([]);
  const [editingCell, setEditingCell] = React.useState<{
    row: number;
    col: 'det' | 'ner' | 'llm';
    key: string;
  } | null>(null);
  const [editingText, setEditingText] = React.useState<string>('');
  const [cellOverrides, setCellOverrides] = React.useState<Record<string, string>>({});
  const [testing, setTesting] = React.useState<boolean>(false);
  const [baselineStats, setBaselineStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [lastStats, setLastStats] = React.useState<{ matched: number; falseAccept: number; totalGt: number } | null>(null);
  const [reportOpen, setReportOpen] = React.useState<boolean>(false);
  const [activeTab, setActiveTab] = React.useState<'regex' | 'extractor' | 'post' | null>(null);

  // 🎯 Use custom hooks
  const {
    notes: cellNotes,
    getNote,
    hasNote,
    addNote,
    deleteNote,
    startEditing,
    stopEditing,
    isEditing,
    setHovered,
    isHovered
  } = useNotes();

  const {
    activeEditor,
    openEditor,
    closeEditor,
    toggleEditor,
    isEditorOpen,
    isAnyEditorOpen
  } = useEditorState();

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
    console.log('[NLP_TESTER] mapKindToField called with:', k);
    const s = (k || '').toLowerCase();
    console.log('[NLP_TESTER] s value after lowercase:', s);

    // ✅ SPECIAL MAPPING: number → age (per estrazione età) - PRIMA di tutto!
    if (s === 'number') {
      console.log('[NLP_TESTER] Entering number special mapping block');
      // Controlla se il contesto suggerisce "age"
      const synonyms = toCommaList(fromCommaList(synonymsText)).toLowerCase();
      const examplesText = (examplesList || []).join(' ').toLowerCase();

      const hasAgeWords = /(età|age|anni|vecchio|giovane)/i.test(synonyms);
      const hasAgeExamples = /(18|21|30|40|50|60|70|80|90|100)/.test(examplesText);

      console.log('[NLP_TESTER] Age detection debug:', {
        synonyms: synonymsText,
        examples: examplesList,
        hasAgeWords,
        hasAgeExamples
      });

      if (hasAgeWords || hasAgeExamples) {
        console.log('[NLP_TESTER] auto-map number → age (age context detected)');
        return 'age';
      }
    }

    // ✅ Use extractorMapping from config (DOPO il controllo speciale)
    const extractorMapping = nlpTypesConfig.extractorMapping as Record<string, string>;
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

    // Regex (sync) - always runs
    const t0Regex = performance.now();
    const regexRes = extractRegexOnly(phrase);
    update({ regex: regexRes.summary, regexMs: Math.round(performance.now() - t0Regex), spans: regexRes.spans });

    const field = mapKindToField(kind);

    console.log('[NLP_TESTER] Field mapping:', {
      originalKind: kind,
      mappedField: field,
      profileKind: profile.kind,
      synonyms: synonymsText,
      examples: examplesList
    });

    // Deterministic async task - only if enabled
    const detTask = enabledMethods.deterministic ? (async () => {
      const t0 = performance.now();
      update({ detRunning: true });
      try {
        // Run extraction for this row
        const finalResult = await extractField<any>(field, phrase);

        // Use individual results for each column
        const detSummary = finalResult.allResults?.deterministic ? summarizeResult(finalResult.allResults.deterministic, field) : "—";
        const nerSummary = finalResult.allResults?.ner ? summarizeResult(finalResult.allResults.ner, field) : "—";
        const llmSummary = finalResult.allResults?.llm ? summarizeResult(finalResult.allResults.llm, field) : "—";

        // eslint-disable-next-line no-console
        console.log('[NLP_TESTER] Extraction results:', {
          deterministic: finalResult.allResults?.deterministic,
          ner: finalResult.allResults?.ner,
          llm: finalResult.allResults?.llm
        });

        // eslint-disable-next-line no-console
        console.log('[NLP_TESTER] summarizeResult output:', {
          deterministic: detSummary,
          ner: nerSummary,
          llm: llmSummary
        });

        update({
          deterministic: detSummary,
          ner: nerSummary,
          llm: llmSummary,
          status: 'done',
          detMs: Math.round(performance.now() - t0),
          detRunning: false
        });
      } catch {
        update({ deterministic: '—', detMs: Math.round(performance.now() - t0), detRunning: false });
      }
    })() : Promise.resolve();

    // NER async task - only if enabled
    const nerTask = enabledMethods.ner ? (async () => {
      const t0 = performance.now();
      update({ nerRunning: true });
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
      })() : Promise.resolve();

    // LLM async task - only if enabled
    const llmTask = enabledMethods.llm ? (async () => {
      const t0 = performance.now();
      update({ llmRunning: true });
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
    })() : Promise.resolve();

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

  // State for enabled extraction methods
  const [enabledMethods, setEnabledMethods] = React.useState({
    regex: true,
    deterministic: true,
    ner: true,
    llm: true
  });

  // Toggle method enabled/disabled
  const toggleMethod = (method: keyof typeof enabledMethods) => {
    setEnabledMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
  };

  // Helper function to summarize extraction results
  const summarizeResult = (result: any, currentField: string): string => {
    try {
      if (!result || result.status !== 'accepted' || result.value === undefined || result.value === null)
        return "—";

      // For age (number), show the value directly
      if (currentField === 'age') {
        return `value=${result.value}`;
      }

      // For other fields, use existing logic
      if (currentField === 'dateOfBirth') {
        const v: any = result.value || {};
        return summarizeVars({ day: v.day, month: v.month, year: v.year },
          v.day && v.month && v.year ? `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}` : undefined);
      } else if (currentField === 'phone') {
        const v: any = result.value || {};
        return v.e164 ? `value=${v.e164}` : '—';
      } else if (currentField === 'email') {
        return result.value ? `value=${String(result.value)}` : '—';
      } else {
        return result.value ? `value=${String(result.value)}` : '—';
      }
    } catch (error) {
      console.error('[NLP_TESTER] summarizeResult error:', error, { result, currentField });
      return "—";
    }
  };

  // Function to save current config to global database
  const saveToGlobal = async () => {
    try {
      // Create config from current profile
      const globalConfig: NLPConfigDB = {
        supportedKinds: [profile.kind],
        aliases: {},
        extractorMapping: { [profile.kind]: profile.kind },
        typeMetadata: {
          [profile.kind]: {
            description: profile.description || `Extractor for ${profile.kind}`,
            examples: profile.examples || [],
            regex: profile.regex ? [profile.regex] : undefined,
            // TODO: Add more fields from profile
          }
        },
        aiPrompts: {},  // Required field
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        permissions: { canEdit: true, canCreate: true, canDelete: false },
        auditLog: true
      };

      const success = await databaseService.saveNLPConfig(globalConfig);
      if (success) {
        alert('Configuration saved to global database!');
      } else {
        alert('Failed to save configuration.');
      }
    } catch (error) {
      console.error('Error saving to global:', error);
      alert('Error saving configuration: ' + error.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header compatto + tab editor */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 80px 1fr', alignItems: 'end', gap: 12 }}>
          {/* Kind Selector Component */}
          <KindSelector
            kind={kind}
            setKind={setKind}
            lockKind={lockKind}
            setLockKind={setLockKind}
            inferredKind={inferredKind}
          />

          {/* Confidence Component */}
          <ConfidenceInput value={minConf} onChange={setMinConf} />

          {/* Waiting Messages Component */}
          <WaitingMessagesConfig
            waitingNER={waitingEsc1}
            setWaitingNER={setWaitingEsc1}
            waitingLLM={waitingEsc2}
            setWaitingLLM={setWaitingEsc2}
          />
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

      {/* 🎨 Tester section - hidden when inline editor is active */}
      {!activeEditor && (
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
          {/* 🎨 Grid - already hidden by parent !activeEditor condition */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' as any }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: '#f9fafb' }}>Frase</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.regex, opacity: enabledMethods.regex ? 1 : 0.4 }} title={COLUMN_LABELS.regex.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={enabledMethods.regex}
                          onChange={() => toggleMethod('regex')}
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, color: enabledMethods.regex ? '#0b0f17' : '#9ca3af' }}>{COLUMN_LABELS.regex.main}</span>
                          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: enabledMethods.regex ? '#0b0f17' : '#9ca3af' }}>({COLUMN_LABELS.regex.tech})</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEditor('regex')}
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
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.deterministic, opacity: enabledMethods.deterministic ? 1 : 0.4 }} title={COLUMN_LABELS.deterministic.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={enabledMethods.deterministic}
                          onChange={() => toggleMethod('deterministic')}
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, color: enabledMethods.deterministic ? '#0b0f17' : '#9ca3af' }}>{COLUMN_LABELS.deterministic.main}</span>
                          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: enabledMethods.deterministic ? '#0b0f17' : '#9ca3af' }}>({COLUMN_LABELS.deterministic.tech})</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => toggleEditor('extractor')}
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
                        <button
                          onClick={() => toggleEditor('post')}
                          title="Configure Post Process"
                          style={{
                            background: activeEditor === 'post' ? '#10b981' : 'rgba(255,255,255,0.3)',
                            border: 'none',
                            borderRadius: 4,
                            padding: '4px 6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                        >
                          <TypeIcon size={14} color={activeEditor === 'post' ? '#fff' : '#666'} />
                        </button>
                      </div>
                    </div>
                  </th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.ner, opacity: enabledMethods.ner ? 1 : 0.4 }} title={COLUMN_LABELS.ner.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={enabledMethods.ner}
                          onChange={() => toggleMethod('ner')}
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, color: enabledMethods.ner ? '#0b0f17' : '#9ca3af' }}>{COLUMN_LABELS.ner.main}</span>
                          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: enabledMethods.ner ? '#0b0f17' : '#9ca3af' }}>({COLUMN_LABELS.ner.tech})</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEditor('ner')}
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
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.llm, opacity: enabledMethods.llm ? 1 : 0.4 }} title={COLUMN_LABELS.llm.tooltip}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={enabledMethods.llm}
                          onChange={() => toggleMethod('llm')}
                          style={{ cursor: 'pointer' }}
                        />
                        <div>
                          <span style={{ fontWeight: 600, color: enabledMethods.llm ? '#0b0f17' : '#9ca3af' }}>{COLUMN_LABELS.llm.main}</span>
                          <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: enabledMethods.llm ? '#0b0f17' : '#9ca3af' }}>({COLUMN_LABELS.llm.tech})</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleEditor('llm')}
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
                        style={{ padding: 8, fontSize: 15, color: enabledMethods.regex ? '#374151' : '#9ca3af', overflow: 'visible', background: EXTRACTOR_COLORS.regex, position: 'relative', verticalAlign: 'top', opacity: enabledMethods.regex ? 1 : 0.6 }}
                        onMouseEnter={() => setHovered(i, 'regex')}
                        onMouseLeave={() => setHovered(null, null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {enabledMethods.regex ? (rr.regex || '—') + ms(rr.regexMs) : '—'}
                          </div>
                          {(isHovered(i, 'regex') || hasNote(i, 'regex')) && enabledMethods.regex && (
                            <NoteButton
                              hasNote={hasNote(i, 'regex')}
                              onClick={() => isEditing(i, 'regex') ? stopEditing() : startEditing(i, 'regex')}
                            />
                          )}
                        </div>
                        {(getNote(i, 'regex') || isEditing(i, 'regex')) && enabledMethods.regex && (
                          <>
                            <NoteSeparator />
                            {isEditing(i, 'regex') ? (
                              <NoteEditor
                                value={getNote(i, 'regex')}
                                onSave={(text) => { addNote(i, 'regex', text); stopEditing(); }}
                                onDelete={() => { deleteNote(i, 'regex'); stopEditing(); }}
                                onCancel={stopEditing}
                              />
                            ) : (
                              <NoteDisplay text={getNote(i, 'regex')} />
                            )}
                          </>
                        )}
                      </td>
                      <td
                        style={{ padding: 8, fontSize: 15, color: enabledMethods.deterministic ? '#374151' : '#9ca3af', overflow: 'visible', background: EXTRACTOR_COLORS.deterministic, position: 'relative', verticalAlign: 'top', opacity: enabledMethods.deterministic ? 1 : 0.6 }}
                        onMouseEnter={() => setHovered(i, 'deterministic')}
                        onMouseLeave={() => setHovered(null, null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {enabledMethods.deterministic ? (
                              <>
                                {rr.detRunning && <span title="Deterministic" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                                {renderStackedSummary(rr.deterministic, i, 'det')}
                                {renderTimeBar(rr.detMs, maxMs)}
                              </>
                            ) : '—'}
                          </div>
                          {(isHovered(i, 'deterministic') || hasNote(i, 'deterministic')) && enabledMethods.deterministic && (
                            <NoteButton
                              hasNote={hasNote(i, 'deterministic')}
                              onClick={() => isEditing(i, 'deterministic') ? stopEditing() : startEditing(i, 'deterministic')}
                            />
                          )}
                        </div>
                        {(getNote(i, 'deterministic') || isEditing(i, 'deterministic')) && enabledMethods.deterministic && (
                          <>
                            <NoteSeparator />
                            {isEditing(i, 'deterministic') ? (
                              <NoteEditor
                                value={getNote(i, 'deterministic')}
                                onSave={(text) => { addNote(i, 'deterministic', text); stopEditing(); }}
                                onDelete={() => { deleteNote(i, 'deterministic'); stopEditing(); }}
                                onCancel={stopEditing}
                              />
                            ) : (
                              <NoteDisplay text={getNote(i, 'deterministic')} />
                            )}
                          </>
                        )}
                      </td>
                      <td
                        style={{ padding: 8, fontSize: 15, color: enabledMethods.ner ? '#374151' : '#9ca3af', overflow: 'visible', background: EXTRACTOR_COLORS.ner, position: 'relative', verticalAlign: 'top', opacity: enabledMethods.ner ? 1 : 0.6 }}
                        onMouseEnter={() => setHovered(i, 'ner')}
                        onMouseLeave={() => setHovered(null, null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {enabledMethods.ner ? (
                              <>
                                {rr.nerRunning && <span title="NER" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #34d399', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                                {renderStackedSummary(rr.ner, i, 'ner')}
                                {renderTimeBar(rr.nerMs, maxMs)}
                              </>
                            ) : '—'}
                          </div>
                          {(isHovered(i, 'ner') || hasNote(i, 'ner')) && enabledMethods.ner && (
                            <NoteButton
                              hasNote={hasNote(i, 'ner')}
                              onClick={() => isEditing(i, 'ner') ? stopEditing() : startEditing(i, 'ner')}
                            />
                          )}
                        </div>
                        {(getNote(i, 'ner') || isEditing(i, 'ner')) && enabledMethods.ner && (
                          <>
                            <NoteSeparator />
                            {isEditing(i, 'ner') ? (
                              <NoteEditor
                                value={getNote(i, 'ner')}
                                onSave={(text) => { addNote(i, 'ner', text); stopEditing(); }}
                                onDelete={() => { deleteNote(i, 'ner'); stopEditing(); }}
                                onCancel={stopEditing}
                              />
                            ) : (
                              <NoteDisplay text={getNote(i, 'ner')} />
                            )}
                          </>
                        )}
                      </td>
                      <td
                        style={{ padding: 8, fontSize: 15, color: enabledMethods.llm ? '#374151' : '#9ca3af', overflow: 'visible', background: EXTRACTOR_COLORS.llm, position: 'relative', verticalAlign: 'top', opacity: enabledMethods.llm ? 1 : 0.6 }}
                        onMouseEnter={() => setHovered(i, 'llm')}
                        onMouseLeave={() => setHovered(null, null)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            {enabledMethods.llm ? (
                              <>
                                {rr.llmRunning && <span title="LLM" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                                {renderStackedSummary(rr.llm, i, 'llm')}
                                {renderTimeBar(rr.llmMs, maxMs)}
                              </>
                            ) : '—'}
                          </div>
                          {(isHovered(i, 'llm') || hasNote(i, 'llm')) && enabledMethods.llm && (
                            <NoteButton
                              hasNote={hasNote(i, 'llm')}
                              onClick={() => isEditing(i, 'llm') ? stopEditing() : startEditing(i, 'llm')}
                            />
                          )}
                        </div>
                        {(getNote(i, 'llm') || isEditing(i, 'llm')) && enabledMethods.llm && (
                          <>
                            <NoteSeparator />
                            {isEditing(i, 'llm') ? (
                              <NoteEditor
                                value={getNote(i, 'llm')}
                                onSave={(text) => { addNote(i, 'llm', text); stopEditing(); }}
                                onDelete={() => { deleteNote(i, 'llm'); stopEditing(); }}
                                onCancel={stopEditing}
                              />
                            ) : (
                              <NoteDisplay text={getNote(i, 'llm')} />
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
      </div>
      )}

      {/* 🎨 Inline Editors - shown in place of Tester when activeEditor is set */}
      {/* 📐 Full-height container for inline editors */}
      {activeEditor && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, minHeight: 600 }}>
          {activeEditor === 'regex' && (
            <RegexInlineEditor
              regex={regex}
              setRegex={setRegex}
              onClose={closeEditor}
            />
          )}

          {activeEditor === 'extractor' && (
            <ExtractorInlineEditor
              onClose={closeEditor}
            />
          )}

          {activeEditor === 'ner' && (
            <NERInlineEditor onClose={closeEditor} />
          )}

          {activeEditor === 'llm' && (
            <LLMInlineEditor onClose={closeEditor} />
          )}

          {activeEditor === 'post' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Post Process Configuration</h3>
                <button
                  onClick={closeEditor}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  Close
                </button>
              </div>
              <PostProcessEditor value={postProcessText} onChange={setPostProcessText} />
              {jsonError && (
                <div style={{ color: '#b91c1c', fontSize: 12, padding: 8, background: '#fee2e2', borderRadius: 6 }}>
                  JSON Error: {jsonError}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Details panel rimosso */}

      {/* Save to Global Button */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <button
          onClick={saveToGlobal}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          💾 Save to Global Database
        </button>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
          Save this configuration to the global database for all projects
        </p>
      </div>
    </div>
  );
}


