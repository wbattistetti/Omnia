import React from 'react';

/**
 * Helper to render phrase with highlighting based on spans
 */
export function renderPhraseWithSpans(phrase: string, spans?: Array<{ start: number; end: number }>) {
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
