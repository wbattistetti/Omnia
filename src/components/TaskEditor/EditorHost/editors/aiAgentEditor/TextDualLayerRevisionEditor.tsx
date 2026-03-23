/**
 * Plaintext revision editor: read-only styled mirror + transparent textarea for input (IME, paste, undo).
 * Emits structured RevisionBatchOp[] (linear) or OtOp[] (OT mode) for the section reducer.
 * OT mode derives mask/inserts from base+effective so strikethrough/insert colors match the legacy path.
 */

import React from 'react';
import { flushSync } from 'react-dom';
import type { InsertOp } from './effectiveFromRevisionMask';
import { effectiveFromRevisionMask } from './effectiveFromRevisionMask';
import { diffToOps } from './otDiffToOps';
import { effectivePairToMaskAndInserts } from './otLinearDisplay';
import type { OtOp } from './otTypes';
import { applyRevisionBatchToSlice } from './applyRevisionBatchToSlice';
import {
  buildLinearDocument,
  linearEditToBatchOps,
  type RevisionBatchOp,
} from './textRevisionLinear';
import type { StructuredSectionRevisionSlice } from './structuredSectionsRevisionReducer';
import {
  isRevisioningDebugEnabled,
  revisioningDebugGroup,
  revisioningGraphemeLikeCount,
  truncateForRevisioningLog,
} from './revisioningDebug';
import { buildRevisionMirrorNodes } from './revisionMirrorRuns';

type LastLinearDoc = { linear: string } | ReturnType<typeof buildLinearDocument>;

export interface TextDualLayerRevisionEditorProps {
  baseText: string;
  deletedMask: readonly boolean[];
  inserts: readonly InsertOp[];
  readOnly: boolean;
  onApplyRevisionOps: (ops: readonly RevisionBatchOp[]) => void;
  minHeightPx?: number;
  /** When set with {@link otCurrentText} and {@link onApplyOtCommit}, uses OT diff path. */
  otMode?: boolean;
  otCurrentText?: string;
  onApplyOtCommit?: (ops: readonly OtOp[]) => void;
}

export function TextDualLayerRevisionEditor({
  baseText,
  deletedMask,
  inserts,
  readOnly,
  onApplyRevisionOps,
  minHeightPx = 280,
  otMode = false,
  otCurrentText,
  onApplyOtCommit,
}: TextDualLayerRevisionEditorProps) {
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const composingRef = React.useRef(false);
  const lastPropLinearRef = React.useRef<string>('');
  const lastKnownDocRef = React.useRef<LastLinearDoc>(
    buildLinearDocument(baseText, deletedMask, inserts)
  );
  /** Mask/inserts matching {@link lastKnownDocRef} when OT (for linearEditToBatchOps). */
  const otMaskRef = React.useRef<boolean[]>([]);
  const otInsRef = React.useRef<InsertOp[]>([]);
  /** After a local edit, caret/selection end in the synced linear string (multi-hunk safe). */
  const pendingCaretRef = React.useRef<number | null>(null);
  const [editError, setEditError] = React.useState<string | null>(null);

  const isOt = Boolean(otMode && onApplyOtCommit && otCurrentText !== undefined);

  const otDerived = React.useMemo(() => {
    if (!isOt || otCurrentText === undefined) {
      return { deletedMask: [] as boolean[], inserts: [] as InsertOp[] };
    }
    return effectivePairToMaskAndInserts(baseText, otCurrentText);
  }, [isOt, baseText, otCurrentText]);

  const docFromProps = React.useMemo(() => {
    if (isOt) {
      return buildLinearDocument(baseText, otDerived.deletedMask, otDerived.inserts);
    }
    return buildLinearDocument(baseText, deletedMask, inserts);
  }, [isOt, baseText, otDerived, deletedMask, inserts]);

  React.useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;

    const nextLinear = docFromProps.linear;
    lastPropLinearRef.current = nextLinear;
    lastKnownDocRef.current = docFromProps;
    if (isOt) {
      otMaskRef.current = otDerived.deletedMask;
      otInsRef.current = otDerived.inserts;
    }

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

    if (!isOt && isRevisioningDebugEnabled() && ta.value !== nextLinear) {
      console.warn('[revisioning] DESYNC: textarea.value !== docFromProps.linear after layout sync', {
        textareaCodeUnits: ta.value.length,
        docCodeUnits: nextLinear.length,
        textareaPreview: truncateForRevisioningLog(ta.value),
        docPreview: truncateForRevisioningLog(nextLinear),
      });
    }
  }, [docFromProps, isOt, otDerived]);

  const mirrorDeletedMask = isOt ? otDerived.deletedMask : deletedMask;

  const mirrorNodes = React.useMemo(
    () => buildRevisionMirrorNodes(docFromProps.linear, docFromProps.meta, mirrorDeletedMask),
    [docFromProps, mirrorDeletedMask]
  );

  const applyInput = React.useCallback(
    (el: HTMLTextAreaElement) => {
      if (readOnly) return;
      const prev = lastKnownDocRef.current;
      const next = el.value;
      if (next === prev.linear) return;

      if (isOt) {
        if (!onApplyOtCommit) return;
        const prevDoc = prev as ReturnType<typeof buildLinearDocument>;
        const batchOps = linearEditToBatchOps(
          prevDoc.linear,
          next,
          prevDoc.meta,
          baseText,
          otMaskRef.current,
          otInsRef.current
        );
        if (batchOps.length === 0) {
          return;
        }
        const prevSlice: StructuredSectionRevisionSlice = {
          promptBaseText: baseText,
          deletedMask: [...otMaskRef.current],
          inserts: otInsRef.current.map((x) => ({ ...x })),
          refinementOpLog: [],
          storageMode: 'linear',
          ot: null,
        };
        const nextSlice = applyRevisionBatchToSlice(prevSlice, batchOps);
        const prevEff = effectiveFromRevisionMask(baseText, prevSlice.deletedMask, prevSlice.inserts);
        const nextEff = effectiveFromRevisionMask(baseText, nextSlice.deletedMask, nextSlice.inserts);
        const otOps = diffToOps(prevEff, nextEff);
        if (otOps.length === 0) {
          return;
        }
        const selEnd = el.selectionEnd ?? el.selectionStart ?? next.length;
        const selStart = el.selectionStart ?? selEnd;
        pendingCaretRef.current = Math.max(0, Math.min(Math.max(selStart, selEnd), next.length));
        setEditError(null);
        onApplyOtCommit(otOps);
        return;
      }

      const prevDoc = prev as ReturnType<typeof buildLinearDocument>;

      if (isRevisioningDebugEnabled()) {
        revisioningDebugGroup('TextDualLayerRevisionEditor: input event', () => {
          const ss = el.selectionStart ?? 0;
          const se = el.selectionEnd ?? 0;
          console.log('selectionStart/End', ss, se);
          console.log(
            'prevLinear code units / grapheme-like',
            prevDoc.linear.length,
            revisioningGraphemeLikeCount(prevDoc.linear)
          );
          console.log('nextLinear code units / grapheme-like', next.length, revisioningGraphemeLikeCount(next));
          console.log('prevLinear preview', truncateForRevisioningLog(prevDoc.linear));
          console.log('nextLinear preview', truncateForRevisioningLog(next));
        });
      }

      const ops = linearEditToBatchOps(
        prevDoc.linear,
        next,
        prevDoc.meta,
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
    [readOnly, isOt, baseText, deletedMask, inserts, onApplyRevisionOps, onApplyOtCommit]
  );

  const onInput = React.useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      if (composingRef.current) return;
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
