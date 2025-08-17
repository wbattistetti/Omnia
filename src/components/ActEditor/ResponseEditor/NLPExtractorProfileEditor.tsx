import React from 'react';
import { Play } from 'lucide-react';
import { extractField } from '../../../nlp/pipeline';
import { nerExtract } from '../../../nlp/services/nerClient';
import RegexEditor from './RegexEditor';
import NLPCompactEditor from './NLPCompactEditor';
import PostProcessEditor from './PostProcessEditor';

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
    };
  }, [node, locale]);

  const inferredKind = React.useMemo(() => inferKindFromNode(node), [node]);
  const [lockKind, setLockKind] = React.useState<boolean>(initial.kind === inferredKind);
  const [kind, setKind] = React.useState<string>(initial.kind);
  const [synonymsText, setSynonymsText] = React.useState<string>(toCommaList(initial.synonyms));
  const [regex, setRegex] = React.useState<string>(initial.regex || '');
  const [formatText, setFormatText] = React.useState<string>(toCommaList(initial.formatHints));
  const [examplesList, setExamplesList] = React.useState<string[]>(Array.isArray(initial.examples) ? initial.examples : []);
  const [minConf, setMinConf] = React.useState<number>(initial.minConfidence || 0.6);
  const [postProcessText, setPostProcessText] = React.useState<string>(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
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
  const [activeTab, setActiveTab] = React.useState<'regex' | 'nlp' | 'post'>('nlp');
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

  // Sync form when node changes
  React.useEffect(() => {
    setKind(lockKind ? inferredKind : initial.kind);
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
  }, [initial.slotId, inferredKind, lockKind]);

  // Keep kind synced with inferred when locked
  React.useEffect(() => {
    if (lockKind) setKind(inferredKind);
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
    };
  }, [node, initial.slotId, initial.locale, kind, synonymsText, regex, formatText, examplesList, minConf, postProcessText]);

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
    // Auto-map generic → dateOfBirth when hints/examples suggest a date
    if (s === 'generic') {
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
        if (det.status === 'accepted') {
          if (field === 'dateOfBirth') {
            const v: any = det.value || {};
            detSummary = summarizeVars({ day: v.day, month: v.month, year: v.year }, v.day && v.month && v.year ? `${String(v.day).padStart(2,'0')}/${String(v.month).padStart(2,'0')}/${v.year}` : undefined);
          } else if (field === 'phone') {
            const v: any = det.value || {};
            detSummary = v.e164 ? `value=${v.e164}` : '—';
          } else if (field === 'email') {
            detSummary = det.value ? `value=${String(det.value)}` : '—';
          }
        } else if (det.status === 'ask-more' && det.value) {
          if (field === 'dateOfBirth') {
            const v: any = det.value || {};
            detSummary = summarizeVars({ day: v.day, month: v.month, year: v.year });
          }
        }
        update({ deterministic: detSummary, detMs: Math.round(performance.now() - t0), detRunning: false });
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
        if (Array.isArray(ner?.candidates) && ner.candidates.length > 0) {
          const c = ner.candidates[0];
          if (field === 'dateOfBirth') {
            nerSummary = summarizeVars({ day: c?.value?.day, month: c?.value?.month, year: c?.value?.year });
          } else if (field === 'phone') {
            nerSummary = c?.value ? `value=${String(c.value)}` : '—';
          } else if (field === 'email') {
            nerSummary = c?.value ? `value=${String(c.value)}` : '—';
          }
        }
        update({ ner: nerSummary, nerMs: Math.round(performance.now() - t0), nerRunning: false });
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
        if (res.ok) {
          const obj = await res.json();
          if (Array.isArray(obj?.candidates) && obj.candidates.length > 0) {
            const c = obj.candidates[0];
            if (field === 'dateOfBirth' && c?.value) llmSummary = summarizeVars({ day: c.value.day, month: c.value.month, year: c.value.year });
            else if (field === 'phone') llmSummary = c?.value ? `value=${String(c.value)}` : '—';
            else if (field === 'email') llmSummary = c?.value ? `value=${String(c.value)}` : '—';
            else llmSummary = c?.value ? `value=${String(c.value)}` : '—';
          }
        }
        update({ llm: llmSummary, llmMs: Math.round(performance.now() - t0), llmRunning: false });
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

  // Helpers to format summary into stacked key: value lines (day/month/year on separate lines)
  const renderStackedSummary = (summary?: string) => {
    const text = (summary || '—').toString();
    if (text === '—') return <div>—</div>;
    const lower = text.toLowerCase();
    const isDate = lower.includes('day=') || lower.includes('month=') || lower.includes('year=');
    if (!isDate) return <div>{text}</div>;
    // Parse simple k=v pairs separated by comma or space
    const kv: Record<string, string> = {};
    text.split(',').forEach(part => {
      const [k, v] = part.split('=').map(s => s && s.trim());
      if (k && typeof v !== 'undefined') kv[k] = v;
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        {typeof kv.day !== 'undefined' && <span>day: {kv.day || '—'}</span>}
        {typeof kv.month !== 'undefined' && <span>month: {kv.month || '—'}</span>}
        {typeof kv.year !== 'undefined' && <span>year: {kv.year || '—'}</span>}
      </div>
    );
  };

  const renderTimeBar = (ms?: number, maxMs?: number, color = '#94a3b8') => {
    const m = typeof ms === 'number' && ms > 0 ? ms : 0;
    const max = typeof maxMs === 'number' && maxMs > 0 ? maxMs : 1;
    const pct = Math.max(4, Math.min(100, Math.round((m / max) * 100)));
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ height: 4, width: '100%', background: '#e5e7eb', borderRadius: 999 }}>
          <div style={{ height: 4, width: `${pct}%`, background: color, borderRadius: 999 }} />
        </div>
        <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>{m ? `${m} ms` : ''}</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header compatto + tab editor */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 120px auto', alignItems: 'end', gap: 12 }}>
          {/* Kind stretto */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, opacity: 0.8 }}>Kind</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: 0.8 }}>
                <input type="checkbox" checked={lockKind} onChange={(e) => setLockKind(e.target.checked)} /> Auto
              </label>
            </div>
            <select value={kind} onChange={(e) => setKind(e.target.value)} disabled={lockKind} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 8, background: lockKind ? '#f3f4f6' : '#fff' }}>
              <option value="name">name</option>
              <option value="date">date</option>
              <option value="address">address</option>
              <option value="number">number</option>
              <option value="email">email</option>
              <option value="phone">phone</option>
              <option value="generic">generic</option>
            </select>
          </div>
          {/* Confidence compatto */}
          <div>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Confidence</label>
            <input type="number" min={0} max={1} step={0.05} value={minConf} onChange={(e) => setMinConf(parseFloat(e.target.value))} style={{ width: '100%', padding: 6, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          {/* Tabs */}
          <div>
            <div style={{ display: 'inline-flex', gap: 8 }}>
              <button onClick={() => setActiveTab('regex')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: activeTab==='regex' ? '#eef2ff' : '#fff', cursor: 'pointer' }}>Regex</button>
              <button onClick={() => setActiveTab('nlp')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: activeTab==='nlp' ? '#eef2ff' : '#fff', cursor: 'pointer' }}>NLP</button>
              <button onClick={() => setActiveTab('post')} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #ddd', background: activeTab==='post' ? '#eef2ff' : '#fff', cursor: 'pointer' }}>Post Processing</button>
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
                  <th style={{ textAlign: 'left', padding: 8, fontSize: 15 }}>NER (spaCy)</th>
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
                                    ? { background: 'rgba(251, 191, 36, 0.25)', border: '1px solid rgba(251, 191, 36, 0.55)', borderRadius: 6, padding: '0 3px', margin: '0 1px' }
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
                        {renderTimeBar(rr.detMs, maxMs, '#60a5fa')}
                      </td>
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>
                        {rr.nerRunning && <span title="NER" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #34d399', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                        {renderStackedSummary(rr.ner)}
                        {renderTimeBar(rr.nerMs, maxMs, '#34d399')}
                      </td>
                      <td style={{ padding: 8, fontSize: 15, color: '#374151' }}>
                        {rr.llmRunning && <span title="LLM" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', marginRight: 6, animation: 'spin 0.8s linear infinite' }} />}
                        {renderStackedSummary(rr.llm)}
                        {renderTimeBar(rr.llmMs, maxMs, '#fbbf24')}
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


