/**
 * Renders text containing `[variableId]` tokens; bracket bodies are GUIDs resolved via {@link resolveVariableDisplayName} (`flowCanvasToken`).
 */
import React from 'react';
import { extractBracketTokens } from '../../utils/variableTokenText';
import { useActiveFlowMetaTranslationsFlattened } from '../../hooks/useActiveFlowMetaTranslations';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';
import { resolveVariableDisplayName } from '../../utils/resolveVariableDisplayName';

type Props = {
  text: string;
  className?: string;
};

export default function VariableTokenText({ text, className }: Props) {
  const flowMetaTranslations = useActiveFlowMetaTranslationsFlattened();
  const { compiledTranslations } = useProjectTranslations();

  const resolveTokenLabel = React.useCallback(
    (rawValue: string): string => {
      const value = String(rawValue || '').trim();
      if (!value) return value;
      return resolveVariableDisplayName(value, 'flowCanvasToken', {
        flowMetaTranslations,
        compiledTranslations,
      });
    },
    [flowMetaTranslations, compiledTranslations]
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
