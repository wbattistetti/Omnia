/**
 * Stato pannello esempi frase: combinatoria locale, Magic polish/creative, persistenza phrase.
 */

import React from 'react';
import {
  extractStyleTokenSurfacesFromText,
  messageHasStyleTokens,
  styleTokenIdFromSurface,
} from '@domain/useCaseBundle/agentMessageTokenSyntax';
import {
  examplesFromPlainTexts,
  getPrimaryPhraseStyleExamples,
  mergeStyleExamples,
  setPrimaryPhraseStyleExamples,
} from '@domain/useCaseBundle/stylePhraseExamplesHelpers';
import { buildMaterializedStylePhrases } from '@domain/useCaseBundle/styleTokenCombinatorics';
import type { AIAgentPhraseStyleExample } from '@domain/useCaseBundle/schema';
import type { AIAgentPhraseStyleToken } from '@domain/useCaseBundle/schema';
import type { AIAgentUseCase } from '@types/aiAgentUseCases';
import {
  generateStylePhraseCreativeApi,
  generateStylePhrasePolishApi,
  type AiCallMeta,
} from '@services/aiAgentDesignApi';
import {
  acceptStyleExample,
  patchStyleExample,
  removeStyleExample,
} from '@domain/useCaseBundle/stylePhraseExamplesHelpers';

export type StylePhraseAiConfig = {
  provider: string;
  model: string;
  outputLanguage?: string;
  callMeta?: AiCallMeta;
};

export type UseStylePhraseExamplesPanelOptions = {
  useCase: AIAgentUseCase;
  messageText: string;
  styleTokens: readonly AIAgentPhraseStyleToken[];
  onPatchUseCase: (updater: (uc: AIAgentUseCase) => AIAgentUseCase) => void;
  ai?: StylePhraseAiConfig | null;
};

export function useStylePhraseExamplesPanel({
  useCase,
  messageText,
  styleTokens,
  onPatchUseCase,
  ai = null,
}: UseStylePhraseExamplesPanelOptions) {
  const [open, setOpen] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);
  const [generating, setGenerating] = React.useState<'polish' | 'creative' | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const examples = getPrimaryPhraseStyleExamples(useCase);

  const hasStyleTokens = React.useMemo(
    () => styleTokens.length > 0 || messageHasStyleTokens(messageText),
    [styleTokens.length, messageText]
  );

  const effectiveStyleTokens = React.useMemo((): readonly AIAgentPhraseStyleToken[] => {
    if (styleTokens.length > 0) return styleTokens;
    return extractStyleTokenSurfacesFromText(messageText).map((surface) => ({
      styleTokenId: styleTokenIdFromSurface(surface),
      defaultSurface: surface,
      variants: [surface],
    }));
  }, [styleTokens, messageText]);

  const patchExamples = React.useCallback(
    (next: readonly AIAgentPhraseStyleExample[]) => {
      onPatchUseCase((uc) =>
        uc.id === useCase.id ? setPrimaryPhraseStyleExamples(uc, next) : uc
      );
    },
    [onPatchUseCase, useCase.id]
  );

  const loadLocalCombinatorics = React.useCallback(() => {
    if (!hasStyleTokens || effectiveStyleTokens.length === 0) return;
    const { phrases, truncated: t } = buildMaterializedStylePhrases(
      messageText,
      effectiveStyleTokens
    );
    const incoming = examplesFromPlainTexts(phrases, 'combinatoric', { accepted: false });
    patchExamples(mergeStyleExamples(examples, incoming));
    setTruncated(t);
    setOpen(true);
    setError(null);
  }, [
    hasStyleTokens,
    effectiveStyleTokens,
    messageText,
    examples,
    patchExamples,
  ]);

  const runPolish = React.useCallback(async () => {
    if (!ai?.provider || !ai?.model) {
      setError('Configura provider e modello IA nelle impostazioni.');
      return;
    }
    const { phrases, truncated: t } = buildMaterializedStylePhrases(
      messageText,
      effectiveStyleTokens
    );
    if (phrases.length === 0) {
      setError('Aggiungi varianti ai token di stile prima di rifinire.');
      return;
    }
    setGenerating('polish');
    setError(null);
    try {
      const polished = await generateStylePhrasePolishApi({
        template: messageText,
        styleTokens: [...effectiveStyleTokens],
        candidatePhrases: phrases,
        provider: ai.provider,
        model: ai.model,
        outputLanguage: ai.outputLanguage,
        callMeta: ai.callMeta,
      });
      const incoming = examplesFromPlainTexts(
        polished.length ? polished : phrases,
        'polish',
        { accepted: false }
      );
      patchExamples(mergeStyleExamples(examples, incoming));
      setTruncated(t);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(null);
    }
  }, [ai, messageText, effectiveStyleTokens, examples, patchExamples]);

  const runCreative = React.useCallback(async () => {
    if (!messageText.trim()) {
      setError('Inserisci un messaggio prima di generare varianti creative.');
      return;
    }
    if (!ai?.provider || !ai?.model) {
      setError('Configura provider e modello IA nelle impostazioni.');
      return;
    }
    setGenerating('creative');
    setError(null);
    try {
      const existing = examples.map((ex) => ex.plainText);
      const created = await generateStylePhraseCreativeApi({
        template: messageText,
        styleTokens: [...effectiveStyleTokens],
        existingPlainPhrases: existing,
        maxPhrases: 10,
        provider: ai.provider,
        model: ai.model,
        outputLanguage: ai.outputLanguage,
        callMeta: ai.callMeta,
      });
      const incoming = examplesFromPlainTexts(created, 'creative', { accepted: false });
      patchExamples(mergeStyleExamples(examples, incoming));
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(null);
    }
  }, [ai, messageText, effectiveStyleTokens, examples, patchExamples]);

  const handlers = React.useMemo(
    () => ({
      onAccept: (exampleId: string) => {
        onPatchUseCase((uc) =>
          uc.id === useCase.id ? acceptStyleExample(uc, exampleId) : uc
        );
      },
      onToggleAccepted: (exampleId: string, accepted: boolean) => {
        onPatchUseCase((uc) =>
          uc.id === useCase.id ? patchStyleExample(uc, exampleId, { accepted }) : uc
        );
      },
      onEdit: (exampleId: string, plainText: string) => {
        onPatchUseCase((uc) =>
          uc.id === useCase.id
            ? patchStyleExample(uc, exampleId, { plainText, source: 'manual' })
            : uc
        );
      },
      onRemove: (exampleId: string) => {
        onPatchUseCase((uc) =>
          uc.id === useCase.id ? removeStyleExample(uc, exampleId) : uc
        );
      },
    }),
    [onPatchUseCase, useCase.id]
  );

  React.useEffect(() => {
    if (!hasStyleTokens && examples.length === 0) setOpen(false);
  }, [hasStyleTokens, examples.length]);

  return {
    hasStyleTokens,
    open,
    setOpen,
    close: () => setOpen(false),
    examples,
    truncated,
    generating,
    error,
    canUseAi: Boolean(ai?.provider && ai?.model),
    loadLocalCombinatorics,
    runPolish,
    runCreative,
    handlers,
  };
}
