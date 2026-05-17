/**
 * Sintassi messaggio agente: slot semantici `[…]` e style token `«…»`.
 */

export const SEMANTIC_TOKEN_PATTERN = /\[[^\[\]\r\n]+\]/g;
export const STYLE_TOKEN_PATTERN = /«[^«»\r\n]+»/g;
const COMBINED_TOKEN_PATTERN = /(\[[^\[\]\r\n]+\]|«[^«»\r\n]+»)/g;

export type AgentMessageTokenKind = 'semantic' | 'style';

export type AgentMessageTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'semantic'; text: string }
  | { kind: 'style'; text: string };

export type AgentTokenSpan = {
  kind: AgentMessageTokenKind;
  /** Testo completo incluso delimitatori (`[x]` o `«x»`). */
  text: string;
  /** Contenuto interno senza delimitatori. */
  inner: string;
  start: number;
  end: number;
};

export function styleTokenIdFromSurface(surface: string): string {
  const slug = surface
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `st-${slug || 'token'}`;
}

/** Superfici default (inner) di ogni `«…»` nel testo, in ordine di apparizione. */
export function extractStyleTokenSurfacesFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text ?? '').matchAll(STYLE_TOKEN_PATTERN)) {
    const full = m[0];
    out.push(full.slice(1, -1));
  }
  return out;
}

export function messageHasSemanticTokens(text: string): boolean {
  return /\[[^\]]+\]/.test(String(text ?? ''));
}

export function messageHasStyleTokens(text: string): boolean {
  return STYLE_TOKEN_PATTERN.test(String(text ?? ''));
}

export function messageHasAgentTokens(text: string): boolean {
  return messageHasSemanticTokens(text) || messageHasStyleTokens(text);
}

/** Segmenta il testo in parti testo / semantic / style. */
export function splitAgentMessageParts(text: string): AgentMessageTextPart[] {
  const s = String(text ?? '');
  const parts: AgentMessageTextPart[] = [];
  let lastIndex = 0;
  for (const match of s.matchAll(COMBINED_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ kind: 'text', text: s.slice(lastIndex, index) });
    }
    const tokenText = match[0];
    parts.push({
      kind: tokenText.startsWith('«') ? 'style' : 'semantic',
      text: tokenText,
    });
    lastIndex = index + tokenText.length;
  }
  if (lastIndex < s.length) {
    parts.push({ kind: 'text', text: s.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ kind: 'text', text: '' }];
}

/** Span del token (semantic o style) che contiene interamente la selezione. */
export function findAgentTokenSpanContainingSelection(
  text: string,
  start: number,
  end: number
): AgentTokenSpan | null {
  const s = String(text ?? '');
  const len = s.length;
  if (start < 0 || end < 0 || start > end || start > len || end > len) {
    return null;
  }
  for (const m of s.matchAll(COMBINED_TOKEN_PATTERN)) {
    const ms = m.index ?? 0;
    const tokenText = m[0];
    const me = ms + tokenText.length;
    if (ms <= start && end <= me) {
      const kind: AgentMessageTokenKind = tokenText.startsWith('«') ? 'style' : 'semantic';
      return {
        kind,
        text: tokenText,
        inner: tokenText.slice(kind === 'style' ? 1 : 1, -1),
        start: ms,
        end: me,
      };
    }
  }
  return null;
}
