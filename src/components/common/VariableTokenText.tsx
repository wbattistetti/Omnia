import React from 'react';
import { extractBracketTokens } from '../../utils/variableTokenText';
import { variableCreationService } from '../../services/VariableCreationService';
import type { VariableInstance } from '../../types/variableTypes';
import { useProjectTranslations } from '../../context/ProjectTranslationsContext';

type Props = {
  text: string;
  className?: string;
};

export default function VariableTokenText({ text, className }: Props) {
  const { translations } = useProjectTranslations();
  const tokenLabelById = React.useMemo(() => {
    let projectId = '';
    try {
      projectId = String(localStorage.getItem('currentProjectId') || '').trim();
    } catch {
      projectId = '';
    }
    if (!projectId) {
      return new Map<string, string>();
    }

    const vars = variableCreationService.getAllVariables(projectId) || [];
    const out = new Map<string, string>();
    vars.forEach((v) => {
      const id = String((v as VariableInstance)?.id || '').trim();
      if (!id) return;
      const fromTr = String(translations[id] ?? '').trim();
      const fromVar = String((v as VariableInstance)?.varName || '').trim();
      const label = fromTr || fromVar;
      if (!label) return;
      out.set(id, label);
    });
    return out;
  }, [text, translations]);

  const resolveTokenLabel = React.useCallback((rawValue: string): string => {
    const value = String(rawValue || '').trim();
    if (!value) return value;
    return tokenLabelById.get(value) || value;
  }, [tokenLabelById]);

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
