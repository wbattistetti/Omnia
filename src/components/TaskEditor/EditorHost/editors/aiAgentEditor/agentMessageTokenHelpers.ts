/**
 * Designer tooling for assistant message templates: bracket detection, global strip,
 * and selection-scoped helpers for the tokenize / untokenize popover.
 */

/** Same bracket-token rule as BracketTokenHighlightedTextarea (no nesting / no inner brackets). */
const BRACKET_TOKEN_PATTERN = /\[[^\[\]\r\n]+\]/g;

/** True if text contains at least one `[...]` span. */
export function messageHasSlotBrackets(text: string): boolean {
  return /\[[^\]]+\]/.test(String(text ?? ''));
}

/**
 * Removes `[slot]` wrappers while keeping inner text (undo token markup).
 */
export function stripAgentMessageSlotBrackets(text: string): string {
  return String(text ?? '').replace(/\[([^\]]+)\]/g, '$1');
}

export type AgentTokenSelectionPopoverAction = 'tokenize' | 'untokenize' | 'none';

/**
 * Decide whether the current textarea selection should offer «tokenize» (wrap in `[…]`)
 * or «untokenize» (remove the bracket span that fully contains the selection).
 */
export function computeAgentTokenSelectionPopoverAction(
  text: string,
  start: number,
  end: number
): AgentTokenSelectionPopoverAction {
  const s = String(text ?? '');
  const len = s.length;
  if (start === end || start < 0 || end < 0 || start > end || start > len || end > len) {
    return 'none';
  }
  const slice = s.slice(start, end);
  for (const m of s.matchAll(BRACKET_TOKEN_PATTERN)) {
    const ms = m.index ?? 0;
    const me = ms + m[0].length;
    if (ms <= start && end <= me) {
      return 'untokenize';
    }
  }
  if (!slice.trim()) {
    return 'none';
  }
  return 'tokenize';
}

/**
 * If the selection lies inside a single `[inner]` token, returns the string with that token’s
 * brackets removed and the selection range covering `inner`. Otherwise `null`.
 */
export function unwrapBracketTokenContainingSelection(
  text: string,
  start: number,
  end: number
): { next: string; selStart: number; selEnd: number } | null {
  const s = String(text ?? '');
  const len = s.length;
  if (start < 0 || end < 0 || start > end || start > len || end > len) {
    return null;
  }
  for (const m of s.matchAll(BRACKET_TOKEN_PATTERN)) {
    const ms = m.index ?? 0;
    const me = ms + m[0].length;
    if (ms <= start && end <= me) {
      const inner = s.slice(ms + 1, me - 1);
      const next = s.slice(0, ms) + inner + s.slice(me);
      return { next, selStart: ms, selEnd: ms + inner.length };
    }
  }
  return null;
}

/**
 * Wraps the **trimmed** substring between `[start, end)` in `[inner]` brackets, preserving
 * leading/trailing spaces outside the token. Returns `null` if the trimmed slice is empty.
 */
export function buildBracketWrapForSelection(
  content: string,
  start: number,
  end: number
): { next: string; selStart: number; selEnd: number } | null {
  const s = String(content ?? '');
  const len = s.length;
  if (start < 0 || end < 0 || start > end || start > len || end > len) {
    return null;
  }
  const rawSel = s.slice(start, end);
  const leading = rawSel.match(/^\s*/)?.[0].length ?? 0;
  const trailing = rawSel.match(/\s*$/)?.[0].length ?? 0;
  const trimStart = start + leading;
  const trimEnd = end - trailing;
  if (trimStart >= trimEnd) {
    return null;
  }
  const inner = s.slice(trimStart, trimEnd);
  if (!inner.trim()) {
    return null;
  }
  const wrapped = `[${inner}]`;
  const next = s.slice(0, trimStart) + wrapped + s.slice(trimEnd);
  const selStart = trimStart;
  const selEnd = trimStart + wrapped.length;
  return { next, selStart, selEnd };
}
