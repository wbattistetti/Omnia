/**
 * Stato UI: pannello esempi frase da combinazioni varianti style token.
 */

import React from 'react';
import {
  extractStyleTokenSurfacesFromText,
  messageHasStyleTokens,
  styleTokenIdFromSurface,
} from '@domain/useCaseBundle/agentMessageTokenSyntax';
import { buildMaterializedStylePhrases } from '@domain/useCaseBundle/styleTokenCombinatorics';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';

export type UseAgentMessageStyleExamplesOptions = {
  text: string;
  styleTokens: readonly AIAgentPhraseStyleToken[];
};

export function useAgentMessageStyleExamples({
  text,
  styleTokens,
}: UseAgentMessageStyleExamplesOptions) {
  const [open, setOpen] = React.useState(false);

  const hasStyleTokens = React.useMemo(
    () => styleTokens.length > 0 || messageHasStyleTokens(text),
    [styleTokens.length, text]
  );

  const effectiveStyleTokens = React.useMemo((): readonly AIAgentPhraseStyleToken[] => {
    if (styleTokens.length > 0) return styleTokens;
    return extractStyleTokenSurfacesFromText(text).map((surface) => ({
      styleTokenId: styleTokenIdFromSurface(surface),
      defaultSurface: surface,
      variants: [surface],
    }));
  }, [styleTokens, text]);

  const { phrases, truncated } = React.useMemo(() => {
    if (!hasStyleTokens || effectiveStyleTokens.length === 0) {
      return { phrases: [] as string[], truncated: false };
    }
    return buildMaterializedStylePhrases(text, effectiveStyleTokens);
  }, [hasStyleTokens, effectiveStyleTokens, text]);

  const canGenerate = hasStyleTokens && effectiveStyleTokens.length > 0 && phrases.length > 0;

  const toggleOpen = React.useCallback(() => {
    setOpen((v) => !v);
  }, []);

  const close = React.useCallback(() => {
    setOpen(false);
  }, []);

  React.useEffect(() => {
    if (!hasStyleTokens) setOpen(false);
  }, [hasStyleTokens]);

  return {
    hasStyleTokens,
    canGenerate,
    open,
    phrases,
    truncated,
    toggleOpen,
    close,
    setOpen,
  };
}
