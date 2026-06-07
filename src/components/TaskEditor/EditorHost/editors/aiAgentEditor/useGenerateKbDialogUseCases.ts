/**
 * Hook: genera UC dialogo KB da documenti approvati e aggiorna bundle + runtime index.
 */

import React from 'react';
import type { AIAgentUseCase, AIAgentUseCaseCategory } from '@types/aiAgentUseCases';
import { parseAgentKnowledgeBaseDocumentsJson } from '@domain/knowledgeBase/serializeKbDocuments';
import { listKbDocumentsReadyForDialogDeploy } from '@domain/convai/kbDialogDeployReadiness';
import { generateKbDialogUseCasesFromDocument } from '@domain/knowledgeBase/kbDialog/generateKbDialogFromDocument';
import { serializeKbDialogRuntimeIndex } from '@domain/knowledgeBase/kbDialog/kbDialogUseCaseGeneration';
import { hasBlockingKbDialogGapIssues } from '@domain/knowledgeBase/kbDialog/kbDialogGapAnalysis';
import type { KbDialogGapIssue } from '@domain/knowledgeBase/kbDialog/kbDialogTypes';

export type GenerateKbDialogUseCasesOutcome = {
  useCases: AIAgentUseCase[];
  categories: AIAgentUseCaseCategory[];
  agentKbDialogIndexJson: string;
  gapIssues: KbDialogGapIssue[];
  kbDocumentId: string;
  updatedKbDocumentsJson: string;
};

export function useGenerateKbDialogUseCases(params: {
  agentKnowledgeBaseDocumentsJson: string;
}): {
  generate: () => GenerateKbDialogUseCasesOutcome | { error: string };
  busy: boolean;
} {
  const [busy, setBusy] = React.useState(false);

  const generate = React.useCallback((): GenerateKbDialogUseCasesOutcome | { error: string } => {
    const ready = listKbDocumentsReadyForDialogDeploy(params.agentKnowledgeBaseDocumentsJson);
    if (ready.length === 0) {
      return { error: 'Nessun documento KB approvato con selectorSpec.' };
    }
    const doc = ready[0]!;
    setBusy(true);
    try {
      const gen = generateKbDialogUseCasesFromDocument(doc);
      if (!gen.ok) {
        return { error: gen.error };
      }

      const docs = parseAgentKnowledgeBaseDocumentsJson(params.agentKnowledgeBaseDocumentsJson);
      const updatedKbDocumentsJson = JSON.stringify(
        docs.map((d) =>
          d.id === doc.id ? { ...d, documentSelectorSpec: gen.updatedSelectorSpec } : d
        )
      );

      return {
        useCases: gen.result.useCases,
        categories: gen.result.categories,
        agentKbDialogIndexJson: serializeKbDialogRuntimeIndex(gen.result.runtimeIndex),
        gapIssues: gen.result.gapIssues,
        kbDocumentId: doc.id,
        updatedKbDocumentsJson,
      };
    } finally {
      setBusy(false);
    }
  }, [params.agentKnowledgeBaseDocumentsJson]);

  return { generate, busy };
}

export function formatKbDialogGapSummary(
  issues: readonly KbDialogGapIssue[] | undefined | null
): string {
  if (!issues || issues.length === 0) return 'Gap analysis: nessun problema.';
  const blocking = hasBlockingKbDialogGapIssues(issues);
  const lines = issues.slice(0, 6).map((i) => i.message);
  return `${blocking ? 'Blocchi deploy:' : 'Avvisi:'} ${lines.join(' · ')}`;
}
