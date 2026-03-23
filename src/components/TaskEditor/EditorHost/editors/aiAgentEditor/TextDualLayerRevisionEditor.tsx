/**
 * Plaintext revision editor: read-only styled mirror + transparent textarea for input (IME, paste, undo).
 * Emits structured RevisionBatchOp[] for the section reducer (no Monaco).
 */

import React from 'react';
import { flushSync } from 'react-dom';
import type { InsertOp } from './effectiveFromRevisionMask';
import { buildLinearDocument, linearEditToBatchOps, type RevisionBatchOp, type RevisionCharMeta } from './textRevisionLinear';

function revisionMirrorNodes(
  linear: string,
  meta: readonly RevisionCharMeta[],
  deletedMask: readonly boolean[]
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < linear.length; i++) {
    const ch = linear[i];
    const m = meta[i];
    const key = `${i}-${m?.kind ?? 'x'}`;
    if (!m) {
      out.push(
        <span key={key} className="omnia-text-rev-base">
          {ch}
        </span>
      );
      continue;
    }
    if (m.kind === 'insert') {
      out.push(
        <span key={key} className="omnia-text-rev-insert">
          {ch}
        </span>
      );
    } else {
      const struck = m.baseIndex < deletedMask.length && deletedMask[m.baseIndex];
      out.push(
        <span key={key} className={struck ? 'omnia-text-rev-delete' : 'omnia-text-rev-base'}>
          {ch}
        </span>
      );
    }
  }
  return out;
}

export interface TextDualLayerRevisionEditorProps {
  baseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  readOnly: boolean;
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
  minHeightPx?: number;
}

export function TextDualLayerRevisionEditor({
  baseText,
  deletedMask,
  inserts,
  readOnly,
  onApplyRevisionOps,
  minHeightPx = 280,
}: TextDualLayerRevisionEditorProps) {
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const composingRef = React.useRef(false);
  const lastPropLinearRef = React.useRef<string>('');
  const lastKnownDocRef = React.useRef(buildLinearDocument(baseText, deletedMask, inserts));
  /** After a local edit, caret/selection end in the synced linear string (multi-hunk safe). */
  const pendingCaretRef = React.useRef<number | null>(null);
  const [editError, setEditError] = React.useState<string | null>(null);

  const docFromProps = React.useMemo(
    () => buildLinearDocument(baseText, deletedMask, inserts),
    [baseText, deletedMask, inserts]
  );

  React.useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    const nextLinear = docFromProps.linear;
    lastPropLinearRef.current = nextLinear;
    lastKnownDocRef.current = docFromProps;

    const pending = pendingCaretRef.current;
    const needAssign = ta.value !== nextLinear;
    const selBefore =
      needAssign && pending === null
        ? { start: ta.selectionStart, end: ta.selectionEnd, dir: ta.selectionDirection }
        : null;

    if (needAssign) {
      ta.value = nextLinear;
    }

    try {
      if (pending !== null) {
        pendingCaretRef.current = null;
        const pos = Math.max(0, Math.min(pending, nextLinear.length));
        ta.setSelectionRange(pos, pos);
      } else if (selBefore) {
        const s = Math.max(0, Math.min(selBefore.start, nextLinear.length));
        const e = Math.max(0, Math.min(selBefore.end, nextLinear.length));
        ta.setSelectionRange(s, e, selBefore.dir ?? undefined);
      }
    } catch {
      pendingCaretRef.current = null;
    }
  }, [docFromProps]);

  const mirrorNodes = React.useMemo(
    () => revisionMirrorNodes(docFromProps.linear, docFromProps.meta, deletedMask),
    [docFromProps, deletedMask]
  );

  const applyInput = React.useCallback(
    (el: HTMLTextAreaElement) => {
      if (readOnly) return;
      const prev = lastKnownDocRef.current;
      const next = el.value;
      if (next === prev.linear) return;

      const ops = linearEditToBatchOps(
        prev.linear,
        next,
        prev.meta,
        baseText,
        deletedMask,
        inserts
      );

      if (ops.length === 0) {
        return;
      }

      const selEnd = el.selectionEnd ?? el.selectionStart ?? next.length;
      const selStart = el.selectionStart ?? selEnd;
      pendingCaretRef.current = Math.max(0, Math.min(Math.max(selStart, selEnd), next.length));

      setEditError(null);
      onApplyRevisionOps(ops);
    },
    [readOnly, baseText, deletedMask, inserts, onApplyRevisionOps]
  );

  const onInput = React.useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (composingRef.current) return;
      // Synchronous commit so useLayoutEffect updates lastKnownDocRef before the next key event.
      flushSync(() => applyInput(e.currentTarget));
    },
    [applyInput]
  );

  const onCompositionEnd = React.useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false;
      flushSync(() => applyInput(e.currentTarget));
    },
    [applyInput]
  );

  const onCompositionStart = React.useCallback(() => {
    composingRef.current = true;
  }, []);

  return (
    <div className="space-y-1">
      {editError ? (
        <div
          className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-1 text-xs text-amber-100 flex gap-2 items-start"
          role="alert"
        >
          <span className="min-w-0 flex-1">{editError}</span>
          <button
            type="button"
            className="shrink-0 text-amber-300 hover:text-amber-100 underline"
            onClick={() => setEditError(null)}
          >
            Chiudi
          </button>
        </div>
      ) : null}
      <div
        className="w-full rounded-md border border-slate-600/60 overflow-auto bg-slate-900"
        style={{ minHeight: minHeightPx, maxHeight: 'min(70vh, 560px)' }}
      >
      <div
        className="grid [grid-template-areas:'stack'] min-w-0"
        style={{ minHeight: Math.max(minHeightPx - 16, 200) }}
      >
        <pre
          className="[grid-area:stack] pointer-events-none m-0 p-2 text-[13px] font-mono leading-5 whitespace-pre-wrap break-words text-slate-200"
          aria-hidden
        >
          {mirrorNodes}
        </pre>
        <textarea
          ref={taRef}
          className="[grid-area:stack] z-10 m-0 resize-none overflow-hidden bg-transparent p-2 text-[13px] font-mono leading-5 whitespace-pre-wrap break-words text-transparent caret-slate-300 min-h-full w-full min-w-0 border-0 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          defaultValue={docFromProps.linear}
          readOnly={readOnly}
          spellCheck={false}
          aria-label="Prompt agente — revisioni suggerite (testo base + insert/cancel)"
          onInput={onInput}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
        />
      </div>
      </div>
    </div>
  );
}
