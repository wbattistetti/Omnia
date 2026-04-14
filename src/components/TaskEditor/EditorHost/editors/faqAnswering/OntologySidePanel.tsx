/**
 * Resizable side panel: breadcrumb, Grammar (intermediate nodes) or Faqs (leaves).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { findNode, getNodePath, isLeaf } from '@domain/faqOntology/treeUtils';
import { useFaqOntology } from './FaqOntologyContext';
import OntologyInlineEditor from './OntologyInlineEditor';

const DEFAULT_W = 320;
const MIN_W = 240;

function normFaq(s: string): string {
  return s.trim().toLowerCase();
}

function sortIt(a: string, b: string): number {
  return a.localeCompare(b, 'it', { sensitivity: 'base' });
}

type SidePanelProps = {
  /** Width bounds for max panel width (typically the tree + panel row). */
  boundsRef: React.RefObject<HTMLDivElement | null>;
};

export default function OntologySidePanel({ boundsRef }: SidePanelProps) {
  const { nodes, selectedNodeId, updateGrammar, updateFaqs } = useFaqOntology();
  const [width, setWidth] = useState(DEFAULT_W);
  const [grammarDraft, setGrammarDraft] = useState('');
  const [resizing, setResizing] = useState(false);

  const selected = selectedNodeId ? findNode(nodes, selectedNodeId) : null;
  const path = selectedNodeId ? getNodePath(nodes, selectedNodeId) : null;

  const maxW = useCallback(() => {
    const el = boundsRef.current;
    if (!el) return 560;
    return Math.max(MIN_W, el.getBoundingClientRect().width - 200);
  }, [boundsRef]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = rect.right - e.clientX;
      setWidth(Math.min(maxW(), Math.max(MIN_W, next)));
    };
    const onUp = () => setResizing(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resizing, maxW]);

  if (!selected || !path) return null;

  const leaf = isLeaf(selected);

  const handleAddGrammar = (raw: string) => {
    const g = raw.trim();
    if (!g) return;
    const n = normFaq(g);
    if (selected.grammar.some((x) => normFaq(x) === n)) return;
    const updated = [...selected.grammar, g].sort(sortIt);
    updateGrammar(selected.id, updated);
    setGrammarDraft('');
  };

  return (
    <div className="relative flex h-full min-h-0 shrink-0 border-l border-slate-700 bg-slate-900/95">
      <button
        type="button"
        aria-label="Ridimensiona pannello"
        className="absolute left-0 top-0 z-10 flex h-full w-2 cursor-col-resize items-center justify-center border-0 bg-transparent p-0 hover:bg-slate-700/40"
        onMouseDown={(e) => {
          e.preventDefault();
          setResizing(true);
        }}
      >
        <GripVertical size={12} className="text-slate-500" />
      </button>
      <aside
        className="flex min-h-0 flex-1 flex-col overflow-hidden pl-3"
        style={{ width, minWidth: width, maxWidth: width }}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1 border-b border-slate-700 px-2 py-2 text-xs text-slate-400">
          {path.map((seg, i) => (
            <React.Fragment key={`${seg}-${i}`}>
              {i > 0 ? <ChevronRight size={12} className="shrink-0 text-slate-600" /> : null}
              <span
                className={
                  i === path.length - 1
                    ? 'font-semibold text-slate-100'
                    : 'truncate text-slate-500'
                }
              >
                {seg}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-2 py-3">
          {leaf ? (
            <FaqSection nodeId={selected.id} faqs={selected.faqs} onUpdateFaqs={updateFaqs} />
          ) : (
            <div>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
                Grammar
              </h3>
              <ul className="space-y-1.5">
                {selected.grammar.map((g, idx) => (
                  <GrammarRow
                    key={`${g}-${idx}`}
                    value={g}
                    others={selected.grammar.filter((_, j) => j !== idx)}
                    onDelete={() =>
                      updateGrammar(
                        selected.id,
                        selected.grammar.filter((_, j) => j !== idx)
                      )
                    }
                    onCommit={(next) => {
                      const t = next.trim();
                      if (!t) {
                        updateGrammar(
                          selected.id,
                          selected.grammar.filter((_, j) => j !== idx)
                        );
                        return;
                      }
                      const nn = normFaq(t);
                      if (selected.grammar.some((x, j) => j !== idx && normFaq(x) === nn)) {
                        return;
                      }
                      const copy = [...selected.grammar];
                      copy[idx] = t;
                      copy.sort(sortIt);
                      updateGrammar(selected.id, copy);
                    }}
                  />
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  value={grammarDraft}
                  onChange={(e) => setGrammarDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddGrammar(grammarDraft);
                    }
                  }}
                  placeholder="Parola chiave…"
                  className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                />
                <button
                  type="button"
                  className="rounded bg-amber-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-amber-500"
                  onClick={() => handleAddGrammar(grammarDraft)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function GrammarRow({
  value,
  others,
  onDelete,
  onCommit,
}: {
  value: string;
  others: string[];
  onDelete: () => void;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  return editing ? (
    <li className="list-none">
      <OntologyInlineEditor
        initialValue={value}
        validate={(v) => {
          const t = v.trim();
          if (!t) return null;
          const nn = normFaq(t);
          if (others.some((o) => normFaq(o) === nn)) return 'Già presente';
          return null;
        }}
        onConfirm={(v) => {
          onCommit(v);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    </li>
  ) : (
    <li className="group flex list-none items-center justify-between gap-2 rounded border border-transparent px-2 py-1 text-sm text-slate-200 hover:border-slate-600">
      <span className="min-w-0 flex-1">{value}</span>
      <span className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
          title="Modifica"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="rounded p-1 text-red-400/80 hover:bg-slate-800 hover:text-red-300"
          title="Elimina"
          onClick={onDelete}
        >
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  );
}

function FaqSection({
  nodeId,
  faqs,
  onUpdateFaqs,
}: {
  nodeId: string;
  faqs: string[];
  onUpdateFaqs: (id: string, faqs: string[]) => void;
}) {
  const handleAdd = (q: string) => {
    const norm = q.trim().toLowerCase();
    if (!norm) return;
    if (faqs.some((f) => f.trim().toLowerCase() === norm)) return;
    const updated = [...faqs, q].sort(sortIt);
    onUpdateFaqs(nodeId, updated);
  };

  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
        FAQ
      </h3>
      <ul className="space-y-2">
        {faqs.map((faq, idx) => (
          <FaqItem
            key={`${faq}-${idx}`}
            value={faq}
            faqs={faqs}
            index={idx}
            onUpdate={(nextList) => onUpdateFaqs(nodeId, nextList)}
          />
        ))}
      </ul>
      <FaqAdd onAdd={handleAdd} />
    </div>
  );
}

function FaqAdd({ onAdd }: { onAdd: (q: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <textarea
        value={v}
        rows={2}
        onChange={(e) => setV(e.target.value)}
        placeholder="Nuova domanda…"
        className="min-w-0 flex-1 resize-y rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onAdd(v);
            setV('');
          }
        }}
      />
      <button
        type="button"
        className="h-fit rounded bg-emerald-700 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-600"
        onClick={() => {
          onAdd(v);
          setV('');
        }}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function FaqItem({
  value,
  faqs,
  index,
  onUpdate,
}: {
  value: string;
  faqs: string[];
  index: number;
  onUpdate: (next: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const confirmedRef = useRef(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = (raw: string) => {
    const t = raw.trim();
    if (!t) {
      onUpdate(faqs.filter((_, j) => j !== index));
      setEditing(false);
      return;
    }
    const nn = t.toLowerCase();
    if (faqs.some((f, j) => j !== index && f.trim().toLowerCase() === nn)) {
      return;
    }
    const next = [...faqs];
    next[index] = t;
    next.sort(sortIt);
    onUpdate(next);
    confirmedRef.current = true;
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="list-none">
        <textarea
          value={draft}
          rows={2}
          autoFocus
          className="w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit(draft);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              confirmedRef.current = true;
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={() => {
            if (confirmedRef.current) {
              confirmedRef.current = false;
              return;
            }
            commit(draft);
          }}
        />
      </li>
    );
  }

  return (
    <li className="group flex list-none items-start gap-2 rounded border border-transparent px-2 py-1 text-sm text-slate-200 hover:border-slate-600">
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{value}</span>
      <span className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-1 text-slate-400 hover:bg-slate-800"
          title="Modifica"
          onClick={() => {
            confirmedRef.current = false;
            setEditing(true);
          }}
        >
          <Pencil size={14} />
        </button>
        <button
          type="button"
          className="rounded p-1 text-red-400/80 hover:bg-slate-800"
          title="Elimina"
          onClick={() => onUpdate(faqs.filter((_, j) => j !== index))}
        >
          <Trash2 size={14} />
        </button>
      </span>
    </li>
  );
}
