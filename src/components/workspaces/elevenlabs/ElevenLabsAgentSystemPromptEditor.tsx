/**
 * Editable agent system prompt (Markdown) with Analyze / Aggrega KB — shared by Agente and inspector Generale.
 */

import React from 'react';
import type { KbLocalSnippetInput } from '@workspaces/elevenlabs/api/kbPromptApi';
import {
  aggregateKbSystemPrompt,
  refineKbSystemPrompt,
} from '@workspaces/elevenlabs/api/kbPromptApi';
import { useAIProvider } from '@context/AIProviderContext';
import { useAiBusyLabel } from '@hooks/useAiBusyLabel';
import { SystemPromptEditor } from './kb/SystemPromptEditor';

export type ElevenLabsAgentSystemPromptEditorProps = {
  systemPromptMarkdown: string;
  onSystemPromptChange: (markdown: string) => void;
  collectKbSnippets: () => readonly KbLocalSnippetInput[];
  editorHeightPx?: number;
};

export function ElevenLabsAgentSystemPromptEditor({
  systemPromptMarkdown,
  onSystemPromptChange,
  collectKbSnippets,
  editorHeightPx = 280,
}: ElevenLabsAgentSystemPromptEditorProps): React.ReactElement {
  const { provider, model } = useAIProvider();
  const { hasModel } = useAiBusyLabel();
  const [analyzeBusy, setAnalyzeBusy] = React.useState(false);
  const [aggregateBusy, setAggregateBusy] = React.useState(false);
  const [editorError, setEditorError] = React.useState<string | null>(null);

  const kbSnippets = React.useMemo(() => collectKbSnippets(), [collectKbSnippets]);
  const snippetCount = kbSnippets.length;

  const requireModel = React.useCallback((): boolean => {
    if (!hasModel || !model.trim()) {
      setEditorError('Seleziona un modello IA in Impostazioni (Omnia Tutor).');
      return false;
    }
    return true;
  }, [hasModel, model]);

  const handleAnalyze = React.useCallback(async () => {
    if (!requireModel()) return;
    const text = systemPromptMarkdown.trim();
    if (text.length < 12) {
      setEditorError('Scrivi almeno qualche riga di prompt prima di Analyze.');
      return;
    }
    setAnalyzeBusy(true);
    setEditorError(null);
    try {
      const markdown = await refineKbSystemPrompt({
        existingPromptMarkdown: text,
        provider,
        model,
        outputLanguage: 'it-IT',
        callMeta: { purpose: 'EL_KB_REFINE_PROMPT' },
      });
      onSystemPromptChange(markdown);
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzeBusy(false);
    }
  }, [requireModel, systemPromptMarkdown, provider, model, onSystemPromptChange]);

  const handleAggregateKb = React.useCallback(async () => {
    if (!requireModel()) return;
    if (snippetCount === 0) {
      setEditorError('Genera almeno uno snippet Markdown su un nodo KB, poi Aggrega KB.');
      return;
    }
    setAggregateBusy(true);
    setEditorError(null);
    try {
      const markdown = await aggregateKbSystemPrompt({
        localSnippets: kbSnippets,
        existingPromptMarkdown: systemPromptMarkdown,
        provider,
        model,
        outputLanguage: 'it-IT',
        callMeta: { purpose: 'EL_KB_AGGREGATE' },
      });
      onSystemPromptChange(markdown);
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : String(e));
    } finally {
      setAggregateBusy(false);
    }
  }, [
    requireModel,
    snippetCount,
    kbSnippets,
    systemPromptMarkdown,
    provider,
    model,
    onSystemPromptChange,
  ]);

  return (
    <SystemPromptEditor
      value={systemPromptMarkdown}
      onChange={onSystemPromptChange}
      onAnalyze={handleAnalyze}
      analyzeBusy={analyzeBusy}
      analyzeDisabled={!hasModel}
      onAggregateKb={handleAggregateKb}
      aggregateBusy={aggregateBusy}
      aggregateDisabled={!hasModel || snippetCount === 0}
      aggregateSnippetCount={snippetCount}
      error={editorError}
      editorHeightPx={editorHeightPx}
    />
  );
}
