import React from 'react';
import { Play, Wand2, TypeIcon } from 'lucide-react';
import { RowResult } from './hooks/useExtractionTesting';
import NoteButton from './CellNote/NoteButton';
import NoteEditor from './CellNote/NoteEditor';
import NoteDisplay from './CellNote/NoteDisplay';
import NoteSeparator from './CellNote/NoteSeparator';

// 🎨 Colori centralizzati per extractors
const EXTRACTOR_COLORS = {
  regex: '#d1fae5',        // Verde chiaro
  deterministic: '#e5e7eb', // Grigio
  ner: '#fef3c7',          // Giallo pallido
  llm: '#fed7aa',          // Arancione pallido
  embeddings: '#e0e7ff',   // Viola chiaro
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
  },
  embeddings: {
    main: "Classificazione",
    tech: "Embeddings",
    tooltip: "Classificazione intenti basata su embeddings semantici"
  }
};

interface TesterGridProps {
  examplesList: string[];
  rowResults: RowResult[];
  selectedRow: number | null;
  setSelectedRow: (idx: number) => void;
  enabledMethods: {
    regex: boolean;
    deterministic: boolean;
    ner: boolean;
    llm: boolean;
  };
  toggleMethod: (method: keyof TesterGridProps['enabledMethods']) => void;
  runRowTest: (idx: number) => Promise<void>;
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  // Cell editing
  cellOverrides: Record<string, string>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  editingText: string;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  // Notes
  hasNote: (row: number, col: string) => boolean;
  getNote: (row: number, col: string) => string | undefined;
  addNote: (row: number, col: string, text: string) => void;
  deleteNote: (row: number, col: string) => void;
  isEditing: (row: number, col: string) => boolean;
  startEditing: (row: number, col: string) => void;
  stopEditing: () => void;
  isHovered: (row: number, col: string) => boolean;
  setHovered: (row: number | null, col: string | null) => void;
  // Editor toggle
  activeEditor: 'regex' | 'extractor' | 'ner' | 'llm' | 'post' | 'embeddings' | null;
  toggleEditor: (type: 'regex' | 'extractor' | 'ner' | 'llm' | 'embeddings') => void;
  // Mode: extraction (default) or classification
  mode?: 'extraction' | 'classification';
}

// Helper to format summary into stacked key: value lines showing expected keys; missing keys grey, present black
function renderStackedSummary(
  summary: string | undefined,
  rowIdx: number | undefined,
  col: 'det' | 'ner' | 'llm' | undefined,
  kind: string,
  expectedKeysForKind: (k?: string) => string[],
  cellOverrides: Record<string, string>,
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null,
  editingText: string,
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>,
  setEditingText: React.Dispatch<React.SetStateAction<string>>,
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
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
}

// Unified color time bar with thresholds: >200ms yellow, >1000ms red
function renderTimeBar(ms?: number, maxMs?: number) {
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
}

// Helper to render phrase with highlighting based on spans
function renderPhraseWithSpans(phrase: string, spans?: Array<{ start: number; end: number }>) {
  if (!spans || spans.length === 0) {
    return phrase;
  }

  const sortedSpans = [...spans].sort((a, b) => a.start - b.start);
  const parts: Array<{ t: string; hit: boolean }> = [];
  let j = 0;
  for (const s of sortedSpans) {
    if (s.start > j) {
      parts.push({ t: phrase.slice(j, s.start), hit: false });
    }
    parts.push({ t: phrase.slice(s.start, s.end), hit: true });
    j = s.end;
  }
  if (j < phrase.length) {
    parts.push({ t: phrase.slice(j), hit: false });
  }

  return (
    <span>
      {parts.map((p, k) => (
        <span
          key={k}
          style={p.hit
            ? { background: 'rgba(251, 191, 36, 0.25)', border: '1px solid rgba(251, 191, 36, 0.55)', borderRadius: 6, padding: '0 3px', margin: '0 1px', fontWeight: 700 }
            : { background: 'transparent' }
          }
        >
          {p.t}
        </span>
      ))}
    </span>
  );
}

export default function TesterGrid({
  examplesList,
  rowResults,
  selectedRow,
  setSelectedRow,
  enabledMethods,
  toggleMethod,
  runRowTest,
  kind,
  expectedKeysForKind,
  cellOverrides,
  setCellOverrides,
  editingCell,
  setEditingCell,
  editingText,
  setEditingText,
  hasNote,
  getNote,
  addNote,
  deleteNote,
  isEditing,
  startEditing,
  stopEditing,
  isHovered,
  setHovered,
  activeEditor,
  toggleEditor,
  mode = 'extraction', // Default to extraction for backward compatibility
}: TesterGridProps) {
  // Determine which columns to show based on mode
  const showDeterministic = mode !== 'classification';
  const showNER = mode !== 'classification';
  const showEmbeddings = mode === 'classification';

  // Calculate colSpan for empty state (1 for Frase + Regex + conditionals + LLM + button)
  const colSpanEmpty = 1 + 1 + (showDeterministic ? 1 : 0) + (showNER ? 1 : 0) + (showEmbeddings ? 1 : 0) + 1 + 1;

  return (
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
            {showDeterministic && (
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
            )}
            {showNER && (
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
            )}
            {showEmbeddings && (
              <th style={{ textAlign: 'left', padding: 8, fontSize: 13, background: EXTRACTOR_COLORS.embeddings, opacity: enabledMethods.regex ? 1 : 0.4 }} title={COLUMN_LABELS.embeddings.tooltip}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={enabledMethods.regex}
                      onChange={() => toggleMethod('regex')}
                      style={{ cursor: 'pointer' }}
                      disabled
                    />
                    <div>
                      <span style={{ fontWeight: 600, color: enabledMethods.regex ? '#0b0f17' : '#9ca3af' }}>{COLUMN_LABELS.embeddings.main}</span>
                      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4, color: enabledMethods.regex ? '#0b0f17' : '#9ca3af' }}>({COLUMN_LABELS.embeddings.tech})</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleEditor('embeddings' as any)}
                    title="Configure Embeddings"
                    style={{
                      background: activeEditor === 'embeddings' ? '#3b82f6' : 'rgba(255,255,255,0.3)',
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Wand2 size={14} color={activeEditor === 'embeddings' ? '#fff' : '#666'} />
                  </button>
                </div>
              </th>
            )}
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
              <tr key={i} style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer', background: selectedRow === i ? '#fff7ed' : '#fff' }} onClick={() => { setSelectedRow(i); }}>
                <td style={{ padding: 8, fontSize: 15, wordBreak: 'break-word' }}>
                  {leading}
                  {renderPhraseWithSpans(ex, rr.spans)}
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
                {showDeterministic && (
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
                          {renderStackedSummary(rr.deterministic, i, 'det', kind, expectedKeysForKind, cellOverrides, editingCell, editingText, setEditingCell, setEditingText, setCellOverrides)}
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
                )}
                {showNER && (
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
                          {renderStackedSummary(rr.ner, i, 'ner', kind, expectedKeysForKind, cellOverrides, editingCell, editingText, setEditingCell, setEditingText, setCellOverrides)}
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
                )}
                {showEmbeddings && (
                  <td
                    style={{ padding: 8, fontSize: 15, color: '#374151', overflow: 'visible', background: EXTRACTOR_COLORS.embeddings, position: 'relative', verticalAlign: 'top', opacity: 1 }}
                    onMouseEnter={() => setHovered(i, 'embeddings')}
                    onMouseLeave={() => setHovered(null, null)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        {/* TODO: Show classification results here in Fase 9 */}
                        {'—'}
                      </div>
                      {(isHovered(i, 'embeddings') || hasNote(i, 'embeddings')) && (
                        <NoteButton
                          hasNote={hasNote(i, 'embeddings')}
                          onClick={() => isEditing(i, 'embeddings') ? stopEditing() : startEditing(i, 'embeddings')}
                        />
                      )}
                    </div>
                    {(getNote(i, 'embeddings') || isEditing(i, 'embeddings')) && (
                      <>
                        <NoteSeparator />
                        {isEditing(i, 'embeddings') ? (
                          <NoteEditor
                            value={getNote(i, 'embeddings')}
                            onSave={(text) => { addNote(i, 'embeddings', text); stopEditing(); }}
                            onDelete={() => { deleteNote(i, 'embeddings'); stopEditing(); }}
                            onCancel={stopEditing}
                          />
                        ) : (
                          <NoteDisplay text={getNote(i, 'embeddings')} />
                        )}
                      </>
                    )}
                  </td>
                )}
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
                          {renderStackedSummary(rr.llm, i, 'llm', kind, expectedKeysForKind, cellOverrides, editingCell, editingText, setEditingCell, setEditingText, setCellOverrides)}
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
              <td colSpan={colSpanEmpty} style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>— nessuna frase —</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

