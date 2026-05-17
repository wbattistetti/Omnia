/**
 * Designer tooling for assistant message templates: semantic `[…]` and style `«…»` tokens.
 */

import {
  findAgentTokenSpanContainingSelection,
  messageHasAgentTokens,
  messageHasSemanticTokens,
  SEMANTIC_TOKEN_PATTERN,
  STYLE_TOKEN_PATTERN,
} from '@domain/useCaseBundle/agentMessageTokenSyntax';

export type { AgentMessageTokenKind, AgentMessageTextPart, AgentTokenSpan } from '@domain/useCaseBundle/agentMessageTokenSyntax';
export {
  extractStyleTokenSurfacesFromText,
  messageHasAgentTokens,
  messageHasSemanticTokens,
  messageHasStyleTokens,
  splitAgentMessageParts,
  styleTokenIdFromSurface,
} from '@domain/useCaseBundle/agentMessageTokenSyntax';

/** @deprecated Prefer {@link messageHasAgentTokens}. */
export function messageHasSlotBrackets(text: string): boolean {
  return messageHasAgentTokens(text);
}

/** Rimuove wrapper `[slot]` e `«style»` mantenendo il testo interno. */
export function stripAgentMessageSlotBrackets(text: string): string {
  return stripAgentMessageTokens(text);
}

/** Rimuove tutti i token agente (semantic + style). */
export function stripAgentMessageTokens(text: string): string {
  let s = String(text ?? '');
  s = s.replace(new RegExp(STYLE_TOKEN_PATTERN.source, 'g'), (m) => m.slice(1, -1));
  s = s.replace(/\[([^\]]+)\]/g, '$1');
  return s;
}

export type AgentTokenSelectionPopoverAction = 'tokenize' | 'untokenize' | 'none';

/**
 * «tokenize» se la selezione può essere avvolta; «untokenize» se è dentro un token.
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
  if (findAgentTokenSpanContainingSelection(s, start, end)) {
    return 'untokenize';
  }
  if (!s.slice(start, end).trim()) {
    return 'none';
  }
  return 'tokenize';
}

export function unwrapBracketTokenContainingSelection(
  text: string,
  start: number,
  end: number
): { next: string; selStart: number; selEnd: number; kind: 'semantic' | 'style'; inner: string } | null {
  const span = findAgentTokenSpanContainingSelection(text, start, end);
  if (!span) return null;
  const s = String(text ?? '');
  const next = s.slice(0, span.start) + span.inner + s.slice(span.end);
  return {
    next,
    selStart: span.start,
    selEnd: span.start + span.inner.length,
    kind: span.kind,
    inner: span.inner,
  };
}

function buildWrapForSelection(
  content: string,
  start: number,
  end: number,
  open: string,
  close: string
): { next: string; selStart: number; selEnd: number; inner: string } | null {
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
  if (trimStart >= trimEnd) return null;
  const inner = s.slice(trimStart, trimEnd);
  if (!inner.trim()) return null;
  const wrapped = `${open}${inner}${close}`;
  const next = s.slice(0, trimStart) + wrapped + s.slice(trimEnd);
  return { next, selStart: trimStart, selEnd: trimStart + wrapped.length, inner };
}

/** Avvolge la selezione (trim) in `[inner]`. */
export function buildBracketWrapForSelection(
  content: string,
  start: number,
  end: number
): { next: string; selStart: number; selEnd: number } | null {
  const built = buildWrapForSelection(content, start, end, '[', ']');
  if (!built) return null;
  return { next: built.next, selStart: built.selStart, selEnd: built.selEnd };
}

/** Avvolge la selezione (trim) in `«inner»`. */
export function buildStyleWrapForSelection(
  content: string,
  start: number,
  end: number
): { next: string; selStart: number; selEnd: number; inner: string } | null {
  return buildWrapForSelection(content, start, end, '«', '»');
}

export function findTokenSpanAtSelection(
  text: string,
  start: number,
  end: number
): ReturnType<typeof findAgentTokenSpanContainingSelection> {
  return findAgentTokenSpanContainingSelection(text, start, end);
}
