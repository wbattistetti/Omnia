import React, { useState } from 'react';
import { Plus, ChevronsRight, Wrench, BarChart2 } from 'lucide-react';

interface TesterControlsProps {
  newExample: string;
  setNewExample: React.Dispatch<React.SetStateAction<string>>;
  examplesList: string[];
  setExamplesList: React.Dispatch<React.SetStateAction<string[]>>;
  selectedRow: number | null;
  setSelectedRow: React.Dispatch<React.SetStateAction<number | null>>;
  runRowTest: (idx: number) => Promise<void>;
  runAllRows: () => Promise<void>;
  testing: boolean;
  // Tuning props
  kind: string;
  locale: string;
  synonymsText: string;
  formatText: string;
  regex: string;
  postProcessText: string;
  rowResults: Array<any>;
  cellOverrides: Record<string, string>;
  expectedKeysForKind: (k?: string) => string[];
  setSynonymsText: React.Dispatch<React.SetStateAction<string>>;
  setFormatText: React.Dispatch<React.SetStateAction<string>>;
  setRegex: React.Dispatch<React.SetStateAction<string>>;
  setPostProcessText: React.Dispatch<React.SetStateAction<string>>;
  // Report props
  baselineStats: { matched: number; falseAccept: number; totalGt: number } | null;
  lastStats: { matched: number; falseAccept: number; totalGt: number } | null;
}

// Helper functions (could be moved to a utils file later)
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

export default function TesterControls({
  newExample,
  setNewExample,
  examplesList,
  setExamplesList,
  selectedRow,
  setSelectedRow,
  runRowTest,
  runAllRows,
  testing,
  kind,
  locale,
  synonymsText,
  formatText,
  regex,
  postProcessText,
  rowResults,
  cellOverrides,
  expectedKeysForKind,
  setSynonymsText,
  setFormatText,
  setRegex,
  setPostProcessText,
  baselineStats,
  lastStats,
}: TesterControlsProps) {
  const [reportOpen, setReportOpen] = useState<boolean>(false);

  // Handler for adding new example
  const handleAddExample = () => {
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
  };

  // Handler for tuning
  const handleTuning = async () => {
    const errors: Array<any> = [];
    (examplesList || []).forEach((phrase, rowIdx) => {
      const rr = rowResults[rowIdx] || {} as any;
      const cols: Array<{ id: 'det' | 'ner' | 'llm'; src?: string }> = [
        { id: 'det', src: rr?.deterministic },
        { id: 'ner', src: rr?.ner },
        { id: 'llm', src: rr?.llm },
      ];
      const keys = expectedKeysForKind(kind);
      keys.forEach((kKey) => {
        const gt = cellOverrides[`${rowIdx}:det:${kKey}`];
        cols.forEach(({ id, src }) => {
          const predMap: Record<string, string | undefined> = {};
          const t = (src || '').toString();
          if (t && t !== '—') {
            t.split(',').forEach(part => {
              const sp = part.split('=');
              const kk = sp[0]?.trim();
              const vv = sp[1] != null ? String(sp[1]).trim() : undefined;
              if (kk) predMap[kk] = vv;
            });
          }
          const pred = predMap[kKey];
          if ((gt && !pred) || (gt && pred && pred !== gt)) {
            errors.push({ phrase, key: kKey, pred: pred ?? null, gt, type: pred ? 'false-accept' : 'unmatched', engine: id });
          }
        });
      });
    });

    try {
      const res = await fetch('/api/nlp/tune-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          locale,
          profile: {
            synonyms: fromCommaList(synonymsText),
            formatHints: fromCommaList(formatText),
            regex: regex || undefined,
            postProcess: tryParseJSON(postProcessText).value
          },
          errors
        })
      });

      if (res.ok) {
        const obj = await res.json();
        const s = obj?.suggested || {};
        if (Array.isArray(s.synonyms)) setSynonymsText(toCommaList(s.synonyms));
        if (Array.isArray(s.formatHints)) setFormatText(toCommaList(s.formatHints));
        if (typeof s.regex === 'string') setRegex(String(s.regex));
        if (typeof s.postProcess !== 'undefined') {
          setPostProcessText(typeof s.postProcess === 'string' ? s.postProcess : JSON.stringify(s.postProcess, null, 2));
        }
        await runAllRows();
      }
    } catch (error) {
      console.error('[TesterControls] Tuning error:', error);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      {/* Input for new example */}
      <input
        value={newExample}
        onChange={(e) => setNewExample(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAddExample();
          }
        }}
        placeholder="Aggiungi frase…"
        style={{ flex: 1, padding: 10, border: '1px solid #4b5563', background: '#111827', color: '#e5e7eb', borderRadius: 8 }}
      />

      {/* Add button */}
      <button
        title="Aggiungi"
        onClick={handleAddExample}
        style={{
          border: '1px solid #10b981',
          background: '#065f46',
          color: '#ecfdf5',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: 'pointer'
        }}
      >
        <Plus size={14} />
      </button>

      {/* Run all button */}
      <button
        onClick={runAllRows}
        disabled={testing || examplesList.length === 0}
        title="Prova tutte"
        style={{
          border: '1px solid #22c55e',
          background: testing ? '#eab308' : '#14532d',
          color: '#dcfce7',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: testing ? 'default' : 'pointer'
        }}
      >
        <ChevronsRight size={16} />
      </button>

      {/* Tuning button */}
      <button
        title="Tuning"
        onClick={handleTuning}
        style={{
          border: '1px solid #f59e0b',
          background: '#7c2d12',
          color: '#ffedd5',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: 'pointer'
        }}
      >
        <Wrench size={16} />
      </button>

      {/* Report dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          title="Report"
          onClick={() => setReportOpen(o => !o)}
          style={{
            border: '1px solid #60a5fa',
            background: '#0c4a6e',
            color: '#dbeafe',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: 'pointer'
          }}
        >
          <BarChart2 size={16} />
        </button>
        {reportOpen && (
          <div style={{
            position: 'absolute',
            right: 0,
            marginTop: 6,
            background: '#111827',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 8,
            padding: 10,
            minWidth: 260,
            zIndex: 30
          }}>
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
  );
}

