import React from 'react';
import { extractBracketTokens } from '../../utils/variableTokenText';

type Props = {
  text: string;
  className?: string;
};

export default function VariableTokenText({ text, className }: Props) {
  const tokens = extractBracketTokens(text);
  if (tokens.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  tokens.forEach((t, i) => {
    if (t.start > cursor) {
      parts.push(<span key={`txt-${i}-${cursor}`}>{text.slice(cursor, t.start)}</span>);
    }
    parts.push(
      <strong key={`tok-${i}-${t.start}`} style={{ fontWeight: 700 }}>
        {text.slice(t.start, t.end)}
      </strong>
    );
    cursor = t.end;
  });
  if (cursor < text.length) {
    parts.push(<span key={`txt-tail-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <span className={className}>{parts}</span>;
}
