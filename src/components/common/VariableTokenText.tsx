/**
 * Renders text containing `[variableId]` tokens; bracket bodies are GUIDs resolved via {@link getVariableLabel}.
 */
import React from 'react';
import { extractBracketTokens } from '../../utils/variableTokenText';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
import { getVariableLabel } from '../../utils/getVariableLabel';

type Props = {
  text: string;
  className?: string;
};

export default function VariableTokenText({ text, className }: Props) {
  const { translations } = useProjectTranslations();

  const resolveTokenLabel = React.useCallback(
    (rawValue: string): string => {
      const value = String(rawValue || '').trim();
      if (!value) return value;
      const label = getVariableLabel(value, translations);
      return label || value;
    },
    [translations]
  );

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
      <strong
        key={`tok-${i}-${t.start}`}
        style={{
          fontWeight: 700,
          whiteSpace: 'nowrap',
          display: 'inline-block',
        }}
      >
        [{resolveTokenLabel(t.value)}]
      </strong>
    );
    cursor = t.end;
  });
  if (cursor < text.length) {
    parts.push(<span key={`txt-tail-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <span className={className}>{parts}</span>;
}
