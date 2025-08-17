import React from 'react';
import { Play } from 'lucide-react';
import { extractField } from '../../../nlp/pipeline';
import { nerExtract } from '../../../nlp/services/nerClient';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';
import { Calendar, Mail, Phone, Hash, Globe, MapPin, User, FileText, CreditCard, CarFront as Car, Badge, Landmark, Type as TypeIcon, ChevronDown } from 'lucide-react';

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
    return {
      slotId: (node?.id || node?._id || node?.label || 'slot') as string,
      locale,
      kind: (node?.kind || p.kind || 'generic') as string,
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
  const [lockKind, setLockKind] = React.useState<boolean>(initial.kind === inferredKind);
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
  // Removed per-row bottom details panel state
  const [testing, setTesting] = React.useState<boolean>(false);
  const [jsonError, setJsonError] = React.useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = React.useState<'regex' | 'nlp' | 'post' | null>('nlp');
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

  // Sync form when node changes
  React.useEffect(() => {
    setKind(lockKind ? 'auto' : initial.kind);
    setSynonymsText(toCommaList(initial.synonyms));
    setRegex(initial.regex || '');
    setFormatText(toCommaList(initial.formatHints));
    setExamplesList(Array.isArray(initial.examples) ? initial.examples : []);
    setMinConf(initial.minConfidence || 0.6);
    setPostProcessText(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
    setNewExample('');
    setLockKind(initial.kind === inferredKind);
    setSelectedRow(null);
    setRowResults([]);
    setWaitingEsc1(initial.waitingEsc1 || '');
    setWaitingEsc2(initial.waitingEsc2 || '');
  }, [initial.slotId, inferredKind, lockKind]);

  // Keep kind synced with inferred when locked
  React.useEffect(() => {
    if (lockKind) setKind('auto');
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
    return {
      slotId: initial.slotId,
      locale: initial.locale,
      kind,
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
  }, [node, initial.slotId, initial.locale, kind, synonymsText, regex, formatText, examplesList, minConf, postProcessText, waitingEsc1, waitingEsc2]);

  const lastSentJsonRef = React.useRef<string>('');
  React.useEffect(() => {
    const json = JSON.stringify(profile);
    if (json !== lastSentJsonRef.current) {
      lastSentJsonRef.current = json;
      onChange?.(profile);
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
    if (s === 'date') return 'dateOfBirth';
    if (s === 'email') return 'email';
    if (s === 'phone') return 'phone';
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
  const renderStackedSummary = (summary?: string) => {
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
          const present = typeof kv[k] !== 'undefined' && kv[k] !== '';
          return <span key={k} style={{ color: present ? '#0b0f17' : '#9ca3af' }}>{k}: {present ? kv[k] : '—'}</span>;
        })}
      </div>
    );
  };

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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) minmax(140px, 200px) 1fr', alignItems: 'end', gap: 12 }}>
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
                  <button type="button" onClick={() => setKindOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: 6, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
                    <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}><selectedKindOpt.Icon /></span>
                    <span style={{ flex: 1, textAlign: 'left' }}>{selectedKindOpt.label}</span>
                    <ChevronDown size={14} color="#9ca3af" />
                  </button>
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
            <input type="number" min={0} max={1} step={0.05} value={minConf} onChange={(e) => setMinConf(parseFloat(e.target.value))} style={{ width: '100%', maxWidth: 120, padding: 6, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          {/* Tabs */}
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ display: 'inline-flex', gap: 8 }}>
                {(() => {
                  const base = { padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer' } as React.CSSProperties;
                  const activeStyle = { background: '#dbeafe', fontWeight: 700 } as React.CSSProperties; // solid (non-trasparente)
                  const inactiveStyle = { background: 'transparent', fontWeight: 400 } as React.CSSProperties;
                  return (
                    <>
                      <button onClick={() => setActiveTab(t => t==='regex' ? null : 'regex')} style={{ ...base, ...(activeTab==='regex' ? activeStyle : inactiveStyle) }}>Regex</button>
                      <button onClick={() => setActiveTab(t => t==='nlp' ? null : 'nlp')} style={{ ...base, ...(activeTab==='nlp' ? activeStyle : inactiveStyle) }}>NLP</button>
                      <button onClick={() => setActiveTab(t => t==='post' ? null : 'post')} style={{ ...base, ...(activeTab==='post' ? activeStyle : inactiveStyle) }}>Post Processing</button>
                    </>
                  );
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, marginLeft: 12 }}>
                <div>
                  <label style={{ fontSize: 12, opacity: 0.8, display: 'block', marginBottom: 4 }}>Waiting 1° escalation</label>
                  <input value={waitingEsc1} onChange={(e) => setWaitingEsc1(e.target.value)} title="Testo mostrato all'utente mentre si attende la 1ª escalation (passaggio a NER)" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, opacity: 0.8, display: 'block', marginBottom: 4 }}>Waiting 2° escalation</label>
                  <input value={waitingEsc2} onChange={(e) => setWaitingEsc2(e.target.value)} title="Testo mostrato all'utente mentre si attende la 2ª escalation (passaggio a LLM)" style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Area editor per tab selezionato */}
        <div style={{ marginTop: 10 }}>
          {activeTab === 'regex' && (
            <RegexEditor value={regex} onChange={setRegex} />
          )}
          {activeTab === 'nlp' && (
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
              style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 8 }}
            />
            <button onClick={() => {
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
            }} style={{ background: '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Aggiungi</button>
            <button onClick={runAllRows} disabled={testing || examplesList.length === 0} style={{ background: testing ? '#fbbf24' : '#34d399', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: testing ? 'default' : 'pointer' }}>{testing ? 'Analizzo…' : 'Prova tutte'}</button>
          </div>
          {/* Grid */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f3f4f6' }}>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>Frase</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>Regex</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>Deterministic</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>NER</th>
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>LLM</th>
                  <th style={{ width: 46 }}></th>
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
                      <td style={{ padding: 8, fontSize: 15 }}>
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
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>{(rr.regex || '—') + ms(rr.regexMs)}</td>
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>
                        {rr.detRunning && <span title="Deterministic" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                        {renderStackedSummary(rr.deterministic)}
                        {renderTimeBar(rr.detMs, maxMs)}
                      </td>
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>
                        {rr.nerRunning && <span title="NER" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #34d399', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                        {renderStackedSummary(rr.ner)}
                        {renderTimeBar(rr.nerMs, maxMs)}
                      </td>
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>
                        {rr.llmRunning && <span title="LLM" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                        {renderStackedSummary(rr.llm)}
                        {renderTimeBar(rr.llmMs, maxMs)}
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
          {/* Details panel rimosso */}
      </div>
    </div>
  );
}


