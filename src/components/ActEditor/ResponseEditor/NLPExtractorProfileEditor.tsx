import React from 'react';

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

function fromMultiline(text: string): string[] {
  return (text || '')
    .split(/\r?\n/)
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

export default function NLPExtractorProfileEditor({
  node,
  locale = 'it-IT',
  onChange,
}: {
  node: any;
  locale?: string;
  onChange?: (profile: NLPProfile) => void;
}) {
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

  const [kind, setKind] = React.useState<string>(initial.kind);
  const [synonymsText, setSynonymsText] = React.useState<string>(toCommaList(initial.synonyms));
  const [regex, setRegex] = React.useState<string>(initial.regex || '');
  const [formatText, setFormatText] = React.useState<string>(toCommaList(initial.formatHints));
  const [examplesText, setExamplesText] = React.useState<string>((initial.examples || []).join('\n'));
  const [minConf, setMinConf] = React.useState<number>(initial.minConfidence || 0.6);
  const [postProcessText, setPostProcessText] = React.useState<string>(initial.postProcess ? JSON.stringify(initial.postProcess, null, 2) : '');
  const [testText, setTestText] = React.useState<string>('');
  const [testMatches, setTestMatches] = React.useState<Array<{ start: number; end: number }>>([]);
  const [testValue, setTestValue] = React.useState<string>('');
  const [jsonError, setJsonError] = React.useState<string | undefined>(undefined);

  const profile: NLPProfile = React.useMemo(() => {
    const syns = fromCommaList(synonymsText);
    const formats = fromCommaList(formatText);
    const ex = fromMultiline(examplesText);
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
  }, [node, initial.slotId, initial.locale, kind, synonymsText, regex, formatText, examplesText, minConf, postProcessText]);

  React.useEffect(() => {
    onChange?.(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.synonyms, profile.regex, profile.kind, profile.formatHints, profile.examples, profile.minConfidence, profile.postProcess, profile.subSlots]);

  const runLocalTest = () => {
    const spans: Array<{ start: number; end: number }> = [];
    let value = '';
    if (profile.regex) {
      try {
        const re = new RegExp(profile.regex, 'g');
        let m: RegExpExecArray | null;
        // eslint-disable-next-line no-cond-assign
        while ((m = re.exec(testText)) !== null) {
          spans.push({ start: m.index, end: m.index + m[0].length });
          if (!value) value = m[0];
        }
      } catch {
        // ignore invalid regex in tester
      }
    }
    setTestMatches(spans);
    setTestValue(value);
  };

  const highlighted = React.useMemo(() => {
    const spans = [...testMatches].sort((a, b) => a.start - b.start);
    const parts: Array<{ t: string; hit: boolean }> = [];
    let i = 0;
    for (const s of spans) {
      if (s.start > i) parts.push({ t: testText.slice(i, s.start), hit: false });
      parts.push({ t: testText.slice(s.start, s.end), hit: true });
      i = s.end;
    }
    if (i < testText.length) parts.push({ t: testText.slice(i), hit: false });
    return parts;
  }, [testMatches, testText]);

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Editor card (left) */}
      <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Editor</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Kind</label>
                <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }}>
                  <option value="name">name</option>
                  <option value="date">date</option>
                  <option value="address">address</option>
                  <option value="number">number</option>
                  <option value="email">email</option>
                  <option value="phone">phone</option>
                  <option value="generic">generic</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, opacity: 0.8 }}>Confidence</label>
                <input type="number" min={0} max={1} step={0.05} value={minConf} onChange={(e) => setMinConf(parseFloat(e.target.value))} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Regex</label>
            <input value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="es. \\b\\d{5}\\b" style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8, fontFamily: 'monospace' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Synonyms (separati da virgola)</label>
            <textarea value={synonymsText} onChange={(e) => setSynonymsText(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          <div>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Examples (una riga per esempio)</label>
            <textarea value={examplesText} onChange={(e) => setExamplesText(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
          </div>
          {jsonError && (
            <div style={{ color: '#b91c1c', fontSize: 12 }}>JSON non valido: {jsonError}</div>
          )}
          <details>
            <summary style={{ cursor: 'pointer' }}>Preview JSON (sola lettura)</summary>
            <pre style={{ background: '#f7f7fb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, overflow: 'auto' }}>
              {JSON.stringify(profile, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      {/* Right column: advanced options + tester */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Opzioni avanzate</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, opacity: 0.8 }}>FormatHints (separati da virgola)</label>
              <textarea value={formatText} onChange={(e) => setFormatText(e.target.value)} rows={2} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, opacity: 0.8 }}>PostProcess (JSON)</label>
              <textarea value={postProcessText} onChange={(e) => setPostProcessText(e.target.value)} rows={3} style={{ width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 8, fontFamily: 'monospace' }} />
            </div>
          </div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Tester</div>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Frase di test</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="Inserisci una frase…" style={{ flex: 1, padding: 10, border: '1px solid #ddd', borderRadius: 8 }} />
            <button onClick={runLocalTest} style={{ background: '#fb923c', color: '#0b1220', border: 'none', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' }}>Prova estrazione</button>
          </div>
          <div style={{ marginTop: 8, padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, minHeight: 80 }}>
            {highlighted.length > 0 ? (
              <div>
                {highlighted.map((p, i) => (
                  <span key={i} style={{ background: p.hit ? '#fde68a' : 'transparent' }}>{p.t}</span>
                ))}
              </div>
            ) : (
              <div style={{ opacity: 0.7, fontSize: 12 }}>— nessun testo —</div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: '#374151' }}>
              <div><strong>Valore:</strong> <code>{testValue || '—'}</code></div>
              <div><strong>Confidenza:</strong> <code>{testMatches.length ? '1.0 (regex locale)' : '—'}</code></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


