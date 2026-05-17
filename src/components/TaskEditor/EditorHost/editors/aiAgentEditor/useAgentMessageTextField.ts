/**
 * Selection + semantic/style token helpers for assistant message textareas.
 */

import React from 'react';
import {
  buildBracketWrapForSelection,
  buildStyleWrapForSelection,
  computeAgentTokenSelectionPopoverAction,
  findTokenSpanAtSelection,
  unwrapBracketTokenContainingSelection,
} from './agentMessageTokenHelpers';
import { getTextareaCaretViewportPoint } from './textareaCaretViewport';
import { buildTokenPopoverAnchorBelowCaret } from './agentMessageTokenPopoverAnchor';
export type { AgentMessageTokenPopoverAnchor } from './agentMessageTokenPopoverAnchor';

export type AgentMessageTextFieldMode = 'live' | 'silent' | 'commit';

export type UseAgentMessageTextFieldOptions = {
  text: string;
  disabled?: boolean;
  isEditing: boolean;
  onTextChange: (next: string, mode: AgentMessageTextFieldMode) => void;
  /** Dopo wrap `«…»` (surface = inner). */
  onStyleTokenWrap?: (surface: string) => void;
  /** Dopo untokenize di uno style token. */
  onStyleTokenUnwrap?: (surface: string) => void;
};

export function useAgentMessageTextField({
  text,
  disabled = false,
  isEditing,
  onTextChange,
  onStyleTokenWrap,
  onStyleTokenUnwrap,
}: UseAgentMessageTextFieldOptions) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [selection, setSelection] = React.useState({ start: 0, end: 0 });
  const [tokenAnchor, setTokenAnchor] = React.useState<{ top: number; left: number } | null>(null);
  const [pointerSelecting, setPointerSelecting] = React.useState(false);

  const getTextarea = React.useCallback(() => textareaRef.current, []);

  const syncSelection = React.useCallback(() => {
    const ta = getTextarea();
    if (!ta) return;
    if (document.activeElement !== ta) return;
    setSelection({ start: ta.selectionStart, end: ta.selectionEnd });
  }, [getTextarea]);

  React.useEffect(() => {
    if (!isEditing) return;
    setSelection({ start: 0, end: 0 });
    setTokenAnchor(null);
    setPointerSelecting(false);
  }, [isEditing]);

  React.useEffect(() => {
    if (!isEditing || disabled) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncSelection);
    };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('mouseup', schedule, true);
    return () => {
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('mouseup', schedule, true);
      cancelAnimationFrame(raf);
    };
  }, [isEditing, disabled, syncSelection]);

  React.useEffect(() => {
    if (!pointerSelecting) return;
    const end = () => setPointerSelecting(false);
    window.addEventListener('mouseup', end, true);
    window.addEventListener('touchend', end, true);
    return () => {
      window.removeEventListener('mouseup', end, true);
      window.removeEventListener('touchend', end, true);
    };
  }, [pointerSelecting]);

  const tokenPopoverAction = React.useMemo(
    () =>
      isEditing
        ? computeAgentTokenSelectionPopoverAction(text, selection.start, selection.end)
        : ('none' as const),
    [isEditing, text, selection.start, selection.end]
  );

  const tokenPopoverActionVisible = pointerSelecting ? ('none' as const) : tokenPopoverAction;

  const activeStyleTokenSpan = React.useMemo(() => {
    if (tokenPopoverAction !== 'untokenize') return null;
    const span = findTokenSpanAtSelection(text, selection.start, selection.end);
    return span?.kind === 'style' ? span : null;
  }, [tokenPopoverAction, text, selection.start, selection.end]);

  const recalcTokenAnchor = React.useCallback(() => {
    if (disabled || !isEditing || pointerSelecting) {
      setTokenAnchor(null);
      return;
    }
    const action = computeAgentTokenSelectionPopoverAction(text, selection.start, selection.end);
    if (action === 'none' || selection.start === selection.end) {
      setTokenAnchor(null);
      return;
    }
    const ta = getTextarea();
    if (!ta) {
      setTokenAnchor(null);
      return;
    }
    const caretIndex = Math.max(selection.start, selection.end);
    const pt = getTextareaCaretViewportPoint(ta, caretIndex);
    if (!pt) {
      setTokenAnchor(null);
      return;
    }
    const cs = window.getComputedStyle(ta);
    const lhParsed = Number.parseFloat(cs.lineHeight);
    const fontSize = Number.parseFloat(cs.fontSize) || 14;
    const lineHeightPx = Number.isFinite(lhParsed) ? lhParsed : fontSize * 1.25;
    setTokenAnchor(buildTokenPopoverAnchorBelowCaret(pt, lineHeightPx));
  }, [disabled, isEditing, pointerSelecting, text, selection, getTextarea]);

  React.useLayoutEffect(() => {
    recalcTokenAnchor();
  }, [recalcTokenAnchor]);

  const queueRecalcTokenAnchor = React.useCallback(() => {
    requestAnimationFrame(recalcTokenAnchor);
  }, [recalcTokenAnchor]);

  const applySelectionPatch = React.useCallback(
    (next: string, selStart: number, selEnd: number) => {
      onTextChange(next, 'silent');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = getTextarea();
          if (!el) return;
          el.focus();
          el.setSelectionRange(selStart, selEnd);
          setSelection({ start: selStart, end: selEnd });
        });
      });
    },
    [onTextChange, getTextarea]
  );

  const handleWrapSemanticToken = React.useCallback(() => {
    if (disabled || !isEditing) return;
    const ta = getTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    if (computeAgentTokenSelectionPopoverAction(text, start, end) !== 'tokenize') return;
    const built = buildBracketWrapForSelection(text, start, end);
    if (!built) return;
    applySelectionPatch(built.next, built.selStart, built.selEnd);
  }, [disabled, isEditing, text, getTextarea, applySelectionPatch]);

  const handleWrapStyleToken = React.useCallback(() => {
    if (disabled || !isEditing) return;
    const ta = getTextarea();
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) return;
    if (computeAgentTokenSelectionPopoverAction(text, start, end) !== 'tokenize') return;
    const built = buildStyleWrapForSelection(text, start, end);
    if (!built) return;
    onStyleTokenWrap?.(built.inner);
    applySelectionPatch(built.next, built.selStart, built.selEnd);
  }, [disabled, isEditing, text, getTextarea, applySelectionPatch, onStyleTokenWrap]);

  const handleDismissTokenPopover = React.useCallback(() => {
    const ta = getTextarea();
    const collapseAt = selection.end;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(collapseAt, collapseAt);
    }
    setSelection({ start: collapseAt, end: collapseAt });
    setTokenAnchor(null);
  }, [getTextarea, selection.end]);

  const handleUnwrapToken = React.useCallback(() => {
    if (disabled || !isEditing) return;
    const ta = getTextarea();
    if (!ta) return;
    const result = unwrapBracketTokenContainingSelection(text, ta.selectionStart, ta.selectionEnd);
    if (!result) return;
    if (result.kind === 'style') {
      onStyleTokenUnwrap?.(result.inner);
    }
    applySelectionPatch(result.next, result.selStart, result.selEnd);
  }, [disabled, isEditing, text, getTextarea, applySelectionPatch, onStyleTokenUnwrap]);

  const markPointerSelectingMouse = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setPointerSelecting(true);
  }, []);

  const markPointerSelectingTouch = React.useCallback(() => {
    setPointerSelecting(true);
  }, []);

  return {
    textareaRef,
    syncSelection,
    queueRecalcTokenAnchor,
    tokenPopoverActionVisible,
    tokenAnchor,
    activeStyleTokenSpan,
    handleWrapSemanticToken,
    handleWrapStyleToken,
    handleUnwrapToken,
    handleDismissTokenPopover,
    markPointerSelectingMouse,
    markPointerSelectingTouch,
  };
}
