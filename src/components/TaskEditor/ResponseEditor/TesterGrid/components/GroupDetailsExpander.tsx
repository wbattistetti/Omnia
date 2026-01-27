import React from 'react';
import { parseSummaryToGroups } from '../helpers/parseSummaryToGroups';

interface GroupDetailsExpanderProps {
  summary: string | undefined;
  rowIdx: number;
  col: 'det' | 'ner' | 'llm' | 'regex';
  kind: string;
  expectedKeysForKind: (k?: string) => string[];
  cellOverrides: Record<string, string>;
  editingCell: { row: number; col: 'det' | 'ner' | 'llm'; key: string } | null;
  editingText: string;
  setEditingCell: React.Dispatch<React.SetStateAction<{ row: number; col: 'det' | 'ner' | 'llm'; key: string } | null>>;
  setEditingText: React.Dispatch<React.SetStateAction<string>>;
  setCellOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

/**
 * Expandable panel for showing group details (day, month, year, etc.)
 */
export default function GroupDetailsExpander({
  summary,
  rowIdx,
  col,
  kind,
  expectedKeysForKind,
  cellOverrides,
  editingCell,
  editingText,
  setEditingCell,
  setEditingText,
  setCellOverrides,
}: GroupDetailsExpanderProps) {
  const kv = parseSummaryToGroups(summary);
  const keys = expectedKeysForKind(kind);

  // ✅ Filter out 'value' key - we only want to show the extracted groups, not the full match
  const filteredKv = { ...kv };
  delete filteredKv.value;

  // ✅ Get all extracted group keys (excluding 'value') that are present in the summary
  const extractedGroupKeys = Object.keys(filteredKv).filter(k =>
    k !== 'value' && filteredKv[k] !== undefined && filteredKv[k] !== '' && filteredKv[k] !== null
  );

  // ✅ Show all extracted groups, ordered by expected keys if available
  const expectedGroupKeys = keys.filter(k => k !== 'value');

  // ✅ Order: first show expected keys that are present, then any other extracted keys
  const orderedGroupKeys = [
    ...expectedGroupKeys.filter(k => extractedGroupKeys.includes(k)),
    ...extractedGroupKeys.filter(k => !expectedGroupKeys.includes(k))
  ];

  // ✅ FIX: Se non ci sono gruppi estratti ma c'è 'value', mostra almeno 'value' per dare feedback
  const hasExtractedGroups = orderedGroupKeys.length > 0;
  const hasValue = kv.value !== undefined && kv.value !== '' && kv.value !== null;

  // ✅ Mostra il pannello se ci sono gruppi estratti O se c'è solo value (per dare feedback visivo)
  if (!hasExtractedGroups && !hasValue) {
    return null;
  }

  // ✅ Se non ci sono gruppi estratti ma c'è value, mostra solo value
  const keysToShow = hasExtractedGroups ? orderedGroupKeys : ['value'];

  return (
    <div
      style={{
        marginTop: 4,
        padding: 8,
        background: '#f9fafb',
        borderRadius: 4,
        border: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        lineHeight: 1.2,
      }}
    >
          {keysToShow.map((k) => {
            const overrideKey = `${rowIdx}:${col}:${k}`;
            const overridden = cellOverrides[overrideKey];
            // ✅ Se stiamo mostrando 'value', prendilo da kv invece di filteredKv
            const baseVal = k === 'value' ? kv[k] : filteredKv[k];
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
                      if (col !== 'regex') {
                        setEditingCell({ row: rowIdx, col: col as 'det' | 'ner' | 'llm', key: k });
                        setEditingText(value || '');
                      }
                    }}
                    title={col !== 'regex' ? 'Clicca per modificare' : undefined}
                    style={{ cursor: col !== 'regex' ? 'text' : 'default', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: 'block', minWidth: 0, maxWidth: '100%' }}
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
                          const k2 = `${rowIdx}:${col}:${k}`;
                          setCellOverrides((prev) => ({ ...prev, [k2]: editingText }));
                          setEditingCell(null);
                        } else if (e.key === 'Escape') {
                          setEditingCell(null);
                        }
                      }}
                      onBlur={() => {
                        const k2 = `${rowIdx}:${col}:${k}`;
                        setCellOverrides((prev) => ({ ...prev, [k2]: editingText }));
                        setEditingCell(null);
                      }}
                      ref={(el) => {
                        if (!el) return;
                        const resize = () => {
                          const cs = getComputedStyle(el);
                          const lhStr = cs.lineHeight || '16px';
                          const lh = parseFloat(lhStr) || 16;
                          const baseH = Math.max(16, Math.ceil(lh));
                          el.style.height = `${baseH}px`;
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          let w = 40;
                          if (ctx) {
                            const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
                            ctx.font = font;
                            w = Math.ceil(ctx.measureText(el.value || '—').width) + 10;
                          }
                          const parent = el.parentElement as HTMLElement | null;
                          const max = parent ? parent.clientWidth : w;
                          el.style.maxWidth = `${max}px`;
                          el.style.width = `${Math.min(w, max)}px`;
                        };
                        resize();
                        el.focus();
                        try { el.selectionStart = el.value.length; } catch {}
                        el.addEventListener('input', resize);
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
